# Mensagens de boas-vindas ao instalar/remover via fisher.
# Fisher emite <nome-do-arquivo>_install / _uninstall para cada arquivo do plugin;
# aqui usamos o do function file principal (claude.fish -> claude_install).
function _claude_switcher_install_hint --on-event claude_install
    echo ""
    echo "claude-switcher instalado."
    if not command -v claude-switcher-core &>/dev/null
        echo "Falta instalar o núcleo:  npm install -g claude-switcher-core"
    end
    echo "1. Registre uma conta:  claude-profile add   (wizard interativo)"
    echo "2. Use normalmente:     claude"
    echo ""
    echo "Cada conta fica isolada em ~/.claude-accounts/<chave> — não precisa"
    echo "escolher path nem exportar CLAUDE_CONFIG_DIR na mão."
    echo ""
end

function _claude_switcher_uninstall_hint --on-event claude_uninstall
    echo "claude-switcher removido."
    echo "Os perfis salvos em ~/.claude-accounts/profiles.json não foram apagados."
end
