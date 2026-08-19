#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const readline = require('node:readline/promises');
const { installShellIntegration, removeShellIntegration } = require('../lib/shell-integration');

const ROOT = path.join(os.homedir(), '.claude-accounts');
const PROFILES_FILE = path.join(ROOT, 'profiles.json');
const UPDATE_CACHE_FILE = path.join(ROOT, '.update-check.json');
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_EMOJI = '👤';
const PKG_NAME = 'claude-switcher-core';

const ORANGE = '\x1b[38;2;255;107;53m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// banner: log = console.log (stdout) ou console.error (stderr, usado em
// telas cujo stdout é capturado por command substitution, como o select).
function banner(log = console.log) {
    log(ORANGE + '   ▐▛███▜▌' + RESET);
    log(ORANGE + '  ▝▜█████▛▘' + RESET);
    log(ORANGE + '    ▘▘ ▝▝' + RESET);
}

function loadProfiles() {
    try {
        const raw = fs.readFileSync(PROFILES_FILE, 'utf8');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
    } catch (err) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}

function saveProfiles(profiles) {
    fs.mkdirSync(ROOT, { recursive: true });
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2) + '\n');
}

function accountDir(key) {
    return path.join(ROOT, key);
}

function findProfile(profiles, key) {
    return profiles.find((p) => p.key === key);
}

// slugify: transforma um nome livre (acentos, espaços, emoji, o que for)
// numa chave segura pra usar como nome de pasta e em
// "CLAUDE_PROFILE=<chave> claude". Minúsculas, sem acento, só
// [a-z0-9-]. Cai pra "conta" se não sobrar nada usável (ex: nome só com
// emoji/símbolos).
function slugify(name) {
    const slug = name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'conta';
}

// uniqueKey: se a chave derivada já existe, sufixa com -2, -3... até achar
// uma livre — nunca pede confirmação nem bloqueia o fluxo por causa disso.
function uniqueKey(baseSlug, profiles) {
    if (!findProfile(profiles, baseSlug)) return baseSlug;
    let i = 2;
    while (findProfile(profiles, `${baseSlug}-${i}`)) i++;
    return `${baseSlug}-${i}`;
}

function hasFzf() {
    const res = spawnSync('fzf', ['--version'], { stdio: 'ignore' });
    return !res.error && res.status === 0;
}

// checkForUpdateNotice: lê o cache de "tem atualização?" (escrito pela
// checagem em background) e, se estiver velho ou não existir, dispara uma
// checagem nova em background — sem esperar por ela, pra nunca deixar
// "claude" mais lento por causa disso. Usa sempre o que já tem no cache
// (mesmo que esteja prestes a ficar velho) pra decidir se avisa AGORA;
// a atualização do cache só vale pra próxima vez.
function checkForUpdateNotice() {
    let cache = null;
    try {
        cache = JSON.parse(fs.readFileSync(UPDATE_CACHE_FILE, 'utf8'));
    } catch (_) {
        cache = null;
    }

    const stale = !cache || (Date.now() - cache.lastChecked) > UPDATE_CHECK_INTERVAL_MS;
    if (stale) {
        try {
            const child = spawn(process.execPath, [__filename, '__background-update-check'], {
                detached: true,
                stdio: 'ignore',
            });
            child.unref();
        } catch (_) {
            // sem problema, só não atualiza o cache dessa vez
        }
    }

    return Boolean(cache && cache.updateAvailable);
}

// cmdBackgroundUpdateCheck: subcomando interno, chamado apenas pelo
// spawn desacoplado acima.
async function cmdBackgroundUpdateCheck() {
    const status = checkForUpdate();
    const cache = {
        lastChecked: Date.now(),
        updateAvailable: Boolean(status && !status.upToDate),
    };
    try {
        fs.mkdirSync(ROOT, { recursive: true });
        fs.writeFileSync(UPDATE_CACHE_FILE, JSON.stringify(cache));
    } catch (_) {
        // é só cache, se falhar tudo bem
    }
}

// askYesNo: mesmo seletor com navegação por teclado do "select" de perfil
// (fzf, com fallback numerado quando não tem fzf) só que pra perguntas
// sim/não — em vez de digitar "s"/"n" e apertar Enter. A opção padrão
// (a que apareceria maiúscula em "[Y/n]"/"[s/N]") fica pré-selecionada.
// Retorna 'yes', 'no' ou 'cancelled' (Esc/Ctrl+C/EOF durante a seleção —
// cada chamador decide se isso deve imprimir alguma mensagem própria).
async function askYesNo(question, defaultYes) {
    const options = defaultYes ? ['Sim', 'Não'] : ['Não', 'Sim'];

    if (hasFzf()) {
        console.log(question);
        const res = spawnSync(
            'fzf',
            ['--height=~40%', '--layout=reverse', '--border', '--no-input',
                '--padding=1,2', '--margin=1,2', '--pointer=➤', '--no-multi'],
            { input: options.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
        );
        const pick = (res.stdout || '').trim();
        if (pick === 'Sim') return 'yes';
        if (pick === 'Não') return 'no';
        return 'cancelled';
    }

    console.log(question);
    options.forEach((o, i) => console.log(`  ${i + 1}) ${o}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let answer;
    try {
        answer = (await rl.question('> ')).trim();
    } catch (_) {
        rl.close();
        return 'cancelled';
    }
    rl.close();
    const idx = parseInt(answer, 10);
    if (Number.isNaN(idx) || idx < 1 || idx > options.length) return 'cancelled';
    return options[idx - 1] === 'Sim' ? 'yes' : 'no';
}

function formatList(profiles) {
    if (profiles.length === 0) {
        return "Nenhum perfil configurado. Use: claude-profile add <nome> [emoji]";
    }
    return profiles
        .map((p) => `${p.emoji}  ${p.key}  (${p.label})  ->  ${accountDir(p.key)}`)
        .join('\n');
}

// --- select: decide qual CLAUDE_CONFIG_DIR usar. ---
// stdout: SÓ o path final (quando exit 0). Todo o resto (banner, menus,
// prompts) vai pro stderr, porque os wrappers de shell capturam o stdout
// via command substitution.
// Exit codes: 0 = usar o path impresso; 1 = cancelado/erro (não rodar
// claude); 2 = passthrough (nenhum perfil configurado, rodar claude puro).
async function cmdSelect() {
    const profiles = loadProfiles();

    if (process.env.CLAUDE_PROFILE) {
        const key = process.env.CLAUDE_PROFILE;
        const p = findProfile(profiles, key);
        if (!p) {
            console.error(`claude: perfil '${key}' não encontrado (veja: claude-profile list).`);
            process.exit(1);
        }
        process.stdout.write(accountDir(p.key));
        process.exit(0);
    }

    if (profiles.length === 0) {
        process.exit(2);
    }

    if (profiles.length === 1) {
        process.stdout.write(accountDir(profiles[0].key));
        process.exit(0);
    }

    if (checkForUpdateNotice()) {
        console.error(DIM + '↑ Atualização disponível — rode "claude-profile update"' + RESET);
    }

    let chosenKey = null;

    if (hasFzf()) {
        banner(console.error);
        console.error(BOLD + 'Escolha o perfil:' + RESET);

        const menu = profiles.map((p) => `${p.emoji}  ${p.label}`).join('\n');
        const res = spawnSync(
            'fzf',
            ['--height=~40%', '--layout=reverse', '--border', '--no-input',
                '--padding=1,2', '--margin=1,2', '--pointer=➤', '--no-multi'],
            { input: menu, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }
        );
        const pick = (res.stdout || '').trim();
        const idx = profiles.findIndex((p) => pick.includes(p.label));
        if (idx !== -1) chosenKey = profiles[idx].key;
    } else {
        console.error('Escolha o perfil:');
        profiles.forEach((p, i) => {
            console.error(`  ${i + 1}) ${p.emoji}  ${p.label}`);
        });
        const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
        const answer = (await rl.question('> ')).trim();
        rl.close();
        const idx = parseInt(answer, 10);
        if (!Number.isNaN(idx) && idx >= 1 && idx <= profiles.length) {
            chosenKey = profiles[idx - 1].key;
        }
    }

    if (!chosenKey) {
        process.exit(1);
    }

    process.stdout.write(accountDir(chosenKey));
    process.exit(0);
}

function cmdList() {
    console.log(formatList(loadProfiles()));
}

function cmdRemove(argv) {
    const key = argv[0];
    if (!key) {
        console.error('uso: claude-profile remove <chave>');
        process.exit(1);
    }
    const profiles = loadProfiles();
    const next = profiles.filter((p) => p.key !== key);
    if (next.length === profiles.length) {
        console.error(`claude-profile: perfil '${key}' não encontrado.`);
        process.exit(1);
    }
    saveProfiles(next);
    console.log(`Perfil '${key}' removido.`);
}

async function promptAuth(dir) {
    if (!process.stdin.isTTY) {
        console.log(`Autentique quando quiser com:  CLAUDE_CONFIG_DIR=${dir} claude`);
        return;
    }
    const answer = await askYesNo('Autenticar essa conta agora (abre o claude)?', true);
    if (answer === 'yes') {
        spawnSync('claude', [], {
            stdio: 'inherit',
            env: { ...process.env, CLAUDE_CONFIG_DIR: dir },
        });
    } else {
        console.log('');
        console.log(`Autentique quando quiser com:  CLAUDE_CONFIG_DIR=${dir} claude`);
    }
}

async function cmdAdd(argv) {
    const profiles = loadProfiles();
    let key, emoji, label;

    if (argv.length >= 1) {
        // Modo direto (scriptável): claude-profile add <nome> [emoji]
        label = argv[0];
        emoji = argv[1] || DEFAULT_EMOJI;

        const baseSlug = slugify(label);
        key = uniqueKey(baseSlug, profiles);
        if (key !== baseSlug) {
            console.log(`Já existe um perfil com a chave "${baseSlug}" — usando "${key}".`);
        }
    } else {
        // Modo wizard interativo.
        if (!process.stdin.isTTY) {
            console.error('uso: claude-profile add [nome] [emoji]');
            process.exit(1);
        }

        banner();
        console.log(BOLD + 'Novo perfil' + RESET + DIM + '  (Ctrl+C cancela a qualquer momento)' + RESET);
        console.log('');
        console.log(DIM + 'Cada conta fica isolada numa pasta própria — login, histórico e' + RESET);
        console.log(DIM + 'configurações não se misturam entre perfis.' + RESET);
        console.log('');

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        console.log(BOLD + 'Nome' + RESET);
        console.log(DIM + '  Como você quer chamar essa conta (ex: Trabalho). Vira o nome mostrado' + RESET);
        console.log(DIM + '  no seletor, e também dá origem à chave interna — o nome da pasta em' + RESET);
        console.log(DIM + '  ~/.claude-accounts/<chave>, usada com "CLAUDE_PROFILE=<chave> claude"' + RESET);
        console.log(DIM + '  pra pular o seletor direto pra essa conta.' + RESET);
        while (true) {
            label = (await rl.question('  > ')).trim();
            if (!label) {
                console.error('  O nome não pode ser vazio.');
                continue;
            }
            break;
        }
        const baseSlug = slugify(label);
        key = uniqueKey(baseSlug, profiles);
        console.log('');

        console.log(BOLD + 'Emoji' + RESET);
        console.log(DIM + '  Aparece ao lado do nome no seletor, quando você tem 2 ou mais perfis.' + RESET);
        emoji = (await rl.question(`  [${DEFAULT_EMOJI}] > `)).trim() || DEFAULT_EMOJI;
        console.log('');

        console.log(DIM + 'Assim vai aparecer no seletor:' + RESET);
        console.log(`  ${emoji}  ${label}`);
        console.log('');
        if (key !== baseSlug) {
            console.log(DIM + `Já existe um perfil com a chave "${baseSlug}" — esta vai usar "${key}".` + RESET);
            console.log('');
        }

        console.log(BOLD + 'Resumo' + RESET);
        console.log(`  nome:       ${label}`);
        console.log(`  chave:      ${key}`);
        console.log(`  emoji:      ${emoji}`);
        console.log(`  config_dir: ${accountDir(key)}`);
        console.log('');

        rl.close(); // fecha antes de askYesNo, que abre sua própria interface se precisar

        const confirm = await askYesNo('Confirmar?', true);
        if (confirm === 'cancelled') {
            process.exit(1); // Ctrl+C/Esc: sai calado, sem "Cancelado."
        }
        if (confirm === 'no') {
            console.log('Cancelado.');
            process.exit(1);
        }
    }

    const dir = accountDir(key);
    fs.mkdirSync(dir, { recursive: true });
    profiles.push({ key, label, emoji });
    saveProfiles(profiles);
    console.log(`Perfil '${label}' adicionado (chave: ${key}, ${dir}).`);

    await promptAuth(dir);
}

// --- uninstall: remove o núcleo (npm) e a integração de cada shell. ---
// O hook "preuninstall" do próprio pacote (scripts/preuninstall.js) já
// tenta remover os wrappers automaticamente durante o "npm uninstall -g"
// abaixo — mas alguns npm têm uma política de segurança (allow-scripts)
// que bloqueia scripts de lifecycle por padrão, silenciosamente. Por
// isso chamamos removeShellIntegration() diretamente aqui também, como
// garantia — rodar duas vezes é inofensivo (idempotente).

function npmUninstall(pkg) {
    spawnSync('npm', ['uninstall', '-g', pkg], { stdio: 'inherit' });
    const userPrefix = path.join(os.homedir(), '.npm-global');
    if (fs.existsSync(userPrefix)) {
        spawnSync('npm', ['uninstall', '-g', '--prefix', userPrefix, pkg], { stdio: 'inherit' });
    }
}

async function cmdUninstall() {
    const removedFrom = removeShellIntegration();

    npmUninstall(PKG_NAME);
    console.log('');
    if (removedFrom.length > 0) {
        console.log(`Wrapper removido de: ${removedFrom.join(', ')}`);
    } else {
        console.log('Nenhum wrapper de shell encontrado pra remover.');
    }
    console.log('(a linha de PATH pro ~/.npm-global/bin, se foi adicionada durante a');
    console.log('instalação, não foi removida — fica inofensiva sem o pacote instalado,');
    console.log('mas você pode tirá-la manualmente do seu arquivo de config se quiser)');
    console.log('');

    if (process.stdin.isTTY) {
        const wipeAccounts = await askYesNo(
            'Apagar também as contas salvas em ~/.claude-accounts (login, histórico, credenciais)?', false
        );
        if (wipeAccounts === 'yes') {
            fs.rmSync(ROOT, { recursive: true, force: true });
            console.log('~/.claude-accounts removido.');
        } else {
            console.log('~/.claude-accounts mantido.');
        }

        const wipeClaude = await askYesNo(
            'Desinstalar também o Claude Code (@anthropic-ai/claude-code)?', false
        );
        if (wipeClaude === 'yes') {
            npmUninstall('@anthropic-ai/claude-code');
            console.log('Claude Code desinstalado.');
        } else {
            console.log('Claude Code mantido.');
        }
    } else {
        console.log('(terminal não interativo — pulei as perguntas sobre apagar contas/Claude Code)');
    }

    console.log('');
    console.log('Pronto. Abra um terminal novo pra confirmar.');
}

// --- update: compara com o registro npm e reinstala. ---

// npmInstallLocal: se ~/.npm-global já existe (de uma instalação anterior
// que caiu nesse fallback), usa ele direto — sem tentar de novo o prefixo
// global padrão primeiro só pra falhar com EACCES toda vez (isso deixava
// "claude-profile update" cuspindo um erro assustador do npm a cada
// execução, mesmo funcionando). Só tenta o prefixo padrão primeiro quando
// ainda não existe indício de qual prefixo usar.
function npmInstallLocal(target) {
    const userPrefix = path.join(os.homedir(), '.npm-global');

    if (fs.existsSync(userPrefix)) {
        const res = spawnSync('npm', ['install', '-g', '--prefix', userPrefix, target], { stdio: 'inherit' });
        return res.status === 0;
    }

    const res = spawnSync('npm', ['install', '-g', target], { stdio: 'inherit' });
    if (res.status === 0) return true;

    fs.mkdirSync(userPrefix, { recursive: true });
    const res2 = spawnSync('npm', ['install', '-g', '--prefix', userPrefix, target], { stdio: 'inherit' });
    return res2.status === 0;
}

function getInstalledVersion() {
    try {
        return require(path.join(__dirname, '..', 'package.json')).version;
    } catch (_) {
        return null;
    }
}

// checkForUpdate: consulta a versão mais recente publicada no registro
// npm e compara com a versão instalada (lida do próprio package.json do
// pacote). Retorna null se a consulta falhar (ex: sem rede), ou
// { upToDate, installed, latest }.
function checkForUpdate() {
    const installed = getInstalledVersion();
    if (!installed) return null;

    const res = spawnSync('npm', ['view', PKG_NAME, 'version'], { encoding: 'utf8' });
    if (res.status !== 0) return null;
    const latest = (res.stdout || '').trim();
    if (!latest) return null;

    return { upToDate: latest === installed, installed, latest };
}

async function cmdUpdate() {
    console.log('Verificando atualizações...');
    const status = checkForUpdate();
    if (!status) {
        console.error('claude-profile: não consegui checar atualizações (npm view falhou — verifique sua conexão).');
        process.exit(1);
    }
    if (status.upToDate) {
        console.log(`Já está na versão mais recente (${status.installed}).`);
        return;
    }

    console.log('');
    console.log(`Nova versão disponível: ${status.installed} → ${status.latest}`);
    console.log('');

    if (process.stdin.isTTY) {
        const answer = await askYesNo('Atualizar agora?', true);
        if (answer !== 'yes') {
            console.log('Mantendo a versão atual.');
            return;
        }
    } else {
        console.log('(terminal não interativo — atualizando automaticamente)');
    }

    console.log('Atualizando...');
    if (!npmInstallLocal(`${PKG_NAME}@latest`)) {
        console.error('claude-profile: falha ao atualizar via npm.');
        process.exit(1);
    }

    console.log('');
    console.log('Atualizado.');
}

// --- ensure-claude-code: chamado pelo wrapper de shell antes de invocar
// o "claude" real, só quando ele não é encontrado no PATH. Pergunta (com
// "Sim" pré-selecionado, já que a pessoa literalmente acabou de tentar
// usar o claude) antes de instalar — nunca instala sem confirmação. ---
function realClaudeWorks() {
    const res = spawnSync('claude', ['--version'], { stdio: 'ignore' });
    return !res.error && res.status === 0;
}

async function cmdEnsureClaudeCode() {
    if (realClaudeWorks()) {
        process.exit(0);
    }

    if (!process.stdin.isTTY) {
        console.error('claude: Claude Code não encontrado. Instale com: npm install -g @anthropic-ai/claude-code');
        process.exit(1);
    }

    const answer = await askYesNo('Claude Code (comando "claude") não encontrado. Instalar agora via npm?', true);
    if (answer !== 'yes') {
        console.error('claude: Claude Code não instalado. Instale manualmente com: npm install -g @anthropic-ai/claude-code');
        process.exit(1);
    }

    console.log('Instalando @anthropic-ai/claude-code...');
    if (!npmInstallLocal('@anthropic-ai/claude-code')) {
        console.error('claude: falha ao instalar o Claude Code via npm.');
        process.exit(1);
    }

    if (!realClaudeWorks()) {
        console.error('claude: o npm instalou o pacote, mas "claude --version" ainda falha — o');
        console.error('postinstall (que baixa o binário nativo da plataforma) pode não ter');
        console.error('terminado. Abra um terminal novo e tente de novo; se continuar falhando,');
        console.error('rode: npm install -g @anthropic-ai/claude-code');
        process.exit(1);
    }

    console.log('Claude Code instalado e funcionando.');
    process.exit(0);
}

// --- setup: (re)configura os wrappers de shell manualmente. ---
// Normalmente isso já acontece sozinho via o hook "postinstall" do
// pacote, mas alguns npm têm uma política de segurança (allow-scripts)
// que bloqueia scripts de lifecycle por padrão — nesse caso o
// "npm install -g" termina normalmente, mas o postinstall nunca roda, e
// os wrappers ficam faltando sem nenhum erro óbvio. Este comando é a
// rede de segurança: roda a mesma lógica manualmente.
function cmdSetup() {
    const pkgRoot = path.join(__dirname, '..');
    const installed = installShellIntegration(pkgRoot);
    if (installed.length > 0) {
        console.log(`Wrapper configurado pra: ${installed.join(', ')}.`);
        console.log('Abra um terminal novo e rode "claude-profile add".');
    } else {
        console.log('Nenhum shell suportado detectado (fish/bash/zsh/PowerShell).');
    }
}

async function main() {
    const [cmd, ...rest] = process.argv.slice(2);

    switch (cmd) {
        case 'select':
            await cmdSelect();
            break;
        case 'add':
            await cmdAdd(rest);
            break;
        case 'list':
        case 'ls':
            cmdList();
            break;
        case 'remove':
        case 'rm':
            cmdRemove(rest);
            break;
        case 'uninstall':
            await cmdUninstall();
            break;
        case 'update':
            await cmdUpdate();
            break;
        case '__background-update-check':
            await cmdBackgroundUpdateCheck();
            break;
        case 'ensure-claude-code':
            await cmdEnsureClaudeCode();
            break;
        case 'setup':
            cmdSetup();
            break;
        default:
            console.error('uso: claude-profile add [nome] [emoji]');
            console.error('     claude-profile list');
            console.error('     claude-profile remove <chave>');
            console.error('     claude-profile setup');
            console.error('     claude-profile update');
            console.error('     claude-profile uninstall');
            process.exit(1);
    }
}

main().catch((err) => {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
});
