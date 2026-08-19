#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const readline = require('node:readline/promises');

const ROOT = path.join(os.homedir(), '.claude-accounts');
const PROFILES_FILE = path.join(ROOT, 'profiles.json');
const KEY_RE = /^[a-zA-Z0-9_-]+$/;
const DEFAULT_EMOJI = '👤';
const REPO_URL = 'https://github.com/ArthurViniciusBA1/claude-code-multi-account.git';

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

function hasFzf() {
    const res = spawnSync('fzf', ['--version'], { stdio: 'ignore' });
    return !res.error && res.status === 0;
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
        return "Nenhum perfil configurado. Use: claude-profile add <chave> [emoji] [rótulo]";
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
        // Modo direto (scriptável): claude-profile add <chave> [emoji] [rótulo]
        key = argv[0];
        emoji = argv[1] || DEFAULT_EMOJI;
        label = argv.length >= 3 ? argv.slice(2).join(' ') : key;

        if (!KEY_RE.test(key)) {
            console.error("claude-profile: chave inválida (use só letras, números, '-' ou '_').");
            process.exit(1);
        }
        if (findProfile(profiles, key)) {
            console.error(`claude-profile: perfil '${key}' já existe. Use 'claude-profile remove ${key}' antes de recriar.`);
            process.exit(1);
        }
    } else {
        // Modo wizard interativo.
        if (!process.stdin.isTTY) {
            console.error('uso: claude-profile add <chave> [emoji] [rótulo]');
            process.exit(1);
        }

        banner();
        console.log(BOLD + 'Novo perfil' + RESET + DIM + '  (Ctrl+C cancela a qualquer momento)' + RESET);
        console.log('');
        console.log(DIM + 'Cada conta fica isolada numa pasta própria — login, histórico e' + RESET);
        console.log(DIM + 'configurações não se misturam entre perfis.' + RESET);
        console.log('');

        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        console.log(BOLD + 'Chave' + RESET);
        console.log(DIM + '  Identificador curto. Vira o nome da pasta em ~/.claude-accounts/<chave>' + RESET);
        console.log(DIM + '  e funciona com "CLAUDE_PROFILE=<chave> claude" pra pular o seletor' + RESET);
        console.log(DIM + '  direto pra essa conta.' + RESET);
        while (true) {
            key = (await rl.question('  > ')).trim();
            if (!key) {
                console.error('  A chave não pode ser vazia.');
                continue;
            }
            if (!KEY_RE.test(key)) {
                console.error("  Use só letras, números, '-' ou '_'.");
                continue;
            }
            if (findProfile(profiles, key)) {
                console.error(`  Já existe um perfil com a chave '${key}'.`);
                continue;
            }
            break;
        }
        console.log('');

        console.log(BOLD + 'Emoji' + RESET);
        console.log(DIM + '  Aparece ao lado do rótulo no seletor, quando você tem 2 ou mais perfis.' + RESET);
        emoji = (await rl.question(`  [${DEFAULT_EMOJI}] > `)).trim() || DEFAULT_EMOJI;
        console.log('');

        console.log(BOLD + 'Rótulo' + RESET);
        console.log(DIM + '  Nome legível mostrado no seletor e no "claude-profile list".' + RESET);
        label = (await rl.question(`  [${key}] > `)).trim() || key;
        console.log('');

        console.log(DIM + 'Assim vai aparecer no seletor:' + RESET);
        console.log(`  ${emoji}  ${label}`);
        console.log('');

        console.log(BOLD + 'Resumo' + RESET);
        console.log(`  chave:      ${key}`);
        console.log(`  rótulo:     ${label}`);
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
    console.log(`Perfil '${key}' adicionado (${dir}).`);

    await promptAuth(dir);
}

// --- uninstall: remove o núcleo (npm) e a integração de cada shell. ---
// Não depende de ter o repositório clonado por perto — só precisa do
// claude-switcher-core já estar no PATH, que é exatamente quando faz
// sentido rodar isso.

function npmUninstall(pkg) {
    spawnSync('npm', ['uninstall', '-g', pkg], { stdio: 'ignore' });
    const userPrefix = path.join(os.homedir(), '.npm-global');
    if (fs.existsSync(userPrefix)) {
        spawnSync('npm', ['uninstall', '-g', '--prefix', userPrefix, pkg], { stdio: 'ignore' });
    }
}

function removeLineContaining(filePath, substring) {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const kept = lines.filter((l) => !l.includes(substring));
    if (kept.length === lines.length) return false;
    fs.writeFileSync(filePath, kept.join('\n'));
    return true;
}

function powerShellProfileCandidates() {
    const candidates = new Set();
    const docs = path.join(os.homedir(), 'Documents');
    candidates.add(path.join(docs, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'));
    candidates.add(path.join(docs, 'PowerShell', 'Microsoft.PowerShell_profile.ps1'));
    if (process.platform === 'win32') {
        for (const exe of ['pwsh', 'powershell']) {
            const res = spawnSync(exe, ['-NoProfile', '-Command', '$PROFILE'], { encoding: 'utf8' });
            if (!res.error && res.status === 0) {
                const p = (res.stdout || '').trim();
                if (p) candidates.add(p);
            }
        }
    }
    return [...candidates];
}

async function cmdUninstall() {
    npmUninstall('claude-switcher-core');
    console.log('núcleo (claude-switcher-core) removido do npm (se estava instalado).');

    const removedFrom = [];

    const fishFiles = [
        path.join(os.homedir(), '.config', 'fish', 'functions', 'claude.fish'),
        path.join(os.homedir(), '.config', 'fish', 'functions', 'claude-profile.fish'),
        path.join(os.homedir(), '.config', 'fish', 'conf.d', 'claude-switcher.fish'),
    ];
    let removedFish = false;
    for (const f of fishFiles) {
        if (fs.existsSync(f)) {
            fs.rmSync(f);
            removedFish = true;
        }
    }
    if (removedFish) removedFrom.push('fish');

    if (removeLineContaining(path.join(os.homedir(), '.bashrc'), 'claude-switcher.sh')) {
        removedFrom.push('bash');
    }
    if (removeLineContaining(path.join(os.homedir(), '.zshrc'), 'claude-switcher.sh')) {
        removedFrom.push('zsh');
    }
    let removedPs = false;
    for (const p of powerShellProfileCandidates()) {
        if (removeLineContaining(p, 'claude-switcher.ps1')) removedPs = true;
    }
    if (removedPs) removedFrom.push('PowerShell');

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

// --- update: puxa a versão mais nova do repositório e reinstala. ---
// Não depende do usuário saber onde clonou o repo nem de rodar git/npm
// na mão: `npm install -g <path-local>` normalmente deixa um symlink de
// volta pro clone original, então achamos o clone a partir do próprio
// arquivo em execução. Se não achar nenhum (instalação não é um symlink
// pra um clone git), clona um novo em ~/.claude-code-multi-account.

function findRepoRoot() {
    try {
        const real = fs.realpathSync(__filename); // .../bin/core.js, já resolvido
        const root = path.dirname(path.dirname(real));
        if (fs.existsSync(path.join(root, '.git'))) {
            return root;
        }
    } catch (_) {
        // segue pro fallback
    }
    return null;
}

function npmInstallLocal(target) {
    const res = spawnSync('npm', ['install', '-g', target], { stdio: 'inherit' });
    if (res.status === 0) return true;
    const userPrefix = path.join(os.homedir(), '.npm-global');
    if (fs.existsSync(userPrefix)) {
        const res2 = spawnSync('npm', ['install', '-g', '--prefix', userPrefix, target], { stdio: 'inherit' });
        return res2.status === 0;
    }
    return false;
}

// checkForUpdate: dá um "git fetch" (não mexe na árvore de trabalho) e
// compara HEAD local com o branch remoto. Retorna null se o fetch falhar
// (ex: sem rede), { upToDate: true } se não há nada novo, ou
// { upToDate: false, log } com os commits novos em texto pronto pra exibir.
function checkForUpdate(repoRoot) {
    const fetch = spawnSync('git', ['-C', repoRoot, 'fetch', '--quiet', 'origin'], { stdio: 'inherit' });
    if (fetch.status !== 0) return null;

    const branchRes = spawnSync('git', ['-C', repoRoot, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });
    const branch = (branchRes.stdout || '').trim() || 'main';

    const localRes = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    const remoteRes = spawnSync('git', ['-C', repoRoot, 'rev-parse', `origin/${branch}`], { encoding: 'utf8' });
    const local = (localRes.stdout || '').trim();
    const remote = (remoteRes.stdout || '').trim();
    if (!local || !remote) return null;

    if (local === remote) return { upToDate: true };

    const logRes = spawnSync('git', ['-C', repoRoot, 'log', '--oneline', `${local}..${remote}`], { encoding: 'utf8' });
    return { upToDate: false, log: (logRes.stdout || '').trim() };
}

async function cmdUpdate() {
    let repoRoot = findRepoRoot();
    let freshClone = false;

    if (!repoRoot) {
        const fallback = path.join(os.homedir(), '.claude-code-multi-account');
        if (fs.existsSync(path.join(fallback, '.git'))) {
            repoRoot = fallback;
        } else {
            console.log(`Nenhum clone git encontrado pra essa instalação — clonando em ${fallback}...`);
            const clone = spawnSync('git', ['clone', REPO_URL, fallback], { stdio: 'inherit' });
            if (clone.status !== 0) {
                console.error('claude-profile: falha ao clonar o repositório.');
                process.exit(1);
            }
            repoRoot = fallback;
            freshClone = true;
        }
    }

    if (!freshClone) {
        console.log('Verificando atualizações...');
        const status = checkForUpdate(repoRoot);
        if (!status) {
            console.error('claude-profile: não consegui checar atualizações (git fetch falhou — verifique sua conexão).');
            process.exit(1);
        }
        if (status.upToDate) {
            console.log('Já está na versão mais recente.');
            return;
        }

        console.log('');
        console.log('Novidades disponíveis:');
        console.log(status.log);
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
    }

    console.log(`Atualizando a partir de ${repoRoot}...`);
    const pull = spawnSync('git', ['-C', repoRoot, 'pull', '--ff-only'], { stdio: 'inherit' });
    if (pull.status !== 0) {
        console.error('claude-profile: git pull falhou — resolva manualmente em ' + repoRoot + ' e rode "claude-profile update" de novo.');
        process.exit(1);
    }

    console.log('Reinstalando o núcleo...');
    if (!npmInstallLocal(repoRoot)) {
        console.error('claude-profile: falha ao reinstalar via npm.');
        process.exit(1);
    }

    console.log('');
    console.log('Atualizado.');
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
        default:
            console.error('uso: claude-profile add [chave] [emoji] [rótulo]');
            console.error('     claude-profile list');
            console.error('     claude-profile remove <chave>');
            console.error('     claude-profile update');
            console.error('     claude-profile uninstall');
            process.exit(1);
    }
}

main().catch((err) => {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
});
