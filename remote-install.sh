#!/bin/sh
# Bootstrapper pra instalação em um comando só (fish/bash/zsh):
#
#   curl -fsSL https://raw.githubusercontent.com/ArthurViniciusBA1/claude-code-multi-account/main/remote-install.sh | sh
#
# De propósito, este arquivo é bem pequeno: só garante que existe um clone
# local em ~/.claude-code-multi-account (clonando ou atualizando) e delega
# pro install.sh de dentro desse clone, que é onde mora a lógica de
# verdade. Isso minimiza a janela de risco clássica do padrão
# "curl | sh" — se a conexão cair no meio do download, o pior caso é esse
# bootstrapper minúsculo vir truncado; o install.sh real só roda depois de
# um "git clone" completo (que tem sua própria checagem de integridade).

set -e

TARGET="$HOME/.claude-code-multi-account"

if ! command -v git >/dev/null 2>&1; then
    printf 'erro: git não encontrado. Instale o git antes de continuar.\n' >&2
    exit 1
fi

if [ -d "$TARGET/.git" ]; then
    printf 'Atualizando clone existente em %s...\n' "$TARGET"
    git -C "$TARGET" pull --ff-only
else
    printf 'Clonando em %s...\n' "$TARGET"
    git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git "$TARGET"
fi

# Com "curl | sh", o stdin deste script É o próprio conteúdo baixado, não
# o teclado — sem isso, as perguntas [s/N] do install.sh seriam puladas
# silenciosamente (ele acha que não há terminal interativo). Reabrimos o
# stdin a partir de /dev/tty antes de delegar, igual instaladores desse
# estilo (rustup, etc) fazem. Se não houver terminal de verdade disponível
# (ex: automação/CI), seguimos sem o /dev/tty e o install.sh já lida bem
# com isso sozinho (pula as perguntas, não trava).
if [ -e /dev/tty ] && [ -r /dev/tty ]; then
    exec sh "$TARGET/install.sh" < /dev/tty
else
    exec sh "$TARGET/install.sh"
fi
