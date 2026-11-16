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
Write-Output 'Decision tests passed'
