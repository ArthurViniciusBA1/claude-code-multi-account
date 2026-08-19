function claude-profile --description "Gerencia os perfis usados pelo seletor de conta do claude"
    if not command -v claude-switcher-core &>/dev/null
        echo "claude-profile: claude-switcher-core não encontrado no PATH." >&2
        echo "Instale com:  npm install -g claude-switcher-core" >&2
        return 1
    end
    claude-switcher-core $argv
end
