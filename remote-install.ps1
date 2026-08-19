# Bootstrapper pra instalação em um comando só (PowerShell):
#
#   irm https://raw.githubusercontent.com/ArthurViniciusBA1/claude-code-multi-account/main/remote-install.ps1 | iex
#
# De propósito, este arquivo é bem pequeno: só garante que existe um clone
# local em ~/.claude-code-multi-account (clonando ou atualizando) e delega
# pro install.ps1 de dentro desse clone, que é onde mora a lógica de
# verdade.
#
# Diferente do "curl | sh" no Unix, "irm | iex" roda o conteúdo baixado na
# MESMA sessão/escopo de quem chamou — não é um processo filho com stdin
# redirecionado, é como se o texto tivesse sido digitado direto no
# console. Por isso Read-Host funciona normalmente sem nenhum truque
# extra, e o dot-source final do install.ps1 (que carrega "claude" e
# "claude-profile" na sessão atual) também propaga corretamente.
#
# Evitamos "return"/"exit" soltos aqui de propósito (usamos if/else em vez
# de saída antecipada) — mesmo cuidado do install.ps1: um "exit" bruto
# rodando numa sessão via iex poderia, dependendo do host, encerrar mais
# do que só este bootstrapper.

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "git não encontrado. Instale o git antes de continuar."
} else {
    $Target = "$HOME\.claude-code-multi-account"

    if (Test-Path "$Target\.git") {
        Write-Host "Atualizando clone existente em $Target..."
        git -C $Target pull --ff-only
    } else {
        Write-Host "Clonando em $Target..."
        git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git $Target
    }

    . "$Target\install.ps1"
}
