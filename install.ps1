# Instalador do claude-switcher pra PowerShell.
#
# Uso:
#   git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
#   cd claude-code-multi-account
#   .\install.ps1
#
# Instala o núcleo (npm install -g a partir do clone local, sem depender de
# git-fetch do npm) e já registra o wrapper no seu $PROFILE, sem precisar
# editar nada na mão. Idempotente: rodar de novo não duplica a linha.

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js não encontrado. Instale o Node antes de continuar (se você já roda o Claude Code, provavelmente já tem)."
    exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm não encontrado."
    exit 1
}

Write-Host "Instalando claude-switcher-core..."
& npm install -g $ScriptDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao instalar o núcleo via npm."
    exit 1
}
Write-Host "  núcleo instalado."

if (-not (Test-Path $PROFILE)) {
    New-Item -ItemType File -Path $PROFILE -Force | Out-Null
}

$Line = ". `"$ScriptDir\powershell\claude-switcher.ps1`""
$Existing = Get-Content $PROFILE -ErrorAction SilentlyContinue
if ($Existing -notcontains $Line) {
    Add-Content -Path $PROFILE -Value "`n$Line"
    Write-Host "  wrapper registrado em `$PROFILE ($PROFILE)."
} else {
    Write-Host "  wrapper já estava registrado em `$PROFILE."
}

Write-Host ""
Write-Host "Pronto. Abra um PowerShell novo (ou rode '. `$PROFILE') e execute:"
Write-Host "  claude-profile add"
