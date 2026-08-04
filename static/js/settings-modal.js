function _backupFetch(path, opts) {
    if (typeof agentFetch === 'function') return agentFetch(path, opts);
    return fetch(path, opts);
}

async function createAndLoadStaticBackup() {
    if (typeof _activeAgent !== 'undefined' && _activeAgent) {
        showToast('Static config backup is included in the dynamic config backup for remote agents', 'info');
        return;
    }
    const btn = document.querySelector('[onclick="createAndLoadStaticBackup()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin"></i> Creating…'; }
    try {
        const res  = await fetch('/api/static/backup/create', { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.success) {
            showToast('Static config backup created', 'success');
            loadBackups();
        } else {
            showToast('Backup failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch(e) { showToast('Backup failed', 'error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-plus"></i> Create Backup'; }
    }
}

function switchBackupTab(id, btn) {
    const isAgent = typeof _activeAgent !== 'undefined' && !!_activeAgent;
    const staticTabBtn = document.getElementById('backup-tab-static');
    if (staticTabBtn) staticTabBtn.style.display = isAgent ? 'none' : '';
    const chip = document.getElementById('backupRemoteChip');
    if (chip) { chip.textContent = isAgent ? _activeAgent.name : ''; chip.style.display = isAgent ? '' : 'none'; }
    if (isAgent && id === 'static') id = 'routes';
    document.querySelectorAll('#mpanel-backups .auth-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#mpanel-backups .auth-sub-panel').forEach(p => p.style.display = 'none');
    if (btn && id !== 'static') btn.classList.add('active');
    const activeTabBtn = document.getElementById('backup-tab-' + id);
    if (activeTabBtn && isAgent && id !== 'static') activeTabBtn.classList.add('active');
    const panel = document.getElementById('backup-sub-' + id);
    if (panel) panel.style.display = 'flex';
    if (id === 'git') loadGitTab();
}

let _gitBackupEnabled  = false;
let _gitAutoPushEnabled = true;

function toggleGitBackupEnabled() {
    _gitBackupEnabled = !_gitBackupEnabled;
    const el = document.getElementById('toggle-git-backup');
    if (el) el.classList.toggle('on', _gitBackupEnabled);
}

function toggleGitAutoPush() {
    _gitAutoPushEnabled = !_gitAutoPushEnabled;
    const el = document.getElementById('toggle-git-autopush');
    if (el) el.classList.toggle('on', _gitAutoPushEnabled);
}

function _gitFetch(path, opts) {
    const isAgent = typeof _activeAgent !== 'undefined' && !!_activeAgent;
    if (isAgent && _activeAgent.git_host_backup) {
        const sep = path.includes('?') ? '&' : '?';
        return fetch(path + sep + 'agent_id=' + encodeURIComponent(_activeAgent.id), opts);
    }
    return _backupFetch(path, opts);
}

let _gitHostAgentOn = false;

function toggleGitHostAgent() {
    _gitHostAgentOn = !_gitHostAgentOn;
    const tog = document.getElementById('toggle-git-host-agent');
    if (tog) tog.classList.toggle('on', _gitHostAgentOn);
}

async function saveGitHostAgent() {
    if (!_activeAgent) return;
    const branch = (document.getElementById('gitHostAgentBranch')?.value || '').trim();
    try {
        const res  = await fetch('/api/agents/' + _activeAgent.id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ git_host_backup: _gitHostAgentOn, git_host_branch: branch }),
        });
        const data = await res.json();
        if (!res.ok || data.error) { showToast(data.error || 'Save failed', 'error'); return; }
        _activeAgent.git_host_backup = _gitHostAgentOn;
        _activeAgent.git_host_branch = branch;
        showToast('Git settings saved', 'success');
        loadGitTab();
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

async function loadGitTab() {
    const isAgent = typeof _activeAgent !== 'undefined' && !!_activeAgent;
    const configForm    = document.getElementById('gitConfigForm');
    const saveBtn       = document.getElementById('gitSaveSettingsBtn');
    const resetBtn      = document.getElementById('gitResetBtn');
    const envNote       = document.getElementById('gitEnvNote');
    const hostForm      = document.getElementById('gitHostAgentForm');
    const testBtn       = document.getElementById('gitTestBtn');
    if (configForm) configForm.style.display = isAgent ? 'none' : 'flex';
    if (saveBtn)    saveBtn.style.display    = isAgent ? 'none' : '';
    if (resetBtn)   resetBtn.style.display   = isAgent ? 'none' : '';
    if (testBtn)    testBtn.style.display    = isAgent ? 'none' : '';
    if (envNote)    envNote.style.display    = isAgent ? '' : 'none';
    if (hostForm)   hostForm.style.display   = isAgent ? 'flex' : 'none';
    if (isAgent) {
        _gitHostAgentOn = !!_activeAgent.git_host_backup;
        const tog = document.getElementById('toggle-git-host-agent');
        if (tog) tog.classList.toggle('on', _gitHostAgentOn);
        const br = document.getElementById('gitHostAgentBranch');
        if (br) br.value = _activeAgent.git_host_branch || (_activeAgent.name || '').toLowerCase().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
    }
    if (!isAgent) {
        try {
            const res  = await fetch('/api/settings');
            const data = await res.json();
            _gitBackupEnabled  = bool(data.git_backup_enabled);
            _gitAutoPushEnabled = bool(data.git_backup_auto_push !== false);
            const tog1 = document.getElementById('toggle-git-backup');
            const tog2 = document.getElementById('toggle-git-autopush');
            if (tog1) tog1.classList.toggle('on', _gitBackupEnabled);
            if (tog2) tog2.classList.toggle('on', _gitAutoPushEnabled);
            _setVal('gitBackupRepo',      data.git_backup_repo || '');
            _setVal('gitBackupBranch',    data.git_backup_branch || 'main');
            _setVal('gitBackupUsername',  data.git_backup_username || '');
            _setVal('gitBackupCommitMsg', data.git_backup_commit_message || 'traefik-manager: {action} at {timestamp}');
            const tokenSet = document.getElementById('gitTokenSet');
            if (tokenSet) tokenSet.style.display = data.git_backup_token_set ? '' : 'none';
        } catch(e) {}
    }
    loadGitStatus();
    loadGitCommits();
}

async function loadGitStatus() {
    try {
        const res  = await _gitFetch('/api/backup/git/status');
        const data = await res.json();
        const line = document.getElementById('gitStatusLine');
        if (!line) return;
        if (data.last_sha) {
            line.style.display = '';
            line.innerHTML = `<i class="ph-bold ph-check-circle" style="color:var(--green)"></i> Last push: <span class="font-mono">${data.last_sha}</span> &middot; ${data.last_push || ''}`;
        } else {
            line.style.display = 'none';
        }
    } catch(e) {}
}

async function loadGitCommits() {
    const list = document.getElementById('gitCommitsList');
    if (!list) return;
    list.innerHTML = `<div class="text-center py-4" style="color:var(--muted)"><i class="ph-light ph-spinner-gap animate-spin text-xl block mb-1"></i></div>`;
    try {
        const res     = await _gitFetch('/api/backup/git/commits');
        const commits = await res.json();
        if (!commits.length) {
            list.innerHTML = `<div class="text-center py-6" style="color:var(--muted)"><i class="ph-light ph-git-commit text-3xl block mb-2 opacity-30"></i><p class="text-xs">No commits yet</p></div>`;
            return;
        }
        list.innerHTML = commits.map(c => `
            <div class="flex items-center justify-between py-2.5 px-3 mb-2 rounded-lg" style="background:var(--bg);border:1px solid var(--border)">
                <div style="min-width:0;flex:1;">
                    <div class="flex items-center gap-1.5">
                        <span class="font-mono text-xs px-1.5 py-0.5 rounded" style="background:var(--input-bg);color:var(--muted);flex-shrink:0;">${c.sha_short}</span>
                        <span class="text-xs truncate" style="color:var(--text)">${_esc(c.message)}</span>
                    </div>
                    <div class="text-xs mt-0.5" style="color:var(--muted)">${c.timestamp}</div>
                </div>
                <div class="flex gap-1 ml-2 flex-shrink-0">
                    <button onclick="gitViewDiff('${c.sha}')" class="btn-secondary text-xs py-1 px-2" title="View diff">
                        <i class="ph-bold ph-code text-xs"></i>
                    </button>
                    <button onclick="gitRestoreCommit('${c.sha}', '${c.sha_short}')" class="btn-secondary text-xs py-1 px-2.5">
                        <i class="ph-bold ph-arrow-counter-clockwise text-xs"></i> Restore
                    </button>
                </div>
            </div>`).join('');
    } catch(e) {
        list.innerHTML = `<p class="text-xs" style="color:var(--red)">Failed to load commits</p>`;
    }
}

async function saveGitBackupSettings() {
    const btn = document.querySelector('[onclick="saveGitBackupSettings()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin"></i> Saving…'; }
    try {
        const settings = await (await fetch('/api/settings')).json();
        const token    = document.getElementById('gitBackupToken')?.value || '';
        const payload  = {
            ...settings,
            git_backup_enabled:        _gitBackupEnabled,
            git_backup_repo:           document.getElementById('gitBackupRepo')?.value.trim() || '',
            git_backup_branch:         document.getElementById('gitBackupBranch')?.value.trim() || 'main',
            git_backup_username:       document.getElementById('gitBackupUsername')?.value.trim() || '',
            git_backup_commit_message: document.getElementById('gitBackupCommitMsg')?.value.trim() || 'traefik-manager: {action} at {timestamp}',
            git_backup_auto_push:      _gitAutoPushEnabled,
        };
        if (token) payload.git_backup_token = token;
        const res  = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) {
            showToast('Git settings saved', 'success');
            document.getElementById('gitBackupToken').value = '';
            const tokenSet = document.getElementById('gitTokenSet');
            if (tokenSet && token) tokenSet.style.display = '';
        } else {
            showToast('Save failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch(e) { showToast('Save failed', 'error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save Git Settings'; }
    }
}

async function gitTestConnection() {
    const btn = document.getElementById('gitTestBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin text-xs"></i> Testing…'; }
    try {
        const isAgent = typeof _activeAgent !== 'undefined' && !!_activeAgent;
        const payload = isAgent ? {} : {
            repo_url: document.getElementById('gitBackupRepo')?.value.trim() || '',
            username: document.getElementById('gitBackupUsername')?.value.trim() || '',
        };
        const token = !isAgent && document.getElementById('gitBackupToken')?.value || '';
        if (token) payload.token = token;
        const res  = await _backupFetch('/api/backup/git/test', { method: 'POST', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.ok) {
            showToast('Connection successful', 'success');
        } else {
            showToast('Connection failed: ' + (data.error || 'Could not reach repository'), 'error');
        }
    } catch(e) {
        showToast('Connection test failed', 'error');
    }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-plugs-connected text-xs"></i> Test'; }
    }
}

async function gitPushNow() {
    const btn = document.getElementById('gitPushBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin text-xs"></i> Pushing…'; }
    const msgEl   = document.getElementById('gitCommitMessage');
    const message = msgEl ? msgEl.value.trim() : '';
    try {
        const res  = await _gitFetch('/api/backup/git/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ message }),
        });
        const data = await res.json();
        if (data.ok) {
            showToast('Pushed successfully', 'success');
            if (msgEl) msgEl.value = '';
            loadGitStatus();
            loadGitCommits();
        } else {
            showToast('Push failed: ' + (data.error || 'Unknown'), 'error');
        }
        if (typeof fetchNotifications === 'function') fetchNotifications();
    } catch(e) {
        showToast('Push failed', 'error');
    }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-cloud-arrow-up text-xs"></i> Push Now'; }
    }
}

async function gitResetRepo() {
    if (!await _confirm('This will delete the local git repository clone. TM will re-initialize it on the next push.\n\nThis does NOT affect your remote repository or any commits.', 'Reset Git Repository', 'Reset')) return;
    const btn = document.getElementById('gitResetBtn');
    if (btn) { btn.disabled = true; }
    try {
        const res  = await _gitFetch('/api/backup/git/repo', { method: 'DELETE', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) {
            showToast('Repository reset - push again to re-initialize', 'success');
            loadGitStatus();
            loadGitCommits();
            if (typeof fetchNotifications === 'function') fetchNotifications();
        } else {
            showToast('Reset failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch(e) { showToast('Reset failed', 'error'); }
    finally {
        if (btn) { btn.disabled = false; }
    }
}

async function gitRestoreCommit(sha, shaShort) {
    if (!await _confirm(`Restore config from commit ${shaShort}? Local backups will be created first.`, 'Git Restore', 'Restore')) return;
    try {
        const res  = await _gitFetch(`/api/backup/git/restore/${sha}`, { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) {
            showToast('Restored successfully', 'success');
            closeSettingsModal();
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('Restore failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch(e) { showToast('Restore failed', 'error'); }
}

async function gitViewDiff(sha) {
    try {
        const res  = await _gitFetch(`/api/backup/git/commit/${sha}/diff`);
        const data = await res.json();
        if (data.error) { showToast('Diff error: ' + data.error, 'error'); return; }
        if (!data.files || !data.files.length) { showToast('No changes in this commit', 'info'); return; }
        if (typeof openGitDiffPopout === 'function') openGitDiffPopout(sha, data.files);
    } catch(e) { showToast('Failed to load diff: ' + (e.message || e), 'error'); }
}

function bool(v) { return v === true || v === 1 || v === 'true'; }
function _setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

let _staticSettingsLoaded = false;
function openStaticSettingsPanel() {
    const warn = document.getElementById('staticDangerWarn');
    if (warn) warn.style.display = localStorage.getItem('staticWarnHidden') === '1' ? 'none' : '';
    if (!_staticSettingsLoaded) {
        refreshStaticTab();
        _staticSettingsLoaded = true;
    }
    requestAnimationFrame(_updateStaticTabArrows);
}

function hideStaticDangerWarn() {
    localStorage.setItem('staticWarnHidden', '1');
    const warn = document.getElementById('staticDangerWarn');
    if (warn) warn.style.display = 'none';
}

function switchAuthTab(id, btn) {
    document.querySelectorAll('#mpanel-auth .auth-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#mpanel-auth .auth-sub-panel').forEach(p => p.style.display = 'none');
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('auth-sub-' + id);
    if (panel) panel.style.display = 'flex';
}

function switchSystemTab(id, btn) {
    document.querySelectorAll('#mpanel-system .auth-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#mpanel-system .auth-sub-panel').forEach(p => p.style.display = 'none');
    if (btn) btn.classList.add('active');
    const panel = document.getElementById('system-sub-' + id);
    if (panel) panel.style.display = 'flex';
}

function _updateSettingsSidebarForAgent(active) {
    const localOnly = ['auth', 'connection', 'notifications'];
    localOnly.forEach(id => {
        const btn = document.getElementById('msb-' + id);
        if (btn) btn.style.display = active ? 'none' : '';
        const mob = document.getElementById('msb-' + id + '-mobile');
        if (mob) mob.style.display = active ? 'none' : '';
    });
    const staticBtn = document.getElementById('msb-static');
    if (staticBtn && active) staticBtn.style.display = 'none';
    const staticMob = document.getElementById('msb-static-mobile');
    if (staticMob && active) staticMob.style.display = 'none';
    const keysBtn = document.getElementById('msb-agent-keys');
    if (keysBtn) keysBtn.style.display = active ? '' : 'none';
    const keysMob = document.getElementById('msb-agent-keys-mobile');
    if (keysMob) keysMob.style.display = active ? '' : 'none';
    const csTab = document.getElementById('system-tab-crowdsec');
    if (csTab) {
        csTab.style.display = active ? 'none' : '';
        if (active && csTab.classList.contains('active')) {
            const firstTab = document.querySelector('#mpanel-system .auth-sub-tab:not([style*="display: none"])');
            if (firstTab) firstTab.click();
        }
    }
}

async function _loadAboutAgentInfo() {
    const row = document.getElementById('sm-agent-version-row');
    if (!row) return;
    if (!_activeAgent) { row.classList.add('hidden'); return; }
    document.getElementById('agentVersionName').textContent = _activeAgent.name;
    document.getElementById('agentVersionCurrent').textContent = '-';
    document.getElementById('agentVersionHint').classList.add('hidden');
    row.classList.remove('hidden');
    row.style.display = 'flex';
    try {
        const d = await fetch('/api/agents/' + _activeAgent.id + '/health').then(r => r.json());
        const cur = (d.version || '').replace(/^v/, '');
        if (!cur) return;
        document.getElementById('agentVersionCurrent').textContent = 'v' + cur;
        const latest = (document.getElementById('mgrUpdateLatestVer').textContent || '').replace(/^v/, '');
        if (latest && latest !== '-' && compareVersions(latest, cur) > 0) {
            const hint = document.getElementById('agentVersionHint');
            hint.textContent = 'v' + latest + ' available';
            hint.classList.remove('hidden');
        }
    } catch (e) {}
}

function switchSettingsPanel(id, btn) {
    document.querySelectorAll('.modal-sidebar-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.modal-panel').forEach(p => p.classList.remove('active'));
    const activeBtn = btn || document.getElementById('msb-' + id);
    if (activeBtn) activeBtn.classList.add('active');
    document.getElementById('mpanel-' + id).classList.add('active');
    if (id === 'about') _loadAboutAgentInfo();
    if (window.innerWidth < 640) {
        const titles = {connection:'Connection',routes:'Route Monitoring',system:'System Monitoring',auth:'Authentication',backups:'Backups',static:'Static Config',ui:'Interface',notifications:'Notifications',about:'About','agent-keys':'API Keys'};
        document.getElementById('settingsModalTitle').textContent = titles[id] || 'Settings';
        document.getElementById('settingsGearIcon').style.display = 'none';
        document.getElementById('settingsMobileRoot').style.display = 'none';
        document.getElementById('settingsPanelWrapper').style.display = 'flex';
        document.getElementById('settingsMobileBack').style.display = 'flex';
    }
}

function settingsMobileBack() {
    document.getElementById('settingsMobileRoot').style.display = 'flex';
    document.getElementById('settingsPanelWrapper').style.display = 'none';
    document.getElementById('settingsMobileBack').style.display = 'none';
    document.getElementById('settingsGearIcon').style.display = '';
    document.getElementById('settingsModalTitle').textContent = 'Settings';
}

async function openSettingsModal(panel) {
    document.getElementById('settingsSavedNotice').classList.add('hidden');
    document.getElementById('apiTestResult').textContent = '';

    ['pwCurrent','pwNew','pwConfirm'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    const msg = document.getElementById('pwChangeMsg');
    if (msg) { msg.classList.add('hidden'); msg.textContent = ''; }
    const apikeyDisplay = document.getElementById('apikeyDisplay');
    if (apikeyDisplay) apikeyDisplay.classList.add('hidden');
    const apikeyValue = document.getElementById('apikeyValue');
    if (apikeyValue) apikeyValue.value = '';

    document.getElementById('settingsModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _updateSettingsSidebarForAgent(!!_activeAgent);

    if (window.innerWidth < 768 && !panel) {
        document.getElementById('settingsMobileRoot').style.display = 'flex';
        document.getElementById('settingsPanelWrapper').style.display = 'none';
        document.getElementById('settingsMobileBack').style.display = 'none';
        document.getElementById('settingsGearIcon').style.display = '';
        document.getElementById('settingsModalTitle').textContent = 'Settings';
    } else {
        document.getElementById('settingsMobileRoot').style.display = 'none';
        document.getElementById('settingsPanelWrapper').style.display = 'flex';
        if (panel) switchSettingsPanel(panel);
    }

    try {
        const res  = await fetch('/api/settings');
        const data = await res.json();
        document.getElementById('settingsDomains').value          = (data.domains || []).join(', ');
        syncThemeButtons(data.default_theme || 'dark');
        document.getElementById('settingsCertResolver').value     = data.cert_resolver || '';
        document.getElementById('settingsApiUrl').value           = data.traefik_api_url || '';
        document.getElementById('settingsApiUser').value          = data.traefik_api_user || '';
        const apiPwHint = document.getElementById('apiPasswordSetHint');
        if (apiPwHint) apiPwHint.classList.toggle('hidden', !data.traefik_api_password_set);
        document.getElementById('settingsAcmeJsonPath').value     = data.acme_json_path || '';
        document.getElementById('settingsAccessLogPath').value    = data.access_log_path || '';
        document.getElementById('settingsStaticConfigPath').value = data.static_config_path || '';
        document.getElementById('settingsCrowdSecUrl').value      = data.crowdsec_lapi_url || '';
        const csKeyHint = document.getElementById('crowdsecKeySetHint');
        if (csKeyHint) csKeyHint.classList.toggle('hidden', !data.crowdsec_api_key_set);
        const csMidEl = document.getElementById('settingsCrowdSecMachineId');
        if (csMidEl) csMidEl.value = data.crowdsec_machine_id || '';
        const csMachineHint = document.getElementById('crowdsecMachineSetHint');
        if (csMachineHint) csMachineHint.classList.toggle('hidden', !data.crowdsec_machine_password_set);
        const whEl = document.getElementById('webhookUrlInput');
        if (whEl) whEl.value = data.webhook_url || '';
        const whType = document.getElementById('webhookTypeSelect');
        if (whType) whType.value = data.webhook_type || 'discord';
        const whUser = document.getElementById('webhookUsername');
        if (whUser) whUser.value = data.webhook_username || '';
        onWebhookTypeChange();

        if (data.visible_tabs) {
            _localTabsCache = data.visible_tabs;
            if (!_activeAgent) _visibleTabsCache = data.visible_tabs;
        }
        loadTabTogglesIntoModal();
        loadUiTogglesIntoModal();
        _applyTraefikBadgeVisibility();
        _applyTmBadgeVisibility();
        _applyDocsLinkVisibility();
        _applyApiLinkVisibility();
        loadOtpStatus();
        loadApiKeyStatus();
        loadOidcStatus();
        loadSelfRoute();

        const authSection   = document.getElementById('authSection');
        const toggleBtn     = document.getElementById('authToggleBtn');
        const stateLabel    = document.getElementById('authStateLabel');
        const toggleLabel   = document.getElementById('authToggleLabel');
        const envForcedNote = document.getElementById('authEnvForcedNote');
        const changePwForm  = document.getElementById('changePwForm');

        if (data.has_password !== undefined) {
            document.getElementById('authHiddenMsg') && (document.getElementById('authHiddenMsg').classList.add('hidden'));
            const isOn = data.auth_enabled;
            stateLabel.textContent  = isOn ? 'enabled' : 'disabled';
            stateLabel.style.color  = isOn ? 'var(--green)' : 'var(--muted)';
            if (!data.auth_env_forced && toggleBtn) {
                toggleBtn.classList.remove('hidden');
                toggleLabel.textContent = isOn ? 'Disable' : 'Enable';
            } else {
                envForcedNote.classList.remove('hidden');
            }
            if (changePwForm) changePwForm.style.display = isOn ? '' : 'none';
        }
        const noAuthWarn = document.getElementById('noAuthWarning');
        if (noAuthWarn) noAuthWarn.style.display = data.no_auth ? '' : 'none';
    } catch(e) {
        console.error('Could not load settings', e);
    }
    const target = panel || 'ui';
    switchSettingsPanel(target);
    if (target === 'backups') loadBackups();
}

function closeSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function changePassword() {
    const current = document.getElementById('pwCurrent').value;
    const newPw   = document.getElementById('pwNew').value;
    const confirm = document.getElementById('pwConfirm').value;
    const msg     = document.getElementById('pwChangeMsg');

    const show = (text, ok) => {
        msg.textContent  = text;
        msg.style.background = ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)';
        msg.style.border     = ok ? '1px solid rgba(63,185,80,0.3)' : '1px solid rgba(248,81,73,0.3)';
        msg.style.color      = ok ? 'var(--green)' : 'var(--red)';
        msg.classList.remove('hidden');
    };

    if (!current || !newPw || !confirm) return show('Please fill in all fields.', false);
    if (newPw.length < 8)              return show('New password must be at least 8 characters.', false);
    if (newPw !== confirm)             return show('Passwords do not match.', false);

    try {
        const res  = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token'] },
            body: JSON.stringify({ current_password: current, new_password: newPw, confirm_password: confirm })
        });
        const data = await res.json();
        if (data.success) {
            show('Password updated successfully.', true);
            ['pwCurrent','pwNew','pwConfirm'].forEach(id => document.getElementById(id).value = '');
        } else {
            show(data.error || 'Failed to update password.', false);
        }
    } catch(e) {
        show('Request failed.', false);
    }
}

async function toggleAuth() {
    const stateLabel  = document.getElementById('authStateLabel');
    const toggleLabel = document.getElementById('authToggleLabel');
    const changePwForm = document.getElementById('changePwForm');
    const currentlyOn = stateLabel.textContent === 'enabled';
    const newState    = !currentlyOn;

    if (currentlyOn && !await _confirm('Disable built-in authentication? Anyone who can reach this URL will have full access.', 'Disable Authentication', 'Disable')) return;

    try {
        const res  = await fetch('/api/auth/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token'] },
            body: JSON.stringify({ auth_enabled: newState })
        });
        const data = await res.json();
        if (data.success) {
            if (data.reauth_required) return _redirectToLoginAfterAuthEnable('Authentication enabled');
            stateLabel.textContent = newState ? 'enabled' : 'disabled';
            stateLabel.style.color = newState ? 'var(--green)' : 'var(--muted)';
            toggleLabel.textContent = newState ? 'Disable' : 'Enable';
            if (changePwForm) changePwForm.style.display = newState ? '' : 'none';
            const naw = document.getElementById('noAuthWarning'); if (naw) naw.style.display = 'none';
            showToast(`Authentication ${newState ? 'enabled' : 'disabled'}.`, 'success');
        } else {
            showToast(data.error || 'Failed to update auth.', 'error');
        }
    } catch(e) {
        showToast('Request failed.', 'error');
    }
}

function onWebhookTypeChange() {
    const type = document.getElementById('webhookTypeSelect')?.value;
    const authFields = document.getElementById('webhookAuthFields');
    if (authFields) authFields.style.display = (type === 'ntfy' || type === 'generic') ? '' : 'none';
}

async function testWebhook() {
    const url      = document.getElementById('webhookUrlInput')?.value.trim();
    const wtype    = document.getElementById('webhookTypeSelect')?.value || 'discord';
    const username = document.getElementById('webhookUsername')?.value.trim() || '';
    const password = document.getElementById('webhookPassword')?.value || '';
    const res = document.getElementById('webhookTestResult');
    if (!url) { if (res) { res.style.display=''; res.style.color='var(--red)'; res.textContent='Enter a webhook URL first.'; } return; }
    if (res) { res.style.display=''; res.style.color='var(--muted)'; res.textContent='Sending...'; }
    try {
        const r = await fetch('/api/settings/webhook-test', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token':_csrfHeaders()['X-CSRF-Token']}, body: JSON.stringify({url, webhook_type: wtype, username, password}) });
        const d = await r.json();
        if (res) { res.style.color = d.ok ? 'var(--green)' : 'var(--red)'; res.textContent = d.ok ? 'Delivered.' : (d.error || 'Failed.'); }
    } catch(e) { if (res) { res.style.color='var(--red)'; res.textContent='Request failed.'; } }
}

let _geoipEnabledState = false;

async function loadGeoipSettings() {
    try {
        const r = await fetch('/api/geoip/status').then(r => r.json());
        _geoipEnabledState = !!r.enabled;
        const tog = document.getElementById('toggle-geoip');
        if (tog) tog.classList.toggle('on', _geoipEnabledState);
        const st = document.getElementById('geoipDbStatus');
        if (st) st.textContent = r.available ? `Ready${r.db_date ? ' - ' + r.db_date : ''}` : 'Not downloaded';
        const btn = document.getElementById('geoipUpdateBtn');
        if (btn) btn.innerHTML = r.available ? '<i class="ph-bold ph-arrows-clockwise text-xs"></i> Update' : '<i class="ph-bold ph-download-simple text-xs"></i> Download';
    } catch(_) {}
}

async function toggleGeoip() {
    _geoipEnabledState = !_geoipEnabledState;
    const tog = document.getElementById('toggle-geoip');
    if (tog) tog.classList.toggle('on', _geoipEnabledState);
    try {
        const sv = await fetch('/api/settings/geoip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ geoip_enabled: _geoipEnabledState })
        }).then(r => r.json());
        if (!sv || sv.success === false) throw new Error();
        if (typeof _geoStatusLoaded !== 'undefined') { try { await loadGeoStatus(true); } catch(_) {} }
        if (_geoipEnabledState) {
            const r = await fetch('/api/geoip/status').then(r => r.json());
            if (!r.available) { showToast('Geolocation on - downloading database...', 'info'); updateGeoipDb(); }
        }
        loadGeoipSettings();
    } catch(_) {
        _geoipEnabledState = !_geoipEnabledState;
        if (tog) tog.classList.toggle('on', _geoipEnabledState);
        showToast('Failed to save', 'error');
    }
}

async function updateGeoipDb(btn) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-bold ph-spinner-gap animate-spin text-xs"></i> Downloading...'; }
    try {
        const r = await fetch('/api/geoip/update', { method: 'POST', headers: _csrfHeaders() }).then(r => r.json());
        if (r.success) {
            showToast(`GeoIP database updated (DB-IP ${r.db_month})`, 'success');
            if (typeof _geoStatusLoaded !== 'undefined') { _geoStatusLoaded = false; try { await loadGeoStatus(true); } catch(_) {} }
        } else {
            showToast(r.error || 'Download failed', 'error');
        }
    } catch(_) { showToast('Download failed', 'error'); }
    finally { if (btn) btn.disabled = false; loadGeoipSettings(); }
}

async function saveSettings() {
    const domains          = document.getElementById('settingsDomains').value.split(',').map(d => d.trim()).filter(Boolean);
    const resolver         = document.getElementById('settingsCertResolver').value.trim();
    const apiUrl           = document.getElementById('settingsApiUrl').value.trim();
    const acmeJsonPath     = document.getElementById('settingsAcmeJsonPath')?.value.trim() || '';
    const accessLogPath    = document.getElementById('settingsAccessLogPath')?.value.trim() || '';
    const staticConfigPath = document.getElementById('settingsStaticConfigPath')?.value.trim() || '';
    const webhookUrl        = document.getElementById('webhookUrlInput')?.value.trim() || '';
    const webhookType       = document.getElementById('webhookTypeSelect')?.value || 'discord';
    const webhookUsername   = document.getElementById('webhookUsername')?.value.trim() || '';
    const webhookPassword   = document.getElementById('webhookPassword')?.value || '';
    const crowdsecLapiUrl     = document.getElementById('settingsCrowdSecUrl')?.value.trim() || '';
    const crowdsecApiKey      = document.getElementById('settingsCrowdSecKey')?.value || '';
    const crowdsecMachineId       = document.getElementById('settingsCrowdSecMachineId')?.value.trim() || '';
    const crowdsecMachinePassword = document.getElementById('settingsCrowdSecMachinePassword')?.value || '';
    const traefikApiUser      = document.getElementById('settingsApiUser')?.value.trim() || '';
    const traefikApiPassword  = document.getElementById('settingsApiPassword')?.value || '';
    if (!domains.length) return;
    try {
        const res  = await fetch('/api/settings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token']},
            body: JSON.stringify({ domains, cert_resolver: resolver, traefik_api_url: apiUrl, acme_json_path: acmeJsonPath, access_log_path: accessLogPath, static_config_path: staticConfigPath, webhook_url: webhookUrl, webhook_type: webhookType, webhook_username: webhookUsername, webhook_password: webhookPassword, crowdsec_lapi_url: crowdsecLapiUrl, crowdsec_api_key: crowdsecApiKey, crowdsec_machine_id: crowdsecMachineId, crowdsec_machine_password: crowdsecMachinePassword, traefik_api_user: traefikApiUser, traefik_api_password: traefikApiPassword })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('settingsSavedNotice').classList.remove('hidden');
            document.getElementById('pathsSavedNotice')?.classList.remove('hidden');
            setTimeout(() => document.getElementById('pathsSavedNotice')?.classList.add('hidden'), 3000);
            document.getElementById('crowdsecSavedNotice')?.classList.remove('hidden');
            setTimeout(() => document.getElementById('crowdsecSavedNotice')?.classList.add('hidden'), 3000);
            if (crowdsecApiKey) {
                document.getElementById('settingsCrowdSecKey').value = '';
                document.getElementById('crowdsecKeySetHint')?.classList.remove('hidden');
            }
            if (crowdsecMachinePassword) {
                document.getElementById('settingsCrowdSecMachinePassword').value = '';
                document.getElementById('crowdsecMachineSetHint')?.classList.remove('hidden');
            }
            if (traefikApiPassword) {
                document.getElementById('settingsApiPassword').value = '';
                document.getElementById('apiPasswordSetHint')?.classList.remove('hidden');
            }
            if (typeof availableDomains !== 'undefined') {
                availableDomains.length = 0;
                domains.forEach(d => availableDomains.push(d));
                const sel = document.getElementById('domain');
                if (sel) sel.innerHTML = domains.map(d => `<option value="${d}">${d}</option>`).join('');
            }
            setTimeout(() => document.getElementById('settingsSavedNotice').classList.add('hidden'), 3000);
        } else {
            showToast(data.error || 'Failed to save settings', 'error');
        }
    } catch(e) {
        showToast('Failed to save settings', 'error');
    }
}

async function resetCrowdSecConfig() {
    if (!confirm('Remove the saved CrowdSec LAPI URL and API key?')) return;
    document.getElementById('settingsCrowdSecUrl').value = '';
    document.getElementById('settingsCrowdSecKey').value = '';
    document.getElementById('crowdsecKeySetHint')?.classList.add('hidden');
    const csMid = document.getElementById('settingsCrowdSecMachineId');
    if (csMid) csMid.value = '';
    const csMpw = document.getElementById('settingsCrowdSecMachinePassword');
    if (csMpw) csMpw.value = '';
    document.getElementById('crowdsecMachineSetHint')?.classList.add('hidden');
    await saveSettings();
}

async function testTraefikApi() {
    const result = document.getElementById('apiTestResult');
    result.textContent = 'Testing…';
    result.style.color = 'var(--muted)';
    try {
        const url  = document.getElementById('settingsApiUrl')?.value.trim() || '';
        const user = document.getElementById('settingsApiUser')?.value.trim() || '';
        const pw   = document.getElementById('settingsApiPassword')?.value || '';
        const res  = await fetch('/api/settings/test-connection', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token']},
            body: JSON.stringify({ url, user, password: pw })
        });
        const d = await res.json();
        if (d.ok) {
            result.textContent = `✓ Connected - Traefik v${d.version}`;
            result.style.color = 'var(--green)';
        } else {
            result.textContent = `✗ ${d.error || 'No response from API'}`;
            result.style.color = 'var(--red)';
        }
    } catch(e) {
        result.textContent = '✗ Connection failed';
        result.style.color = 'var(--red)';
    }
}

function _renderBackupList(containerId, backups) {
    const list = document.getElementById(containerId);
    if (!list) return;
    if (!backups.length) {
        list.innerHTML = `<div class="text-center py-8" style="color:var(--muted)"><i class="ph-light ph-archive text-4xl block mb-2 opacity-30"></i><p>No backups yet</p></div>`;
        return;
    }
    list.innerHTML = backups.map(b => `
        <div class="flex items-center justify-between py-2.5 rounded-lg px-3 mb-2" style="background:var(--bg);border:1px solid var(--border)">
            <div>
                <div class="font-mono text-xs" style="color:var(--text)">${b.name}</div>
                <div class="text-xs mt-0.5" style="color:var(--muted)">${b.modified} · ${formatBytes(b.size)}</div>
            </div>
            <div class="flex gap-1">
                <button onclick="restoreBackup('${b.name}')" class="btn-secondary text-xs py-1 px-2.5">
                    <i class="ph-bold ph-arrow-counter-clockwise text-xs"></i> Restore
                </button>
                <button onclick="deleteBackup('${b.name}')" class="btn-danger p-1.5">
                    <i class="ph-bold ph-trash text-sm"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function loadBackups() {
    const isAgent    = typeof _activeAgent !== 'undefined' && !!_activeAgent;
    const staticTab  = document.getElementById('backup-tab-static');
    if (staticTab)  staticTab.style.display = isAgent ? 'none' : '';
    const chip = document.getElementById('backupRemoteChip');
    if (chip) { chip.textContent = isAgent ? _activeAgent.name : ''; chip.style.display = isAgent ? '' : 'none'; }
    const retRow     = document.getElementById('backupRetentionRow');
    const retEnvNote = document.getElementById('backupRetentionEnvNote');
    if (retRow)     retRow.style.display     = isAgent ? 'none' : 'flex';
    if (retEnvNote) retEnvNote.style.display = isAgent ? '' : 'none';
    const gitPane = document.getElementById('backup-sub-git');
    if (gitPane && gitPane.style.display !== 'none') loadGitTab();
    if (!isAgent) {
        try {
            const sres = await fetch('/api/settings');
            const sdat = await sres.json();
            _setVal('backupKeepCount', (sdat.backup_keep_count ?? 0));
            _setVal('backupKeepCountStatic', (sdat.backup_keep_count ?? 0));
        } catch (e) {}
    }
    const routesList  = document.getElementById('sm-backups-list');
    const staticList  = document.getElementById('sm-static-backups-list');
    const spinner = `<div class="text-center py-8" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-2xl animate-spin block mb-2"></i>Loading…</div>`;
    if (routesList) routesList.innerHTML = spinner;
    if (staticList) staticList.innerHTML = spinner;
    try {
        const res  = await _backupFetch('/api/backups');
        const raw  = await res.json();
        if (!res.ok) {
            const msg = raw.error || `Error ${res.status}`;
            if (routesList) routesList.innerHTML = `<p class="text-sm px-1" style="color:var(--red)">${_esc(msg)}</p>`;
            if (staticList) staticList.innerHTML = '';
            return;
        }
        const rawArr  = Array.isArray(raw) ? raw : (raw.backups || []);
        const backups = rawArr.map(b => ({ ...b, modified: b.modified || b.date || '' }));
        const routes  = isAgent ? backups : backups.filter(b => b.kind !== 'static');
        const statics = backups.filter(b => b.kind === 'static');
        _renderBackupList('sm-backups-list', routes);
        if (!isAgent) _renderBackupList('sm-static-backups-list', statics);
    } catch (e) {
        if (routesList) routesList.innerHTML = `<p class="text-sm px-1" style="color:var(--red)">Failed to load backups</p>`;
        if (staticList) staticList.innerHTML = `<p class="text-sm px-1" style="color:var(--red)">Failed to load backups</p>`;
    }
}

async function saveBackupKeepCount(sourceId) {
    const input = document.getElementById(sourceId || 'backupKeepCount');
    if (!input) return;
    const btnId = sourceId === 'backupKeepCountStatic' ? 'backupKeepBtnStatic' : 'backupKeepBtn';
    const btn   = document.getElementById(btnId);
    let n = parseInt(input.value, 10);
    if (isNaN(n) || n < 0) n = 0;
    _setVal('backupKeepCount', n);
    _setVal('backupKeepCountStatic', n);
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin text-xs"></i> Saving…'; }
    try {
        const res = await fetch('/api/settings/backup-retention', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ backup_keep_count: n }),
        });
        if (res.ok) showToast('Retention saved', 'success');
        else        showToast('Failed to save retention', 'error');
    } catch (e) {
        showToast('Failed to save retention', 'error');
    }
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Save'; }
}

async function createAndLoadBackups() {
    const btn = document.querySelector('[onclick="createAndLoadBackups()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin"></i> Creating…'; }
    try {
        const res  = await _backupFetch('/api/backup/create', { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.success || data.ok) {
            const n = data.count || 1;
            showToast(`Backup created (${n} file${n > 1 ? 's' : ''})`, 'success');
            loadBackups();
        } else {
            showToast('Backup failed: ' + (data.error || 'Unknown'), 'error');
        }
    } catch(e) { showToast('Backup failed', 'error'); }
    finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ph-bold ph-plus"></i> Create Backup'; }
    }
}

async function restoreBackup(name) {
    if (!await _confirm(`Restore backup "${name}"? Your current config will be backed up first.`, 'Restore Backup', 'Restore')) return;
    try {
        const res  = await _backupFetch(`/api/restore/${encodeURIComponent(name)}`, { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.success || data.ok) {
            showToast('Backup restored successfully!', 'success');
            closeSettingsModal();
            setTimeout(() => location.reload(), 1500);
        } else {
            showToast('Restore failed: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('Restore failed', 'error');
    }
}

async function deleteBackup(name) {
    if (!await _confirm(`Delete backup "${name}"?`, 'Delete Backup', 'Delete')) return;
    try {
        const res  = await _backupFetch(`/api/backup/delete/${encodeURIComponent(name)}`, { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.success || data.ok) { showToast('Backup deleted', 'success'); loadBackups(); }
        else showToast('Delete failed: ' + data.error, 'error');
    } catch(e) { showToast('Delete failed', 'error'); }
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
}

function toggleTraefikBadge() {
    const show = tmPref('showTraefikBadge');
    tmSetPref('showTraefikBadge', !show);
    _applyTraefikBadgeVisibility();
}

function toggleRouteIcons() {
    const show = tmPref('showRouteIcons');
    tmSetPref('showRouteIcons', !show);
    window._showRouteIcons = !show;
    const tog = document.getElementById('toggle-route-icons');
    if (tog) tog.classList.toggle('on', !show);
    if (typeof renderRouteGrid === 'function' && window._lastRenderedApps) {
        renderRouteGrid(window._lastRenderedApps);
        if (typeof filterRoutes === 'function') filterRoutes();
    }
}

function _applyTraefikBadgeVisibility() {
    const show = tmPref('showTraefikBadge');
    const hasVersion = (document.getElementById('versionText').textContent || '').trim() !== '-';
    const badge  = document.getElementById('versionBadge');
    const badgeM = document.getElementById('versionBadgeMobile');
    if (badge)  badge.classList.toggle('hidden', !show || !hasVersion);
    if (badgeM) {
        badgeM.classList.toggle('hidden', !show || !hasVersion);
        if (show && hasVersion) badgeM.classList.add('flex');
    }
    const tog = document.getElementById('toggle-traefik-badge');
    if (tog) tog.classList.toggle('on', show);
}

function toggleTmBadge() {
    const show = tmPref('showTmBadge');
    tmSetPref('showTmBadge', !show);
    _applyTmBadgeVisibility();
}

function _applyTmBadgeVisibility() {
    const show = tmPref('showTmBadge');
    const hasVersion = (document.getElementById('tmVersionText').textContent || '').trim() !== '-';
    const badge  = document.getElementById('tmVersionBadge');
    const badgeM = document.getElementById('tmVersionBadgeMobile');
    if (badge)  badge.classList.toggle('hidden', !show || !hasVersion);
    if (badgeM) {
        badgeM.classList.toggle('hidden', !show || !hasVersion);
        if (show && hasVersion) badgeM.classList.add('flex');
    }
    const tog = document.getElementById('toggle-tm-badge');
    if (tog) tog.classList.toggle('on', show);
}

function toggleShortcutsBtn() {
    const show = tmPref('showShortcutsBtn');
    tmSetPref('showShortcutsBtn', !show);
    document.documentElement.classList.toggle('tm-hide-shortcuts', show);
    const t = document.getElementById('toggle-shortcuts-btn');
    if (t) t.classList.toggle('on', !show);
}

function toggleIpDiagBtn() {
    const show = tmPref('showIpDiagBtn');
    tmSetPref('showIpDiagBtn', !show);
    document.documentElement.classList.toggle('tm-hide-ipdiag', show);
    const t = document.getElementById('toggle-ipdiag-btn');
    if (t) t.classList.toggle('on', !show);
}

function toggleDocsLink() {
    const show = tmPref('showDocsLink');
    tmSetPref('showDocsLink', !show);
    _applyDocsLinkVisibility();
}

function _applyDocsLinkVisibility() {
    const show = tmPref('showDocsLink');
    document.documentElement.classList.toggle('tm-hide-docs', !show);
    document.querySelectorAll('.nav-docs-link').forEach(el => el.classList.toggle('hidden', !show));
    const tog = document.getElementById('toggle-docs-link');
    if (tog) tog.classList.toggle('on', show);
}

function toggleApiLink() {
    const show = tmPref('showApiLink');
    tmSetPref('showApiLink', !show);
    _applyApiLinkVisibility();
}

function _applyApiLinkVisibility() {
    const show = tmPref('showApiLink');
    document.documentElement.classList.toggle('tm-hide-api', !show);
    document.querySelectorAll('.nav-api-link').forEach(el => el.classList.toggle('hidden', !show));
    const tog = document.getElementById('toggle-api-link');
    if (tog) tog.classList.toggle('on', show);
}

function renderReleaseNotes(md) {
    function esc(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function inline(s) {
        return esc(s)
            .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
            .replace(/`([^`]+)`/g, '<code style="background:var(--border);padding:1px 5px;border-radius:3px;font-size:11px;font-family:monospace">$1</code>')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--blue);text-decoration:none">$1</a>');
    }
    function isTableRow(l) { const t = l.trim(); return t.startsWith('|') && t.endsWith('|'); }
    function isSepRow(l) { return l.replace(/^\||\|$/g, '').split('|').every(c => /^[\s\-:]+$/.test(c)); }
    function parseCells(l) { return l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()); }

    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let html = '', inList = false, i = 0;

    while (i < lines.length) {
        const line = lines[i].trimEnd();

        // Table - collect all consecutive table rows
        if (isTableRow(line)) {
            if (inList) { html += '</ul>'; inList = false; }
            const block = [];
            while (i < lines.length && isTableRow(lines[i].trimEnd())) { block.push(lines[i].trimEnd()); i++; }
            const rows = block.filter(l => !isSepRow(l));
            if (rows.length) {
                html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin:6px 0">';
                rows.forEach((row, idx) => {
                    const tag = idx === 0 ? 'th' : 'td';
                    const st  = idx === 0
                        ? 'padding:3px 8px;border-bottom:1px solid var(--border);color:var(--text);font-weight:600;text-align:left;white-space:nowrap'
                        : 'padding:3px 8px;border-bottom:1px solid var(--border);color:var(--muted)';
                    html += '<tr>' + parseCells(row).map(c => `<${tag} style="${st}">${inline(c)}</${tag}>`).join('') + '</tr>';
                });
                html += '</table>';
            }
            continue;
        }

        // Blockquote
        if (/^> /.test(line)) {
            if (inList) { html += '</ul>'; inList = false; }
            html += `<div style="margin:6px 0;padding:5px 10px;border-left:3px solid var(--blue);background:rgba(58,130,246,0.06);border-radius:0 4px 4px 0;font-size:11px;color:var(--muted)">${inline(line.replace(/^> /, ''))}</div>`;
            i++; continue;
        }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            if (inList) { html += '</ul>'; inList = false; }
            html += '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">';
            i++; continue;
        }

        // Headings
        if (/^#{1,4} /.test(line)) {
            if (inList) { html += '</ul>'; inList = false; }
            const lvl   = line.match(/^(#{1,4}) /)[1].length;
            const text  = inline(line.replace(/^#{1,4} /, ''));
            const sz    = lvl <= 2 ? '12px' : '11px';
            const mt    = lvl <= 2 ? '14px' : '10px';
            const extra = lvl <= 2 ? 'border-bottom:1px solid var(--border);padding-bottom:4px;' : '';
            html += `<div style="font-weight:700;color:var(--text);font-size:${sz};margin:${mt} 0 4px;${extra}">${text}</div>`;
            i++; continue;
        }

        // List item
        if (/^[-*] /.test(line)) {
            if (!inList) { html += '<ul style="margin:4px 0 6px;padding-left:16px;list-style:disc">'; inList = true; }
            html += `<li style="margin:2px 0;color:var(--text)">${inline(line.replace(/^[-*] /, ''))}</li>`;
            i++; continue;
        }

        // Blank line
        if (line.trim() === '') {
            if (inList) { html += '</ul>'; inList = false; }
            i++; continue;
        }

        // Paragraph
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p style="margin:3px 0;color:var(--muted)">${inline(line)}</p>`;
        i++;
    }

    if (inList) html += '</ul>';
    return html;
}

function _uiPref(key) { return tmPref(key); }

function _applyEntrypointsVisibility() {
    const bar  = document.getElementById('entrypointsBar');
    const list = document.getElementById('entrypointsList');
    if (!bar) return;
    const hasData = list && list.children.length > 0;
    bar.classList.toggle('hidden', !_uiPref('showEntrypoints') || !hasData);
}

function applyUiPrefs() {
    const html = document.documentElement;
    const showStats = _uiPref('showStatCards');
    const compact = tmPref('compactStatCards');
    html.classList.toggle('tm-hide-stats', !showStats);
    html.classList.toggle('tm-compact-stats', compact);
    html.classList.toggle('tm-hide-entrypoints', !_uiPref('showEntrypoints'));
    html.classList.toggle('tm-scope-dash', tmPref('statBarScope') === 'dashboard');
    html.classList.toggle('tm-modern', tmPref('layoutMode') === 'modern');
    buildSideNav();
    placeStatCards();
    const overviewSection = document.getElementById('overviewSection');
    if (overviewSection) overviewSection.classList.toggle('hidden', !showStats);
    _applyEntrypointsVisibility();
    const grid = document.getElementById('statsGrid');
    if (grid) grid.classList.toggle('stats-compact', compact);
}

function loadUiTogglesIntoModal() {
    const scope = tmPref('statBarScope') === 'dashboard' ? 'dashboard' : 'all';
    const bAll  = document.getElementById('scope-stats-all');
    const bDash = document.getElementById('scope-stats-dash');
    if (bAll)  bAll.className  = 'proto-btn' + (scope === 'all' ? ' active-http' : '');
    if (bDash) bDash.className = 'proto-btn' + (scope === 'dashboard' ? ' active-http' : '');
    const layout = tmPref('layoutMode') === 'modern' ? 'modern' : 'classic';
    const lC = document.getElementById('layout-classic');
    const lM = document.getElementById('layout-modern');
    if (lC) lC.className = 'proto-btn' + (layout === 'classic' ? ' active-http' : '');
    if (lM) lM.className = 'proto-btn' + (layout === 'modern' ? ' active-http' : '');
    const dens = tmPref('dashPodDensity') === 'icons' ? 'icons' : 'list';
    const dL = document.getElementById('dashdens-list');
    const dI = document.getElementById('dashdens-icons');
    if (dL) dL.className = 'proto-btn' + (dens === 'list' ? ' active-http' : '');
    if (dI) dI.className = 'proto-btn' + (dens === 'icons' ? ' active-http' : '');
    const sc = document.getElementById('toggle-ui-statcards');
    const ep = document.getElementById('toggle-ui-entrypoints');
    const cs = document.getElementById('toggle-ui-compact-stats');
    const sh = document.getElementById('toggle-shortcuts-btn');
    if (sc) sc.classList.toggle('on', _uiPref('showStatCards'));
    if (ep) ep.classList.toggle('on', _uiPref('showEntrypoints'));
    if (cs) cs.classList.toggle('on', tmPref('compactStatCards'));
    if (sh) sh.classList.toggle('on', tmPref('showShortcutsBtn'));
    const ipd = document.getElementById('toggle-ipdiag-btn');
    if (ipd) ipd.classList.toggle('on', tmPref('showIpDiagBtn'));
    const ri = document.getElementById('toggle-route-icons');
    if (ri) ri.classList.toggle('on', tmPref('showRouteIcons'));
    loadGeoipSettings();
}

function toggleUiPref(key) {
    tmSetPref(key, !tmPref(key));
    applyUiPrefs();
    loadUiTogglesIntoModal();
}

function setLayoutMode(v) {
    tmSetPref('layoutMode', v);
    loadUiTogglesIntoModal();
    applyUiPrefs();
    _rerenderCardGrids();
}

function _rerenderCardGrids() {
    if (typeof renderRouteGrid === 'function' && window._lastRenderedApps) {
        renderRouteGrid(window._lastRenderedApps);
        if (typeof filterRoutes === 'function') filterRoutes();
    }
    if (typeof renderMwGrid === 'function' && typeof _allMiddlewares !== 'undefined' && _allMiddlewares) {
        renderMwGrid(_allMiddlewares);
        if (typeof filterMw === 'function') filterMw();
    }
    if (typeof renderServicesTable === 'function' && typeof _allServices !== 'undefined' && _allServices.length) {
        renderServicesTable();
    }
    if (typeof renderCertCards === 'function' && typeof _allCerts !== 'undefined' && _allCerts.length) {
        renderCertCards();
    }
    if (typeof renderTlsOptions === 'function' && typeof _tlsOptions !== 'undefined' && _tlsOptions.length) {
        renderTlsOptions(_tlsOptions);
    }
    if (typeof renderPluginCards === 'function' && typeof _allPlugins !== 'undefined' && _allPlugins.length) {
        renderPluginCards();
    }
    const active = document.querySelector('.tab-content.active');
    if (active && typeof switchTab === 'function') switchTab(active.id.replace(/^tab-/, ''));
}

function setStatBarScope(v) {
    tmSetPref('statBarScope', v);
    applyUiPrefs();
    loadUiTogglesIntoModal();
}

function setDashPodDensity(v) {
    tmSetPref('dashPodDensity', v);
    loadUiTogglesIntoModal();
    if (typeof window.refreshDashboardTab === 'function') window.refreshDashboardTab();
}

let _otpEnabled = false;

async function loadOtpStatus() {
    try {
        const res  = await fetch('/api/auth/otp/status');
        const data = await res.json();
        _otpEnabled = !!data.otp_enabled;
        const label = document.getElementById('otpStatusLabel');
        const btn   = document.getElementById('otpToggleBtnLabel');
        if (label) {
            label.textContent  = _otpEnabled ? 'Enabled' : 'Disabled';
            label.style.color  = _otpEnabled ? 'var(--green)' : 'var(--muted)';
        }
        if (btn) btn.textContent = _otpEnabled ? 'Disable 2FA' : 'Enable 2FA';
    } catch(e) {}
}

async function otpToggleFlow() {
    if (_otpEnabled) {
        if (!await _confirm('Disable two-factor authentication?', 'Disable 2FA', 'Disable')) return;
        try {
            const res  = await fetch('/api/auth/otp/disable', { method: 'POST', headers: _csrfHeaders() });
            const data = await res.json();
            if (data.success) { showToast('2FA disabled', 'success'); loadOtpStatus(); }
            else showToast(data.error || 'Failed', 'error');
        } catch(e) { showToast('Request failed', 'error'); }
        return;
    }
    // Start setup flow
    try {
        const res  = await fetch('/api/auth/otp/setup', { method: 'POST', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }

        document.getElementById('otpManualSecret').textContent = data.secret;
        const canvas = document.getElementById('otpQrCanvas');
        canvas.innerHTML = '';
        const qrDiv = document.createElement('div');
        canvas.appendChild(qrDiv);

        if (typeof QRCode !== 'undefined') {
            new QRCode(qrDiv, { text: data.uri, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
        } else {
            qrDiv.innerHTML = `<div class="text-xs" style="color:var(--muted)">Manual entry: use the secret below.</div>`;
        }

        const flow = document.getElementById('otpSetupFlow');
        flow.style.display = 'flex';
        flow.classList.remove('hidden');
        document.getElementById('otpVerifyCode').value = '';
        const msg = document.getElementById('otpSetupMsg');
        if (msg) msg.classList.add('hidden');
    } catch(e) { showToast('Failed to start 2FA setup', 'error'); }
}

async function otpConfirmEnable() {
    const code = (document.getElementById('otpVerifyCode').value || '').trim();
    const msg  = document.getElementById('otpSetupMsg');
    const show = (text, ok) => {
        msg.textContent = text;
        msg.style.background = ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)';
        msg.style.border     = ok ? '1px solid rgba(63,185,80,0.3)' : '1px solid rgba(248,81,73,0.3)';
        msg.style.color      = ok ? 'var(--green)' : 'var(--red)';
        msg.classList.remove('hidden');
    };
    if (!code || code.length !== 6) return show('Enter the 6-digit code.', false);
    try {
        const res  = await fetch('/api/auth/otp/enable', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token'] },
            body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (data.success) {
            show('2FA enabled successfully!', true);
            setTimeout(() => { otpCancelSetup(); loadOtpStatus(); }, 1200);
        } else {
            show(data.error || 'Invalid code. Try again.', false);
        }
    } catch(e) { show('Request failed.', false); }
}

function otpCancelSetup() {
    const flow = document.getElementById('otpSetupFlow');
    flow.style.display = 'none';
    flow.classList.add('hidden');
}

async function loadOidcStatus() {
    try {
        const res  = await fetch('/api/auth/oidc');
        const data = await res.json();
        const label = document.getElementById('oidcStatusLabel');
        const btn   = document.getElementById('oidcToggleBtn');
        const isOn  = !!data.oidc_enabled;
        if (label) { label.textContent = isOn ? 'Enabled' : 'Disabled'; label.style.color = isOn ? 'var(--green)' : 'var(--muted)'; }
        if (btn)   btn.textContent = isOn ? 'Disable' : 'Enable';
        const set = e => { const el = document.getElementById(e[0]); if (el) el.value = e[1] || ''; };
        set(['oidcProviderUrl', data.oidc_provider_url]);
        set(['oidcClientId',    data.oidc_client_id]);
        set(['oidcDisplayName', data.oidc_display_name]);
        set(['oidcAllowedEmails', data.oidc_allowed_emails]);
        set(['oidcAllowedGroups', data.oidc_allowed_groups]);
        set(['oidcGroupsClaim', data.oidc_groups_claim]);
        const _anyEl = document.getElementById('oidcAllowAny'); if (_anyEl) _anyEl.checked = !!data.oidc_allow_any_authenticated;
        document.getElementById('oidcClientSecret') && (document.getElementById('oidcClientSecret').value = '');
        const secretLabel = document.getElementById('oidcSecretSetLabel');
        if (secretLabel) secretLabel.classList.toggle('hidden', !data.oidc_client_secret_set);
    } catch(e) {}
}

async function oidcToggleEnabled() {
    const btn   = document.getElementById('oidcToggleBtn');
    const label = document.getElementById('oidcStatusLabel');
    const isOn  = label && label.textContent.trim() === 'Enabled';
    const url   = document.getElementById('oidcProviderUrl')?.value.trim() || '';
    const id    = document.getElementById('oidcClientId')?.value.trim() || '';
    const sec   = document.getElementById('oidcClientSecret')?.value.trim() || '';
    const disp  = document.getElementById('oidcDisplayName')?.value.trim() || 'OIDC';
    const ae    = document.getElementById('oidcAllowedEmails')?.value.trim() || '';
    const ag    = document.getElementById('oidcAllowedGroups')?.value.trim() || '';
    const gc    = document.getElementById('oidcGroupsClaim')?.value.trim() || 'groups';
    const any   = document.getElementById('oidcAllowAny')?.checked || false;
    try {
        const res = await fetch('/api/auth/oidc', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token']},
            body: JSON.stringify({ oidc_enabled: !isOn, oidc_provider_url: url, oidc_client_id: id, oidc_client_secret: sec, oidc_display_name: disp, oidc_allowed_emails: ae, oidc_allowed_groups: ag, oidc_groups_claim: gc, oidc_allow_any_authenticated: any })
        });
        const data = await res.json();
        if (data.ok) {
            if (data.reauth_required) return _redirectToLoginAfterAuthEnable('OIDC enabled');
            loadOidcStatus();
        } else {
            showToast(data.error || 'Failed to update OIDC', 'error');
        }
    } catch(e) { showToast('Failed to update OIDC', 'error'); }
}

function _redirectToLoginAfterAuthEnable(what) {
    showToast(`${what} - authentication is now required, redirecting to sign in`, 'info');
    setTimeout(() => { window.location.href = '/login'; }, 1200);
}

async function saveOidcConfig() {
    const url  = document.getElementById('oidcProviderUrl')?.value.trim() || '';
    const id   = document.getElementById('oidcClientId')?.value.trim() || '';
    const sec  = document.getElementById('oidcClientSecret')?.value.trim() || '';
    const disp = document.getElementById('oidcDisplayName')?.value.trim() || 'OIDC';
    const ae   = document.getElementById('oidcAllowedEmails')?.value.trim() || '';
    const ag   = document.getElementById('oidcAllowedGroups')?.value.trim() || '';
    const gc   = document.getElementById('oidcGroupsClaim')?.value.trim() || 'groups';
    const any  = document.getElementById('oidcAllowAny')?.checked || false;
    const label = document.getElementById('oidcStatusLabel');
    const isOn  = label && label.textContent.trim() === 'Enabled';
    try {
        const res = await fetch('/api/auth/oidc', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token']},
            body: JSON.stringify({ oidc_enabled: isOn, oidc_provider_url: url, oidc_client_id: id, oidc_client_secret: sec, oidc_display_name: disp, oidc_allowed_emails: ae, oidc_allowed_groups: ag, oidc_groups_claim: gc, oidc_allow_any_authenticated: any })
        });
        const data = await res.json();
        if (data.ok) {
            if (data.reauth_required) return _redirectToLoginAfterAuthEnable('OIDC saved');
            const msg = document.getElementById('oidcSavedMsg');
            if (msg) { msg.classList.remove('hidden'); setTimeout(() => msg.classList.add('hidden'), 2500); }
            loadOidcStatus();
        } else {
            showToast(data.error || 'Failed to save OIDC config', 'error');
        }
    } catch(e) { showToast('Failed to save OIDC config', 'error'); }
}

async function testOidcProvider() {
    const url    = document.getElementById('oidcProviderUrl')?.value.trim() || '';
    const result = document.getElementById('oidcTestResult');
    if (!url) return;
    if (result) { result.textContent = 'Testing...'; result.style.color = 'var(--muted)'; }
    try {
        const res  = await fetch('/api/auth/oidc/test', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token']},
            body: JSON.stringify({ provider_url: url })
        });
        const data = await res.json();
        if (result) {
            result.textContent = data.ok ? `Connected - issuer: ${data.issuer}` : `Error: ${data.error}`;
            result.style.color = data.ok ? 'var(--green)' : 'var(--red)';
        }
    } catch(e) {
        if (result) { result.textContent = 'Request failed'; result.style.color = 'var(--red)'; }
    }
}

let _agentWizId   = null;
let _agentWizKey  = null;
let _agentWizStep = 0;
let _agentRestartMethod = '';
let _agentCfgViewOnly = false;

async function loadAgentsList() {
    const body = document.getElementById('agentsListBody');
    if (!body) return;
    document.getElementById('agentListView').style.display    = 'flex';
    document.getElementById('agentWizardView').style.display  = 'none';
    document.getElementById('agentKeysView').style.display    = 'none';
    try {
        const res  = await fetch('/api/agents');
        const data = await res.json();
        const agents = data.agents || [];
        if (!agents.length) {
            body.innerHTML = `<div class="text-center py-8" style="color:var(--muted)"><i class="ph-light ph-robot text-4xl block mb-2 opacity-30"></i><p class="text-xs font-medium mb-1">No agents configured</p><p class="text-xs">Add a remote agent to manage multiple Traefik instances from one TM.</p></div>`;
            updateServerSwitcher(agents);
            return;
        }
        body.innerHTML = agents.map(a => `
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2" data-agent-id="${a.id}" style="background:var(--bg);border:1px solid var(--border);">
                <div style="flex:1;min-width:0;">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full flex-shrink-0" id="agent-dot-${a.id}" style="background:var(--muted)"></span>
                        <span class="agent-name-label text-xs font-medium truncate" style="color:var(--text)">${_esc(a.name)}</span>
                    </div>
                    <div class="flex items-center gap-1 mt-0.5">
                        <span class="agent-url-label text-xs truncate font-mono" style="color:var(--muted)">${_esc(a.url)}</span>
                        <button onclick="inlineEditAgent('${a.id}','url','${_esc(a.url)}')" class="btn-icon agent-url-btn flex-shrink-0" title="Edit URL" style="opacity:0.5;padding:0 2px;"><i class="ph-bold ph-pencil-simple" style="font-size:10px;"></i></button>
                    </div>
                </div>
                <div class="flex items-center gap-1 flex-shrink-0">
                    <button onclick="openAgentKeys('${a.id}','${_esc(a.name)}')" class="btn-icon" title="API Keys"><i class="ph-bold ph-key text-xs"></i></button>
                    <button onclick="inlineEditAgent('${a.id}','name','${_esc(a.name)}')" class="btn-icon agent-rename-btn" title="Rename"><i class="ph-bold ph-pencil-simple text-xs"></i></button>
                    <button onclick="openAgentSetup('${a.id}')" class="btn-icon" title="Edit Settings"><i class="ph-bold ph-gear text-xs"></i></button>
                    <button onclick="deleteAgent('${a.id}','${_esc(a.name)}')" class="btn-icon" title="Remove" style="color:var(--red)"><i class="ph-bold ph-trash text-xs"></i></button>
                </div>
            </div>`).join('');
        agents.forEach(a => pingAgent(a.id, a.url));
        updateServerSwitcher(agents);
    } catch(e) {
        body.innerHTML = `<div class="text-center py-6 text-xs" style="color:var(--red)">Failed to load agents</div>`;
    }
}

let _keysAgentId = null;

function openAgentKeys(agentId, agentName) {
    _keysAgentId = agentId;
    document.getElementById('agentKeysTitle').textContent = _esc(agentName) + ' - API Keys';
    document.getElementById('agentListView').style.display   = 'none';
    document.getElementById('agentWizardView').style.display = 'none';
    document.getElementById('agentKeysView').style.display   = 'flex';
    hideAddKeyForm();
    loadAgentKeys();
}

function closeAgentKeys() {
    document.getElementById('agentKeysView').style.display  = 'none';
    document.getElementById('agentListView').style.display  = 'flex';
}

async function loadAgentKeys() {
    const list = document.getElementById('agentKeysList');
    if (!list || !_keysAgentId) return;
    list.innerHTML = '<div class="text-xs" style="color:var(--muted)">Loading...</div>';
    try {
        const res  = await fetch('/api/agents/proxy/' + _keysAgentId + '/keys', { headers: _csrfHeaders() });
        const data = await res.json();
        const keys = data.keys || [];
        if (!keys.length) {
            list.innerHTML = '<div class="text-center py-6 text-xs" style="color:var(--muted)">No API keys yet. Add one to allow external clients like the mobile app to connect to this agent.</div>';
            return;
        }
        list.innerHTML = keys.map(k => `
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg" style="background:var(--bg);border:1px solid var(--border);">
                <i class="ph-bold ph-key text-xs flex-shrink-0" style="color:var(--muted)"></i>
                <div style="flex:1;min-width:0;">
                    <div class="text-xs font-medium" style="color:var(--text)">${_esc(k.name)}</div>
                    <div class="text-xs" style="color:var(--muted)">Created ${new Date(k.created_at).toLocaleDateString()}${k.last_used_at ? ' &middot; Last used ' + new Date(k.last_used_at).toLocaleDateString() : ''}</div>
                </div>
                <button onclick="deleteAgentKey('${_keysAgentId}','${k.id}','${_esc(k.name)}')" class="btn-icon flex-shrink-0" title="Revoke" style="color:var(--red)"><i class="ph-bold ph-trash text-xs"></i></button>
            </div>`).join('');
    } catch(e) {
        list.innerHTML = '<div class="text-xs" style="color:var(--red)">Failed to load keys</div>';
    }
}

function showAddKeyForm() {
    const form = document.getElementById('agentKeysAddForm');
    if (form) { form.style.display = 'flex'; }
    document.getElementById('agentKeyNameInput').value = '';
    document.getElementById('agentKeyNewDisplay').style.display = 'none';
    document.getElementById('agentKeyCreateErr').style.display  = 'none';
    document.getElementById('agentKeyCreateBtn').textContent = 'Create';
    setTimeout(() => document.getElementById('agentKeyNameInput').focus(), 50);
}

function hideAddKeyForm() {
    const form = document.getElementById('agentKeysAddForm');
    if (form) form.style.display = 'none';
}

async function createAgentKey() {
    const name = document.getElementById('agentKeyNameInput').value.trim();
    const errEl = document.getElementById('agentKeyCreateErr');
    if (!name) { errEl.textContent = 'Enter a name for this key'; errEl.style.display = ''; return; }
    const btn = document.getElementById('agentKeyCreateBtn');
    btn.disabled = true; btn.textContent = 'Creating...';
    errEl.style.display = 'none';
    try {
        const res  = await fetch('/api/agents/proxy/' + _keysAgentId + '/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!data.ok) { errEl.textContent = data.error || 'Failed to create key'; errEl.style.display = ''; btn.disabled = false; btn.textContent = 'Create'; return; }
        document.getElementById('agentKeyNewValue').textContent = data.key;
        document.getElementById('agentKeyNewDisplay').style.display = 'flex';
        btn.textContent = 'Done';
        btn.onclick = () => { hideAddKeyForm(); loadAgentKeys(); btn.onclick = createAgentKey; };
        btn.disabled = false;
    } catch(e) {
        errEl.textContent = 'Request failed'; errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Create';
    }
}

function copyNewAgentKey() {
    const val = document.getElementById('agentKeyNewValue').textContent;
    navigator.clipboard.writeText(val).then(() => showToast('Key copied', 'success')).catch(() => {});
}

async function deleteAgentKey(agentId, keyId, keyName) {
    if (!await _confirm(`Revoke key "${keyName}"? Any client using it will lose access immediately.`, 'Revoke Key', 'Revoke')) return;
    try {
        const res  = await fetch('/api/agents/proxy/' + agentId + '/keys/' + keyId, { method: 'DELETE', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) { showToast('Key revoked', 'success'); loadAgentKeys(); }
        else showToast('Revoke failed: ' + (data.error || 'Unknown'), 'error');
    } catch(e) { showToast('Revoke failed', 'error'); }
}

async function loadActiveAgentKeys() {
    if (!_activeAgent) return;
    const sub = document.getElementById('agentKeysSubtitle');
    if (sub) sub.textContent = _activeAgent.name;
    hideActiveAgentAddKeyForm();
    const list = document.getElementById('activeAgentKeysList');
    if (!list) return;
    list.innerHTML = '<div class="text-xs" style="color:var(--muted)">Loading...</div>';
    try {
        const res  = await fetch('/api/agents/proxy/' + _activeAgent.id + '/keys', { headers: _csrfHeaders() });
        const data = await res.json();
        const keys = data.keys || [];
        if (!keys.length) {
            list.innerHTML = '<div class="text-center py-6 text-xs" style="color:var(--muted)">No API keys yet.<br>Add one to let external clients like the mobile app connect directly to this agent.</div>';
            return;
        }
        list.innerHTML = keys.map(k => `
            <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg" style="background:var(--bg);border:1px solid var(--border);">
                <i class="ph-bold ph-key text-xs flex-shrink-0" style="color:var(--muted)"></i>
                <div style="flex:1;min-width:0;">
                    <div class="text-xs font-medium" style="color:var(--text)">${_esc(k.name)}</div>
                    <div class="text-xs" style="color:var(--muted)">Created ${new Date(k.created_at).toLocaleDateString()}${k.last_used_at ? ' &middot; Last used ' + new Date(k.last_used_at).toLocaleDateString() : ''}</div>
                </div>
                <button onclick="deleteActiveAgentKey('${k.id}','${_esc(k.name)}')" class="btn-icon flex-shrink-0" title="Revoke" style="color:var(--red)"><i class="ph-bold ph-trash text-xs"></i></button>
            </div>`).join('');
    } catch(e) {
        list.innerHTML = '<div class="text-xs" style="color:var(--red)">Failed to load keys</div>';
    }
}

function showActiveAgentAddKeyForm() {
    const form = document.getElementById('activeAgentKeysAddForm');
    if (form) form.style.display = 'flex';
    document.getElementById('activeAgentKeyNameInput').value = '';
    document.getElementById('activeAgentKeyNewDisplay').style.display = 'none';
    document.getElementById('activeAgentKeyCreateErr').style.display  = 'none';
    const btn = document.getElementById('activeAgentKeyCreateBtn');
    btn.textContent = 'Create'; btn.onclick = createActiveAgentKey;
    setTimeout(() => document.getElementById('activeAgentKeyNameInput').focus(), 50);
}

function hideActiveAgentAddKeyForm() {
    const form = document.getElementById('activeAgentKeysAddForm');
    if (form) form.style.display = 'none';
}

async function createActiveAgentKey() {
    if (!_activeAgent) return;
    const name = document.getElementById('activeAgentKeyNameInput').value.trim();
    const errEl = document.getElementById('activeAgentKeyCreateErr');
    if (!name) { errEl.textContent = 'Enter a name for this key'; errEl.style.display = ''; return; }
    const btn = document.getElementById('activeAgentKeyCreateBtn');
    btn.disabled = true; btn.textContent = 'Creating...';
    errEl.style.display = 'none';
    try {
        const res  = await fetch('/api/agents/proxy/' + _activeAgent.id + '/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!data.ok) { errEl.textContent = data.error || 'Failed'; errEl.style.display = ''; btn.disabled = false; btn.textContent = 'Create'; return; }
        document.getElementById('activeAgentKeyNewValue').textContent = data.key;
        document.getElementById('activeAgentKeyNewDisplay').style.display = 'flex';
        btn.textContent = 'Done'; btn.disabled = false;
        btn.onclick = () => { hideActiveAgentAddKeyForm(); loadActiveAgentKeys(); btn.onclick = createActiveAgentKey; };
    } catch(e) {
        errEl.textContent = 'Request failed'; errEl.style.display = '';
        btn.disabled = false; btn.textContent = 'Create';
    }
}

function copyActiveAgentKey() {
    const val = document.getElementById('activeAgentKeyNewValue').textContent;
    navigator.clipboard.writeText(val).then(() => showToast('Key copied', 'success')).catch(() => {});
}

async function deleteActiveAgentKey(keyId, keyName) {
    if (!_activeAgent) return;
    if (!await _confirm(`Revoke key "${keyName}"? Any client using it will lose access immediately.`, 'Revoke Key', 'Revoke')) return;
    try {
        const res  = await fetch('/api/agents/proxy/' + _activeAgent.id + '/keys/' + keyId, { method: 'DELETE', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) { showToast('Key revoked', 'success'); loadActiveAgentKeys(); }
        else showToast('Revoke failed: ' + (data.error || 'Unknown'), 'error');
    } catch(e) { showToast('Revoke failed', 'error'); }
}

async function pingAgent(id, url) {
    const dot = document.getElementById('agent-dot-' + id);
    if (!dot) return;
    try {
        const res  = await fetch('/api/agents/' + id + '/health');
        const data = await res.json();
        dot.style.background = data.ok ? 'var(--green)' : 'var(--red)';
    } catch(e) { if (dot) dot.style.background = 'var(--red)'; }
}

function inlineEditAgent(id, field, currentValue) {
    const card = document.querySelector(`[data-agent-id="${id}"]`);
    if (!card) return;
    const isName = field === 'name';
    const labelEl  = card.querySelector(isName ? '.agent-name-label' : '.agent-url-label');
    const pencilBtn = card.querySelector(isName ? '.agent-rename-btn' : '.agent-url-btn');
    if (!labelEl || !pencilBtn) return;
    const input = document.createElement('input');
    input.type = isName ? 'text' : 'url';
    input.value = currentValue;
    input.className = 'input-field text-xs';
    input.style.cssText = isName ? 'padding:2px 6px;height:24px;width:120px;' : 'padding:2px 6px;height:24px;width:200px;';
    labelEl.replaceWith(input);
    pencilBtn.innerHTML = '<i class="ph-bold ph-check text-xs"></i>';
    pencilBtn.style.color = 'var(--green)';
    pencilBtn.style.opacity = '1';
    input.focus();
    input.select();
    let _settled = false;
    const submit = async () => {
        if (_settled) return;
        _settled = true;
        const newVal = input.value.trim();
        if (!newVal || newVal === currentValue) { loadAgentsList(); return; }
        try {
            const res  = await fetch('/api/agents/' + id, { method: 'PUT', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: newVal }) });
            const data = await res.json();
            if (data.ok) { showToast(`Agent ${isName ? 'renamed' : 'URL updated'}`, 'success'); updateServerSwitcher(); }
            else { showToast(`Update failed: ${data.error || 'Unknown'}`, 'error'); }
        } catch(e) { showToast('Update failed', 'error'); }
        loadAgentsList();
    };
    pencilBtn.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { _settled = true; loadAgentsList(); } });
    input.addEventListener('blur', () => setTimeout(submit, 150));
}

async function deleteAgent(id, name) {
    if (!await _confirm(`Remove agent "${name}"? This only removes it from TM settings - the agent service on the remote server is unaffected.`, 'Remove Agent', 'Remove')) return;
    try {
        const res  = await fetch('/api/agents/' + id, { method: 'DELETE', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) { showToast('Agent removed', 'success'); loadAgentsList(); }
        else showToast('Remove failed: ' + (data.error || 'Unknown'), 'error');
    } catch(e) { showToast('Remove failed', 'error'); }
}

function startAddAgent() {
    _agentWizId          = null;
    _agentWizKey         = null;
    _agentWizStep        = 1;
    _agentCfgViewOnly    = false;
    _agentRestartMethod  = '';
    document.getElementById('agentListView').style.display   = 'none';
    document.getElementById('agentWizardView').style.display = 'flex';
    document.getElementById('agentWizardTitle').textContent  = 'Add Agent';
    document.getElementById('agentWizardStepPills').style.display = '';
    resetAgentWizard();
    showAgentWizStep(1);
}

async function openAgentSetup(id, titleOverride) {
    _agentCfgViewOnly = true;
    _agentWizId = id;
    _agentWizKey = null;
    document.getElementById('agentListView').style.display   = 'none';
    document.getElementById('agentWizardView').style.display = 'flex';
    document.getElementById('agentWizardTitle').textContent  = titleOverride || 'Setup Commands';
    document.getElementById('agentWizardStepPills').style.display = 'none';
    document.getElementById('agentRotateKeyBanner').style.display = '';
    document.getElementById('agentRotatedKeyDisplay').style.display = 'none';
    document.getElementById('agentRotatedKeyText').textContent = '';
    resetAgentWizardCfgFields();
    showAgentWizStep(3);
    document.getElementById('agentWizSaveBtn').style.display = 'inline-flex';
    document.getElementById('agentWizKeyDisplay').textContent = '';
    try {
        const res  = await fetch('/api/agents');
        const data = await res.json();
        const a    = (data.agents || []).find(x => x.id === id);
        if (a) {
            if (a.traefik_api_url)    document.getElementById('agCfgTraefikUrl').value  = a.traefik_api_url;
            document.getElementById('agCfgCertResolver').value = a.cert_resolver || '';
            const tlsEl = document.getElementById('agCfgInsecureTLS');
            if (tlsEl) { tlsEl.classList.toggle('on', !!a.traefik_insecure_skip_verify); }
            if (a.config_path)        document.getElementById('agCfgConfigPath').value  = a.config_path;
            if (a.static_config_path) document.getElementById('agCfgStaticPath').value  = a.static_config_path;
            if (a.backup_dir)         document.getElementById('agCfgBackupDir').value   = a.backup_dir;
            if (a.backup_keep_count)  { const el = document.getElementById('agCfgKeepCount'); if (el) el.value = a.backup_keep_count; }
            if (a.acme_json_path)     document.getElementById('agCfgAcmePath').value    = a.acme_json_path;
            if (a.access_log_path)    document.getElementById('agCfgLogPath').value     = a.access_log_path;
            if (a.plugins_dir)        document.getElementById('agCfgPluginsDir').value  = a.plugins_dir;
            if (a.docker_host)        document.getElementById('agCfgDockerHost').value  = a.docker_host;
            if (a.signal_file_path)   document.getElementById('agCfgSignalFile').value  = a.signal_file_path;
            if (a.crowdsec_lapi_url)  document.getElementById('agCfgCsUrl').value       = a.crowdsec_lapi_url;
            if (a.crowdsec_machine_id) document.getElementById('agCfgCsMachineId').value = a.crowdsec_machine_id;
            if (a.restart_method)     selectRestartMethod(a.restart_method, null);
            const container = a.traefik_container || '';
            if (container) {
                document.getElementById('agCfgContainer').value       = container;
                document.getElementById('agCfgSocketContainer').value = container;
            }
            if (a.git_backup_enabled) {
                document.getElementById('agCfgGitEnabled').checked = true;
                document.getElementById('agentGitFields').style.display = 'block';
                if (a.git_backup_repo)    document.getElementById('agCfgGitRepo').value   = a.git_backup_repo;
                if (a.git_backup_branch)  document.getElementById('agCfgGitBranch').value = a.git_backup_branch;
                if (a.git_backup_username) document.getElementById('agCfgGitUser').value  = a.git_backup_username;
                document.getElementById('agCfgGitAutoPush').checked = a.git_backup_auto_push !== false;
            }
            if (a.tma_port)       { const el = document.getElementById('agCfgPort');      if (el) el.value = a.tma_port; }
            if (a.tma_rate_limit) { const el = document.getElementById('agCfgRateLimit'); if (el) el.value = a.tma_rate_limit; }
            if (a.domains && a.domains.length) { const el = document.getElementById('agCfgDomains'); if (el) el.value = a.domains.join(', '); }
        }
    } catch(e) {}
    agentCfgChanged();
}

function cancelAddAgent() {
    document.getElementById('agentWizardView').style.display = 'none';
    document.getElementById('agentListView').style.display   = 'flex';
}

function resetAgentWizard() {
    document.getElementById('agentWizName').value = '';
    document.getElementById('agentWizUrl').value  = '';
    document.getElementById('agentWizStep1Err').style.display = 'none';
    resetAgentWizardCfgFields();
}

function resetAgentWizardCfgFields() {
    document.getElementById('agCfgTraefikUrl').value  = 'http://traefik:8080';
    document.getElementById('agCfgCertResolver').value = '';
    document.getElementById('agCfgConfigPath').value  = '/app/config';
    document.getElementById('agCfgStaticPath').value  = '';
    document.getElementById('agCfgBackupDir').value   = '';
    { const el = document.getElementById('agCfgKeepCount'); if (el) el.value = ''; }
    document.getElementById('agCfgAcmePath').value    = '';
    document.getElementById('agCfgLogPath').value     = '';
    document.getElementById('agCfgPluginsDir').value  = '';
    document.getElementById('agCfgDockerHost').value  = '';
    document.getElementById('agCfgContainer').value   = 'traefik';
    document.getElementById('agCfgSignalFile').value  = '';
    document.getElementById('agCfgSocketContainer').value = 'traefik';
    document.getElementById('agCfgGitEnabled').checked = false;
    document.getElementById('agentGitFields').style.display = 'none';
    document.getElementById('agCfgGitRepo').value     = '';
    document.getElementById('agCfgGitBranch').value   = 'main';
    document.getElementById('agCfgGitUser').value     = '';
    document.getElementById('agCfgGitToken').value    = '';
    document.getElementById('agCfgGitAutoPush').checked = true;
    document.getElementById('agCfgCsUrl').value       = '';
    const portEl = document.getElementById('agCfgPort'); if (portEl) portEl.value = '';
    const rlEl   = document.getElementById('agCfgRateLimit'); if (rlEl) rlEl.value = '';
    const domsEl = document.getElementById('agCfgDomains'); if (domsEl) domsEl.value = '';
    document.getElementById('agCfgCsKey').value       = '';
    document.getElementById('agCfgCsMachineId').value = '';
    document.getElementById('agCfgCsMachinePassword').value = '';
    document.getElementById('agCfgInsecureTLS')?.classList.remove('on');
    selectRestartMethod('', document.querySelector('#restartMethodChips .agent-chip'));
}

function showAgentWizStep(n) {
    [1,2,3].forEach(i => {
        const el = document.getElementById('agentWizStep' + i);
        if (el) el.style.display = i === n ? '' : 'none';
        const pill = document.getElementById('wiz-step-pill-' + i);
        if (pill) {
            pill.style.background = i === n ? 'var(--blue)' : (i < n ? 'var(--green)' : 'var(--border)');
            pill.style.color      = i <= n ? '#fff' : 'var(--muted)';
        }
    });
    _agentWizStep = n;
    if (n === 3) { switchAgentCfgTab('traefik', document.querySelector('#agentCfgTabs .auth-sub-tab')); agentCfgChanged(); }
}

async function agentWizStep1Next() {
    const name = document.getElementById('agentWizName').value.trim();
    const url  = document.getElementById('agentWizUrl').value.trim();
    const err  = document.getElementById('agentWizStep1Err');
    if (!name || !url) { err.textContent = 'Name and URL are required.'; err.style.display = ''; return; }
    const btn = document.getElementById('agentWizStep1Btn');
    btn.disabled = true; btn.innerHTML = '<i class="ph-light ph-spinner-gap animate-spin text-xs"></i> Creating…';
    try {
        const res  = await fetch('/api/agents', { method: 'POST', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name, url }) });
        const data = await res.json();
        if (!data.ok) { err.textContent = data.error || 'Failed to create agent'; err.style.display = ''; return; }
        _agentWizId  = data.agent.id;
        _agentWizKey = data.agent.api_key_raw;
        document.getElementById('agentWizKeyDisplay').textContent = _agentWizKey;
        err.style.display = 'none';
        showAgentWizStep(2);
    } catch(e) { err.textContent = 'Request failed'; err.style.display = ''; }
    finally { btn.disabled = false; btn.innerHTML = 'Continue <i class="ph-bold ph-caret-right text-xs"></i>'; }
}

function agentWizStep2Next() {
    document.getElementById('agentRotateKeyBanner').style.display = 'none';
    showAgentWizStep(3);
}

async function agentWizStep3Save() {
    if (!_agentWizId) return;
    const cfg = buildAgentCfgPayload();
    try {
        const res  = await fetch('/api/agents/' + _agentWizId, { method: 'PUT', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) });
        const data = await res.json();
        if (data.ok) showToast('Agent config saved', 'success');
        else showToast('Save failed: ' + (data.error || 'Unknown'), 'error');
    } catch(e) { showToast('Save failed', 'error'); }
}

async function agentWizDone() {
    await agentWizStep3Save();
    document.getElementById('agentWizardView').style.display = 'none';
    document.getElementById('agentListView').style.display   = 'flex';
    loadAgentsList();
}

function copyAgentKey() {
    navigator.clipboard.writeText(_agentWizKey || '').then(() => showToast('Key copied', 'success'));
}

function copyAgentCompose() {
    navigator.clipboard.writeText(document.getElementById('agentComposeOutput').textContent).then(() => showToast('Copied', 'success'));
}

function copyAgentRun() {
    navigator.clipboard.writeText(document.getElementById('agentRunOutput').textContent).then(() => showToast('Copied', 'success'));
}

function copyRotatedKey() {
    const key = document.getElementById('agentRotatedKeyText').textContent;
    navigator.clipboard.writeText(key).then(() => showToast('Key copied', 'success'));
}

async function rotateAgentKey() {
    const btn = document.getElementById('agentRotateKeyBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph-bold ph-spinner-gap animate-spin text-xs"></i>';
    try {
        const res = await fetch('/api/agents/' + _agentWizId + '/rotate-key', {
            method: 'POST', headers: { ..._csrfHeaders() }
        });
        let data = {};
        try { data = await res.json(); } catch(je) { throw new Error('HTTP ' + res.status + ' - invalid response'); }
        if (!res.ok || !data.api_key_raw) throw new Error(data.error || ('HTTP ' + res.status));
        _agentWizKey = data.api_key_raw;
        document.getElementById('agentRotatedKeyText').textContent = _agentWizKey;
        document.getElementById('agentRotatedKeyDisplay').style.display = '';
        btn.innerHTML = '<i class="ph-bold ph-check text-xs"></i> Rotated';
        agentCfgChanged();
        showToast('API key rotated - update your agent', 'warning');
    } catch(e) {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph-bold ph-arrows-clockwise text-xs"></i> Rotate Key';
        showToast(e.message || 'Rotation failed', 'error');
    }
}

function switchAgentCfgTab(id, btn) {
    document.querySelectorAll('#agentCfgTabs .auth-sub-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('[id^="agentCfgPane-"]').forEach(p => { p.style.display = 'none'; });
    if (btn) btn.classList.add('active');
    const pane = document.getElementById('agentCfgPane-' + id);
    if (pane) pane.style.display = id === 'restart' ? '' : 'flex';
}

function selectRestartMethod(method, btn) {
    _agentRestartMethod = method;
    document.querySelectorAll('#restartMethodChips .agent-chip').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('restartProxyFields').style.display     = method === 'proxy'       ? '' : 'none';
    document.getElementById('restartPoisonPillFields').style.display = method === 'poison-pill' ? '' : 'none';
    document.getElementById('restartSocketFields').style.display    = method === 'socket'      ? '' : 'none';
    agentCfgChanged();
}

document.getElementById('agCfgGitEnabled').addEventListener('change', function() {
    document.getElementById('agentGitFields').style.display = this.checked ? 'block' : 'none';
    agentCfgChanged();
});

function buildAgentCfgPayload() {
    return {
        traefik_api_url:          document.getElementById('agCfgTraefikUrl').value.trim(),
        cert_resolver:            document.getElementById('agCfgCertResolver').value.trim(),
        traefik_insecure_skip_verify: document.getElementById('agCfgInsecureTLS')?.classList.contains('on') || false,
        config_path:        document.getElementById('agCfgConfigPath').value.trim(),
        static_config_path: document.getElementById('agCfgStaticPath').value.trim(),
        backup_dir:         document.getElementById('agCfgBackupDir').value.trim(),
        backup_keep_count:  document.getElementById('agCfgKeepCount')?.value.trim() || '',
        acme_json_path:     document.getElementById('agCfgAcmePath').value.trim(),
        access_log_path:    document.getElementById('agCfgLogPath').value.trim(),
        plugins_dir:        document.getElementById('agCfgPluginsDir').value.trim(),
        restart_method:     _agentRestartMethod,
        traefik_container:  (document.getElementById('agCfgContainer').value || document.getElementById('agCfgSocketContainer').value || 'traefik').trim(),
        docker_host:        document.getElementById('agCfgDockerHost').value.trim(),
        signal_file_path:   document.getElementById('agCfgSignalFile').value.trim(),
        crowdsec_lapi_url:  document.getElementById('agCfgCsUrl').value.trim(),
        crowdsec_api_key:   document.getElementById('agCfgCsKey').value,
        crowdsec_machine_id:       document.getElementById('agCfgCsMachineId').value.trim(),
        crowdsec_machine_password: document.getElementById('agCfgCsMachinePassword').value,
        git_backup_enabled: document.getElementById('agCfgGitEnabled').checked,
        git_backup_repo:    document.getElementById('agCfgGitRepo').value.trim(),
        git_backup_branch:  document.getElementById('agCfgGitBranch').value.trim() || 'main',
        git_backup_username:document.getElementById('agCfgGitUser').value.trim(),
        git_backup_token:   document.getElementById('agCfgGitToken').value,
        git_backup_auto_push: document.getElementById('agCfgGitAutoPush').checked,
        tma_port:        (document.getElementById('agCfgPort')?.value.trim()) || '',
        tma_rate_limit:  (document.getElementById('agCfgRateLimit')?.value.trim()) || '',
        domains:         (document.getElementById('agCfgDomains')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
    };
}

function agentCfgChanged() {
    const key       = _agentWizKey || '<your-api-key>';
    const traefik   = document.getElementById('agCfgTraefikUrl').value.trim() || 'http://traefik:8080';
    const configPath= document.getElementById('agCfgConfigPath').value.trim() || '/app/config';
    const staticPath= document.getElementById('agCfgStaticPath').value.trim();
    const backupDir = document.getElementById('agCfgBackupDir').value.trim();
    const acmePath  = document.getElementById('agCfgAcmePath').value.trim();
    const logPath   = document.getElementById('agCfgLogPath').value.trim();
    const pluginsDir= document.getElementById('agCfgPluginsDir').value.trim();
    const restart   = _agentRestartMethod;
    const container = (document.getElementById('agCfgContainer').value || document.getElementById('agCfgSocketContainer').value || 'traefik').trim();
    const dockerHost= document.getElementById('agCfgDockerHost').value.trim();
    const signalFile= document.getElementById('agCfgSignalFile').value.trim();
    const csUrl     = document.getElementById('agCfgCsUrl').value.trim();
    const csKey     = document.getElementById('agCfgCsKey').value.trim();
    const csMid     = document.getElementById('agCfgCsMachineId').value.trim();
    const csMpw     = document.getElementById('agCfgCsMachinePassword').value.trim();
    const gitOn     = document.getElementById('agCfgGitEnabled').checked;
    const gitRepo   = document.getElementById('agCfgGitRepo').value.trim();
    const gitBranch = document.getElementById('agCfgGitBranch').value.trim() || 'main';
    const gitUser   = document.getElementById('agCfgGitUser').value.trim();
    const gitToken  = document.getElementById('agCfgGitToken').value.trim();
    const gitAuto   = document.getElementById('agCfgGitAutoPush').checked;

    const insecureTLS = document.getElementById('agCfgInsecureTLS')?.classList.contains('on');
    const agentPort   = document.getElementById('agCfgPort')?.value.trim() || '8090';
    const rateLimit   = document.getElementById('agCfgRateLimit')?.value.trim();
    const keepCount   = document.getElementById('agCfgKeepCount')?.value.trim();
    const envLines = [`      - TMA_API_KEY=${key}`, `      - TRAEFIK_API_URL=${traefik}`, `      - CONFIG_PATH=${configPath}`];
    if (agentPort !== '8090') envLines.push(`      - TMA_PORT=${agentPort}`);
    if (rateLimit && rateLimit !== '300') envLines.push(`      - TMA_RATE_LIMIT=${rateLimit}`);
    if (insecureTLS) envLines.push(`      - TRAEFIK_INSECURE_SKIP_VERIFY=true`);
    if (staticPath)  envLines.push(`      - STATIC_CONFIG_PATH=${staticPath}`);
    if (restart)     envLines.push(`      - RESTART_METHOD=${restart}`);
    if (restart && container) envLines.push(`      - TRAEFIK_CONTAINER=${container}`);
    if (restart === 'proxy' && dockerHost)  envLines.push(`      - DOCKER_HOST=${dockerHost}`);
    if (restart === 'poison-pill' && signalFile) envLines.push(`      - SIGNAL_FILE_PATH=${signalFile}`);
    if (acmePath)    envLines.push(`      - ACME_JSON_PATH=${acmePath}`);
    if (logPath)     envLines.push(`      - ACCESS_LOG_PATH=${logPath}`);
    if (pluginsDir)  envLines.push(`      - PLUGINS_DIR=${pluginsDir}`);
    if (backupDir)   envLines.push(`      - BACKUP_DIR=${backupDir}`);
    if (keepCount && keepCount !== '0') envLines.push(`      - BACKUP_KEEP_COUNT=${keepCount}`);
    if (csUrl)       envLines.push(`      - CROWDSEC_LAPI_URL=${csUrl}`);
    if (csKey)       envLines.push(`      - CROWDSEC_API_KEY=${csKey}`);
    if (csMid)       envLines.push(`      - CROWDSEC_MACHINE_ID=${csMid}`);
    if (csMpw)       envLines.push(`      - CROWDSEC_MACHINE_PASSWORD=${csMpw}`);
    if (gitOn) {
        envLines.push(`      - GIT_BACKUP_ENABLED=true`);
        if (gitRepo)   envLines.push(`      - GIT_BACKUP_REPO=${gitRepo}`);
        envLines.push(`      - GIT_BACKUP_BRANCH=${gitBranch}`);
        if (gitUser)   envLines.push(`      - GIT_BACKUP_USERNAME=${gitUser}`);
        if (gitToken)  envLines.push(`      - GIT_BACKUP_TOKEN=${gitToken}`);
        envLines.push(`      - GIT_BACKUP_AUTO_PUSH=${gitAuto}`);
    }

    const volLines = [`      - ${configPath}:${configPath}`];
    if (staticPath)  volLines.push(`      - ${staticPath}:${staticPath}`);
    if (backupDir)   volLines.push(`      - ${backupDir}:/app/backups`);
    else             volLines.push(`      - tma_backups:/app/backups`);
    if (acmePath)    volLines.push(`      - ${acmePath}:${acmePath}:ro`);
    if (logPath)     volLines.push(`      - ${logPath}:${logPath}:ro`);
    if (pluginsDir)  volLines.push(`      - ${pluginsDir}:${pluginsDir}:ro`);
    if (restart === 'socket') volLines.push(`      - /var/run/docker.sock:/var/run/docker.sock:ro`);
    if (restart === 'poison-pill') volLines.push(`      - traefik-signals:/signals`);

    const namedVols = [];
    if (!backupDir) namedVols.push(`  tma_backups:`);
    if (restart === 'poison-pill') namedVols.push(`  traefik-signals:`);

    let compose = `services:\n  traefik-manager-agent:\n    image: ghcr.io/chr0nzz/traefik-manager-agent:latest\n    restart: unless-stopped\n    ports:\n      - "${agentPort}:${agentPort}"\n    environment:\n${envLines.join('\n')}\n    volumes:\n${volLines.join('\n')}`;
    if (namedVols.length) compose += `\n\nvolumes:\n${namedVols.join('\n')}`;

    const runParts = [`docker run -d \\`, `  --name traefik-manager-agent \\`, `  -p ${agentPort}:${agentPort} \\`];
    envLines.forEach(e => runParts.push(`  -e ${e.replace(/^\s+- /, '')} \\`));
    volLines.forEach(v => runParts.push(`  -v ${v.replace(/^\s+- /, '')} \\`));
    runParts.push(`  ghcr.io/chr0nzz/traefik-manager-agent:latest`);

    const co = document.getElementById('agentComposeOutput');
    const ro = document.getElementById('agentRunOutput');
    if (co) co.textContent = compose;
    if (ro) ro.textContent = runParts.join('\n');
}

function updateServerSwitcher(agents) {
    if (typeof _updateServerSwitcherList === 'function') _updateServerSwitcherList(agents);
}

let _editingTemplateId = null;

async function loadTemplatesList() {
    const listEl = document.getElementById('templateListView');
    if (!listEl) return;
    try {
        const res  = await fetch('/api/mw/templates');
        const data = await res.json();
        const templates = data.templates || [];
        if (templates.length === 0) {
            listEl.innerHTML = `<div class="text-center py-10" style="color:var(--muted)">
                <i class="ph-light ph-puzzle-piece text-3xl block mb-2 opacity-40"></i>
                <p class="text-xs">No custom templates yet. Click <strong>Add Template</strong> to create one.</p>
            </div>`;
            return;
        }
        listEl.innerHTML = templates.map(t => `
            <div class="flex items-center justify-between px-3 py-2.5 rounded-lg" style="background:var(--input-bg);border:1px solid var(--border)">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="ph-bold ph-puzzle-piece text-sm flex-shrink-0" style="color:var(--blue)"></i>
                    <span class="text-sm font-medium truncate" style="color:var(--text)">${_esc(t.name)}</span>
                </div>
                <div class="flex gap-1 flex-shrink-0">
                    <button onclick="openTemplateEditor('${t.id}')" class="btn-icon text-xs" title="Edit"><i class="ph-bold ph-pencil text-xs"></i></button>
                    <button onclick="deleteTemplate('${t.id}')" class="btn-icon text-xs" title="Delete" style="color:var(--red)"><i class="ph-bold ph-trash text-xs"></i></button>
                </div>
            </div>`).join('');
    } catch(e) {
        listEl.innerHTML = `<div class="text-xs py-4 text-center" style="color:var(--muted)">Failed to load templates</div>`;
    }
}

async function openTemplateEditor(id) {
    _editingTemplateId = id;
    document.getElementById('templateListView').style.display = 'none';
    document.getElementById('templateEditorView').style.display = 'flex';
    document.getElementById('templateEditorTitle').textContent = id ? 'Edit Template' : 'Add Template';
    document.getElementById('tplName').value = '';
    document.getElementById('tplYaml').value = '';
    if (id) {
        try {
            const res  = await fetch('/api/mw/templates');
            const data = await res.json();
            const t    = (data.templates || []).find(x => x.id === id);
            if (t) {
                document.getElementById('tplName').value = t.name;
                document.getElementById('tplYaml').value = t.yaml;
            }
        } catch(e) {}
    }
}

function closeTemplateEditor() {
    _editingTemplateId = null;
    document.getElementById('templateEditorView').style.display = 'none';
    document.getElementById('templateListView').style.display = 'flex';
    loadTemplatesList();
}

async function saveTemplate() {
    const name = document.getElementById('tplName').value.trim();
    const yaml = document.getElementById('tplYaml').value;
    if (!name) { showToast('Name is required', 'error'); return; }
    try {
        let res;
        if (_editingTemplateId) {
            res = await fetch('/api/mw/templates/' + _editingTemplateId, {
                method: 'PUT', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, yaml })
            });
        } else {
            res = await fetch('/api/mw/templates', {
                method: 'POST', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, yaml })
            });
        }
        const data = await res.json();
        if (data.ok) {
            showToast(_editingTemplateId ? 'Template updated' : 'Template created', 'success');
            closeTemplateEditor();
            if (typeof _loadCustomMwTemplates === 'function') _loadCustomMwTemplates();
        } else {
            showToast(data.error || 'Save failed', 'error');
        }
    } catch(e) { showToast('Request failed', 'error'); }
}

async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    try {
        const res  = await fetch('/api/mw/templates/' + id, { method: 'DELETE', headers: _csrfHeaders() });
        const data = await res.json();
        if (data.ok) {
            showToast('Template deleted', 'success');
            loadTemplatesList();
            if (typeof _loadCustomMwTemplates === 'function') _loadCustomMwTemplates();
        } else {
            showToast(data.error || 'Delete failed', 'error');
        }
    } catch(e) { showToast('Request failed', 'error'); }
}
