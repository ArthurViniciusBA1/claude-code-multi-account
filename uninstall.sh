#!/bin/sh
# Desinstalador do claude-switcher pra fish, bash e zsh.
#
# Uso: ./uninstall.sh
#
# Remove o núcleo (npm) e a integração adicionada em cada shell (fish,
# bash, zsh). Por padrão NÃO apaga suas contas salvas em
# ~/.claude-accounts nem desinstala o Claude Code em si — pergunta [s/N]
# separadamente pra cada um desses dois, sempre com padrão "não".

info()  { printf '%s\n' "$*"; }
warn()  { printf 'aviso: %s\n' "$*" >&2; }

# remove_line_containing <arquivo> <padrão-grep>
# Remove (in-place) qualquer linha que combine com o padrão. Retorna 0 se
# removeu algo, 1 se não havia nada pra remover.
remove_line_containing() {
    file="$1"; pattern="$2"
    [ -f "$file" ] || return 1
    if grep -q "$pattern" "$file" 2>/dev/null; then
        tmp="$(mktemp)"
        grep -v "$pattern" "$file" > "$tmp"
        mv "$tmp" "$file"
        return 0
    fi
    return 1
}

# --- 1. Núcleo (claude-switcher-core) via npm ---

if command -v npm >/dev/null 2>&1; then
    npm uninstall -g claude-switcher-core >/dev/null 2>&1 || true
    if [ -d "$HOME/.npm-global" ]; then
        npm uninstall -g --prefix "$HOME/.npm-global" claude-switcher-core >/dev/null 2>&1 || true
    fi
    info "núcleo (claude-switcher-core) removido do npm (se estava instalado)."
else
    warn "npm não encontrado — pulei a remoção do pacote."
fi

# --- 2. Integração de cada shell ---

REMOVED=""

if [ -f "$HOME/.config/fish/functions/claude.fish" ] || \
   [ -f "$HOME/.config/fish/functions/claude-profile.fish" ] || \
   [ -f "$HOME/.config/fish/conf.d/claude-switcher.fish" ]; then
    rm -f "$HOME/.config/fish/functions/claude.fish" \
          "$HOME/.config/fish/functions/claude-profile.fish" \
          "$HOME/.config/fish/conf.d/claude-switcher.fish"
    REMOVED="$REMOVED fish"
fi

if remove_line_containing "$HOME/.bashrc" 'claude-switcher\.sh'; then
    REMOVED="$REMOVED bash"
fi

if remove_line_containing "$HOME/.zshrc" 'claude-switcher\.sh'; then
    REMOVED="$REMOVED zsh"
fi

info ""
if [ -n "$REMOVED" ]; then
    info "Wrapper removido de:$REMOVED"
else
    info "Nenhum wrapper de shell encontrado pra remover."
fi
info "(a linha de PATH pro ~/.npm-global/bin, se foi adicionada durante a"
info "instalação, não foi removida — fica inofensiva sem o pacote instalado,"
info "mas você pode tirá-la manualmente do seu arquivo de config se quiser)"
info ""

# --- 3. Perguntas opcionais (padrão: não apagar nada disso) ---

if [ -t 0 ]; then
    printf 'Apagar também as contas salvas em ~/.claude-accounts (login, histórico, credenciais)? [s/N] '
    read -r ANSWER
    case "$ANSWER" in
        [sSyY]*)
            rm -rf "$HOME/.claude-accounts"
            info "~/.claude-accounts removido."
            ;;
        *)
            info "~/.claude-accounts mantido."
            ;;
    esac

    printf 'Desinstalar também o Claude Code (@anthropic-ai/claude-code)? [s/N] '
    read -r ANSWER2
    case "$ANSWER2" in
        [sSyY]*)
            if command -v npm >/dev/null 2>&1; then
                npm uninstall -g @anthropic-ai/claude-code >/dev/null 2>&1 || true
                if [ -d "$HOME/.npm-global" ]; then
                    npm uninstall -g --prefix "$HOME/.npm-global" @anthropic-ai/claude-code >/dev/null 2>&1 || true
                fi
                info "Claude Code desinstalado."
            fi
            ;;
        *)
            info "Claude Code mantido."
            ;;
    esac
else
    warn "terminal não interativo — pulei as perguntas sobre apagar contas/Claude Code."
fi

info ""
info "Pronto. Abra um terminal novo pra confirmar."
