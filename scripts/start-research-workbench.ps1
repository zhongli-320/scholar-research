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
        if ($service.Name -eq 'PaperSeek') { return (($response.Content | ConvertFrom-Json).status -eq 'ready') }
        if ($service.Name -eq 'GPT Researcher') {
            $body = $response.Content | ConvertFrom-Json
            $origin = ([Uri]$service.Url).GetLeftPart([System.UriPartial]::Authority)
            if ($body.agent_discovery_version -ne '0.1' -or $body.services -isnot [array]) { return $false }
            $research = @($body.services | Where-Object { $_.name -eq 'research' -and $_.endpoint -eq "$origin/report/" -and $_.description -eq 'Submit a research job and generate a report.' })
            $reports = @($body.services | Where-Object { $_.name -eq 'reports' -and $_.endpoint -eq "$origin/api/reports" })
            $chat = @($body.services | Where-Object { $_.name -eq 'chat' -and $_.endpoint -eq "$origin/api/chat" })
            $stream = @($body.services | Where-Object { $_.name -eq 'research_stream' -and $_.endpoint -eq ($origin.Replace('http://', 'ws://') + '/ws') })
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
foreach ($service in $services) {
    $service.Action = Resolve-ServiceAction (Test-Ready $service) (Test-PortOpen $service.Port)
    Write-Output "$($service.Name) port $($service.Port): $($service.Action)"
}
if (@($services | Where-Object Action -eq 'blocked').Count) { throw 'An occupied port is not healthy; no service was started.' }
if ($services[1].Action -eq 'reuse' -and $FrontendPort -ne 3000) { Write-Warning 'Reused backend: verify CORS permits the selected frontend port.' }
if ($services[2].Action -eq 'reuse') { Write-Warning 'Reused frontend: verify its configured backend and PaperSeek ports match the selected ports.' }
if ($CheckOnly) { return }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$commonDir = (& git -C $root rev-parse --git-common-dir)
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate the main repository.' }
if (-not [System.IO.Path]::IsPathRooted($commonDir)) { $commonDir = Join-Path $root $commonDir }
$mainRepo = Split-Path (Resolve-Path -LiteralPath $commonDir).Path
$paperDir = (Resolve-Path (Join-Path (Split-Path $mainRepo) 'paperseek')).Path
$paperPython = (Resolve-Path (Join-Path $paperDir '.venv\Scripts\python.exe')).Path
$backendPython = (Resolve-Path (Join-Path $mainRepo '.venv\Scripts\python.exe')).Path
$frontDir = (Resolve-Path (Join-Path $root 'frontend\nextjs')).Path
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$logDir = Join-Path $root 'logs\workbench'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$env:PAPERSEEK_API_URL = "http://127.0.0.1:$PaperSeekPort"
$env:NEXT_PUBLIC_GPTR_API_URL = "http://127.0.0.1:$BackendPort"
$env:NEXT_PUBLIC_BACKEND_URL = $env:NEXT_PUBLIC_GPTR_API_URL
$env:WORKBENCH_FRONTEND_ORIGIN = "http://127.0.0.1:$FrontendPort"
$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) { $envFile = Join-Path $mainRepo '.env' }
foreach ($service in $services) {
    if ($service.Action -eq 'reuse') { continue }
    # Recheck immediately before launching in case another process claimed the port.
    $action = Resolve-ServiceAction (Test-Ready $service) (Test-PortOpen $service.Port)
    if ($action -eq 'reuse') { Write-Output "$($service.Name): reuse"; continue }
    if ($action -eq 'blocked') { throw "$($service.Name) port $($service.Port) is occupied; no process was stopped." }
    switch ($service.Name) {
        'PaperSeek' { $exe = $paperPython; $arguments = "-m paperseek_community.cli serve --port $PaperSeekPort"; $working = $paperDir; $logName = 'paperseek' }
        'GPT Researcher' {
            $exe = $backendPython; $arguments = "-m uvicorn backend.server.app:app --host 127.0.0.1 --port $BackendPort --app-dir `"$root`""
            if (Test-Path -LiteralPath $envFile) { $arguments += ' --env-file "' + $envFile + '"' }
            $working = $mainRepo; $logName = 'backend'
        }
        'Next.js' { $exe = $env:ComSpec; $arguments = '/d /c ""' + $npm + '" run dev -- -H 127.0.0.1 -p ' + $FrontendPort + '"'; $working = $frontDir; $logName = 'frontend' }
    }
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
