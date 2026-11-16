$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path $PSScriptRoot 'start-research-workbench.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($scriptPath, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Launcher could not be parsed' }
$function = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-ServiceAction' }, $true)
if (-not $function) { throw 'Resolve-ServiceAction missing' }
Invoke-Expression $function.Extent.Text
foreach ($case in @(@($true,$true,'reuse'), @($true,$false,'reuse'), @($false,$false,'start'), @($false,$true,'blocked'))) {
    $actual = Resolve-ServiceAction $case[0] $case[1]
    if ($actual -ne $case[2]) { throw "Expected $($case[2]), got $actual" }
}
$source = Get-Content -Raw -LiteralPath $scriptPath
if ($source -match '(?i)Stop-Process|\bkill\b|Get-Random') { throw 'Forbidden process or port operation' }
if ($source -match '/files/') { throw 'Launcher must not probe files' }
Write-Output 'Decision tests passed'

function Invoke-WebRequest { param($Uri, $TimeoutSec, [switch]$UseBasicParsing, $MaximumRedirection) if ($MaximumRedirection -ne 0) { throw "Redirects must be disabled" }; return $script:response }
$readyFunction = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-Ready' }, $true)
Invoke-Expression $readyFunction.Extent.Text
foreach ($name in 'GPT Researcher','Next.js') {
    $script:response = @{ StatusCode=200; Content='<html>other app</html>'; Headers=@{} }
    if (Test-Ready @{ Name=$name; Url='http://localhost/' }) { throw "$name accepted an unrelated page" }
}
$script:response = @{ StatusCode=200; Content='{"agent_discovery_version":"0.1","services":[{"name":"research","endpoint":"http://localhost/report/","description":"Submit a research job and generate a report."},{"name":"reports","endpoint":"http://localhost/api/reports"},{"name":"chat","endpoint":"http://localhost/api/chat"},{"name":"research_stream","endpoint":"ws://localhost/ws"}]}'; Headers=@{} }
if (-not (Test-Ready @{Name='GPT Researcher'; Url='http://localhost/.well-known/agent-discovery.json'})) { throw 'Backend identity rejected' }
$script:response = @{ StatusCode=200; Content='<main data-research-workbench="literature"></main>'; Headers=@{} }
if (-not (Test-Ready @{Name='Next.js'; Url='http://localhost/'})) { throw 'Frontend identity rejected' }
$script:response = @{ StatusCode=200; Content='{"status":"ready"}'; Headers=@{} }
if (-not (Test-Ready @{Name='PaperSeek'; Url='http://localhost/ready'})) { throw 'PaperSeek readiness rejected' }
$script:response = @{ StatusCode=302; Content=''; Headers=@{} }
if (Test-Ready @{Name='PaperSeek'; Url='http://localhost/ready'}) { throw 'Redirect accepted' }
$script:response = @{ StatusCode=200; Content='{"agent_discovery_version":"0.1","services":[]}'; Headers=@{} }
if (Test-Ready @{Name='GPT Researcher'; Url='http://localhost/.well-known/agent-discovery.json'}) { throw 'Invalid discovery document accepted' }
$probeReady = $readyFunction.Extent.Text
$probePort = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-PortOpen' }, $true).Extent.Text
$mocked = $source.Replace($probeReady, 'function Test-Ready($service) { return $false }').Replace($probePort, 'function Test-PortOpen([int]$Port) { return $script:portOpen }')
function Start-Process { throw 'Start-Process must not be called' }
function New-Item { throw 'New-Item must not be called' }
$script:portOpen = $false
& ([scriptblock]::Create($mocked)) -CheckOnly | Out-Null
$script:portOpen = $true
$blocked = $false
try { & ([scriptblock]::Create($mocked)) | Out-Null } catch { if ($_ -match 'occupied port') { $blocked = $true } else { throw } }
if (-not $blocked) { throw 'Blocked scenario did not abort' }
Write-Output 'Probe and early-exit tests passed'
