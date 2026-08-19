# claude-switcher para bash/zsh.
#
# Adicione ao seu ~/.bashrc ou ~/.zshrc:
#   source /caminho/para/claude-switcher.sh
#
# Requer claude-switcher-core no PATH (npm install -g claude-switcher-core).

claude() {
    if ! command -v claude-switcher-core >/dev/null 2>&1; then
        command claude "$@"
        return $?
    fi

    # Se o binário real do claude não existe ainda, pergunta (com "Sim"
    # pré-selecionado) antes de instalar via npm — nunca instala sem
    # confirmação. Sem terminal interativo, só avisa e sai.
    if ! command -v claude >/dev/null 2>&1; then
        claude-switcher-core ensure-claude-code || return 1
    fi

    local interactive=0
    case $- in
        *i*) interactive=1 ;;
    esac

    # CLAUDE_PROFILE=<chave> deve funcionar mesmo em scripts não-interativos;
    # fora isso, sem terminal interativo nunca abrimos seletor.
    if [ -z "${CLAUDE_PROFILE:-}" ] && [ "$interactive" -eq 0 ]; then
        command claude "$@"
        return $?
    fi

    local dir rc
    dir=$(claude-switcher-core select)
    rc=$?

    case $rc in
        0) CLAUDE_CONFIG_DIR="$dir" command claude "$@" ;;
        2) command claude "$@" ;;
        *) return 1 ;;
    esac
}

claude-profile() {
    if ! command -v claude-switcher-core >/dev/null 2>&1; then
        echo "claude-profile: claude-switcher-core não encontrado no PATH." >&2
        echo "Instale com:  npm install -g claude-switcher-core" >&2
        return 1
    fi
    claude-switcher-core "$@"
}
