#!/bin/sh
# Instalador do claude-switcher pra fish, bash e zsh.
#
# Uso:
#   git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
#   cd claude-code-multi-account
#   ./install.sh
#
# Detecta qual(is) shell(s) você usa (pelo binário instalado, arquivo de
# config existente, ou $SHELL) e já configura o wrapper certo pra cada um —
# sem precisar escolher/copiar nada na mão. Roda quantas vezes quiser: só
# adiciona o que ainda não está lá (idempotente).
#
# Instala a partir do próprio clone local (npm install -g .), então não
# depende do npm buscar nada via git — evita travas tipo "allow-git=none"
# que alguns sistemas têm por segurança.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

info()  { printf '%s\n' "$*"; }
warn()  { printf 'aviso: %s\n' "$*" >&2; }
err()   { printf 'erro: %s\n' "$*" >&2; }

if ! command -v node >/dev/null 2>&1; then
    err "Node.js não encontrado. Instale o Node antes de continuar (se você já roda o Claude Code, provavelmente já tem)."
    exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
    err "npm não encontrado."
    exit 1
fi

# --- 1. Instala o núcleo (claude-switcher-core) ---

info "Instalando claude-switcher-core..."

NPM_PREFIX=""
if npm install -g "$SCRIPT_DIR" >/tmp/claude-switcher-install.log 2>&1; then
    info "  núcleo instalado no prefixo global padrão do npm."
else
    warn "instalação global padrão falhou (provavelmente sem permissão em $(npm config get prefix)); tentando prefixo de usuário..."
    NPM_PREFIX="$HOME/.npm-global"
    mkdir -p "$NPM_PREFIX"
    if ! npm install -g --prefix "$NPM_PREFIX" "$SCRIPT_DIR" >/tmp/claude-switcher-install.log 2>&1; then
        err "falha ao instalar o núcleo. Veja /tmp/claude-switcher-install.log"
        exit 1
    fi
    info "  núcleo instalado em $NPM_PREFIX (prefixo de usuário, sem sudo)."
fi

# --- 2. Detecta shells presentes e configura cada um ---

CONFIGURED=""

append_once() {
    # append_once <arquivo> <linha>
    file="$1"; line="$2"
    mkdir -p "$(dirname "$file")"
    touch "$file"
    if ! grep -qF "$line" "$file" 2>/dev/null; then
        printf '\n%s\n' "$line" >> "$file"
        return 0
    fi
    return 1
}

# fish
if command -v fish >/dev/null 2>&1 || [ -d "$HOME/.config/fish" ]; then
    mkdir -p "$HOME/.config/fish/functions" "$HOME/.config/fish/conf.d"
    cp "$SCRIPT_DIR"/functions/*.fish "$HOME/.config/fish/functions/"
    cp "$SCRIPT_DIR"/conf.d/*.fish "$HOME/.config/fish/conf.d/"
    if [ -n "$NPM_PREFIX" ]; then
        append_once "$HOME/.config/fish/config.fish" "fish_add_path $NPM_PREFIX/bin" || true
    fi
    CONFIGURED="$CONFIGURED fish"
fi

# bash
if command -v bash >/dev/null 2>&1 || [ -f "$HOME/.bashrc" ]; then
    LINE="source \"$SCRIPT_DIR/shell/claude-switcher.sh\""
    append_once "$HOME/.bashrc" "$LINE" || true
    if [ -n "$NPM_PREFIX" ]; then
        append_once "$HOME/.bashrc" "export PATH=\"$NPM_PREFIX/bin:\$PATH\"" || true
    fi
    CONFIGURED="$CONFIGURED bash"
fi

# zsh
if command -v zsh >/dev/null 2>&1 || [ -f "$HOME/.zshrc" ]; then
    LINE="source \"$SCRIPT_DIR/shell/claude-switcher.sh\""
    append_once "$HOME/.zshrc" "$LINE" || true
    if [ -n "$NPM_PREFIX" ]; then
        append_once "$HOME/.zshrc" "export PATH=\"$NPM_PREFIX/bin:\$PATH\"" || true
    fi
    CONFIGURED="$CONFIGURED zsh"
fi

if [ -z "$CONFIGURED" ]; then
    warn "não detectei fish, bash nem zsh. Configure manualmente (veja o README)."
    exit 1
fi

info ""
info "Pronto. Shells configurados:$CONFIGURED"
info "Abra um terminal novo (ou reinicie sua sessão de shell) e rode:"
info "  claude-profile add"
