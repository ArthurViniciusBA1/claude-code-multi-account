# Instalador do claude-switcher pra PowerShell.
#
# Uso:
#   git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
#   cd claude-code-multi-account
#   .\install.ps1
#
# Se o Claude Code (`claude`) ainda não estiver instalado, pergunta (S/N)
# antes de instalar via npm — nunca instala sem confirmação.
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

# --- 0. Claude Code em si (opcional, pergunta antes) ---

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    if (-not [Console]::IsInputRedirected) {
        $Answer = Read-Host 'Claude Code (comando "claude") não encontrado. Instalar agora via npm? [s/N]'
        if ($Answer -match '^[sSyY]') {
            Write-Host "Instalando @anthropic-ai/claude-code..."
            & npm install -g "@anthropic-ai/claude-code"
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Falha ao instalar o Claude Code via npm."
                exit 1
            }
            $ClaudeCmd = Get-Command claude -ErrorAction SilentlyContinue
            $Verified = $false
            if ($ClaudeCmd) {
                & claude --version *> $null
                $Verified = ($LASTEXITCODE -eq 0)
            }
            if ($Verified) {
                Write-Host "  Claude Code instalado e funcionando."
            } else {
                Write-Warning 'o npm instalou o pacote, mas "claude --version" falhou (ou o binário não apareceu no PATH ainda) — abra um PowerShell novo e tente "claude --version"; se continuar falhando, rode de novo: npm install -g @anthropic-ai/claude-code'
            }
        } else {
            Write-Warning "Claude Code não instalado. O wrapper vai funcionar assim que você instalar (veja: https://docs.claude.com/claude-code)."
        }
    } else {
        Write-Warning 'Claude Code (comando "claude") não encontrado, e este terminal não é interativo pra perguntar. Pulei a instalação.'
    }
}

# --- 1. Instala o núcleo (claude-switcher-core) ---

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
