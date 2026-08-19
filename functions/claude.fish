function claude --description "Escolhe qual conta/instância do Claude usar antes de rodar o Claude Code"
    # Sem o núcleo instalado (npm install -g claude-switcher-core), vira
    # um passthrough transparente pro claude normal.
    if not command -v claude-switcher-core &>/dev/null
        command claude $argv
        return $status
    end

    # CLAUDE_PROFILE=<chave> deve funcionar mesmo em scripts não-interativos;
    # fora isso, sem terminal interativo nunca abrimos seletor.
    if not set -q CLAUDE_PROFILE; and not status is-interactive
        command claude $argv
        return $status
    end

    set -l dir (claude-switcher-core select)
    set -l rc $status

    switch $rc
        case 0
            CLAUDE_CONFIG_DIR=$dir command claude $argv
        case 2
            command claude $argv
        case '*'
            return 1
    end
end
