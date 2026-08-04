function _showSelfRouteEpWarning(badEp, fixEp) {
    if (document.getElementById('selfRouteEpWarning')) return;
    const el = document.createElement('div');
    el.id = 'selfRouteEpWarning';
    el.className = 'toast-item error';
    el.style.cssText = 'animation:none;cursor:default;align-items:flex-start;gap:10px';
    el.innerHTML = `<i class="ph-fill ph-warning-circle text-red-400 text-lg" style="margin-top:2px;flex-shrink:0"></i><span style="flex:1;line-height:1.5">Self-route entrypoint <b style="font-family:monospace">${_esc(badEp)}</b> does not exist in Traefik.<br><span style="font-size:12px;opacity:0.8">Your TM domain may not be accessible. Use <b style="font-family:monospace">${_esc(fixEp)}</b> instead?</span></span><div style="display:flex;gap:6px;flex-shrink:0;margin-top:2px"><button onclick="_fixSelfRouteEp('${_esc(fixEp)}')" style="padding:3px 10px;border-radius:5px;background:var(--red);color:#fff;font-size:12px;border:none;cursor:pointer">Fix</button><button onclick="document.getElementById('selfRouteEpWarning').remove()" style="padding:3px 8px;border-radius:5px;background:transparent;color:var(--muted);font-size:12px;border:1px solid var(--border);cursor:pointer">Dismiss</button></div>`;
    document.getElementById('toastContainer').appendChild(el);
}

async function _fixSelfRouteEp(fixEp) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const srRes = await fetch('/api/settings/self-route');
        const sr = await srRes.json();
        if (!sr.domain) return;
        const res = await fetch('/api/settings/self-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', 'X-CSRF-Token': token },
            body: JSON.stringify({ domain: sr.domain, service_url: sr.service_url, router_name: sr.router_name || 'traefik-manager', entry_point: fixEp })
        });
        const json = await res.json();
        if (json.ok) {
            document.getElementById('selfRouteEpWarning')?.remove();
            showToast('Self-route entrypoint updated to ' + fixEp);
        }
    } catch(e) { showToast('Failed to update self-route', 'error'); }
}

function loadTabTogglesIntoModal() {
    OPTIONAL_TABS.forEach(tab => {
        const sw = document.getElementById('toggle-' + tab);
        if (sw) sw.classList.toggle('on', !!_visibleTabsCache[tab]);
    });
}

async function toggleTabVisibility(tab) {
    const newVal = !_visibleTabsCache[tab];

    _visibleTabsCache[tab] = newVal;
    const sw  = document.getElementById('toggle-' + tab);
    const btn = document.getElementById('btn-' + tab);
    if (sw)  sw.classList.toggle('on', newVal);
    if (btn) {
        btn.style.display = newVal ? 'block' : 'none';
        if (!newVal && btn.classList.contains('active')) switchTab('services');
    }

    if (_activeAgent) {
        const key = 'tm_tabs_agent_' + _activeAgent.id;
        const stored = JSON.parse(localStorage.getItem(key) || '{}');
        stored[tab] = newVal;
        localStorage.setItem(key, JSON.stringify(stored));
        const reg = _agentRegistry[_activeAgent.id];
        const merged = { ...((reg && reg.visible_tabs) || {}), [tab]: newVal };
        if (reg) reg.visible_tabs = merged;
        fetch('/api/agents/' + _activeAgent.id, { method: 'PUT', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify({ visible_tabs: merged }) }).catch(() => {});
    } else {
        _localTabsCache[tab] = newVal;
        try {
            await fetch('/api/settings/tabs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': _csrfHeaders()['X-CSRF-Token'] },
                body: JSON.stringify({ [tab]: newVal })
            });
        } catch(e) {
            console.error('Failed to save tab visibility', e);
        }
    }
}

function showAddApiKeyForm() {
    document.getElementById('apikeyAddForm').classList.remove('hidden');
    document.getElementById('apikeyDeviceName').focus();
}

function hideAddApiKeyForm() {
    document.getElementById('apikeyAddForm').classList.add('hidden');
    document.getElementById('apikeyDeviceName').value = '';
}

function _renderApiKeyList(keys) {
    const list = document.getElementById('apikeyList');
    const addBtn = document.getElementById('btnAddApiKey');
    if (!list) return;
    if (!keys || keys.length === 0) {
        list.innerHTML = '<div class="text-xs" style="color:var(--muted);padding:8px 0;">No active keys</div>';
        if (addBtn) addBtn.style.display = '';
        return;
    }
    if (addBtn) addBtn.style.display = keys.length >= 10 ? 'none' : '';
    list.innerHTML = keys.map(k => `
        <div class="flex items-center justify-between" style="background:var(--input-bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;">
            <div class="flex flex-col" style="gap:2px;">
                <span class="text-xs font-semibold" style="color:var(--text)">${k.name.replace(/</g,'&lt;')}</span>
                <code class="text-xs font-mono" style="color:var(--muted);font-size:10px;letter-spacing:.05em">${k.preview}</code>
            </div>
            <button onclick="revokeApiKey('${k.preview.replace(/'/g,"\\'")}')" class="nav-btn text-xs" style="color:var(--red);border-color:rgba(248,81,73,0.3);flex-shrink:0;"><i class="ph-bold ph-x"></i> Revoke</button>
        </div>`).join('');
}

async function generateApiKey() {
    const deviceName = (document.getElementById('apikeyDeviceName')?.value || '').trim();
    if (!deviceName) { showToast('Enter a device name first.', 'error'); return; }
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const res = await fetch('/api/auth/apikey/generate', {
            method: 'POST',
            headers: { 'X-Requested-With': 'fetch', 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_name: deviceName })
        });
        const json = await res.json();
        if (json.ok) {
            hideAddApiKeyForm();
            document.getElementById('apikeyValue').value = json.key;
            document.getElementById('apikeyDisplay').classList.remove('hidden');
            showToast('API key generated. Copy it now.', 'success');
            loadApiKeyStatus();
        } else {
            showToast(json.error || 'Failed to generate key.', 'error');
        }
    } catch(e) { showToast('Error generating key.', 'error'); }
}

async function revokeApiKey(preview) {
    if (!await _confirm('Revoke this API key?', 'Revoke API Key', 'Revoke')) return;
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const res = await fetch('/api/auth/apikey/revoke', {
            method: 'POST',
            headers: { 'X-Requested-With': 'fetch', 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ preview })
        });
        const json = await res.json();
        if (json.ok) {
            showToast('API key revoked.', 'success');
            loadApiKeyStatus();
        }
    } catch(e) { showToast('Error revoking key.', 'error'); }
}

function copyApiKey() {
    const val = document.getElementById('apikeyValue')?.value || '';
    if (val) navigator.clipboard.writeText(val).then(() => showToast('Key copied.', 'success'));
}

async function loadApiKeyStatus() {
    try {
        const res = await fetch('/api/auth/apikey/status');
        const json = await res.json();
        _renderApiKeyList(json.keys || []);
    } catch(e) {}
}

let _selfRouteRouterName = 'traefik-manager';

async function loadSelfRoute() {
    try {
        const hostname = window.location.hostname;
        const res = await fetch('/api/settings/self-route?hostname=' + encodeURIComponent(hostname));
        const json = await res.json();
        const domainEl  = document.getElementById('selfRouteDomain');
        const serviceEl = document.getElementById('selfRouteService');
        const deleteBtn = document.getElementById('btnDeleteSelfRoute');
        _selfRouteRouterName = json.router_name || 'traefik-manager';
        if (domainEl)  domainEl.value  = json.domain      || hostname;
        if (serviceEl) serviceEl.value = json.service_url || 'http://traefik-manager:5000';
        const epEl = document.getElementById('selfRouteEntryPoint');
        if (epEl) epEl.value = json.entry_point || json.default_entry_point || 'websecure';
        if (deleteBtn) deleteBtn.classList.toggle('hidden', !json.domain && !json.found);
    } catch(e) {}
}

async function saveSelfRoute() {
    const domain      = (document.getElementById('selfRouteDomain')?.value     || '').trim();
    const serviceUrl  = (document.getElementById('selfRouteService')?.value    || '').trim() || 'http://traefik-manager:5000';
    const entryPoint  = (document.getElementById('selfRouteEntryPoint')?.value || '').trim() || 'websecure';
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const res = await fetch('/api/settings/self-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', 'X-CSRF-Token': token },
            body: JSON.stringify({ domain, service_url: serviceUrl, router_name: _selfRouteRouterName, entry_point: entryPoint })
        });
        const json = await res.json();
        if (json.ok) {
            const notice    = document.getElementById('selfRouteSavedNotice');
            const deleteBtn = document.getElementById('btnDeleteSelfRoute');
            if (notice) { notice.classList.remove('hidden'); setTimeout(() => notice.classList.add('hidden'), 2500); }
            if (deleteBtn) deleteBtn.classList.toggle('hidden', !domain);
            showToast(domain ? 'Self route saved.' : 'Self route removed.', 'success');
        }
    } catch(e) { showToast('Error saving self route.', 'error'); }
}

async function deleteSelfRoute() {
    if (!await _confirm('Remove the self route?', 'Remove Self Route', 'Remove')) return;
    document.getElementById('selfRouteDomain').value = '';
    await saveSelfRoute();
}

async function checkAgentTraefikUpdates() {
    const latest = window._latestTraefikTag;
    if (!latest || typeof _agentList === 'undefined' || !_agentList.length) return;
    for (const a of _agentList) {
        const key = 'tm-agent-traefik-' + a.id + '-' + latest;
        if (sessionStorage.getItem(key)) continue;
        try {
            const res = await fetch('/api/agents/proxy/' + a.id + '/traefik/version', { headers: _csrfHeaders() });
            if (!res.ok) continue;
            const cur = ((await res.json()).Version || '').replace(/^v/, '');
            if (!cur) continue;
            sessionStorage.setItem(key, '1');
            if (compareVersions(latest, cur) > 0) {
                fetch('/api/notifications/add', { method: 'POST', headers: { ..._csrfHeaders(), 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ type: 'info', message: `Traefik v${latest} is available on ${a.name} (running v${cur})` }) }).catch(() => {});
            }
        } catch (e) {}
    }
}

async function checkForUpdate(currentVersion) {
    try {
        const res = await fetch('https://api.github.com/repos/traefik/traefik/releases/latest', {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        const latestTag = (data.tag_name || '').replace(/^v/, '');
        const current   = currentVersion.replace(/^v/, '');
        window._latestTraefikTag = latestTag;
        checkAgentTraefikUpdates();

        const curEl    = document.getElementById('updateCurrentVer');
        const latEl    = document.getElementById('updateLatestVer');
        const linkEl   = document.getElementById('updateReleaseLink');
        if (curEl) curEl.textContent = 'v' + current;
        if (latEl) latEl.textContent = 'v' + (latestTag || '-');
        if (linkEl && data.html_url) linkEl.href = data.html_url;

        if (latestTag && latestTag !== current && compareVersions(latestTag, current) > 0) {
            const badge = document.getElementById('versionBadge');
            if (badge) {
                badge.classList.add('update-available');
                badge.title = `Update available: v${latestTag}`;
                badge.onclick = () => openSettingsModal('about');
            }
            document.getElementById('versionText').innerHTML =
                `v${current} <i class="ph-bold ph-arrow-circle-up" style="font-size:11px"></i>`;
            const notice = document.getElementById('sm-traefik-update-notice');
            const text   = document.getElementById('sm-traefik-update-text');
            if (notice && text) { text.textContent = `v${latestTag} available`; notice.classList.remove('hidden'); }
            if (!sessionStorage.getItem('tm-update-notified-' + latestTag)) {
                sessionStorage.setItem('tm-update-notified-' + latestTag, '1');
                fetch('/api/notifications/update', { method: 'POST', headers: { ..._csrfHeaders(), 'X-Requested-With': 'fetch', 'Content-Type': 'application/json' }, body: JSON.stringify({ version: latestTag, product: 'traefik' }) }).catch(() => {});
            }
        }
    } catch(e) {}
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

let _managerVersion = null;
async function checkManagerVersion() {
    try {
        const res = await fetch('/api/manager/version');
        if (!res.ok) return;
        const d = await res.json();

        const current  = (d.version || '').replace(/^v/, '');
        const footerEl = document.getElementById('footerManagerVer');

        if (current && footerEl) {
            _managerVersion = current;
            footerEl.textContent = 'v' + current;
            footerEl.title = 'Traefik Manager v' + current;
        }

        if (current) {
            document.getElementById('tmVersionText').textContent = 'v' + current;
            const vtmm = document.getElementById('tmVersionTextMobile');
            if (vtmm) vtmm.textContent = 'v' + current;
            _applyTmBadgeVisibility();
        }

        const curEl = document.getElementById('mgrUpdateCurrentVer');
        if (curEl && current) curEl.textContent = 'v' + current;

        if (d.static_config_configured === false && !localStorage.getItem('tm-static-setup-v1')) {
            const b = document.getElementById('staticSetupBanner');
            if (b) b.style.display = 'block';
        }

        const ghRes = await fetch(
            `https://api.github.com/repos/${d.repo}/releases/latest`,
            { headers: { 'Accept': 'application/vnd.github.v3+json' } }
        );
        if (!ghRes.ok) return;

        const ghData    = await ghRes.json();
        const latestTag = (ghData.tag_name || '').replace(/^v/, '');

        const latEl  = document.getElementById('mgrUpdateLatestVer');
        const linkEl = document.getElementById('mgrUpdateReleaseLink');
        if (latEl && latestTag) latEl.textContent = 'v' + latestTag;
        if (linkEl && ghData.html_url) linkEl.href = ghData.html_url;

        const notesEl = document.getElementById('sm-about-release-notes');
        if (notesEl && ghData.body) notesEl.innerHTML = renderReleaseNotes(ghData.body);

        if (latestTag && current && compareVersions(latestTag, current) > 0) {
            if (footerEl) {
                footerEl.innerHTML   = `v${current} <i class="ph-bold ph-arrow-circle-up" style="color:var(--orange);font-size:11px"></i>`;
                footerEl.title       = `Update available: v${latestTag}`;
                footerEl.style.color = 'var(--orange)';
            }
            const notice = document.getElementById('sm-mgr-update-notice');
            const text   = document.getElementById('sm-mgr-update-text');
            if (notice && text) { text.textContent = `v${latestTag} available`; notice.classList.remove('hidden'); }

            const badge  = document.getElementById('tmVersionBadge');
            if (badge) {
                badge.classList.add('update-available');
                badge.title   = `Update available: v${latestTag}`;
                badge.onclick = () => openSettingsModal('about');
            }
            document.getElementById('tmVersionText').innerHTML =
                `v${current} <i class="ph-bold ph-arrow-circle-up" style="font-size:11px"></i>`;

            if (localStorage.getItem('tmUpdateDismissed') !== latestTag) {
                const popup   = document.getElementById('tmUpdatePopup');
                const popupV  = document.getElementById('tmUpdatePopupVersion');
                const popupL  = document.getElementById('tmUpdatePopupLink');
                if (popup && popupV) {
                    popupV.textContent = `v${latestTag} is available (current: v${current})`;
                    if (popupL && ghData.html_url) popupL.href = ghData.html_url;
                    popup.classList.remove('hidden');
                }
            }
        }
    } catch(e) {}
}

function dismissTmUpdatePopup() {
    const popup = document.getElementById('tmUpdatePopup');
    if (popup) popup.classList.add('hidden');
    const vEl = document.getElementById('tmUpdatePopupVersion');
    const ver = (vEl?.textContent || '').match(/v([\d.]+)/)?.[1];
    if (ver) localStorage.setItem('tmUpdateDismissed', ver);
}

const TRAEFIK_ADVISORIES = [
    {
        id: 'CVE-2026-39858',
        severity: 'High',
        url: 'https://github.com/traefik/traefik/security/advisories/GHSA-5m6w-wvh7-57vm',
        forwardAuthRelated: true,
        summary: 'ForwardAuth authentication bypass via forwarded header aliases',
        // Fixed in 2.11.43 / 3.6.14 / 3.7.0-rc.2. Any 3.x below 3.6.14 (3.7.0+ is above) or 2.x below 2.11.43 is affected.
        affected: (p) => {
            const [maj, min, pat] = p;
            if (maj < 2) return true;
            if (maj === 2) return (min < 11) || (min === 11 && pat < 43);
            if (maj === 3) return (min < 6) || (min === 6 && pat < 14);
            return false;
        },
    },
];

function _configHasForwardAuth() {
    try {
        return (typeof _allMiddlewares !== 'undefined' ? _allMiddlewares : [])
            .some(m => /forward[_-]?auth/i.test(m.yaml || '') || /forward[_-]?auth/i.test(m.name || ''));
    } catch (e) { return false; }
}

function checkTraefikAdvisories(version) {
    const p = _semverParts(version);
    if (!p) return;
    const hit = TRAEFIK_ADVISORIES.find(a => a.affected(p));
    if (!hit) return;
    const dismissKey = 'traefikAdvisoryDismissed_' + hit.id;
    if (localStorage.getItem(dismissKey) === version) return;
    const popup = document.getElementById('securityAdvisoryPopup');
    const txt   = document.getElementById('securityAdvisoryText');
    const link  = document.getElementById('securityAdvisoryLink');
    if (!popup || !txt) return;
    const fa = hit.forwardAuthRelated && _configHasForwardAuth();
    txt.innerHTML = `Your Traefik <b>v${_esc(version)}</b> is affected by <b>${_esc(hit.id)}</b> (${_esc(hit.severity)}) - ${_esc(hit.summary)}.`
        + (fa ? ` A forwardAuth middleware is in use, so this is high priority.` : ``)
        + ` Update Traefik to a patched version.`;
    if (link) link.href = hit.url;
    popup.dataset.advisory = hit.id;
    popup.dataset.version = version;
    popup.classList.remove('hidden');
}

function dismissSecurityAdvisory() {
    const popup = document.getElementById('securityAdvisoryPopup');
    if (!popup) return;
    popup.classList.add('hidden');
    if (popup.dataset.advisory && popup.dataset.version) {
        localStorage.setItem('traefikAdvisoryDismissed_' + popup.dataset.advisory, popup.dataset.version);
    }
}
