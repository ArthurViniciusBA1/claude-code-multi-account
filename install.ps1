# Instalador do claude-switcher pra PowerShell.
#
# Uso (recomendado — carrega o comando "claude" nesta mesma sessão, sem
# precisar abrir um terminal novo depois):
#   git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
#   cd claude-code-multi-account
#   . .\install.ps1
#
# (repare no ". " antes do caminho — isso roda o script "dot-sourced",
# carregando o wrapper na sessão atual. Rodar só ".\install.ps1", sem o
# ponto, também funciona, mas aí precisa abrir um terminal novo depois.)
#
# Se o Claude Code (`claude`) ainda não estiver instalado, pergunta (S/N)
# antes de instalar via npm — nunca instala sem confirmação.
#
# Instala o núcleo (npm install -g a partir do clone local, sem depender de
# git-fetch do npm) e já registra o wrapper no seu $PROFILE, sem precisar
# editar nada na mão. Idempotente: rodar de novo não duplica a linha.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Install-ClaudeSwitcherCore {
    # Tudo dentro de uma função e usando "return" (nunca "exit") pra sair
    # cedo em caso de erro: um "exit" bruto, quando o script é rodado com
    # ". .\install.ps1" (dot-sourced), fecharia a janela inteira do
    # PowerShell em vez de só interromper o script. Retorna $true/$false
    # indicando sucesso. O dot-source final do wrapper fica FORA desta
    # função de propósito: dot-sourcing feito dentro de uma função só
    # alcança o escopo da própria função, não o de quem chamou — só um
    # dot-source no nível superior do script propaga pra sessão de quem
    # rodou ". .\install.ps1".

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js não encontrado. Instale o Node antes de continuar (se você já roda o Claude Code, provavelmente já tem)."
        return $false
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "npm não encontrado."
        return $false
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
                    return $false
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
        return $false
    }
    Write-Host "  núcleo instalado."

    # --- 2. Registra o wrapper no $PROFILE ---

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

    return $true
}

try {
    $InstallOk = Install-ClaudeSwitcherCore
} catch {
    # Rede de segurança: se algo aqui virar um erro terminante (por
    # exemplo, se a sessão de quem chamou já tiver
    # $ErrorActionPreference = "Stop" configurado globalmente), pegamos
    # aqui em vez de deixar propagar e, no caso de ". .\install.ps1",
    # arriscar fechar a sessão inteira.
    Write-Error "Instalação falhou: $_"
    $InstallOk = $false
}

if ($InstallOk) {
    # Dot-source no nível superior do script (fora de qualquer função): se
    # quem chamou rodou ". .\install.ps1", isso propaga "claude" e
    # "claude-profile" pra sessão de quem chamou. Se rodou só
    # ".\install.ps1" (sem o ponto), fica isolado no processo filho e não
    # aparece na sessão de quem chamou — nesse caso é preciso abrir um
    # terminal novo mesmo.
    . "$ScriptDir\powershell\claude-switcher.ps1"

    Write-Host ""
    Write-Host "Pronto."
    Write-Host 'Se você rodou este instalador com ". .\install.ps1" (com o ponto), o'
    Write-Host 'comando "claude" já está disponível nesta sessão — pode rodar:'
    Write-Host "  claude-profile add"
    Write-Host 'Senão, abra um PowerShell novo antes de rodar esse comando.'
}
