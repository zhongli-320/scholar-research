param(
    [switch]$CheckOnly,
    [ValidateRange(1,65535)][int]$PaperSeekPort = 8767,
    [ValidateRange(1,65535)][int]$BackendPort = 8000,
    [ValidateRange(1,65535)][int]$FrontendPort = 3000
)
$ErrorActionPreference = 'Stop'

function Resolve-ServiceAction([bool]$Ready, [bool]$PortOpen) {
    if ($Ready) { return 'reuse' }
    if ($PortOpen) { return 'blocked' }
    return 'start'
}
function Test-Ready($service) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $service.Url -TimeoutSec 3 -MaximumRedirection 0
        if ($response.StatusCode -ne 200) { return $false }
        if ($service.Name -eq 'PaperSeek' -or $service.Name -eq 'GPT Researcher') {
            if (-not $response.Content.TrimStart().StartsWith('{')) { return $false }
            $body = $response.Content | ConvertFrom-Json
            if ($body -isnot [pscustomobject]) { return $false }
            if ($service.Name -eq 'PaperSeek') { return ($body.status -is [string] -and $body.status -ceq 'ready') }
            $origin = ([Uri]$service.Url).GetLeftPart([System.UriPartial]::Authority)
            if (($body.agent_discovery_version -isnot [string] -or $body.agent_discovery_version -cne '0.1') -or $body.services -isnot [array]) { return $false }
            foreach ($item in $body.services) { if ($item -isnot [pscustomobject]) { return $false } }
            $research = @($body.services | Where-Object { $_ -is [pscustomobject] -and $_.name -is [string] -and $_.name -ceq 'research' -and $_.endpoint -is [string] -and $_.endpoint -ceq "$origin/report/" -and $_.description -is [string] -and $_.description -ceq 'Submit a research job and generate a report.' })
            $reports = @($body.services | Where-Object { $_ -is [pscustomobject] -and $_.name -is [string] -and $_.name -ceq 'reports' -and $_.endpoint -is [string] -and $_.endpoint -ceq "$origin/api/reports" })
            $chat = @($body.services | Where-Object { $_ -is [pscustomobject] -and $_.name -is [string] -and $_.name -ceq 'chat' -and $_.endpoint -is [string] -and $_.endpoint -ceq "$origin/api/chat" })
            $stream = @($body.services | Where-Object { $_ -is [pscustomobject] -and $_.name -is [string] -and $_.name -ceq 'research_stream' -and $_.endpoint -is [string] -and $_.endpoint -ceq ($origin.Replace('http://', 'ws://') + '/ws') })
            return ($research.Count -eq 1 -and $reports.Count -eq 1 -and $chat.Count -eq 1 -and $stream.Count -eq 1)
        }
        return $response.Content.Contains('data-research-workbench="literature"')
    } catch { return $false }
}
function Test-PortOpen([int]$Port) {
    return [bool](@([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port }).Count)
}
$services = @(
    @{ Name='PaperSeek'; Port=$PaperSeekPort; Url="http://127.0.0.1:$PaperSeekPort/ready" },
    @{ Name='GPT Researcher'; Port=$BackendPort; Url="http://127.0.0.1:$BackendPort/.well-known/agent-discovery.json" },
    @{ Name='Next.js'; Port=$FrontendPort; Url="http://127.0.0.1:$FrontendPort/" }
)
if (@($services.Port | Select-Object -Unique).Count -ne 3) { throw 'Service ports must be distinct.' }
# One local lock covers overlapping port selections as well as identical ones.
$mutex = $null
$locked = $false
try {
    if (-not $CheckOnly) {
        $mutex = New-Object System.Threading.Mutex($false, 'Local\ResearchWorkbenchLauncher-1e957e45')
        try { $locked = $mutex.WaitOne() } catch [System.Threading.AbandonedMutexException] { $locked = $true }
    }
foreach ($service in $services) {
    $service.Action = Resolve-ServiceAction (Test-Ready $service) (Test-PortOpen $service.Port)
    Write-Output "$($service.Name) port $($service.Port): $($service.Action)"
}
if (@($services | Where-Object Action -eq 'blocked').Count) { throw 'An occupied port is not healthy; no service was started.' }
if ($services[1].Action -eq 'reuse' -and $FrontendPort -ne 3000) { Write-Warning 'Reused backend: verify CORS permits the selected frontend port.' }
if ($services[2].Action -eq 'reuse') { Write-Warning 'Reused frontend: verify its configured backend and PaperSeek ports match the selected ports.' }
if ($CheckOnly) { return }

if (-not @($services | Where-Object Action -eq 'start').Count) { return }
$env:PAPERSEEK_API_URL = "http://127.0.0.1:$PaperSeekPort"
$env:NEXT_PUBLIC_GPTR_API_URL = "http://127.0.0.1:$BackendPort"
$env:NEXT_PUBLIC_BACKEND_URL = $env:NEXT_PUBLIC_GPTR_API_URL
$env:WORKBENCH_FRONTEND_ORIGIN = "http://127.0.0.1:$FrontendPort"
foreach ($service in $services) {
    if ($service.Action -eq 'reuse') { continue }
    # Recheck immediately before launching in case another process claimed the port.
    $action = Resolve-ServiceAction (Test-Ready $service) (Test-PortOpen $service.Port)
    if ($action -eq 'reuse') { Write-Output "$($service.Name): reuse"; continue }
    if ($action -eq 'blocked') { throw "$($service.Name) port $($service.Port) is occupied; no process was stopped." }
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    if ($service.Name -ne 'Next.js') {
        $commonDir = (& git -C $root rev-parse --git-common-dir)
        if ($LASTEXITCODE -ne 0) { throw 'Cannot locate the main repository.' }
        if (-not [System.IO.Path]::IsPathRooted($commonDir)) { $commonDir = Join-Path $root $commonDir }
        $mainRepo = Split-Path (Resolve-Path -LiteralPath $commonDir).Path
    }
    switch ($service.Name) {
        'PaperSeek' { $paperDir = (Resolve-Path (Join-Path (Split-Path $mainRepo) 'paperseek')).Path; $exe = (Resolve-Path (Join-Path $paperDir '.venv\Scripts\python.exe')).Path; $arguments = "-m paperseek_community.cli serve --port $PaperSeekPort"; $working = $paperDir; $logName = 'paperseek' }
        'GPT Researcher' {
            $exe = (Resolve-Path (Join-Path $mainRepo '.venv\Scripts\python.exe')).Path; $envFile = Join-Path $root '.env'; if (-not (Test-Path -LiteralPath $envFile)) { $envFile = Join-Path $mainRepo '.env' }; $arguments = "-m uvicorn backend.server.app:app --host 127.0.0.1 --port $BackendPort --app-dir `"$root`""
            if (Test-Path -LiteralPath $envFile) { $arguments += ' --env-file "' + $envFile + '"' }
            $working = $mainRepo; $logName = 'backend'
        }
        'Next.js' { $frontDir = (Resolve-Path (Join-Path $root 'frontend\nextjs')).Path; $npm = (Get-Command npm.cmd -ErrorAction Stop).Source; $exe = $env:ComSpec; $arguments = '/d /c ""' + $npm + '" run dev -- -H 127.0.0.1 -p ' + $FrontendPort + '"'; $working = $frontDir; $logName = 'frontend' }
    }
    $logDir = Join-Path $root 'logs\workbench'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $stdout = Join-Path $logDir "$logName.stdout.log"
    $stderr = Join-Path $logDir "$logName.stderr.log"
    try {
        Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $working -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr | Out-Null
    } catch { throw "$($service.Name) failed to start. Logs: $stdout and $stderr. Error: $($_.Exception.Message)" }
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Ready $service) { $ready = $true; break }
    }
    if (-not $ready) { throw "$($service.Name) did not become ready. Logs: $stdout and $stderr" }
    Write-Output "$($service.Name): ready"
}
Write-Output "Workbench: http://127.0.0.1:$FrontendPort/"
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
