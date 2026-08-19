#!/usr/bin/env node
'use strict';
// Roda automaticamente antes de "npm uninstall -g claude-switcher-core"
// remover os arquivos do pacote. Limpa a integração de shell (arquivos
// fish, linhas em .bashrc/.zshrc/$PROFILE) — nunca mexe em
// ~/.claude-accounts (contas salvas) nem no Claude Code em si; isso é
// coisa de "claude-profile uninstall", não de um hook automático.

const { removeShellIntegration } = require('../lib/shell-integration');

const removed = removeShellIntegration();
if (removed.length > 0) {
    console.log(`claude-switcher: integração de shell removida (${removed.join(', ')}).`);
}
