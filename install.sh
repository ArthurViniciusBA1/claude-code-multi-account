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
# Se o Claude Code (`claude`) ainda não estiver instalado, pergunta (S/N)
# antes de instalar via npm — nunca instala sem confirmação.
#
# Instala o núcleo a partir do próprio clone local (npm install -g .), então
# não depende do npm buscar nada via git — evita travas tipo "allow-git=none"
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

NPM_PREFIX=""

# npm_install_global <alvo>
# Instala <alvo> globalmente; se o prefixo padrão do npm não for gravável,
# cai pra um prefixo de usuário (~/.npm-global) e reaproveita esse mesmo
# prefixo nas chamadas seguintes. Cada comando arriscado é sempre a
# condição direta de um "if", pra nunca disparar o "set -e" de forma
# inconsistente entre shells diferentes (dash/bash/ash).
npm_install_global() {
    target="$1"
    if [ -n "$NPM_PREFIX" ]; then
        if npm install -g --prefix "$NPM_PREFIX" "$target" >/tmp/claude-switcher-install.log 2>&1; then
            return 0
        else
            return 1
        fi
    fi
    if npm install -g "$target" >/tmp/claude-switcher-install.log 2>&1; then
        return 0
    fi
    warn "instalação global padrão falhou (provavelmente sem permissão em $(npm config get prefix)); usando prefixo de usuário..."
    NPM_PREFIX="$HOME/.npm-global"
    mkdir -p "$NPM_PREFIX"
    if npm install -g --prefix "$NPM_PREFIX" "$target" >/tmp/claude-switcher-install.log 2>&1; then
        return 0
    else
        return 1
    fi
}

# --- 0. Claude Code em si (opcional, pergunta antes) ---

if ! command -v claude >/dev/null 2>&1; then
    if [ -t 0 ]; then
        printf 'Claude Code (comando "claude") não encontrado. Instalar agora via npm? [s/N] '
        read -r ANSWER
        case "$ANSWER" in
            [sSyY]*)
                info "Instalando @anthropic-ai/claude-code..."
                if npm_install_global "@anthropic-ai/claude-code"; then
                    CLAUDE_BIN="claude"
                    if [ -n "$NPM_PREFIX" ]; then
                        CLAUDE_BIN="$NPM_PREFIX/bin/claude"
                    fi
                    if "$CLAUDE_BIN" --version >/dev/null 2>&1; then
                        info "  Claude Code instalado e funcionando."
                    else
                        warn "o npm instalou o pacote, mas \"claude --version\" falhou — o"
                        warn "postinstall (que baixa o binário nativo da plataforma) pode não"
                        warn "ter terminado. Depois de abrir um terminal novo, tente rodar"
                        warn "\"claude --version\"; se continuar falhando, rode de novo:"
                        warn "  npm install -g @anthropic-ai/claude-code"
                    fi
                else
                    err "falha ao instalar o Claude Code. Veja /tmp/claude-switcher-install.log"
                    exit 1
                fi
                ;;
            *)
                warn "Claude Code não instalado. O wrapper vai funcionar assim que você instalar (veja: https://docs.claude.com/claude-code)."
                ;;
        esac
    else
        warn "Claude Code (comando \"claude\") não encontrado, e este terminal não é interativo pra perguntar. Pulei a instalação — rode ./install.sh direto num terminal se quiser instalar."
    fi
fi

# --- 1. Instala o núcleo (claude-switcher-core) ---

info "Instalando claude-switcher-core..."
if npm_install_global "$SCRIPT_DIR"; then
    if [ -n "$NPM_PREFIX" ]; then
        info "  núcleo instalado em $NPM_PREFIX (prefixo de usuário, sem sudo)."
    else
        info "  núcleo instalado no prefixo global padrão do npm."
    fi
else
    err "falha ao instalar o núcleo. Veja /tmp/claude-switcher-install.log"
    exit 1
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
