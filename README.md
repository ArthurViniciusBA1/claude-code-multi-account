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

**Linux/macOS (fish, bash, zsh) — um comando:**

```sh
curl -fsSL https://raw.githubusercontent.com/ArthurViniciusBA1/claude-code-multi-account/main/remote-install.sh | sh
```

**Windows (PowerShell) — um comando:**

```powershell
irm https://raw.githubusercontent.com/ArthurViniciusBA1/claude-code-multi-account/main/remote-install.ps1 | iex
```

Cada comando clona o repositório em `~/.claude-code-multi-account` (ou
atualiza, se já existir) e delega pro `install.sh`/`install.ps1` de lá —
mesma lógica de sempre, só sem precisar clonar/rodar na mão. As perguntas
interativas (Claude Code instalado? etc.) continuam funcionando
normalmente mesmo dentro do `curl | sh` — o script reabre o terminal de
verdade pra elas. No PowerShell, `irm | iex` já roda no escopo da sessão
atual (diferente de chamar um arquivo `.ps1` direto), então o comando
`claude` fica disponível na hora, sem precisar abrir nada novo.

> O wrapper e os instaladores do PowerShell foram escritos e revisados com
> cuidado (inclusive o detalhe de resolver o binário real do `claude` via
> `Get-Command -CommandType Application` pra evitar recursão infinita, já
> que o PowerShell não tem um `command`/`command` como fish/bash), mas
> **ainda não foram testados num Windows/PowerShell de verdade** — valide
> num ambiente real antes de distribuir pro time.

Depois de instalar com o comando de um passo só, rode `claude-profile add`
pra cadastrar sua primeira conta — no fish/bash/zsh, se o script te
mostrou o aviso de "abra um terminal novo" é só porque o wrapper daquele
shell específico ainda não estava carregado nesta sessão; no PowerShell,
já funciona na hora.

<details>
<summary>Clonar manualmente em vez do comando de um passo só</summary>

```sh
git clone https://github.com/ArthurViniciusBA1/claude-code-multi-account.git
cd claude-code-multi-account
./install.sh          # Linux/macOS
. .\install.ps1        # Windows — repare no ". " antes do caminho
```

`install.sh`/`install.ps1` detectam sozinhos quais shells você tem
instalados (fish, bash e/ou zsh — pode ser mais de um) e já configuram o
wrapper certo pra cada um, sem precisar copiar arquivo nem escolher nada
na mão. Também instalam o núcleo a partir do próprio clone (sem depender
do npm buscar via git, então não esbarram em travas de segurança tipo
`allow-git=none`), e caem sozinhos num prefixo de usuário
(`~/.npm-global`) se o prefixo global do npm não for gravável sem `sudo`.
Rodar de novo não duplica nada — é seguro repetir.

No PowerShell, o `. ` antes do caminho roda o script "dot-sourced", o que
carrega o comando `claude` direto nessa mesma sessão (sem precisar abrir
um terminal novo depois). Rodar só `.\install.ps1`, sem o ponto, também
funciona, mas aí você precisa abrir uma sessão nova pra usar o `claude`.

Se o Claude Code (comando `claude`) ainda não estiver instalado, o script
pergunta (S/N) antes de instalar via `npm install -g @anthropic-ai/claude-code`
— nunca instala sem confirmação. Depois de instalar, confirma de verdade
rodando `claude --version` (o pacote tem um postinstall que baixa o binário
nativo da plataforma; se isso falhar silenciosamente, o script avisa em vez
de fingir que deu certo).

</details>

<details>
<summary>Instalação manual / passo a passo por shell (sem rodar nenhum script)</summary>

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
claude-profile update
claude-profile uninstall
```

`remove` só apaga o registro do perfil, não a pasta em `~/.claude-accounts/`
— se quiser apagar os dados da conta também, faça isso manualmente
(`rm -rf ~/.claude-accounts/<chave>`).

`update` checa se há uma versão mais nova (via `git fetch`, sem mexer em
nada ainda), mostra os commits novos e pergunta `[S/n]` antes de puxar e
reinstalar — nunca atualiza silenciosamente. Sem precisar rodar
`git clone`/`git pull` na mão: ele acha sozinho onde está o clone original
(`npm install -g <path-local>` normalmente deixa um symlink de volta pra
ele); se não achar nenhum clone associado à instalação atual, clona um novo
em `~/.claude-code-multi-account` e passa a usar esse dali em diante.

`uninstall` é outra coisa — remove o claude-switcher inteiro (veja a seção
[Desinstalando](#desinstalando)).

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

O jeito mais simples, direto de qualquer shell (não precisa ter o repositório
clonado por perto — só precisa do `claude-switcher-core` ainda estar no
PATH):

```sh
claude-profile uninstall
```

Remove o pacote do npm e a integração de todos os shells (fish, bash, zsh e
PowerShell — detecta e limpa o que encontrar, independente de qual você
está usando agora). Por padrão **não apaga suas contas** salvas em
`~/.claude-accounts` nem desinstala o Claude Code em si — pergunta `[s/N]`
separadamente pra cada um desses dois, sempre com padrão "não".

Alternativa, se preferir rodar a partir do clone do repositório:

```sh
./uninstall.sh        # Linux/macOS (fish, bash, zsh)
.\uninstall.ps1        # Windows (PowerShell)
```

Fazem exatamente a mesma coisa que `claude-profile uninstall` — a diferença
é só não depender do pacote já estar instalado (útil se a instalação ficou
pela metade).
