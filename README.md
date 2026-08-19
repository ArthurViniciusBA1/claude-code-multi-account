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

**1. Instale o núcleo** (requer Node.js — se você já roda o Claude Code,
já tem Node instalado):

```sh
npm install -g git+https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
```

Se `/usr` (ou o prefixo global padrão do seu `npm`) não for gravável sem
`sudo`, configure um prefixo de usuário uma vez, sem precisar de privilégio
elevado:

```sh
mkdir -p ~/.npm-global
npm install -g --prefix ~/.npm-global git+https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
```

E adicione `~/.npm-global/bin` ao seu `PATH` (fish: `fish_add_path ~/.npm-global/bin`
no `config.fish`; bash/zsh: `export PATH="$HOME/.npm-global/bin:$PATH"` no
`.bashrc`/`.zshrc`).

**2. Instale o wrapper do seu shell:**

<details>
<summary><b>fish</b></summary>

Com [Fisher](https://github.com/jorgebucaran/fisher):

```fish
fisher install ArthurViniciusBA1/claude-code-multi-account
```

Sem Fisher (manual):

```fish
cp functions/*.fish ~/.config/fish/functions/
cp conf.d/*.fish ~/.config/fish/conf.d/
```

Requer [fzf](https://github.com/junegunn/fzf) pro seletor visual — sem ele,
cai automaticamente num menu numerado simples.

</details>

<details>
<summary><b>bash / zsh</b></summary>

Clone o repositório em algum lugar estável e adicione ao seu `~/.bashrc` ou
`~/.zshrc`:

```sh
git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git ~/.claude-code-multi-account
echo 'source ~/.claude-code-multi-account/shell/claude-switcher.sh' >> ~/.bashrc   # ou ~/.zshrc
```

Também usa `fzf` se disponível, com fallback pro menu numerado.

</details>

<details>
<summary><b>PowerShell (Windows/macOS/Linux)</b></summary>

Clone o repositório em algum lugar estável e adicione ao seu `$PROFILE`:

```powershell
git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git $HOME\claude-code-multi-account
Add-Content $PROFILE '. "$HOME\claude-code-multi-account\powershell\claude-switcher.ps1"'
```

> O wrapper PowerShell foi escrito e revisado com cuidado (inclusive o
> detalhe de resolver o binário real do `claude` via
> `Get-Command -CommandType Application` pra evitar recursão infinita, já
> que o PowerShell não tem um `command`/`command` como fish/bash), mas
> **ainda não foi testado num Windows/PowerShell de verdade** — valide
> num ambiente real antes de distribuir pro time.

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
