# Claude Code Multi Account

Troca o comando `claude` (Claude Code) por um seletor de conta. Útil pra
quem tem mais de uma conta Claude (ex: pessoal + trabalho) e não quer ficar
exportando `CLAUDE_CONFIG_DIR` na mão toda vez.

Funciona em **fish, bash, zsh e PowerShell** — a lógica de perfis (guardar,
listar, escolher) mora num único núcleo em Node.js
(`claude-switcher-core`), e cada shell tem só um wrapper fino que chama esse
núcleo. Isso evita manter a mesma lógica reimplementada 4 vezes de formas
divergentes.

Cada perfil vira uma pasta própria em `~/.claude-accounts/<chave>`, usada
como `CLAUDE_CONFIG_DIR` — login, histórico e configurações de cada conta
ficam completamente isolados. Esse caminho é sempre derivado da chave, então
você nunca precisa escolher ou digitar um path.

## Instalação

**Linux/macOS (fish, bash, zsh) — um passo só:**

```sh
git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
cd claude-code-multi-account
./install.sh
```

`install.sh` detecta sozinho quais shells você tem instalados (fish, bash
e/ou zsh — pode ser mais de um) e já configura o wrapper certo pra cada um,
sem precisar copiar arquivo nem escolher nada na mão. Também instala o
núcleo a partir do próprio clone (sem depender do npm buscar via git, então
não esbarra em travas de segurança tipo `allow-git=none`), e cai sozinho
num prefixo de usuário (`~/.npm-global`) se o prefixo global do npm não for
gravável sem `sudo`. Rodar de novo não duplica nada — é seguro repetir.

Se o Claude Code (comando `claude`) ainda não estiver instalado, o script
pergunta (S/N) antes de instalar via `npm install -g @anthropic-ai/claude-code`
— nunca instala sem confirmação. Depois de instalar, confirma de verdade
rodando `claude --version` (o pacote tem um postinstall que baixa o binário
nativo da plataforma; se isso falhar silenciosamente, o script avisa em vez
de fingir que deu certo).

**Windows (PowerShell) — um passo só:**

```powershell
git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
cd claude-code-multi-account
.\install.ps1
```

> O wrapper e o instalador do PowerShell foram escritos e revisados com
> cuidado (inclusive o detalhe de resolver o binário real do `claude` via
> `Get-Command -CommandType Application` pra evitar recursão infinita, já
> que o PowerShell não tem um `command`/`command` como fish/bash), mas
> **ainda não foram testados num Windows/PowerShell de verdade** — valide
> num ambiente real antes de distribuir pro time.

Depois de instalar (qualquer shell), abra um terminal novo e rode
`claude-profile add` pra cadastrar sua primeira conta.

<details>
<summary>Instalação manual / passo a passo por shell (se preferir não rodar o script)</summary>

**Núcleo** (necessário em todos os casos):

```sh
npm install -g /caminho/do/clone/claude-code-multi-account
```

Se o prefixo global do seu `npm` não for gravável sem `sudo`:

```sh
mkdir -p ~/.npm-global
npm install -g --prefix ~/.npm-global /caminho/do/clone/claude-code-multi-account
```

E adicione `~/.npm-global/bin` ao seu `PATH` (fish: `fish_add_path ~/.npm-global/bin`
no `config.fish`; bash/zsh: `export PATH="$HOME/.npm-global/bin:$PATH"` no
`.bashrc`/`.zshrc`).

**fish** — com [Fisher](https://github.com/jorgebucaran/fisher):

```fish
fisher install ArthurViniciusBA1/claude-code-multi-account
```

Ou manual:

```fish
cp functions/*.fish ~/.config/fish/functions/
cp conf.d/*.fish ~/.config/fish/conf.d/
```

**bash / zsh** — adicione ao `~/.bashrc` ou `~/.zshrc`:

```sh
source /caminho/do/clone/claude-code-multi-account/shell/claude-switcher.sh
```

**PowerShell** — adicione ao `$PROFILE`:

```powershell
. "C:\caminho\do\clone\claude-code-multi-account\powershell\claude-switcher.ps1"
```

Todos os shells usam `fzf` se disponível pro seletor visual, com fallback
pra um menu numerado simples.

</details>

## Configurando seus perfis

Rode `claude-profile add` (sem argumentos) e siga o passo a passo — ele
pergunta chave, emoji e rótulo, mostra um resumo pra confirmar (com o
`config_dir` já derivado automaticamente), e no final já oferece autenticar
a conta na hora:

```
$ claude-profile add
Vamos configurar um novo perfil. (Ctrl+C cancela a qualquer momento.)

Chave (identificador curto, ex: work): work
Emoji [👤]: 💼
Rótulo [work]: Trabalho

Resumo:
  chave:      work
  rótulo:     Trabalho
  emoji:      💼
  config_dir: ~/.claude-accounts/work

Confirmar? [Y/n]
Perfil 'work' adicionado (~/.claude-accounts/work).
Autenticar essa conta agora (abre o claude)? [Y/n]
```

Repita pra cada conta que quiser adicionar. Com 2+ perfis configurados,
`claude` passa a abrir o seletor antes de rodar o Claude Code de verdade.

Todas as contas ficam organizadas sob `~/.claude-accounts/`, uma pasta por
chave — não existe opção de customizar esse caminho, é assim que todo mundo
do time tem as contas no mesmo lugar sem pensar em paths.

Os perfis ficam salvos em `~/.claude-accounts/profiles.json`, gerenciado
pelo núcleo — não precisa editar esse arquivo na mão, use os comandos
`claude-profile`.

Também dá pra adicionar sem o wizard, útil em scripts:

```sh
claude-profile add work 💼 "Trabalho"
```

## Uso

```sh
claude                       # abre o seletor (se houver 2+ perfis)
claude "some prompt"         # argumentos são repassados normalmente
CLAUDE_PROFILE=work claude   # pula o seletor, usa o perfil "work" direto
```

- Sem `claude-switcher-core` instalado: `claude` vira um passthrough
  transparente pro binário normal — nada quebra se o núcleo faltar.
- Com 0 perfis configurados: `claude` se comporta como o binário normal.
- Com 1 perfil: usa ele direto, sem perguntar.
- Em sessões não-interativas (scripts, hooks): sempre passa direto pro
  `claude` real, nunca abre o seletor — exceto `CLAUDE_PROFILE=<chave>`, que
  funciona mesmo fora de um terminal interativo.

## Gerenciando perfis

```sh
claude-profile list
claude-profile add <chave> [emoji] [rótulo]
claude-profile remove <chave>
```

`remove` só apaga o registro do perfil, não a pasta em `~/.claude-accounts/`
— se quiser apagar os dados da conta também, faça isso manualmente
(`rm -rf ~/.claude-accounts/<chave>`).

## Como funciona

- **`claude-switcher-core`** (Node.js, `bin/core.js`): guarda os perfis em
  `~/.claude-accounts/profiles.json`, decide qual conta usar (`select`) e
  implementa o wizard de cadastro (`add`), listagem (`list`) e remoção
  (`remove`). É a única fonte de verdade da lógica — os wrappers de shell
  não duplicam nenhuma regra de negócio.
- **`select`** imprime *só* o `CLAUDE_CONFIG_DIR` resolvido no stdout
  (nada mais) e usa códigos de saída pros wrappers decidirem o que fazer:
  `0` = usar o path impresso, `2` = nenhum perfil configurado (passthrough),
  `1` = cancelado ou erro (não rodar o claude). Todo o resto — banner, menu,
  mensagens — vai pro stderr, pra não contaminar o path capturado.
- Cada wrapper de shell (`claude.fish`, `shell/claude-switcher.sh`,
  `powershell/claude-switcher.ps1`) faz três coisas: checa se o núcleo está
  instalado, decide se a sessão é interativa (usando o jeito nativo de cada
  shell), e chama `claude-switcher-core select` pra decidir o
  `CLAUDE_CONFIG_DIR`. Em seguida chama o binário real do `claude` —
  usando `command claude` no fish/bash/zsh, ou o path resolvido via
  `Get-Command -CommandType Application` no PowerShell — pra nunca cair
  numa recursão infinita chamando a própria função de novo.

## Desinstalando

```sh
npm uninstall -g claude-switcher-core
```

E remova o wrapper do seu shell (o `fisher remove`, o `source` do
`.bashrc`/`.zshrc`, ou a linha no `$PROFILE`, conforme o caso). Os perfis
salvos em `~/.claude-accounts/profiles.json` não são apagados.
