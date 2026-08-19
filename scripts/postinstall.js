#!/usr/bin/env node
'use strict';
// Roda automaticamente depois de "npm install -g claude-switcher-core".
// Detecta os shells presentes (fish/bash/zsh/PowerShell) e já registra o
// wrapper em cada um — sem perguntar nada aqui (perguntas interativas
// dentro de scripts de lifecycle do npm são pouco confiáveis, já que o
// stdin nem sempre está conectado a um terminal de verdade). A pergunta
// sobre instalar o Claude Code em si fica pra quando "claude" for
// chamado e detectar que o binário real não existe.

const path = require('node:path');
const { installShellIntegration } = require('../lib/shell-integration');

const pkgRoot = path.join(__dirname, '..');
const installed = installShellIntegration(pkgRoot);

console.log('');
if (installed.length > 0) {
    console.log(`claude-switcher: wrapper configurado pra ${installed.join(', ')}.`);
    console.log('Abra um terminal novo e rode "claude-profile add" pra cadastrar sua primeira conta.');
} else {
    console.log('claude-switcher: nenhum shell suportado detectado (fish/bash/zsh/PowerShell).');
    console.log('Configure manualmente — veja o README do pacote.');
}
console.log('');
