# Claude Code Multi Account

Troca o comando `claude` (Claude Code) por um seletor de conta. Útil pra
quem tem mais de uma conta Claude (ex: pessoal + trabalho) e não quer ficar
exportando `CLAUDE_CONFIG_DIR` na mão toda vez.

Funciona em **fish, bash, zsh e PowerShell** — a lógica de perfis (guardar,
listar, escolher) mora num único núcleo em Node.js
([`claude-switcher-core`](https://www.npmjs.com/package/claude-switcher-core)),
publicado no npm, e cada shell tem só um wrapper fino que chama esse
núcleo. Isso evita manter a mesma lógica reimplementada 4 vezes de formas
divergentes.

Cada perfil vira uma pasta própria em `~/.claude-accounts/<chave>`, usada
como `CLAUDE_CONFIG_DIR` — login, histórico e configurações de cada conta
ficam completamente isolados. Esse caminho é sempre derivado do nome que
você dá ao perfil, então você nunca precisa escolher ou digitar um path.

## Instalação

```sh
npm install -g claude-switcher-core
```

É só isso — não precisa clonar repositório, não precisa rodar nenhum
script à parte. Um hook de pós-instalação do próprio pacote detecta quais
shells você tem (fish, bash, zsh e/ou PowerShell — pode ser mais de um) e
já registra o wrapper certo em cada um, sozinho.

> Alguns `npm` têm uma política de segurança (`allow-scripts`) que bloqueia
> scripts de pós-instalação por padrão — nesse caso o pacote instala
> normalmente, mas o wrapper de shell não é configurado, silenciosamente
> (só um aviso fácil de não notar). Se depois de instalar o comando
> `claude` continuar não fazendo nada diferente, rode:
> ```sh
> claude-profile setup
> ```
> Isso configura os wrappers manualmente — mesma lógica do hook, só que
> chamada explicitamente. Sempre seguro de rodar de novo.

Se o prefixo global do seu `npm` não for gravável sem `sudo` (comum em
Linux), o `npm install -g` acima já cai sozinho num prefixo de usuário
(`~/.npm-global`) — só lembre de deixar `~/.npm-global/bin` no seu `PATH`
se ele avisar que fez isso.

Depois de instalar, abra um terminal novo e rode `claude-profile add` pra
cadastrar sua primeira conta.

## Configurando seus perfis

Rode `claude-profile add` (sem argumentos) e siga o passo a passo — ele
pede só o nome e o emoji, deriva a chave interna automaticamente a partir
do nome (removendo acentos/espaços/símbolos — "Mega ADS" vira `mega-ads`;
se colidir com uma chave existente, sufixa sozinho com `-2`, `-3`...), e
mostra uma prévia de como a conta vai aparecer no seletor antes de
confirmar:

```
$ claude-profile add
   ▐▛███▜▌
  ▝▜█████▛▘
    ▘▘ ▝▝
Novo perfil  (Ctrl+C cancela a qualquer momento)

Cada conta fica isolada numa pasta própria — login, histórico e
configurações não se misturam entre perfis.

Nome
  Como você quer chamar essa conta (ex: Trabalho). Vira o nome mostrado
  no seletor, e também dá origem à chave interna — o nome da pasta em
  ~/.claude-accounts/<chave>, usada com "CLAUDE_PROFILE=<chave> claude"
  pra pular o seletor direto pra essa conta.
  > Trabalho

Emoji
  Aparece ao lado do nome no seletor, quando você tem 2 ou mais perfis.
  [👤] > 💼

Assim vai aparecer no seletor:
  💼  Trabalho

Resumo
  nome:       Trabalho
  chave:      trabalho
  emoji:      💼
  config_dir: ~/.claude-accounts/trabalho

Confirmar?
  ➤ Sim
    Não
Perfil 'Trabalho' adicionado (chave: trabalho, ~/.claude-accounts/trabalho).
Autenticar essa conta agora (abre o claude)?
  ➤ Sim
    Não
```

Se o Claude Code (comando `claude`) ainda não estiver instalado nesse
ponto, a pergunta de autenticar acaba te oferecendo instalar via npm
primeiro — veja [Uso](#uso) abaixo pra mais detalhes desse fluxo.

As perguntas sim/não usam o mesmo seletor com navegação por teclado do
seletor de conta (setas + Enter, via `fzf`, com fallback numerado — `1)
Sim  2) Não` — quando `fzf` não está disponível). A opção que era
maiúscula no `[Y/n]`/`[s/N]` de antes fica pré-selecionada.

Repita pra cada conta que quiser adicionar. Com 2+ perfis configurados,
`claude` passa a abrir o seletor antes de rodar o Claude Code de verdade.

Todas as contas ficam organizadas sob `~/.claude-accounts/`, uma pasta por
chave — não existe opção de customizar esse caminho, é assim que todo mundo
do time tem as contas no mesmo lugar sem pensar em paths.

Os perfis ficam salvos em `~/.claude-accounts/profiles.json`, gerenciado
pelo núcleo — não precisa editar esse arquivo na mão, use os comandos
`claude-profile`.

Também dá pra adicionar sem o wizard, útil em scripts (a chave é derivada
do nome do mesmo jeito):

```sh
claude-profile add "Trabalho" 💼
```

## Uso

```sh
claude                       # abre o seletor (se houver 2+ perfis)
claude "some prompt"         # argumentos são repassados normalmente
CLAUDE_PROFILE=work claude   # pula o seletor, usa o perfil "work" direto
```

- Sem `claude-switcher-core` instalado: `claude` vira um passthrough
  transparente pro binário normal — nada quebra se o núcleo faltar.
- Se o binário real do Claude Code (`claude`) ainda não existir quando você
  chama `claude`, é perguntado (com "Sim" pré-selecionado, já que você
  literalmente acabou de tentar usá-lo) se quer instalar via
  `npm install -g @anthropic-ai/claude-code` — nunca instala sem
  confirmação, e confirma de verdade rodando `claude --version` depois (o
  pacote tem um postinstall que baixa o binário nativo da plataforma; se
  isso falhar silenciosamente, o wrapper avisa em vez de fingir que deu
  certo).
- Com 0 perfis configurados: `claude` se comporta como o binário normal.
- Com 1 perfil: usa ele direto, sem perguntar.
- Em sessões não-interativas (scripts, hooks): sempre passa direto pro
  `claude` real, nunca abre o seletor nem pergunta sobre instalar nada —
  exceto `CLAUDE_PROFILE=<chave>`, que funciona mesmo fora de um terminal
  interativo.
- Com 2+ perfis, o seletor também avisa quando há uma versão mais nova do
  `claude-switcher-core` publicada
  (`↑ Atualização disponível — rode "claude-profile update"`). Essa
  checagem usa um cache de até 24h e roda em segundo plano — nunca deixa o
  `claude` mais lento esperando rede.

## Gerenciando perfis

```sh
claude-profile list
claude-profile add <nome> [emoji]
claude-profile remove <chave>
claude-profile setup
claude-profile update
claude-profile uninstall
```

`remove` só apaga o registro do perfil, não a pasta em `~/.claude-accounts/`
— se quiser apagar os dados da conta também, faça isso manualmente
(`rm -rf ~/.claude-accounts/<chave>`).

`setup` (re)configura os wrappers de shell manualmente — normalmente
desnecessário (o `npm install -g` já faz isso sozinho), mas é a rede de
segurança pra quando o hook de pós-instalação é bloqueado por uma política
`allow-scripts` (veja [Instalação](#instalação)).

`update` checa se há uma versão mais nova publicada no npm, mostra a
diferença de versão e pergunta (com "Sim" pré-selecionado) antes de
atualizar — nunca atualiza silenciosamente.

`uninstall` é outra coisa — remove o claude-switcher inteiro (veja a seção
[Desinstalando](#desinstalando)).

## Como funciona

- **`claude-switcher-core`** (Node.js, `bin/core.js`): guarda os perfis em
  `~/.claude-accounts/profiles.json`, decide qual conta usar (`select`) e
  implementa o wizard de cadastro (`add`), listagem (`list`), remoção
  (`remove`), atualização (`update`) e o fluxo de garantir que o Claude
  Code está instalado (`ensure-claude-code`). É a única fonte de verdade
  da lógica — os wrappers de shell não duplicam nenhuma regra de negócio.
- **`select`** imprime *só* o `CLAUDE_CONFIG_DIR` resolvido no stdout
  (nada mais) e usa códigos de saída pros wrappers decidirem o que fazer:
  `0` = usar o path impresso, `2` = nenhum perfil configurado (passthrough),
  `1` = cancelado ou erro (não rodar o claude). Todo o resto — banner, menu,
  mensagens — vai pro stderr, pra não contaminar o path capturado.
- Cada wrapper de shell (`claude.fish`, `shell/claude-switcher.sh`,
  `powershell/claude-switcher.ps1`) faz três coisas: checa se o núcleo está
  instalado, garante que o `claude` real existe (perguntando antes de
  instalar, se não existir), decide se a sessão é interativa (usando o
  jeito nativo de cada shell), e chama `claude-switcher-core select` pra
  decidir o `CLAUDE_CONFIG_DIR`. Em seguida chama o binário real do
  `claude` — usando `command claude` no fish/bash/zsh, ou o path resolvido
  via `Get-Command -CommandType Application` no PowerShell — pra nunca
  cair numa recursão infinita chamando a própria função de novo.
- **`lib/shell-integration.js`**: lógica compartilhada de configurar/remover
  os wrappers de shell, usada tanto pelos hooks `postinstall`/`preuninstall`
  do npm quanto pelos comandos manuais `claude-profile setup`/`uninstall`.
- **`checkForUpdate`** consulta `npm view claude-switcher-core version` e
  compara com a versão instalada (lida do próprio `package.json` do
  pacote) — sem depender de git nem de nenhum clone local.

## Desinstalando

```sh
claude-profile uninstall
```

Remove o pacote do npm e a integração de todos os shells (fish, bash, zsh e
PowerShell — detecta e limpa o que encontrar, independente de qual você
está usando agora; não depende do hook `preuninstall` funcionar, já que
ele pode ser bloqueado pela mesma política `allow-scripts` mencionada em
[Instalação](#instalação)). Por padrão **não apaga suas contas** salvas em
`~/.claude-accounts` nem desinstala o Claude Code em si — pergunta
separadamente pra cada um desses dois (com "Não" pré-selecionado).

Equivalente, se preferir:

```sh
npm uninstall -g claude-switcher-core
```

(só que sem as perguntas sobre apagar contas/Claude Code — e ainda sujeito
à política `allow-scripts` bloquear a limpeza automática dos wrappers, se
o seu `npm` tiver essa restrição).
