'use strict';
// Lógica de configurar/remover a integração de cada shell (fish, bash,
// zsh, PowerShell). Compartilhada entre scripts/postinstall.js,
// scripts/preuninstall.js e bin/core.js — pra não duplicar a mesma coisa
// em três lugares.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function appendOnce(filePath, line) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
        // arquivo não existe ainda, tudo bem
    }
    if (content.includes(line)) return false;
    fs.writeFileSync(filePath, content + (content.endsWith('\n') || content === '' ? '' : '\n') + '\n' + line + '\n');
    return true;
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

function detectShells() {
    const has = (cmd) => {
        const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
        return !res.error;
    };
    const shells = [];
    if (has('fish') || fs.existsSync(path.join(os.homedir(), '.config', 'fish'))) shells.push('fish');
    if (has('bash') || fs.existsSync(path.join(os.homedir(), '.bashrc'))) shells.push('bash');
    if (has('zsh') || fs.existsSync(path.join(os.homedir(), '.zshrc'))) shells.push('zsh');
    if (process.platform === 'win32') shells.push('powershell');
    return shells;
}

// installShellIntegration: copia/registra o wrapper de cada shell
// detectado. pkgRoot = raiz do pacote instalado (onde ficam functions/,
// conf.d/, shell/, powershell/). Não pergunta nada — idempotente, seguro
// de rodar de novo.
function installShellIntegration(pkgRoot) {
    const installed = [];
    const shells = detectShells();

    if (shells.includes('fish')) {
        const fnDir = path.join(os.homedir(), '.config', 'fish', 'functions');
        const confDir = path.join(os.homedir(), '.config', 'fish', 'conf.d');
        fs.mkdirSync(fnDir, { recursive: true });
        fs.mkdirSync(confDir, { recursive: true });
        for (const f of fs.readdirSync(path.join(pkgRoot, 'functions'))) {
            fs.copyFileSync(path.join(pkgRoot, 'functions', f), path.join(fnDir, f));
        }
        for (const f of fs.readdirSync(path.join(pkgRoot, 'conf.d'))) {
            fs.copyFileSync(path.join(pkgRoot, 'conf.d', f), path.join(confDir, f));
        }
        installed.push('fish');
    }

    if (shells.includes('bash')) {
        const line = `source "${path.join(pkgRoot, 'shell', 'claude-switcher.sh')}"`;
        appendOnce(path.join(os.homedir(), '.bashrc'), line);
        installed.push('bash');
    }

    if (shells.includes('zsh')) {
        const line = `source "${path.join(pkgRoot, 'shell', 'claude-switcher.sh')}"`;
        appendOnce(path.join(os.homedir(), '.zshrc'), line);
        installed.push('zsh');
    }

    if (process.platform === 'win32') {
        const line = `. "${path.join(pkgRoot, 'powershell', 'claude-switcher.ps1')}"`;
        for (const p of powerShellProfileCandidates()) {
            if (appendOnce(p, line)) installed.push('PowerShell');
        }
    }

    return installed;
}

// removeShellIntegration: remove tudo que installShellIntegration pode ter
// adicionado — em qualquer shell, independente do que está detectado
// AGORA (o usuário pode estar desinstalando de um shell diferente do que
// usava quando instalou).
function removeShellIntegration() {
    const removed = [];

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
    if (removedFish) removed.push('fish');

    if (removeLineContaining(path.join(os.homedir(), '.bashrc'), 'claude-switcher.sh')) {
        removed.push('bash');
    }
    if (removeLineContaining(path.join(os.homedir(), '.zshrc'), 'claude-switcher.sh')) {
        removed.push('zsh');
    }

    let removedPs = false;
    for (const p of powerShellProfileCandidates()) {
        if (removeLineContaining(p, 'claude-switcher.ps1')) removedPs = true;
    }
    if (removedPs) removed.push('PowerShell');

    return removed;
}

module.exports = { installShellIntegration, removeShellIntegration, detectShells };
