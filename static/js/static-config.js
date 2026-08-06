require.config({ paths: { vs: '/static/vendor/monaco/vs' } });

let _staticMonaco          = null;
let _staticRawContent      = '';
let _staticOriginalContent = '';
let _staticPendingChanges  = false;
let _staticSectionEdits    = false;
let _staticSaved           = false;

function _confirm(message, title, okLabel) {
    return new Promise(resolve => {
        const overlay = document.getElementById('customConfirmOverlay');
        const msg     = document.getElementById('customConfirmMsg');
        const ttl     = document.getElementById('customConfirmTitle');
        const ok      = document.getElementById('customConfirmOk');
        const cancel  = document.getElementById('customConfirmCancel');
        if (msg)    msg.textContent = message;
        if (ttl)    ttl.textContent = title || '';
        if (ok)     ok.textContent  = okLabel || 'Confirm';
        if (overlay) overlay.style.display = 'flex';
        const done = (val) => {
            if (overlay) overlay.style.display = 'none';
            if (ok)     ok.onclick     = null;
            if (cancel) cancel.onclick = null;
            resolve(val);
        };
        if (ok)     ok.onclick     = () => done(true);
        if (cancel) cancel.onclick = () => done(false);
    });
}

let _mwMonacoEditor = null;
let _monacoThemesPromise = null;

function _monacoThemeName(isDark) { return isDark ? 'github-dark' : 'github-light'; }

function _ensureMonacoThemes() {
    if (_monacoThemesPromise) return _monacoThemesPromise;
    _monacoThemesPromise = Promise.all([
        fetch('/static/vendor/monaco-themes/GitHub%20Light.json').then(r => r.json()),
        fetch('/static/vendor/monaco-themes/GitHub%20Dark.json').then(r => r.json()),
    ]).then(([light, dark]) => {
        monaco.editor.defineTheme('github-light', light);
        monaco.editor.defineTheme('github-dark', dark);
    }).catch(() => { _monacoThemesPromise = null; });
    return _monacoThemesPromise;
}

function _initMwMonaco(value) {
    const container = document.getElementById('mwEditorContainer');
    if (!container) return;
    if (_mwMonacoEditor) {
        _mwMonacoEditor.setValue(value);
        setTimeout(() => _mwMonacoEditor.layout(), 50);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _mwMonacoEditor = monaco.editor.create(container, {
                value: value,
                language: 'yaml',
                theme: _monacoThemeName(isDark),
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'off',
            });
        });
    });
}

function _initStaticMonaco(content, containerId) {
    const container = document.getElementById(containerId || 'staticYamlPopoutEditor');
    if (!container) return;
    if (_staticMonaco) {
        _staticMonaco.setValue(content);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _staticMonaco = monaco.editor.create(container, {
                value: content,
                language: 'yaml',
                theme: _monacoThemeName(isDark),
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'off',
            });
            _staticMonaco.onDidChangeModelContent(() => {
                if (_staticMonaco.getValue() !== _staticOriginalContent) {
                    _markStaticPending();
                } else if (!_staticSectionEdits) {
                    _clearStaticPending();
                }
            });
        });
    });
}

function openStaticYamlPopout() {
    const overlay = document.getElementById('staticYamlPopout');
    if (!overlay) return;
    overlay.style.display = 'flex';
    if (_staticMonaco) {
        setTimeout(() => _staticMonaco.layout(), 50);
    } else {
        _initStaticMonaco(_staticRawContent);
    }
}

async function openStaticYamlPopoutFromShortcut() {
    if (!_staticRawContent) {
        try {
            const res  = await agentFetch(_activeAgent ? '/api/static' : '/api/static/config');
            const data = await res.json();
            const raw  = _activeAgent ? data.content : data.raw;
            if (raw) {
                _staticRawContent = raw;
                _staticOriginalContent = raw;
            }
        } catch(e) {}
    }
    openStaticYamlPopout();
}

function closeStaticYamlPopout() {
    const overlay = document.getElementById('staticYamlPopout');
    if (overlay) overlay.style.display = 'none';
}

let _gitDiffEditor  = null;
let _gitDiffFiles   = [];
let _gitDiffActive  = 0;

function openGitDiffPopout(sha, files) {
    const overlay = document.getElementById('gitDiffPopout');
    if (!overlay) return;
    const title = document.getElementById('gitDiffPopoutTitle');
    if (title) title.textContent = 'Diff - ' + sha.slice(0, 8);
    _gitDiffFiles  = files;
    _gitDiffActive = 0;
    overlay.style.display = 'flex';
    _renderGitDiffTabs();
    _showGitDiffFile(0);
}

function _renderGitDiffTabs() {
    const tabs = document.getElementById('gitDiffFileTabs');
    if (!tabs) return;
    tabs.innerHTML = _gitDiffFiles.map((f, i) => {
        const name   = f.filename.split('/').pop();
        const active = i === _gitDiffActive;
        return `<button onclick="_showGitDiffFile(${i})" id="gitDiffTab${i}" title="${f.filename}" class="btn-secondary text-xs" style="${active ? 'background:var(--input-bg);border-color:var(--blue);' : ''}">${name}</button>`;
    }).join('');
}

function _showGitDiffFile(idx) {
    _gitDiffActive = idx;
    const f = _gitDiffFiles[idx];
    if (!f) return;
    _gitDiffFiles.forEach((_, i) => {
        const t = document.getElementById('gitDiffTab' + i);
        if (t) t.style.borderColor = i === idx ? 'var(--blue)' : '';
    });
    const ext  = f.filename.split('.').pop().toLowerCase();
    const lang = (ext === 'yml' || ext === 'yaml') ? 'yaml' : 'plaintext';
    const container = document.getElementById('gitDiffPopoutEditor');
    if (_gitDiffEditor) {
        _gitDiffEditor.setModel({
            original: monaco.editor.createModel(f.old, lang),
            modified: monaco.editor.createModel(f.new, lang),
        });
    } else {
        require(['vs/editor/editor.main'], function() {
            _ensureMonacoThemes().then(() => {
                const isDark = document.documentElement.classList.contains('dark');
                _gitDiffEditor = monaco.editor.createDiffEditor(container, {
                    readOnly:           true,
                    renderSideBySide:   true,
                    theme:              _monacoThemeName(isDark),
                    fontSize:           12,
                    minimap:            { enabled: false },
                    scrollBeyondLastLine: false,
                });
                _gitDiffEditor.setModel({
                    original: monaco.editor.createModel(f.old, lang),
                    modified: monaco.editor.createModel(f.new, lang),
                });
            });
        });
    }
}

function closeGitDiffPopout() {
    const overlay = document.getElementById('gitDiffPopout');
    if (overlay) overlay.style.display = 'none';
}

async function saveStaticPopout() {
    await saveStaticConfig();
    closeStaticYamlPopout();
}

let _staticRestartNeeded = false;

function _renderStaticStateBar() {
    const bar = document.getElementById('staticStateBar');
    if (!bar) return;
    if (_staticPendingChanges) {
        bar.className = 'static-state-bar static-state-pending';
        bar.style.display = 'flex';
        bar.innerHTML = `<i class="ph-bold ph-warning"></i>
            <span class="static-state-text">Unsaved changes - nothing is written to <code>traefik.yml</code> until you save</span>
            <button onclick="discardStaticChanges()" class="btn-secondary text-xs">Discard</button>
            <button onclick="saveStaticConfig()" class="btn-primary text-xs">Save</button>`;
        return;
    }
    if (_staticRestartNeeded) {
        bar.className = 'static-state-bar static-state-restart';
        bar.style.display = 'flex';
        bar.innerHTML = `<i class="ph-bold ph-warning-circle"></i>
            <span class="static-state-text">Saved. Traefik is still running the previous config.</span>
            <button onclick="triggerTraefikRestart()" class="btn-secondary text-xs static-state-restart-btn">Restart Traefik</button>`;
        return;
    }
    bar.style.display = 'none';
    bar.innerHTML = '';
}

function _markStaticPending() {
    if (_staticPendingChanges) return;
    _staticPendingChanges = true;
    _renderStaticStateBar();
}

function _clearStaticPending() {
    _staticPendingChanges = false;
    _renderStaticStateBar();
}

function _showStaticRestartBanner() {
    _staticRestartNeeded = true;
    _renderStaticStateBar();
}

function _hideStaticRestartBanner() {
    _staticRestartNeeded = false;
    _renderStaticStateBar();
}

async function discardStaticChanges() {
    await _loadStaticFromDisk();
}

async function saveStaticConfig() {
    const content = _staticMonaco ? _staticMonaco.getValue() : _staticRawContent;
    try {
        const fetchFn = _activeAgent
            ? () => agentFetch('/api/static', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
            : () => fetch('/api/static/config', { method: 'POST', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify({ content }) });
        const res  = await fetchFn();
        const data = await res.json();
        if (data.ok) {
            _staticRawContent = content;
            _staticOriginalContent = content;
            _staticSaved = true;
            _staticSectionEdits = false;
            _clearStaticPending();
            _showStaticRestartBanner();
            showToast('Static config saved', 'success');
            try {
                const cfgUrl = _activeAgent
                    ? '/api/static/config?server=' + encodeURIComponent(_activeAgent.id)
                    : '/api/static/config';
                const r2 = await fetch(cfgUrl);
                const d2 = await r2.json();
                if (d2.parsed) _renderStaticSections(d2.parsed);
            } catch(e) {}
        } else {
            showToast(data.error || 'Save failed', 'error');
        }
    } catch(e) {
        showToast('Save failed', 'error');
    }
}

let _routeYamlMonaco  = null;
let _routeYamlId      = '';
let _routeYamlContent = '';

function _initRouteYamlMonaco(content) {
    const container = document.getElementById('routeYamlPopoutEditor');
    if (!container) return;
    if (_routeYamlMonaco) {
        _routeYamlMonaco.setValue(content);
        _routeYamlContent = content;
        setTimeout(() => _routeYamlMonaco.layout(), 50);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _routeYamlMonaco = monaco.editor.create(container, {
                value: content,
                language: 'yaml',
                theme: _monacoThemeName(isDark),
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'off',
            });
            _routeYamlContent = content;
        });
    });
}

async function openRouteYamlEditor(id) {
    _routeYamlId = id;
    const name = id.includes('::') ? id.split('::')[1] : id;
    const title = document.getElementById('routeYamlPopoutTitle');
    if (title) title.textContent = `Raw YAML - ${name}`;
    try {
        const res  = await agentFetch(`/api/routes/${encodeURIComponent(id)}/raw`);
        const data = await res.json();
        if (data.error) { showToast(data.error, 'error'); return; }
        const overlay = document.getElementById('routeYamlPopout');
        if (overlay) overlay.style.display = 'flex';
        _initRouteYamlMonaco(data.raw || '');
    } catch(e) {
        showToast('Failed to load route YAML', 'error');
    }
}

function closeRouteYamlEditor() {
    const overlay = document.getElementById('routeYamlPopout');
    if (overlay) overlay.style.display = 'none';
}

async function saveRouteYaml() {
    const content = _routeYamlMonaco ? _routeYamlMonaco.getValue() : _routeYamlContent;
    try {
        const res = await agentFetch(`/api/routes/${encodeURIComponent(_routeYamlId)}/raw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.ok) {
            closeRouteYamlEditor();
            refreshRoutes();
            fetchNotifications();
        } else {
            showToast(data.error || 'Save failed', 'error');
        }
    } catch(e) {
        showToast('Save failed', 'error');
    }
}

function _showRestartOverlay() {
    const el = document.getElementById('traefikRestartOverlay');
    if (el) el.style.display = 'flex';
}

function _hideRestartOverlay() {
    const el = document.getElementById('traefikRestartOverlay');
    if (el) el.style.display = 'none';
}

async function _waitForReconnect(immediate = false) {
    setTimeout(() => {
        const btn = document.getElementById('traefikRestartManualReload');
        if (btn) btn.style.display = 'inline-block';
    }, 8000);
    const agentId = _activeAgent ? _activeAgent.id : null;
    const healthOk = async () => {
        const r = await fetch(agentId ? `/api/agents/${encodeURIComponent(agentId)}/health` : '/api/health',
            { signal: AbortSignal.timeout(agentId ? 6000 : 3000) });
        if (!r.ok) return false;
        if (!agentId) return true;
        const d = await r.json();
        return d.ok === true;
    };
    if (!immediate) {
        await new Promise(r => setTimeout(r, 1500));
        let wentDown = false;
        for (let i = 0; i < 8 && !wentDown; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try { if (!await healthOk()) wentDown = true; }
            catch(e) { wentDown = true; }
        }
    }
    while (true) {
        await new Promise(r => setTimeout(r, 1500));
        try {
            if (await healthOk()) { location.reload(); return; }
        } catch(e) {}
    }
}

async function triggerTraefikRestart() {
    _showRestartOverlay();
    try {
        const res  = await agentFetch('/api/static/restart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.ok) {
            _hideStaticRestartBanner();
            _staticSaved = false;
            _waitForReconnect(false);
        } else {
            _hideRestartOverlay();
            showToast(data.error || 'Restart failed', 'error');
        }
    } catch(e) {
        _hideStaticRestartBanner();
        _waitForReconnect(true);
    }
}

let _staticParsedData    = {};
let _staticEditState     = { section: null, name: null };
let _staticActiveSection = 'entrypoints';
let _traefikRuntime      = null;

function _sfFormKey(s)   { return {entrypoints:'Ep', resolvers:'Res', plugins:'Plugin', providers:'Provider'}[s]||''; }
function _sfFormLabel(s) { return {entrypoints:'Entrypoint', resolvers:'Resolver', plugins:'Plugin', providers:'Provider'}[s]||''; }

function _updateStaticTabArrows() {
    const bar = document.getElementById('staticTabBar');
    const lBtn = document.getElementById('staticTabArrowL');
    const rBtn = document.getElementById('staticTabArrowR');
    if (!bar || !lBtn || !rBtn) return;
    const overflow = bar.scrollWidth > bar.clientWidth + 2;
    lBtn.style.display = overflow && bar.scrollLeft > 2 ? '' : 'none';
    rBtn.style.display = overflow && bar.scrollLeft < bar.scrollWidth - bar.clientWidth - 2 ? '' : 'none';
}

function _scrollStaticTabs(dir) {
    const bar = document.getElementById('staticTabBar');
    if (bar) bar.scrollBy({ left: dir * 160, behavior: 'smooth' });
}

function switchStaticSection(section) {
    _staticActiveSection = section;
    if (_tmModern()) {
        const head = document.getElementById('scHead-' + section);
        if (head) head.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
    }
    const sectionColors  = { entrypoints: 'var(--blue)', resolvers: 'var(--green)', plugins: 'var(--purple)', providers: 'var(--teal)' };
    const sectionLabels  = { entrypoints: 'Entrypoint', resolvers: 'Resolver', plugins: 'Plugin', providers: 'Provider' };
    const hdrIcon   = document.getElementById('staticHdrAddIcon');
    const hdrLabel  = document.getElementById('staticHdrAddLabel');
    const hdrAddBtn = document.getElementById('staticHdrAddBtn');
    if (hdrIcon)  hdrIcon.style.color = sectionColors[section] || 'var(--blue)';
    if (hdrLabel) hdrLabel.textContent = sectionLabels[section] || 'Add';
    const isSingleBlock = ['api','log'].includes(section);
    if (hdrAddBtn) hdrAddBtn.style.display = isSingleBlock ? 'none' : '';
    ['entrypoints','resolvers','plugins','api','log','providers'].forEach(s => {
        const panel = document.getElementById('staticPanel-' + s);
        const btn   = document.getElementById('ssnBtn-' + s);
        if (panel) panel.style.display = s === section ? '' : 'none';
        if (btn) {
            btn.classList.toggle('active', s === section);
            if (s === section) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    });
    requestAnimationFrame(_updateStaticTabArrows);
}

function _semverParts(v) {
    const m = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
}

function _traefikSupportsUnderscoreStrategy() {
    const p = _semverParts(typeof _currentVersion !== 'undefined' ? _currentVersion : '');
    if (!p) return true;
    const [maj, min, pat] = p;
    if (maj > 3) return true;
    if (maj < 3) return false;
    if (min > 7) return true;
    if (min === 7) return pat >= 6;
    if (min === 6) return pat >= 20;
    return false;
}

function _updateEpUnderscoreVisibility() {
    const row = document.getElementById('sfEpUnderscoreRow');
    if (row) row.style.display = _traefikSupportsUnderscoreStrategy() ? 'block' : 'none';
}

function openStaticAddForm(section) {
    if (_staticEditState.section) closeStaticForm(_staticEditState.section);
    _staticEditState = { section, name: null };
    _resetStaticForm(section);
    if (section === 'entrypoints') _updateEpUnderscoreVisibility();
    const f = document.getElementById('staticForm-' + section);
    if (f) f.style.display = 'block';
    const btn = document.getElementById('sf' + _sfFormKey(section) + 'Btn');
    if (btn) btn.textContent = 'Add ' + _sfFormLabel(section);
    if (section === 'entrypoints') document.getElementById('sfEpName')?.focus();
    if (section === 'resolvers')   document.getElementById('sfResName')?.focus();
    if (section === 'plugins')     document.getElementById('sfPluginName')?.focus();
}

function openStaticEditForm(section, name) {
    if (_staticEditState.section) closeStaticForm(_staticEditState.section);
    _staticEditState = { section, name };
    _prefillStaticForm(section, name);
    if (section === 'entrypoints') _updateEpUnderscoreVisibility();
    const f = document.getElementById('staticForm-' + section);
    if (f) f.style.display = 'block';
    const btn = document.getElementById('sf' + _sfFormKey(section) + 'Btn');
    if (btn) btn.textContent = 'Save Changes';
}

function closeStaticForm(section) {
    if (!section) return;
    const f = document.getElementById('staticForm-' + section);
    if (f) f.style.display = 'none';
    _staticEditState = { section: null, name: null };
}

function _resetStaticForm(section) {
    if (section === 'entrypoints') {
        ['sfEpName','sfEpAddr','sfEpRedirect','sfEpTrustedIps','sfEpProxyIps','sfEpMiddlewares','sfEpTlsResolver','sfEpTlsOptions','sfEpReadTimeout','sfEpWriteTimeout','sfEpIdleTimeout'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
        ['sfEpHttp3','sfEpFwdInsecure','sfEpProxyInsecure','sfEpTlsEnabled','sfEpAsDefault'].forEach(id => { const e = document.getElementById(id); if (e) e.checked = false; });
        const tlsRow = document.getElementById('sfEpTlsRow'); if (tlsRow) tlsRow.style.display = 'none';
    } else if (section === 'resolvers') {
        ['sfResName','sfResEmail','sfResProvider','sfResCaServer','sfResEabKid','sfResEabHmac','sfResDnsResolvers','sfResDnsDelay'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
        const kt = document.getElementById('sfResKeyType'); if (kt) kt.value = '';
        const nc = document.getElementById('sfResDnsNoCheck'); if (nc) nc.checked = false;
        const st = document.getElementById('sfResStorage'); if (st) st.value = '/acme.json';
        const ch = document.getElementById('sfResChallenge'); if (ch) ch.value = 'dnsChallenge';
        onStaticChallengeChange();
    } else if (section === 'plugins') {
        ['sfPluginName','sfPluginModule','sfPluginVersion'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    } else if (section === 'providers') {
        const t = document.getElementById('sfProviderType'); if (t) t.value = '';
        const w = document.getElementById('sfProviderEditorWrap'); if (w) w.style.display = 'none';
        if (_providerMonaco) _providerMonaco.setValue('');
    }
}

function _prefillStaticForm(section, name) {
    _resetStaticForm(section);
    const d = _staticParsedData || {};
    if (section === 'entrypoints') {
        const ep = (d.entryPoints || d.entrypoints || {})[name] || {};
        document.getElementById('sfEpName').value    = name;
        document.getElementById('sfEpAddr').value    = ep.address || '';
        document.getElementById('sfEpRedirect').value = ep.http?.redirections?.entryPoint?.to || '';
        const h3chk = document.getElementById('sfEpHttp3'); if (h3chk) h3chk.checked = !!ep.http3;
        const uhsSel = document.getElementById('sfEpUnderscore');
        if (uhsSel) uhsSel.value = ep.http?.underscoreHeadersStrategy || '';
        const fh = ep.forwardedHeaders || {};
        const pp = ep.proxyProtocol || {};
        const tipsEl = document.getElementById('sfEpTrustedIps');
        if (tipsEl) tipsEl.value = Array.isArray(fh.trustedIPs) ? fh.trustedIPs.join('\n') : '';
        const ppEl = document.getElementById('sfEpProxyIps');
        if (ppEl) ppEl.value = Array.isArray(pp.trustedIPs) ? pp.trustedIPs.join('\n') : '';
        const fiEl = document.getElementById('sfEpFwdInsecure'); if (fiEl) fiEl.checked = !!fh.insecure;
        const piEl = document.getElementById('sfEpProxyInsecure'); if (piEl) piEl.checked = !!pp.insecure;
        const mwEl = document.getElementById('sfEpMiddlewares');
        if (mwEl) mwEl.value = Array.isArray(ep.http?.middlewares) ? ep.http.middlewares.join(', ') : '';
        const tlsOn = ep.http && ep.http.tls !== undefined && ep.http.tls !== null;
        const tlsChk = document.getElementById('sfEpTlsEnabled'); if (tlsChk) tlsChk.checked = tlsOn;
        const tlsRow = document.getElementById('sfEpTlsRow'); if (tlsRow) tlsRow.style.display = tlsOn ? '' : 'none';
        const tlsObj = (tlsOn && typeof ep.http.tls === 'object') ? ep.http.tls : {};
        const trEl = document.getElementById('sfEpTlsResolver'); if (trEl) trEl.value = tlsObj.certResolver || '';
        const toEl = document.getElementById('sfEpTlsOptions'); if (toEl) toEl.value = tlsObj.options || '';
        const adEl = document.getElementById('sfEpAsDefault'); if (adEl) adEl.checked = !!ep.asDefault;
        const rts = ep.transport?.respondingTimeouts || {};
        [['sfEpReadTimeout','readTimeout'],['sfEpWriteTimeout','writeTimeout'],['sfEpIdleTimeout','idleTimeout']].forEach(([id, k]) => {
            const e = document.getElementById(id);
            if (e) e.value = rts[k] !== undefined && rts[k] !== null ? String(rts[k]) : '';
        });
    } else if (section === 'resolvers') {
        const acme = ((d.certificatesResolvers || {})[name] || {}).acme || {};
        document.getElementById('sfResName').value    = name;
        document.getElementById('sfResEmail').value   = acme.email || '';
        document.getElementById('sfResStorage').value = acme.storage || '/acme.json';
        const ct = acme.dnsChallenge ? 'dnsChallenge' : acme.httpChallenge ? 'httpChallenge' : 'tlsChallenge';
        document.getElementById('sfResChallenge').value = ct;
        document.getElementById('sfResProvider').value  = (acme.dnsChallenge || {}).provider || '';
        document.getElementById('sfResHttpEp').value    = (acme.httpChallenge || {}).entryPoint || 'web';
        document.getElementById('sfResCaServer').value  = acme.caServer || '';
        const ktEl = document.getElementById('sfResKeyType'); if (ktEl) ktEl.value = acme.keyType || '';
        document.getElementById('sfResEabKid').value  = (acme.eab || {}).kid || '';
        document.getElementById('sfResEabHmac').value = (acme.eab || {}).hmacEncoded || '';
        const dns = acme.dnsChallenge || {};
        document.getElementById('sfResDnsResolvers').value = Array.isArray(dns.resolvers) ? dns.resolvers.join('\n') : '';
        const prop = dns.propagation || {};
        document.getElementById('sfResDnsDelay').value = prop.delayBeforeChecks !== undefined && prop.delayBeforeChecks !== null ? String(prop.delayBeforeChecks) : '';
        const ncEl = document.getElementById('sfResDnsNoCheck'); if (ncEl) ncEl.checked = !!prop.disableChecks;
        onStaticChallengeChange();
    } else if (section === 'plugins') {
        const p = ((d.experimental || {}).plugins || {})[name] || {};
        document.getElementById('sfPluginName').value    = name;
        document.getElementById('sfPluginModule').value  = p.moduleName || '';
        document.getElementById('sfPluginVersion').value = p.version || '';
    } else if (section === 'providers') {
        const sel = document.getElementById('sfProviderType');
        if (sel) sel.value = name;
        const wrap = document.getElementById('sfProviderEditorWrap');
        if (wrap) wrap.style.display = '';
        const existing = ((d.providers || {})[name] || {});
        const yamlLines = Object.entries(existing).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
        const initialYaml = yamlLines || (PROVIDER_TEMPLATES[name] || '');
        _initProviderMonaco(initialYaml);
    }
}

function onStaticChallengeChange() {
    const ct   = document.getElementById('sfResChallenge')?.value;
    const dns  = document.getElementById('sfResDnsRow');
    const http = document.getElementById('sfResHttpRow');
    const adv  = document.getElementById('sfResDnsAdvanced');
    if (dns)  dns.style.display  = ct === 'dnsChallenge'  ? '' : 'none';
    if (http) http.style.display = ct === 'httpChallenge' ? '' : 'none';
    if (adv)  adv.style.display  = ct === 'dnsChallenge'  ? '' : 'none';
}

async function _applyStaticSectionChange(body) {
    const res  = await fetch('/api/static/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ ...body, current_raw: _staticRawContent }),
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.error || 'Failed', 'error'); return; }
    _staticParsedData = data.parsed || {};
    _staticRawContent = data.raw || '';
    _renderStaticSections(_staticParsedData);
    if (_staticMonaco) _staticMonaco.setValue(_staticRawContent);
    _staticSectionEdits = true;
    _markStaticPending();
}

async function submitStaticSection(section) {
    const action   = _staticEditState.name ? 'edit' : 'add';
    const old_name = _staticEditState.name || '';
    let name, payload;
    if (section === 'entrypoints') {
        name    = document.getElementById('sfEpName').value.trim();
        payload = { address: document.getElementById('sfEpAddr').value.trim(), redirect_to: document.getElementById('sfEpRedirect').value.trim(), http3: document.getElementById('sfEpHttp3')?.checked || false, underscore_headers: document.getElementById('sfEpUnderscore')?.value || '',
            trusted_ips: document.getElementById('sfEpTrustedIps')?.value || '',
            forwarded_insecure: document.getElementById('sfEpFwdInsecure')?.checked || false,
            proxy_trusted_ips: document.getElementById('sfEpProxyIps')?.value || '',
            proxy_insecure: document.getElementById('sfEpProxyInsecure')?.checked || false,
            middlewares: document.getElementById('sfEpMiddlewares')?.value || '',
            tls_enabled: document.getElementById('sfEpTlsEnabled')?.checked || false,
            tls_cert_resolver: document.getElementById('sfEpTlsResolver')?.value.trim() || '',
            tls_options: document.getElementById('sfEpTlsOptions')?.value.trim() || '',
            as_default: document.getElementById('sfEpAsDefault')?.checked || false,
            read_timeout: document.getElementById('sfEpReadTimeout')?.value.trim() || '',
            write_timeout: document.getElementById('sfEpWriteTimeout')?.value.trim() || '',
            idle_timeout: document.getElementById('sfEpIdleTimeout')?.value.trim() || '' };
    } else if (section === 'resolvers') {
        name    = document.getElementById('sfResName').value.trim();
        payload = { email: document.getElementById('sfResEmail').value.trim(), storage: document.getElementById('sfResStorage').value.trim(), challenge_type: document.getElementById('sfResChallenge').value, provider: document.getElementById('sfResProvider').value.trim(), http_entrypoint: document.getElementById('sfResHttpEp').value.trim(),
            ca_server: document.getElementById('sfResCaServer')?.value.trim() || '',
            key_type: document.getElementById('sfResKeyType')?.value || '',
            eab_kid: document.getElementById('sfResEabKid')?.value.trim() || '',
            eab_hmac: document.getElementById('sfResEabHmac')?.value.trim() || '',
            dns_resolvers: document.getElementById('sfResDnsResolvers')?.value || '',
            dns_delay: document.getElementById('sfResDnsDelay')?.value.trim() || '',
            dns_disable_checks: document.getElementById('sfResDnsNoCheck')?.checked || false };
    } else if (section === 'plugins') {
        name    = document.getElementById('sfPluginName').value.trim();
        payload = { moduleName: document.getElementById('sfPluginModule').value.trim(), version: document.getElementById('sfPluginVersion').value.trim() };
    }
    if (!name) { showToast('Name is required', 'error'); return; }
    try {
        await _applyStaticSectionChange({ action, section, name, old_name, data: payload });
        closeStaticForm(section);
    } catch(e) { showToast('Request failed', 'error'); }
}

async function removeStaticItem(section, name) {
    if (!await _confirm(`Remove "${name}"?`, 'Remove Item', 'Remove')) return;
    try {
        await _applyStaticSectionChange({ action: 'remove', section, name, data: {} });
    } catch(e) { showToast('Request failed', 'error'); }
}

function _scFile(path) {
    if (!path) return '';
    const name = String(path).split('/').filter(Boolean).pop() || String(path);
    return `<span class="tm-cf" title="${_esc(path)}"><i class="ph-bold ph-file-code"></i>${_esc(name)}</span>`;
}

function _scRail(section, name) {
    const nd = JSON.stringify(name);
    return `<span class="tm-rail tm-rail-sm" onclick="event.stopPropagation()">` +
        `<button type="button" class="tm-btn" title="Edit" onclick='event.stopPropagation();openStaticEditForm("${section}",${nd})'><i class="ph-bold ph-pencil-simple"></i></button>` +
        `<button type="button" class="tm-btn" title="Delete" onclick='event.stopPropagation();removeStaticItem("${section}",${nd})'><i class="ph-bold ph-trash"></i></button>` +
        '</span>';
}

function _scGrid(cards) {
    return `<div class="tm-card-grid">${cards}</div>`;
}

function _scEmpty(text) {
    return `<div class="px-5 py-8 text-center text-sm" style="color:var(--muted)">${_esc(text)}</div>`;
}

function _tmEpCard(name, ep) {
    const addr  = ep.address || '';
    const redir = ep.http?.redirections?.entryPoint?.to || '';
    const uhs   = ep.http?.underscoreHeadersStrategy || '';
    const tips  = Array.isArray(ep.forwardedHeaders?.trustedIPs) ? ep.forwardedHeaders.trustedIPs.length : 0;
    const isUdp = /\/udp$/i.test(addr);
    const isTcp = /\/tcp$/i.test(addr);
    const port  = addr.replace(/\/(tcp|udp)$/i, '').replace(/^.*:/, '');
    const proto = isUdp ? ['UDP', '#e2c041'] : isTcp ? ['TCP', 'var(--teal)']
                : port === '443' ? ['HTTPS', 'var(--green)'] : ['HTTP', 'var(--blue)'];
    const glyphs = (ep.http3 ? '<i class="ph-bold ph-lightning tm-glyph" style="color:var(--purple)" title="HTTP/3 enabled"></i>' : '')
        + (tips ? `<i class="ph-bold ph-shield tm-glyph" style="color:var(--blue)" title="forwardedHeaders.trustedIPs: ${tips} range(s)"></i>` : '')
        + (uhs ? `<i class="ph-bold ph-shield-check tm-glyph" style="color:var(--green)" title="underscoreHeadersStrategy: ${_esc(uhs)}"></i>` : '');
    const vals = redir
        ? `<div class="tm-vals"><div class="tm-val tm-val-target"><i class="ph-bold ph-arrow-u-up-right"></i><span class="tm-v">redirects to ${_esc(redir)}</span></div></div>`
        : '';
    const meta = [
        `<span class="d-flat" style="color:${proto[1]}">${proto[0]}${port ? ' ' + _esc(port) : ''}</span>`,
        tips ? `${tips} trusted range${tips > 1 ? 's' : ''}` : '',
        uhs ? _esc(uhs) : '',
    ].filter(Boolean).join('<span class="tm-sep"> \u00b7 </span>');
    return `<div class="tm-card tm-card-flat" style="--tm-accent:${proto[1]}">
        <div class="tm-head">
            <span class="tm-ic tm-ic-tile"><i class="ph-bold ph-door-open"></i></span>
            <div class="tm-head-txt">
                <div class="tm-title"><span class="tm-name">${_esc(name)}</span>${glyphs}</div>
            </div>${_scRail('entrypoints', name)}
        </div>
        ${vals}
        <div class="tm-foot"><span class="tm-meta">${meta}</span></div>
    </div>`;
}

function _tmResolverCard(name, res) {
    const acme  = (res || {}).acme || {};
    const isDns = !!acme.dnsChallenge, isHttp = !!acme.httpChallenge;
    const kind  = isDns ? `DNS challenge \u00b7 ${acme.dnsChallenge.provider || '?'}` : isHttp ? 'HTTP challenge' : 'TLS challenge';
    const accent = isDns ? 'var(--blue)' : isHttp ? 'var(--orange)' : 'var(--green)';

    return `<div class="tm-card tm-card-flat" style="--tm-accent:${accent}">
        <div class="tm-head">
            <span class="tm-ic tm-ic-tile"><i class="ph-bold ph-certificate"></i></span>
            <div class="tm-head-txt">
                <div class="tm-title"><span class="tm-name">${_esc(name)}</span></div>
                <div class="tm-sub">${_esc(kind)}</div>
            </div>${_scRail('resolvers', name)}
        </div>
        <div class="tm-foot"><span class="tm-meta">${acme.email ? _esc(acme.email) : 'no account email'}</span>${_scFile(acme.storage || 'acme.json')}</div>
    </div>`;
}

function _tmPluginCard(name, p) {
    const vals = p.moduleName
        ? `<div class="tm-vals"><div class="tm-val"><i class="ph-bold ph-package"></i><span class="tm-v" title="${_esc(p.moduleName)}">${_esc(p.moduleName)}</span>${_tmCopy(p.moduleName)}</div></div>`
        : '';
    return `<div class="tm-card tm-card-flat" style="--tm-accent:var(--purple)">
        <div class="tm-head">
            <span class="tm-ic tm-ic-tile"><i class="ph-bold ph-puzzle-piece"></i></span>
            <div class="tm-head-txt">
                <div class="tm-title"><span class="tm-name">${_esc(name)}</span></div>
                <div class="tm-sub">${_esc(p.version || 'no version pinned')}</div>
            </div>${_scRail('plugins', name)}
        </div>
        ${vals}
        <div class="tm-foot"><span class="tm-meta">declared in traefik.yml</span></div>
    </div>`;
}

function _renderStaticEntrypoints(eps) {
    const keys = Object.keys(eps || {});
    const cnt  = document.getElementById('staticEpCount');
    if (cnt) cnt.textContent = keys.length;
    const el = document.getElementById('staticEpList');
    if (!el) return;
    if (!keys.length) {
        el.innerHTML = _scEmpty('No entrypoints configured');
        return;
    }
    if (_tmModern()) {
        el.innerHTML = _scGrid(keys.map(name => _tmEpCard(name, eps[name] || {})).join(''));
        return;
    }
    const rows = keys.map((name, i) => {
        const ep    = eps[name] || {};
        const addr  = ep.address || '';
        const redir = ep.http?.redirections?.entryPoint?.to || '';
        const uhs   = ep.http?.underscoreHeadersStrategy || '';
        const http3 = !!ep.http3;
        const tips  = Array.isArray(ep.forwardedHeaders?.trustedIPs) ? ep.forwardedHeaders.trustedIPs.length : 0;
        const port  = addr.replace(/^.*:/, '');
        const proto = port === '443' ? 'HTTPS' : port === '80' ? 'HTTP' : port ? port : '';
        const nd    = JSON.stringify(name);
        const sep   = i < keys.length - 1 ? `border-bottom:1px solid var(--border);` : '';
        return `<div class="flex items-center gap-4 px-4 py-3" style="${sep}">
            <div class="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                <span class="text-sm font-mono font-semibold" style="color:var(--text)">${_esc(name)}</span>
                <span class="text-xs font-mono px-2 py-0.5 rounded-md flex-shrink-0" style="background:rgba(36,161,222,0.1);color:var(--blue)">${_esc(addr)}</span>
                ${proto ? `<span class="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style="background:rgba(36,161,222,0.07);color:var(--blue)">${proto}</span>` : ''}
                ${redir ? `<span class="text-xs flex-shrink-0" style="color:var(--muted)">→ <span class="font-mono" style="color:var(--text)">${_esc(redir)}</span></span>` : ''}
                ${http3 ? `<span class="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style="background:rgba(163,113,247,0.1);color:var(--purple)">HTTP/3</span>` : ''}
                ${uhs ? `<span class="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style="background:rgba(63,185,80,0.12);color:var(--green)" title="underscoreHeadersStrategy: ${_esc(uhs)}"><i class="ph-bold ph-shield-check" style="font-size:10px"></i> ${_esc(uhs)}</span>` : ''}
                ${tips ? `<span class="text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0" style="background:rgba(36,161,222,0.1);color:var(--blue)" title="forwardedHeaders.trustedIPs: ${tips} range(s)"><i class="ph-bold ph-shield" style="font-size:10px"></i> ${tips} trusted</span>` : ''}
            </div>
            <div class="flex gap-1 flex-shrink-0">
                <button onclick='openStaticEditForm("entrypoints",${nd})' class="btn-icon text-xs" title="Edit"><i class="ph-bold ph-pencil-simple"></i></button>
                <button onclick='removeStaticItem("entrypoints",${nd})' class="btn-icon text-xs" title="Delete" style="color:var(--red)"><i class="ph-bold ph-trash"></i></button>
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div style="margin:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;">${rows}</div>`;
}

function _renderStaticResolvers(resolvers) {
    const keys = Object.keys(resolvers || {});
    const cnt  = document.getElementById('staticResolverCount');
    if (cnt) cnt.textContent = keys.length;
    const el = document.getElementById('staticResolverList');
    if (!el) return;
    if (!keys.length) {
        el.innerHTML = _scEmpty('No certificate resolvers configured');
        return;
    }
    if (_tmModern()) {
        el.innerHTML = _scGrid(keys.map(name => _tmResolverCard(name, resolvers[name])).join(''));
        return;
    }
    const rows = keys.map((name, i) => {
        const acme  = (resolvers[name] || {}).acme || {};
        const email = acme.email || '';
        const isDns  = !!acme.dnsChallenge;
        const isHttp = !!acme.httpChallenge;
        const chLabel = isDns  ? `DNS · ${acme.dnsChallenge.provider || '?'}`
                      : isHttp ? 'HTTP'
                      : 'TLS';
        const chColor = isDns  ? 'var(--blue)' : isHttp ? '#f59e0b' : 'var(--green)';
        const chBg    = isDns  ? 'rgba(36,161,222,0.1)' : isHttp ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)';
        const nd  = JSON.stringify(name);
        const sep = i < keys.length - 1 ? `border-bottom:1px solid var(--border);` : '';
        return `<div class="flex items-center gap-4 px-4 py-3" style="${sep}">
            <div class="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
                <span class="text-sm font-mono font-semibold" style="color:var(--text)">${_esc(name)}</span>
                <span class="text-xs font-mono px-2 py-0.5 rounded-md flex-shrink-0" style="background:${chBg};color:${chColor}">${_esc(chLabel)}</span>
                ${email ? `<span class="text-xs truncate" style="color:var(--muted)">${_esc(email)}</span>` : ''}
            </div>
            <div class="flex gap-1 flex-shrink-0">
                <button onclick='openStaticEditForm("resolvers",${nd})' class="btn-icon text-xs" title="Edit"><i class="ph-bold ph-pencil-simple"></i></button>
                <button onclick='removeStaticItem("resolvers",${nd})' class="btn-icon text-xs" title="Delete" style="color:var(--red)"><i class="ph-bold ph-trash"></i></button>
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div style="margin:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;">${rows}</div>`;
}

function _renderStaticPlugins(plugins) {
    const keys = Object.keys(plugins || {});
    const cnt  = document.getElementById('staticPluginCount');
    if (cnt) cnt.textContent = keys.length;
    const el = document.getElementById('staticPluginList');
    if (!el) return;
    if (!keys.length) {
        el.innerHTML = _scEmpty('No plugins installed');
        return;
    }
    if (_tmModern()) {
        el.innerHTML = _scGrid(keys.map(name => _tmPluginCard(name, plugins[name] || {})).join(''));
        return;
    }
    const rows = keys.map((name, i) => {
        const p   = plugins[name] || {};
        const nd  = JSON.stringify(name);
        const sep = i < keys.length - 1 ? `border-bottom:1px solid var(--border);` : '';
        return `<div class="flex items-center gap-4 px-4 py-3" style="${sep}">
            <div class="flex-1 flex items-center gap-2 min-w-0">
                <span class="text-sm font-mono font-semibold flex-shrink-0" style="color:var(--text)">${_esc(name)}</span>
                ${p.moduleName ? `<span class="text-xs font-mono truncate" style="color:var(--muted)">${_esc(p.moduleName)}</span>` : ''}
                ${p.version    ? `<span class="text-xs font-mono px-2 py-0.5 rounded-md flex-shrink-0" style="background:rgba(168,85,247,0.1);color:var(--purple)">${_esc(p.version)}</span>` : ''}
            </div>
            <div class="flex gap-1 flex-shrink-0">
                <button onclick='openStaticEditForm("plugins",${nd})' class="btn-icon text-xs" title="Edit"><i class="ph-bold ph-pencil-simple"></i></button>
                <button onclick='removeStaticItem("plugins",${nd})' class="btn-icon text-xs" title="Delete" style="color:var(--red)"><i class="ph-bold ph-trash"></i></button>
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div style="margin:12px 16px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;">${rows}</div>`;
}

function _renderStaticSections(parsed) {
    _staticParsedData = parsed || {};
    _renderStaticEntrypoints(_staticParsedData.entryPoints || _staticParsedData.entrypoints || {});
    _renderStaticResolvers(_staticParsedData.certificatesResolvers || {});
    _renderStaticPlugins((_staticParsedData.experimental || {}).plugins || {});
    _renderStaticApi(_staticParsedData.api);
    _renderStaticLog(_staticParsedData.log, _staticParsedData.accessLog);
    _renderStaticProviders(_staticParsedData.providers);
}

function staticToggle(id) {
    const el = document.getElementById('staticT-' + id);
    if (el) el.classList.toggle('on');
}
function _staticToggleState(id) {
    const el = document.getElementById('staticT-' + id);
    return el ? el.classList.contains('on') : false;
}
function _setStaticToggle(id, on) {
    const el = document.getElementById('staticT-' + id);
    if (el) el.classList.toggle('on', !!on);
}

function _syncStaticApiWarn() {
    const warn = document.getElementById('staticApiWarn');
    if (warn) warn.style.display = _staticToggleState('apiEnabled') ? 'none' : '';
}

function onApiEnabledToggle() {
    staticToggle('apiEnabled');
    _syncStaticApiWarn();
}

function onAccessLogToggle() {
    staticToggle('accessLog');
    const row = document.getElementById('accessLogPathRow');
    if (row) row.style.display = _staticToggleState('accessLog') ? '' : 'none';
}
function onDockerProviderToggle() {
    staticToggle('dockerEnabled');
    const fields = document.getElementById('dockerProviderFields');
    if (fields) fields.style.display = _staticToggleState('dockerEnabled') ? '' : 'none';
}
function onFileProviderToggle() {
    staticToggle('fileEnabled');
    const fields = document.getElementById('fileProviderFields');
    if (fields) fields.style.display = _staticToggleState('fileEnabled') ? '' : 'none';
}

function _renderStaticApi(apiData) {
    const enabled = apiData !== undefined && apiData !== null;
    _setStaticToggle('apiEnabled', enabled);
    const api = apiData || {};
    _setStaticToggle('dashboardEnabled', api.dashboard !== false);
    _setStaticToggle('insecure', !!api.insecure);
    _setStaticToggle('debugMode', !!api.debug);
    _syncStaticApiWarn();
}

function _renderStaticLog(logData, accessLogData) {
    const log = logData || {};
    const sel = document.getElementById('sfLogLevel');
    if (sel) sel.value = (log.level || 'ERROR').toUpperCase();
    const hasAL = accessLogData !== undefined && accessLogData !== null;
    _setStaticToggle('accessLog', hasAL);
    const inp = document.getElementById('sfAccessLogPath');
    if (inp) inp.value = (accessLogData || {}).filePath || '';
    const row = document.getElementById('accessLogPathRow');
    if (row) row.style.display = hasAL ? '' : 'none';
}

function _renderStaticProviders(providersData) {
    const prov = providersData || {};
    const hasDocker = prov.docker !== undefined && prov.docker !== null;
    _setStaticToggle('dockerEnabled', hasDocker);
    const dockerFields = document.getElementById('dockerProviderFields');
    if (dockerFields) dockerFields.style.display = hasDocker ? '' : 'none';
    if (hasDocker) {
        const ep = document.getElementById('sfDockerEndpoint');
        if (ep) ep.value = (prov.docker || {}).endpoint || 'unix:///var/run/docker.sock';
        _setStaticToggle('dockerExposedByDefault', (prov.docker || {}).exposedByDefault !== false);
        _setStaticToggle('dockerWatch', (prov.docker || {}).watch !== false);
    }
    const hasFile = prov.file !== undefined && prov.file !== null;
    _setStaticToggle('fileEnabled', hasFile);
    const fileFields = document.getElementById('fileProviderFields');
    if (fileFields) fileFields.style.display = hasFile ? '' : 'none';
    if (hasFile) {
        const dir = document.getElementById('sfFileDirectory');
        if (dir) dir.value = (prov.file || {}).directory || '';
        _setStaticToggle('fileWatch', (prov.file || {}).watch !== false);
    }
    const otherEl = document.getElementById('staticOtherProvidersList');
    if (otherEl) {
        const others = Object.keys(prov).filter(k => k !== 'docker' && k !== 'file');
        if (others.length) {
            otherEl.innerHTML = `<div style="margin:0 16px 8px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;overflow:hidden;">` +
                others.map((k, i) => `
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;${i > 0 ? 'border-top:1px solid var(--border)' : ''}">
                        <div class="flex items-center gap-2 text-sm">
                            <i class="ph-bold ph-cloud" style="color:var(--teal)"></i>
                            <span class="font-medium">${_esc(k)}</span>
                        </div>
                        <button onclick="removeStaticItem('providers','${_esc(k)}')" class="btn-secondary text-xs flex items-center gap-1" style="height:24px;padding:0 8px;color:var(--red)">
                            <i class="ph-bold ph-trash text-sm"></i>
                        </button>
                    </div>`).join('') +
                `</div>`;
        } else {
            otherEl.innerHTML = '';
        }
    }
}

const PROVIDER_TEMPLATES = {
    swarm:              `endpoint: "unix:///var/run/docker.sock"\nexposedByDefault: false\nwatch: true`,
    http:               `endpoint: "http://your-config-server/api/config"\npollInterval: "5s"\npollTimeout: "5s"`,
    kubernetes:         `endpoint: ""\ntoken: ""\ncertAuthFilePath: ""\nnamespaces: []\nlabelselector: ""`,
    kubernetesIngress:  `endpoint: ""\ntoken: ""\nnamespaces: []\ningressClass: ""\ningressEndpoint:\n  publishedService: ""`,
    kubernetesGateway:  `endpoint: ""\nexperimentalChannel: false`,
    nomad:              `endpoint: "http://localhost:4646"\nprefix: "traefik"\nstale: false\nnamespaces: []`,
    ecs:                `clusters:\n  - default\nautoDiscoverClusters: false\nregion: "us-east-1"\nexposedByDefault: true`,
    consulCatalog:      `prefix: "traefik"\nrefreshInterval: "15s"\nendpoint:\n  address: "127.0.0.1:8500"\n  scheme: ""\n  datacenter: ""\n  token: ""\nexposedByDefault: true`,
    consul:             `endpoints:\n  - "127.0.0.1:8500"\nrootKey: "traefik"\nnamespace: ""\ntoken: ""`,
    redis:              `endpoints:\n  - "127.0.0.1:6379"\nrootKey: "traefik"\npassword: ""\ndb: 0`,
    etcd:               `endpoints:\n  - "127.0.0.1:2379"\nrootKey: "traefik"\nusername: ""\npassword: ""`,
    zooKeeper:          `endpoints:\n  - "127.0.0.1:2181"\nrootKey: "traefik"\nusername: ""\npassword: ""`,
};

let _providerMonaco = null;

function _initProviderMonaco(value) {
    const container = document.getElementById('sfProviderEditorContainer');
    if (!container) return;
    if (_providerMonaco) {
        _providerMonaco.setValue(value);
        setTimeout(() => _providerMonaco.layout(), 50);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _providerMonaco = monaco.editor.create(container, {
                value: value,
                language: 'yaml',
                theme: _monacoThemeName(isDark),
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'off',
            });
        });
    });
}

function onProviderTypeSelect(val) {
    const wrap = document.getElementById('sfProviderEditorWrap');
    if (!val) { if (wrap) wrap.style.display = 'none'; return; }
    if (wrap) wrap.style.display = '';
    const tpl = PROVIDER_TEMPLATES[val] || '';
    _initProviderMonaco(tpl);
}

async function submitStaticProvider() {
    const type = (document.getElementById('sfProviderType')?.value || '').trim();
    if (!type) { showToast('Select a provider type', 'error'); return; }
    const yaml_config = _providerMonaco ? _providerMonaco.getValue() : '';
    const action   = _staticEditState.name ? 'edit' : 'add';
    const old_name = _staticEditState.name || '';
    try {
        await _applyStaticSectionChange({ action, section: 'providers', name: type, old_name, data: { yaml_config } });
        closeStaticForm('providers');
    } catch(e) { showToast('Request failed', 'error'); }
}

async function saveStaticSingleSection(section) {
    let data = {};
    if (section === 'api') {
        data = {
            enabled: _staticToggleState('apiEnabled'),
            dashboard: _staticToggleState('dashboardEnabled'),
            insecure: _staticToggleState('insecure'),
            debug: _staticToggleState('debugMode'),
        };
    } else if (section === 'log') {
        data = {
            level: document.getElementById('sfLogLevel')?.value || 'ERROR',
            accessLog: _staticToggleState('accessLog'),
            accessLogPath: document.getElementById('sfAccessLogPath')?.value.trim() || '',
        };
    } else if (section === 'providers') {
        data = {
            docker: _staticToggleState('dockerEnabled'),
            dockerEndpoint: document.getElementById('sfDockerEndpoint')?.value.trim() || '',
            dockerExposedByDefault: _staticToggleState('dockerExposedByDefault'),
            dockerWatch: _staticToggleState('dockerWatch'),
            file: _staticToggleState('fileEnabled'),
            fileDirectory: document.getElementById('sfFileDirectory')?.value.trim() || '',
            fileWatch: _staticToggleState('fileWatch'),
        };
    }
    try {
        await _applyStaticSectionChange({ action: 'set', section, name: '', data });
        const save = document.querySelector(`.sc-save[data-sc-save="${section}"]`);
        if (save) save.style.display = 'none';
    } catch(e) { showToast('Request failed', 'error'); }
}

function _buildStaticTabHTML() {
    return _tmModern() ? _buildStaticOnePage() : _buildStaticClassicHTML();
}

function _scSectionHead(key, label, icon, color, countId, addLabel) {
    const count = countId ? `<span class="d-n sc-count" id="${countId}">0</span>` : '';
    const add = addLabel
        ? `<div class="flex gap-1 p-1 rounded-lg" style="background:var(--input-bg);border:1px solid var(--border)"><button onclick="openStaticAddForm('${key}')" class="proto-btn text-xs px-3 py-1.5" title="Add ${addLabel}"><i class="ph-bold ph-plus"></i></button></div>`
        : '';
    return `<div class="sc-sec-head" id="scHead-${key}"><i class="ph-bold ${icon} sc-sec-icon" style="color:${color}"></i><span class="sc-sec-label">${label}</span>${count}<span class="sc-sec-rule"></span>${add}</div>`;
}

const SC_SECTIONS = [
    ['entrypoints', 'Entrypoints',           'ph-door-open',    'var(--blue)',   'staticEpCount',       'Entrypoint'],
    ['resolvers',   'Certificate resolvers', 'ph-certificate',  'var(--green)',  'staticResolverCount', 'Resolver'],
    ['providers',   'Providers',             'ph-cloud',        'var(--teal)',   null,                  'Provider'],
    ['api',         'API and dashboard',     'ph-gauge',        'var(--orange)', null,                  null],
    ['log',         'Logging',               'ph-scroll',       '#ca8a04',       null,                  null],
];

function _buildStaticOnePage() {
    const classic = document.createElement('div');
    classic.innerHTML = _buildStaticClassicHTML();
    return SC_SECTIONS.map(([key, label, icon, color, countId, addLabel]) => {
        const panel = classic.querySelector('#staticPanel-' + key);
        if (!panel) return '';
        panel.style.display = '';
        const warn = panel.querySelector('#staticEpWarning');
        const form = panel.querySelector('#staticForm-' + key);
        if (warn && form) form.insertBefore(warn, form.firstChild);
        return `<section class="sc-sec" data-sc-sec="${key}">`
             + _scSectionHead(key, label, icon, color, countId, addLabel)
             + panel.outerHTML + '</section>';
    }).join('');
}

function _buildStaticClassicHTML() {
    return `
    <div style="border-bottom:1px solid var(--border);flex-shrink:0;padding:12px 16px 0;display:flex;align-items:flex-end;gap:2px;">
        <button id="staticTabArrowL" onclick="_scrollStaticTabs(-1)" style="display:none;flex-shrink:0;background:none;border:none;cursor:pointer;padding:4px 3px 6px;color:var(--muted)" title="Scroll left"><i class="ph-bold ph-caret-left text-sm"></i></button>
        <div id="staticTabBar" style="display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;flex:1;" onscroll="_updateStaticTabArrows()">
            <button onclick="switchStaticSection('entrypoints')" id="ssnBtn-entrypoints" class="auth-sub-tab active">
                <i class="ph-bold ph-plugs" style="color:var(--blue)"></i>
                Entrypoints
                <span id="staticEpCount" style="display:inline-flex;align-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(36,161,222,0.15);color:var(--blue)">0</span>
            </button>
            <button onclick="switchStaticSection('resolvers')" id="ssnBtn-resolvers" class="auth-sub-tab">
                <i class="ph-bold ph-seal-check" style="color:var(--green)"></i>
                Cert Resolvers
                <span id="staticResolverCount" style="display:inline-flex;align-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(34,197,94,0.15);color:var(--green)">0</span>
            </button>
            <button onclick="switchStaticSection('plugins')" id="ssnBtn-plugins" class="auth-sub-tab">
                <i class="ph-bold ph-puzzle-piece" style="color:var(--purple)"></i>
                Plugins
                <span id="staticPluginCount" style="display:inline-flex;align-items:center;min-width:16px;height:16px;padding:0 4px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(168,85,247,0.15);color:var(--purple)">0</span>
            </button>
            <button onclick="switchStaticSection('api')" id="ssnBtn-api" class="auth-sub-tab">
                <i class="ph-bold ph-gauge" style="color:var(--orange)"></i>
                API
            </button>
            <button onclick="switchStaticSection('log')" id="ssnBtn-log" class="auth-sub-tab">
                <i class="ph-bold ph-scroll" style="color:#ca8a04"></i>
                Logging
            </button>
            <button onclick="switchStaticSection('providers')" id="ssnBtn-providers" class="auth-sub-tab">
                <i class="ph-bold ph-cloud" style="color:var(--teal)"></i>
                Providers
            </button>
        </div>
        <button id="staticTabArrowR" onclick="_scrollStaticTabs(1)" style="display:none;flex-shrink:0;background:none;border:none;cursor:pointer;padding:4px 3px 6px;color:var(--muted)" title="Scroll right"><i class="ph-bold ph-caret-right text-sm"></i></button>
    </div>

    <div id="staticPanel-entrypoints">
        <div id="staticEpWarning"></div>
        <div id="staticEpList"></div>
        <div id="staticForm-entrypoints" style="display:none;border-top:1px solid var(--border);background:var(--input-bg)" class="px-5 py-4 space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)" id="sfEpFormTitle">New Entrypoint</p>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Name</label>
                    <input id="sfEpName" type="text" class="input-field text-sm" placeholder="websecure">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Address</label>
                    <input id="sfEpAddr" type="text" class="input-field text-sm" placeholder=":443">
                </div>
            </div>
            <div>
                <label class="text-xs block mb-1" style="color:var(--muted)">HTTP → HTTPS redirect <span style="color:var(--muted);font-weight:400">(optional)</span></label>
                <input id="sfEpRedirect" type="text" class="input-field text-sm" placeholder="Name of the HTTPS entrypoint to redirect to, e.g. websecure">
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="sfEpHttp3" class="rounded" style="accent-color:var(--blue)">
                <span class="text-xs" style="color:var(--text)">Enable HTTP/3 (QUIC)</span>
                <span class="text-xs" style="color:var(--muted)">- adds <code class="font-mono">http3: {}</code> to this entrypoint</span>
            </div>
            <div id="sfEpUnderscoreRow" style="display:none">
                <label class="text-xs block mb-1" style="color:var(--muted)">Underscore Headers <span style="color:var(--muted);font-weight:400">(security)</span></label>
                <select id="sfEpUnderscore" class="input-field text-sm">
                    <option value="">Keep (default)</option>
                    <option value="delete">Delete - strip underscore headers</option>
                    <option value="reject">Reject - 400 on underscore headers</option>
                </select>
                <p class="text-xs mt-1" style="color:var(--muted)">Stops underscore header aliases (e.g. <code class="font-mono">X_Auth_User</code>) from bypassing forwardAuth. <code class="font-mono">Delete</code> recommended. <a href="https://traefik-manager.xyzlab.dev/hardening.html" target="_blank" style="color:var(--blue)">Learn more</a></p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Trusted IPs - forwarded headers <span style="font-weight:400">(optional)</span></label>
                    <textarea id="sfEpTrustedIps" class="input-field text-sm font-mono" rows="3" placeholder="173.245.48.0/20&#10;10.0.0.0/8" style="resize:vertical"></textarea>
                    <p class="text-xs mt-1" style="color:var(--muted)">IPs/CIDRs allowed to set <code class="font-mono">X-Forwarded-*</code>, one per line. The <i class="ph-bold ph-shield-check"></i> helper above can bulk-add Cloudflare ranges.</p>
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Trusted IPs - PROXY protocol <span style="font-weight:400">(optional)</span></label>
                    <textarea id="sfEpProxyIps" class="input-field text-sm font-mono" rows="3" placeholder="192.168.1.10/32" style="resize:vertical"></textarea>
                    <p class="text-xs mt-1" style="color:var(--muted)">Enables PROXY protocol from these load balancers, one per line.</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="sfEpFwdInsecure" class="rounded" style="accent-color:var(--red)">
                <span class="text-xs" style="color:var(--text)">Trust forwarded headers from everyone</span>
                <span class="text-xs" style="color:var(--red)">- insecure, lets any client forge its IP</span>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="sfEpProxyInsecure" class="rounded" style="accent-color:var(--red)">
                <span class="text-xs" style="color:var(--text)">Accept PROXY protocol from everyone</span>
                <span class="text-xs" style="color:var(--red)">- insecure, testing only</span>
            </div>
            <div>
                <label class="text-xs block mb-1" style="color:var(--muted)">Middleware chain <span style="font-weight:400">(optional)</span></label>
                <input id="sfEpMiddlewares" type="text" class="input-field text-sm font-mono" placeholder="secure-headers@file, rate-limit@file">
                <p class="text-xs mt-1" style="color:var(--muted)">Prepended to every router on this entrypoint, comma separated, provider suffix included.</p>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="sfEpTlsEnabled" class="rounded" style="accent-color:var(--blue)" onchange="document.getElementById('sfEpTlsRow').style.display = this.checked ? '' : 'none'">
                <span class="text-xs" style="color:var(--text)">TLS on every router</span>
                <span class="text-xs" style="color:var(--muted)">- adds <code class="font-mono">http.tls</code> so routers here get TLS by default</span>
            </div>
            <div id="sfEpTlsRow" class="grid grid-cols-1 sm:grid-cols-2 gap-3" style="display:none">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Default cert resolver <span style="font-weight:400">(optional)</span></label>
                    <input id="sfEpTlsResolver" type="text" class="input-field text-sm" placeholder="cloudflare">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Default TLS options <span style="font-weight:400">(optional)</span></label>
                    <input id="sfEpTlsOptions" type="text" class="input-field text-sm" placeholder="modern@file">
                </div>
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="sfEpAsDefault" class="rounded" style="accent-color:var(--blue)">
                <span class="text-xs" style="color:var(--text)">Default entrypoint</span>
                <span class="text-xs" style="color:var(--muted)">- used by routers that list no entrypoints</span>
            </div>
            <div>
                <label class="text-xs block mb-1" style="color:var(--muted)">Responding timeouts <span style="font-weight:400">(optional, e.g. 60s, 1m30s, 0 = unlimited)</span></label>
                <div class="grid grid-cols-3 gap-3">
                    <input id="sfEpReadTimeout" type="text" class="input-field text-sm" placeholder="read (60s)">
                    <input id="sfEpWriteTimeout" type="text" class="input-field text-sm" placeholder="write (0)">
                    <input id="sfEpIdleTimeout" type="text" class="input-field text-sm" placeholder="idle (180s)">
                </div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
                <button onclick="closeStaticForm('entrypoints')" class="btn-secondary text-xs">Cancel</button>
                <button onclick="submitStaticSection('entrypoints')" class="btn-primary text-xs" id="sfEpBtn">Add Entrypoint</button>
            </div>
        </div>
    </div>

    <div id="staticPanel-resolvers" style="display:none">
        <div id="staticResolverList"></div>
        <div id="staticForm-resolvers" style="display:none;border-top:1px solid var(--border);background:var(--input-bg)" class="px-5 py-4 space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)" id="sfResFormTitle">New Resolver</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Name</label>
                    <input id="sfResName" type="text" class="input-field text-sm" placeholder="cloudflare">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Email</label>
                    <input id="sfResEmail" type="email" class="input-field text-sm" placeholder="you@example.com">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Storage path</label>
                    <input id="sfResStorage" type="text" class="input-field text-sm" placeholder="/acme.json" value="/acme.json">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Challenge type</label>
                    <select id="sfResChallenge" class="input-field text-sm" onchange="onStaticChallengeChange()">
                        <option value="dnsChallenge">DNS Challenge</option>
                        <option value="httpChallenge">HTTP Challenge</option>
                        <option value="tlsChallenge">TLS Challenge</option>
                    </select>
                </div>
                <div id="sfResDnsRow">
                    <label class="text-xs block mb-1" style="color:var(--muted)">DNS Provider</label>
                    <input id="sfResProvider" type="text" class="input-field text-sm" placeholder="cloudflare">
                </div>
                <div id="sfResHttpRow" style="display:none">
                    <label class="text-xs block mb-1" style="color:var(--muted)">HTTP Entrypoint</label>
                    <input id="sfResHttpEp" type="text" class="input-field text-sm" placeholder="web" value="web">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">CA server <span style="font-weight:400">(optional)</span></label>
                    <input id="sfResCaServer" type="text" class="input-field text-sm" placeholder="default: Let's Encrypt production">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Key type <span style="font-weight:400">(optional)</span></label>
                    <select id="sfResKeyType" class="input-field text-sm">
                        <option value="">Default (RSA4096)</option>
                        <option value="EC256">EC256</option>
                        <option value="EC384">EC384</option>
                        <option value="RSA2048">RSA2048</option>
                        <option value="RSA3072">RSA3072</option>
                        <option value="RSA4096">RSA4096</option>
                        <option value="RSA8192">RSA8192</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">EAB key ID <span style="font-weight:400">(optional)</span></label>
                    <input id="sfResEabKid" type="text" class="input-field text-sm" placeholder="for CAs requiring external account binding">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">EAB HMAC <span style="font-weight:400">(optional)</span></label>
                    <input id="sfResEabHmac" type="text" class="input-field text-sm" placeholder="base64-encoded HMAC key">
                </div>
            </div>
            <div id="sfResDnsAdvanced" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">DNS check resolvers <span style="font-weight:400">(optional)</span></label>
                    <textarea id="sfResDnsResolvers" class="input-field text-sm font-mono" rows="2" placeholder="1.1.1.1:53&#10;8.8.8.8:53" style="resize:vertical"></textarea>
                    <p class="text-xs mt-1" style="color:var(--muted)">Used to verify the DNS record before requesting the certificate, one per line.</p>
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Propagation delay <span style="font-weight:400">(optional)</span></label>
                    <input id="sfResDnsDelay" type="text" class="input-field text-sm" placeholder="e.g. 30s">
                    <div class="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="sfResDnsNoCheck" class="rounded" style="accent-color:var(--blue)">
                        <span class="text-xs" style="color:var(--text)">Disable propagation checks</span>
                    </div>
                </div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
                <button onclick="closeStaticForm('resolvers')" class="btn-secondary text-xs">Cancel</button>
                <button onclick="submitStaticSection('resolvers')" class="btn-primary text-xs" id="sfResBtn">Add Resolver</button>
            </div>
        </div>
    </div>

    <div id="staticPanel-plugins" style="display:none">
        <div class="mx-5 mt-4 mb-2 rounded-lg p-3 text-xs flex items-center gap-2" style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);color:var(--text)">
            <i class="ph-bold ph-info text-sm shrink-0" style="color:var(--blue)"></i>
            <span>Use the <button onclick="closeSettingsModal();switchTab('plugins')" class="font-semibold" style="color:var(--blue);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline">Plugins tab</button> for an interactive way to install and manage plugins.</span>
        </div>
        <div id="staticPluginList"></div>
        <div id="staticForm-plugins" style="display:none;border-top:1px solid var(--border);background:var(--input-bg)" class="px-5 py-4 space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)" id="sfPluginFormTitle">New Plugin</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Name</label>
                    <input id="sfPluginName" type="text" class="input-field text-sm" placeholder="my-plugin">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Module</label>
                    <input id="sfPluginModule" type="text" class="input-field text-sm" placeholder="github.com/user/plugin">
                </div>
                <div>
                    <label class="text-xs block mb-1" style="color:var(--muted)">Version</label>
                    <input id="sfPluginVersion" type="text" class="input-field text-sm" placeholder="v1.0.0">
                </div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
                <button onclick="closeStaticForm('plugins')" class="btn-secondary text-xs">Cancel</button>
                <button onclick="submitStaticSection('plugins')" class="btn-primary text-xs" id="sfPluginBtn">Add Plugin</button>
            </div>
        </div>
    </div>

    <div id="staticPanel-api" style="display:none">
        <div class="px-4 py-4 space-y-1.5">
            <div id="staticApiWarn" class="mb-3 rounded-lg px-3 py-2.5 flex items-start gap-2.5 text-xs" style="display:none;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);color:#ca8a04">
                <i class="ph-bold ph-warning text-sm shrink-0 mt-0.5"></i>
                <span>Traefik Manager reads your routes, services and middlewares from the Traefik API. With it disabled those tabs will be empty until you turn it back on and restart Traefik.</span>
            </div>
            <div class="tab-toggle-row" onclick="onApiEnabledToggle()">
                <span class="flex items-center gap-2 text-sm"><i class="ph-bold ph-terminal-window" style="color:var(--muted)"></i> API Enabled</span>
                <div class="toggle-switch" id="staticT-apiEnabled"><div class="toggle-knob"></div></div>
            </div>
            <div class="tab-toggle-row" onclick="staticToggle('dashboardEnabled')">
                <span class="flex items-center gap-2 text-sm"><i class="ph-bold ph-layout" style="color:var(--muted)"></i> Dashboard</span>
                <div class="toggle-switch" id="staticT-dashboardEnabled"><div class="toggle-knob"></div></div>
            </div>
            <div class="tab-toggle-row" onclick="staticToggle('insecure')">
                <span class="flex items-center gap-2 text-sm">
                    <i class="ph-bold ph-lock-open" style="color:var(--red)"></i>
                    <span>Insecure Mode</span>
                    <span class="text-xs" style="color:var(--muted)">(exposes API without auth)</span>
                </span>
                <div class="toggle-switch" id="staticT-insecure"><div class="toggle-knob"></div></div>
            </div>
            <div class="tab-toggle-row" onclick="staticToggle('debugMode')">
                <span class="flex items-center gap-2 text-sm"><i class="ph-bold ph-bug" style="color:var(--muted)"></i> Debug Mode</span>
                <div class="toggle-switch" id="staticT-debugMode"><div class="toggle-knob"></div></div>
            </div>
            <div class="flex justify-end pt-2 sc-save" data-sc-save="api" style="display:none">
                <button onclick="saveStaticSingleSection('api')" class="btn-primary text-xs">Save Changes</button>
            </div>
        </div>
    </div>

    <div id="staticPanel-log" style="display:none">
        <div class="px-4 py-4 space-y-3">
            <div>
                <label class="text-xs block mb-1" style="color:var(--muted)">Log Level</label>
                <select id="sfLogLevel" class="input-field text-sm">
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR" selected>ERROR</option>
                </select>
            </div>
            <div class="tab-toggle-row" onclick="onAccessLogToggle()">
                <span class="flex items-center gap-2 text-sm"><i class="ph-bold ph-file-text" style="color:var(--muted)"></i> Access Log</span>
                <div class="toggle-switch" id="staticT-accessLog"><div class="toggle-knob"></div></div>
            </div>
            <div id="accessLogPathRow" style="display:none">
                <label class="text-xs block mb-1" style="color:var(--muted)">Log File Path <span style="font-weight:400">(leave empty for stdout)</span></label>
                <input id="sfAccessLogPath" type="text" class="input-field text-sm" placeholder="/var/log/traefik/access.log">
            </div>
            <div class="flex justify-end pt-1 sc-save" data-sc-save="log" style="display:none">
                <button onclick="saveStaticSingleSection('log')" class="btn-primary text-xs">Save Changes</button>
            </div>
        </div>
    </div>

    <div id="staticPanel-providers" style="display:none">
        <div id="staticOtherProvidersList" class="pt-3"></div>
        <div class="px-4 pb-4 space-y-3">
            <div class="rounded-lg p-3" style="border:1px solid var(--border)">
                <div class="tab-toggle-row" onclick="onDockerProviderToggle()">
                    <span class="flex items-center gap-2 text-sm font-medium"><i class="ph-bold ph-cube" style="color:var(--blue)"></i> Docker</span>
                    <div class="toggle-switch" id="staticT-dockerEnabled"><div class="toggle-knob"></div></div>
                </div>
                <div id="dockerProviderFields" class="mt-3 space-y-2" style="display:none">
                    <div>
                        <label class="text-xs block mb-1" style="color:var(--muted)">Endpoint</label>
                        <input id="sfDockerEndpoint" type="text" class="input-field text-sm" placeholder="unix:///var/run/docker.sock">
                    </div>
                    <div class="tab-toggle-row" onclick="staticToggle('dockerExposedByDefault')">
                        <span class="text-sm" style="color:var(--muted)">Expose by default</span>
                        <div class="toggle-switch" id="staticT-dockerExposedByDefault"><div class="toggle-knob"></div></div>
                    </div>
                    <div class="tab-toggle-row" onclick="staticToggle('dockerWatch')">
                        <span class="text-sm" style="color:var(--muted)">Watch</span>
                        <div class="toggle-switch" id="staticT-dockerWatch"><div class="toggle-knob"></div></div>
                    </div>
                </div>
            </div>
            <div class="rounded-lg p-3" style="border:1px solid var(--border)">
                <div class="tab-toggle-row" onclick="onFileProviderToggle()">
                    <span class="flex items-center gap-2 text-sm font-medium"><i class="ph-bold ph-file-code" style="color:var(--green)"></i> File</span>
                    <div class="toggle-switch" id="staticT-fileEnabled"><div class="toggle-knob"></div></div>
                </div>
                <div id="fileProviderFields" class="mt-3 space-y-2" style="display:none">
                    <div>
                        <label class="text-xs block mb-1" style="color:var(--muted)">Directory</label>
                        <input id="sfFileDirectory" type="text" class="input-field text-sm" placeholder="/etc/traefik/dynamic">
                    </div>
                    <div class="tab-toggle-row" onclick="staticToggle('fileWatch')">
                        <span class="text-sm" style="color:var(--muted)">Watch</span>
                        <div class="toggle-switch" id="staticT-fileWatch"><div class="toggle-knob"></div></div>
                    </div>
                </div>
            </div>
            <div class="flex justify-end pt-1 sc-save" data-sc-save="providers" style="display:none">
                <button onclick="saveStaticSingleSection('providers')" class="btn-primary text-xs">Save Changes</button>
            </div>
        </div>
        <div id="staticForm-providers" style="display:none;border-top:1px solid var(--border);background:var(--input-bg)" class="px-5 py-4 space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)" id="sfProviderFormTitle">Add Provider</p>
            <div>
                <label class="text-xs block mb-1" style="color:var(--muted)">Provider Type</label>
                <select id="sfProviderType" class="input-field text-sm" onchange="onProviderTypeSelect(this.value)">
                    <option value="">Select provider...</option>
                    <option value="swarm">Docker Swarm</option>
                    <option value="http">HTTP</option>
                    <option value="kubernetes">Kubernetes (CRD)</option>
                    <option value="kubernetesIngress">Kubernetes Ingress</option>
                    <option value="kubernetesGateway">Kubernetes Gateway</option>
                    <option value="nomad">HashiCorp Nomad</option>
                    <option value="ecs">AWS ECS</option>
                    <option value="consulCatalog">Consul Catalog</option>
                    <option value="consul">Consul KV</option>
                    <option value="redis">Redis KV</option>
                    <option value="etcd">etcd KV</option>
                    <option value="zooKeeper">ZooKeeper KV</option>
                </select>
            </div>
            <div id="sfProviderEditorWrap" style="display:none">
                <label class="text-xs block mb-1" style="color:var(--muted)">Configuration</label>
                <div id="sfProviderEditorContainer" style="height:220px;border:1px solid var(--border);border-radius:8px;overflow:hidden;"></div>
            </div>
            <div class="flex gap-2 justify-end pt-1">
                <button onclick="closeStaticForm('providers')" class="btn-secondary text-xs">Cancel</button>
                <button onclick="submitStaticProvider()" class="btn-primary text-xs" id="sfProviderBtn">Add Provider</button>
            </div>
        </div>
    </div>`;
}

function _renderEpRuntimeWarning() {
    const el = document.getElementById('staticEpWarning');
    if (!el) return;
    const rt = _traefikRuntime;
    if (!rt) return;
    const toggler = `onclick="const b=this.parentElement.querySelector('.ep-warn-body');b.classList.toggle('hidden');this.querySelector('i.caret').classList.toggle('ph-caret-down');this.querySelector('i.caret').classList.toggle('ph-caret-right')"`;
    let title = '', body = '';
    if (rt.runtime === 'docker') {
        title = 'New entrypoints also need a port mapping in your compose file';
        body  = `After adding an entrypoint here, open your <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">docker-compose.yml</code> and add the port under <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">ports:</code>, then run:
                 <code class="font-mono block mt-1.5 mb-1 px-2 py-1 rounded" style="background:var(--input-bg);border:1px solid var(--border)">docker compose up -d</code>
                 Without this the port will not be reachable outside the container even after restarting Traefik.`;
    } else if (rt.runtime === 'native') {
        title = 'New entrypoints need the port open on your system';
        body  = `After adding an entrypoint and restarting Traefik, ensure the port is accessible:
                 <code class="font-mono block mt-1.5 mb-1 px-2 py-1 rounded" style="background:var(--input-bg);border:1px solid var(--border)">sudo ufw allow PORT/tcp</code>
                 For ports below 1024, Traefik needs <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">NET_BIND_SERVICE</code> capability or must run as root.`;
    } else {
        title = 'New entrypoints require additional steps after saving';
        body  = `<span class="font-medium" style="color:var(--text)">Docker / Podman / Unraid:</span> add the port under <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">ports:</code> in your compose file and run <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">docker compose up -d</code>
                 <span class="block mt-1"><span class="font-medium" style="color:var(--text)">Native Linux:</span> open the port in your firewall, e.g. <code class="font-mono" style="background:var(--input-bg);padding:1px 4px;border-radius:3px">sudo ufw allow PORT/tcp</code></span>`;
    }
    el.innerHTML = `<div class="mx-4 mt-3 mb-1 rounded-lg" style="background:rgba(59,130,246,0.07);border:1px solid rgba(59,130,246,0.2)">
        <button ${toggler} class="w-full px-4 py-2.5 flex items-center gap-2 text-left" style="background:none;border:none;cursor:pointer">
            <i class="ph-bold ph-info text-sm shrink-0" style="color:var(--blue)"></i>
            <span class="text-xs font-semibold flex-1" style="color:var(--text)">${title}</span>
            <i class="ph-bold ph-caret-right caret text-xs" style="color:var(--muted)"></i>
        </button>
        <div class="ep-warn-body px-4 pb-3 text-xs hidden" style="color:var(--muted)">${body}</div>
    </div>`;
}

async function _loadStaticFromDisk() {
    const wrapper = document.getElementById('staticSettingsContent');
    if (!wrapper) return;
    try {
        const cfgUrl = _activeAgent
            ? '/api/static/config?server=' + encodeURIComponent(_activeAgent.id)
            : '/api/static/config';
        _traefikRuntime = null;
        const fetches = [fetch(cfgUrl)];
        if (_activeAgent) {
            fetches.push(agentFetch('/api/static/status').then(r => r.json()).catch(() => null));
        } else {
            fetches.push(fetch('/api/traefik/runtime').then(r => r.json()).catch(() => null));
        }
        const results = await Promise.all(fetches);
        const res = results[0];
        if (_activeAgent) {
            const st = results[1];
            if (st && ['proxy', 'socket'].includes(st.restart_method)) {
                _traefikRuntime = { method: st.restart_method, runtime: 'docker', container: st.traefik_container || '' };
            }
        } else if (results[1]) {
            _traefikRuntime = results[1];
        }
        const data = await res.json();
        if (data.error) {
            _staticLoadedFor = null;
            const bar = document.getElementById('staticStateBar');
            if (bar) bar.style.display = 'none';
            const acts = document.querySelector('#tab-static .fb-secondary');
            if (acts) acts.style.display = 'none';
            wrapper.innerHTML = (!_activeAgent && typeof _emptyMountState === 'function')
                ? _emptyMountState({
                    icon: 'ph-sliders',
                    title: 'traefik.yml not mounted',
                    description: 'Mount your Traefik <code class="font-mono" style="color:var(--blue)">traefik.yml</code> read-write to edit entrypoints, certificate resolvers, plugins and providers from here.',
                    steps: [
                        { label: 'Add this volume to the <code class="font-mono">traefik-manager</code> service in your <code class="font-mono">docker-compose.yml</code>:',
                          code: '- /path/to/traefik/traefik.yml:/app/traefik.yml' },
                    ],
                    note: 'Mount it read-write, without <code class="font-mono">:ro</code> - this tab writes to the file. A backup is taken before every save.'
                })
                : `<div class="text-center py-16" style="color:var(--muted)">
                    <i class="ph-light ph-warning-circle text-4xl block mb-3 opacity-40"></i>
                    <p>${_esc(data.error)}</p></div>`;
            return;
        }
        const acts = document.querySelector('#tab-static .fb-secondary');
        if (acts) acts.style.display = '';
        if (_staticMonaco) { _staticMonaco.dispose(); _staticMonaco = null; }
        if (_providerMonaco) { _providerMonaco.dispose(); _providerMonaco = null; }
        _staticRawContent = data.raw || '';
        _staticOriginalContent = _staticRawContent;
        _staticSectionEdits = false;
        _clearStaticPending();
        _staticPendingChanges = false;
        if (!_staticSaved) _hideStaticRestartBanner();
        const hdrAddBtn = document.getElementById('staticHdrAddBtn');
        if (hdrAddBtn) hdrAddBtn.style.display = '';
        wrapper.innerHTML = _buildStaticTabHTML();
        initStaticDirtyTracking();
        _renderStaticSections(data.parsed || {});
        _renderEpRuntimeWarning();
        if (!_tmModern()) switchStaticSection(_staticActiveSection);
        requestAnimationFrame(_updateStaticTabArrows);
    } catch(e) {
        wrapper.innerHTML = `<div class="text-center py-16" style="color:var(--muted)">
            <i class="ph-light ph-warning-circle text-4xl block mb-3 opacity-40"></i>
            <p>Failed to load static config</p></div>`;
    }
}

let _staticLoadedFor = null;

function _scMarkSectionDirty(el) {
    const sec = el.closest ? el.closest('.sc-sec, [id^="staticPanel-"]') : null;
    const key = sec ? (sec.dataset.scSec || (sec.id || '').replace('staticPanel-', '')) : null;
    if (!key) return;
    const save = document.querySelector(`.sc-save[data-sc-save="${key}"]`);
    if (save) save.style.display = '';
}

function _scResetSaves() {
    document.querySelectorAll('.sc-save').forEach(el => { el.style.display = 'none'; });
}

function initStaticDirtyTracking() {
    const root = document.getElementById('staticSettingsContent');
    if (!root || root.dataset.dirtyBound) return;
    root.dataset.dirtyBound = '1';
    const mark = e => {
        if (e.target.closest('.sc-save')) return;
        _scMarkSectionDirty(e.target);
    };
    root.addEventListener('input', mark);
    root.addEventListener('change', mark);
    root.addEventListener('click', e => {
        if (e.target.closest('.tab-toggle-row')) mark(e);
    });
}

function rerenderStaticBody() {
    const wrapper = document.getElementById('staticSettingsContent');
    if (!wrapper || _staticLoadedFor === null || _activeAgent) return;
    wrapper.innerHTML = _buildStaticTabHTML();
    initStaticDirtyTracking();
    _renderStaticSections(_staticParsedData);
    _renderEpRuntimeWarning();
    if (!_tmModern()) switchStaticSection(_staticActiveSection);
    _renderStaticStateBar();
    filterStatic();
}

function filterStatic() {
    const q = (document.getElementById('staticSearch')?.value || '').trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('#staticSettingsContent .sc-sec').forEach(sec => {
        const cards = sec.querySelectorAll('.tm-card');
        if (!cards.length) {
            sec.style.display = q ? 'none' : '';
            return;
        }
        let hits = 0;
        cards.forEach(card => {
            const match = !q || card.textContent.toLowerCase().includes(q);
            card.style.display = match ? '' : 'none';
            if (match) hits++;
        });
        sec.style.display = hits ? '' : 'none';
        shown += hits;
    });
    const empty = document.getElementById('staticNoMatch');
    if (empty) empty.style.display = (q && shown === 0) ? '' : 'none';
}

function openStaticTab() {
    const warn = document.getElementById('staticDangerWarn');
    if (warn) warn.style.display = localStorage.getItem('staticWarnHidden') === '1' ? 'none' : '';
    const server = _activeAgent ? _activeAgent.id : 'host';
    if (_staticLoadedFor !== server) {
        _staticLoadedFor = server;
        _loadStaticFromDisk();
    } else {
        _renderStaticStateBar();
        requestAnimationFrame(_updateStaticTabArrows);
    }
    const tip = document.getElementById('staticTrustedIpsWrap');
    if (tip) tip.style.display = '';
}

async function refreshStaticTab() {
    if (_staticPendingChanges) {
        if (!await _confirm('You have unsaved changes. Discard and reload?', 'Unsaved Changes', 'Discard')) return;
    }
    await _loadStaticFromDisk();
}

let _tipData = null;

function _tipBaseRaw() {
    return _staticMonaco ? _staticMonaco.getValue() : _staticRawContent;
}

function _tipInvalidatePreview() {
    if (_tipData) _tipData.preview = null;
    const pv = document.getElementById('tipPreviewBox'); if (pv) pv.innerHTML = '';
    const applyBtn = document.getElementById('tipApplyBtn'); if (applyBtn) applyBtn.disabled = true;
}

function openTrustedIpsHelper() {
    const modal = document.getElementById('trustedIpsModal');
    if (!modal) return;
    _tipData = null;
    document.getElementById('tipEntrypoint').innerHTML = '<option value="">Loading...</option>';
    document.getElementById('tipCurrent').innerHTML = '';
    document.getElementById('tipPreviewBox').innerHTML = '';
    document.getElementById('tipCustom').value = '';
    document.getElementById('tipSrcCloudflare').checked = true;
    document.getElementById('tipSrcPrivate').checked = false;
    document.getElementById('tipApplyBtn').disabled = true;
    modal.classList.add('open');
    document.getElementById('trustedIpsBackdrop').classList.add('open');
    if (!setDetailDockOpen(true)) document.body.style.overflow = 'hidden';
    _tipInspect();
}

function closeTrustedIpsModal() {
    setDetailDockOpen(false);
    document.getElementById('trustedIpsModal').classList.remove('open');
    document.getElementById('trustedIpsBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

async function _tipInspect() {
    try {
        const res = await fetch('/api/static/trusted-ips/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify({ current_raw: _tipBaseRaw() }) });
        const d = await res.json();
        if (!res.ok || d.error) { showToast(d.error || 'Failed to read static config', 'error'); closeTrustedIpsModal(); return; }
        _tipData = d;
        const sel = document.getElementById('tipEntrypoint');
        if (!d.entrypoints.length) {
            sel.innerHTML = '<option value="">No entrypoints found</option>';
        } else {
            sel.innerHTML = d.entrypoints.map(e => `<option value="${_esc(e.name)}">${_esc(e.name)}${e.address ? ' (' + _esc(e.address) + ')' : ''}</option>`).join('');
        }
        const cf = document.getElementById('tipCfLabel');
        if (cf) cf.textContent = `Cloudflare edge ranges (${(d.cloudflare_ranges || []).length}, captured ${d.cloudflare_captured})`;
        _tipRenderCurrent();
    } catch (e) { showToast('Failed to read static config', 'error'); closeTrustedIpsModal(); }
}

function _tipRenderCurrent() {
    if (_tipData) _tipData.preview = null;
    const applyBtn = document.getElementById('tipApplyBtn');
    if (applyBtn) applyBtn.disabled = true;
    const pv = document.getElementById('tipPreviewBox');
    if (pv) pv.innerHTML = '';
    const sel = document.getElementById('tipEntrypoint');
    const name = sel ? sel.value : '';
    const ep = (_tipData && _tipData.entrypoints || []).find(e => e.name === name);
    const box = document.getElementById('tipCurrent');
    if (!box) return;
    const cur = (ep && ep.trusted_ips) || [];
    if (!cur.length) {
        box.innerHTML = `<span class="text-xs" style="color:var(--muted)">No <code class="font-mono">trustedIPs</code> on this entrypoint yet.</span>`;
    } else {
        box.innerHTML = `<div class="text-xs mb-1" style="color:var(--muted)">Current <code class="font-mono">trustedIPs</code> (${cur.length}):</div><div class="flex flex-wrap gap-1">` + cur.map(c => `<span class="text-xs font-mono px-1.5 py-0.5 rounded" style="background:var(--input-bg);color:var(--text)">${_esc(c)}</span>`).join('') + `</div>`;
    }
}

async function tipPreview() {
    const sel = document.getElementById('tipEntrypoint');
    const entrypoint = sel ? sel.value : '';
    if (!entrypoint) { showToast('Pick an entrypoint', 'error'); return; }
    const cloudflare = document.getElementById('tipSrcCloudflare').checked;
    const priv = document.getElementById('tipSrcPrivate').checked;
    const custom = document.getElementById('tipCustom').value;
    if (!cloudflare && !priv && !custom.trim()) { showToast('Select at least one source', 'error'); return; }
    try {
        const res = await fetch('/api/static/trusted-ips/preview', { method: 'POST', headers: { 'Content-Type': 'application/json', ..._csrfHeaders() }, body: JSON.stringify({ current_raw: _tipBaseRaw(), entrypoint, cloudflare, private: priv, custom_cidrs: custom }) });
        const d = await res.json();
        if (!res.ok || d.error) { showToast(d.error || 'Preview failed', 'error'); return; }
        if (_tipData) _tipData.preview = d;
        _tipRenderPreview(d);
    } catch (e) { showToast('Preview failed', 'error'); }
}

function _tipRenderPreview(d) {
    const box = document.getElementById('tipPreviewBox');
    if (!box) return;
    const added = d.added || [], invalid = d.invalid || [], existing = d.existing || [];
    let html = '';
    if (!added.length && !invalid.length) {
        html += `<div class="text-xs px-3 py-2 rounded" style="background:rgba(234,179,8,0.1);color:#ca8a04">Nothing new to add - every selected range is already trusted on <span class="font-mono">${_esc(d.entrypoint)}</span>.</div>`;
    }
    if (added.length) {
        html += `<div class="text-xs mb-1" style="color:var(--green)"><i class="ph-bold ph-plus-circle"></i> Adding ${added.length} range${added.length > 1 ? 's' : ''}:</div><div class="flex flex-wrap gap-1 mb-2">` + added.map(c => `<span class="text-xs font-mono px-1.5 py-0.5 rounded" style="background:rgba(63,185,80,0.12);color:var(--green)">${_esc(c)}</span>`).join('') + `</div>`;
    }
    if (invalid.length) {
        html += `<div class="text-xs mb-1" style="color:var(--red)"><i class="ph-bold ph-warning"></i> Skipped ${invalid.length} invalid entr${invalid.length > 1 ? 'ies' : 'y'}:</div><div class="flex flex-wrap gap-1 mb-2">` + invalid.map(c => `<span class="text-xs font-mono px-1.5 py-0.5 rounded" style="background:rgba(239,68,68,0.12);color:var(--red)">${_esc(c)}</span>`).join('') + `</div>`;
    }
    html += `<div class="text-xs" style="color:var(--muted)">Result: <span style="color:var(--text);font-weight:600">${d.final.length}</span> trusted range${d.final.length !== 1 ? 's' : ''} on <span class="font-mono">${_esc(d.entrypoint)}</span> (was ${existing.length}).</div>`;
    box.innerHTML = html;
    document.getElementById('tipApplyBtn').disabled = !added.length;
}

async function tipApply() {
    const d = _tipData && _tipData.preview;
    if (!d || !d.raw) return;
    _staticRawContent = d.raw;
    if (_staticMonaco) _staticMonaco.setValue(d.raw);
    closeTrustedIpsModal();
    await saveStaticConfig();
}

const _origSetTheme = setTheme;
setTheme = function(theme) {
    _origSetTheme(theme);
    if (_staticMonaco || _mwMonacoEditor || _pluginStaticMonaco || _pluginMwMonaco || _providerMonaco) {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        _ensureMonacoThemes().then(() => monaco.editor.setTheme(_monacoThemeName(isDark)));
    }
};
