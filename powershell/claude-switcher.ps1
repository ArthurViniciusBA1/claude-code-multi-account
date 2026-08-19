# claude-switcher para PowerShell.
#
# Adicione ao seu $PROFILE (ex: notepad $PROFILE):
#   . "C:\caminho\para\claude-switcher.ps1"
#
# Requer claude-switcher-core no PATH (npm install -g claude-switcher-core).
#
# PowerShell não tem um equivalente direto ao `command` do fish/bash pra
# "pular a função e chamar o binário real" -- se a função abaixo se chamar
# `claude`, `& claude` dentro dela mesma recursaria infinitamente. Por isso
# resolvemos o caminho do binário real (via Get-Command -CommandType
# Application) uma vez e guardamos em cache no escopo do script.

$script:ClaudeSwitcherRealClaude = $null

function Get-RealClaudePath {
    if (-not $script:ClaudeSwitcherRealClaude) {
        $cmd = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cmd) {
            $script:ClaudeSwitcherRealClaude = $cmd.Source
        }
    }
    return $script:ClaudeSwitcherRealClaude
}

function claude {
    $realClaude = Get-RealClaudePath
    if (-not $realClaude) {
        Write-Error "claude: binário real do Claude Code não encontrado no PATH."
        return
    }

    $core = Get-Command claude-switcher-core -ErrorAction SilentlyContinue
    if (-not $core) {
        & $realClaude @args
        return
    }

    # CLAUDE_PROFILE=<chave> deve funcionar mesmo fora de um terminal
    # interativo; fora isso, sem terminal interativo nunca abrimos seletor.
    $isInteractive = -not ([Console]::IsInputRedirected)
    if (-not $env:CLAUDE_PROFILE -and -not $isInteractive) {
        & $realClaude @args
        return
    }

    $dir = & claude-switcher-core select
    $rc = $LASTEXITCODE

    if ($rc -eq 0) {
        $prevDir = $env:CLAUDE_CONFIG_DIR
        $env:CLAUDE_CONFIG_DIR = $dir
        try {
            & $realClaude @args
        } finally {
            if ($null -eq $prevDir) {
                Remove-Item Env:\CLAUDE_CONFIG_DIR -ErrorAction SilentlyContinue
            } else {
                $env:CLAUDE_CONFIG_DIR = $prevDir
            }
        }
    } elseif ($rc -eq 2) {
        & $realClaude @args
    }
    # rc 1 (cancelado/erro): claude-switcher-core já imprimiu a mensagem;
    # não roda o claude.
}

function claude-profile {
    $core = Get-Command claude-switcher-core -ErrorAction SilentlyContinue
    if (-not $core) {
        Write-Error "claude-profile: claude-switcher-core não encontrado no PATH. Instale com: npm install -g claude-switcher-core"
        return
    }
    & claude-switcher-core @args
}
