# Desinstalador do claude-switcher pra PowerShell.
#
# Uso: .\uninstall.ps1
#
# Remove o núcleo (npm) e a linha adicionada ao $PROFILE. Por padrão NÃO
# apaga suas contas salvas em ~/.claude-accounts nem desinstala o Claude
# Code em si — pergunta [s/N] separadamente pra cada um, sempre com padrão
# "não".

$ErrorActionPreference = "Continue"

if (Get-Command npm -ErrorAction SilentlyContinue) {
    & npm uninstall -g claude-switcher-core *> $null
    Write-Host "núcleo (claude-switcher-core) removido do npm (se estava instalado)."
} else {
    Write-Warning "npm não encontrado — pulei a remoção do pacote."
}

$Removed = $false
if (Test-Path $PROFILE) {
    $Content = @(Get-Content $PROFILE)
    $Filtered = @($Content | Where-Object { $_ -notmatch 'claude-switcher\.ps1' })
    if ($Filtered.Count -ne $Content.Count) {
        Set-Content -Path $PROFILE -Value $Filtered
        $Removed = $true
    }
}

Write-Host ""
if ($Removed) {
    Write-Host "Wrapper removido de `$PROFILE."
} else {
    Write-Host "Nenhuma linha do wrapper encontrada em `$PROFILE."
}
Write-Host ""

if (-not [Console]::IsInputRedirected) {
    $Answer = Read-Host "Apagar também as contas salvas em ~\.claude-accounts (login, histórico, credenciais)? [s/N]"
    if ($Answer -match '^[sSyY]') {
        Remove-Item -Recurse -Force "$HOME\.claude-accounts" -ErrorAction SilentlyContinue
        Write-Host "~\.claude-accounts removido."
    } else {
        Write-Host "~\.claude-accounts mantido."
    }

    $Answer2 = Read-Host "Desinstalar também o Claude Code (@anthropic-ai/claude-code)? [s/N]"
    if ($Answer2 -match '^[sSyY]') {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            & npm uninstall -g "@anthropic-ai/claude-code" *> $null
            Write-Host "Claude Code desinstalado."
        }
    } else {
        Write-Host "Claude Code mantido."
    }
} else {
    Write-Warning "terminal não interativo — pulei as perguntas sobre apagar contas/Claude Code."
}

Write-Host ""
Write-Host "Pronto. Abra um PowerShell novo pra confirmar."
