# Cliente de CAPE SecretManager para PowerShell (Windows). Corre «cape» (el de bash) con Git Bash.
# No llama a «bash» a secas: en Windows puede ser el de WSL, que tiene otro $HOME y no ve ~/.cape.
#   & ~/.cape/cape.ps1 lista
#   & ~/.cape/cape.ps1 ssh vps "docker ps"
# Para comandos con comillas dentro, mejor desde Git Bash: PowerShell 5.1 las recorta al pasarlas.
$ErrorActionPreference = 'Stop'
$cape = Join-Path $PSScriptRoot 'cape'
if (-not (Test-Path $cape)) { Write-Error "No encuentro $cape (cópialo junto a este archivo: docs/3-ia.md)"; exit 1 }

$bash = $env:CAPE_BASH
if (-not $bash) {
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  $candidatos = @()
  if ($git) { $candidatos += Join-Path (Split-Path (Split-Path $git.Source)) 'bin\bash.exe' }
  $candidatos += "$env:ProgramFiles\Git\bin\bash.exe", "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
  $bash = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $bash) { Write-Error 'Falta Git Bash: instala Git para Windows (https://git-scm.com/download/win) o define CAPE_BASH.'; exit 1 }

& $bash $cape @args
exit $LASTEXITCODE
