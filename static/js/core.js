function showToast(msg, type='success') {
    const icon = type === 'success' ? 'ph-check-circle' : 'ph-warning-circle';
    const color = type === 'success' ? 'text-green-400' : 'text-red-400';
    const el = document.createElement('div');
    el.className = `toast-item ${type}`;
    el.innerHTML = `<i class="ph-fill ${icon} ${color} text-lg"></i><span>${_esc(msg)}</span>`;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(() => { el.style.animation='slideOut 0.3s ease forwards'; setTimeout(()=>el.remove(),300); }, 4000);
}

const OPTIONAL_TABS = ['dashboard', 'routemap', 'docker', 'kubernetes', 'swarm', 'nomad', 'ecs', 'consulcatalog', 'redis', 'etcd', 'consul', 'zookeeper', 'http_provider', 'file_external', 'certs', 'tls', 'crowdsec', 'plugins', 'logs'];

let _visibleTabsCache = {};
let _localTabsCache   = {};

function applyTabVisibility(map) {
    if (map) _visibleTabsCache = map;
    OPTIONAL_TABS.forEach(tab => {
        const btn = document.getElementById('btn-' + tab);
        if (!btn) return;
        btn.style.display = _visibleTabsCache[tab] ? 'block' : 'none';
    });
    
    const activeBtn = document.querySelector('.tab-btn.active');
    if (activeBtn && activeBtn.style.display === 'none') {
        switchTab('services');
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    document.getElementById('btn-' + tab).classList.add('active');
    if (tab === 'dashboard')     refreshDashboardTab();
    if (tab === 'routemap')      refreshRoutemapTab();
    if (tab === 'services' || tab === 'middlewares') refreshRoutes();
    if (tab === 'live')          refreshLiveView();
    if (tab === 'docker')        refreshDockerTab();
    if (tab === 'kubernetes')    refreshKubernetesTab();
    if (tab === 'swarm')         refreshSwarmTab();
    if (tab === 'nomad')         refreshNomadTab();
    if (tab === 'ecs')           refreshEcsTab();
    if (tab === 'consulcatalog') refreshConsulCatalogTab();
    if (tab === 'redis')         refreshRedisTab();
    if (tab === 'etcd')          refreshEtcdTab();
    if (tab === 'consul')        refreshConsulTab();
    if (tab === 'zookeeper')     refreshZookeeperTab();
    if (tab === 'http_provider') refreshHttpProviderTab();
    if (tab === 'file_external') refreshFileExternalTab();
    if (tab === 'certs')         refreshCertsTab();
    if (tab === 'tls')           refreshTlsOptionsTab();
    if (tab === 'crowdsec')      refreshCrowdSecTab();
    if (tab === 'plugins')       refreshPluginsTab();
    if (tab === 'logs')          refreshLogs();
    _initMobileFilterBars();
}

function _buildConfigSelectOptions(sel, files, allowNew) {
    sel.innerHTML = '<option value="">Select a file...</option>';
    if (allowNew) {
        const o = document.createElement('option'); o.value = '__new__'; o.textContent = '+ New file...'; sel.appendChild(o);
    }
    files.forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; sel.appendChild(o); });
}

async function _populateConfigFileSelect(which) {
    const isRoute = which === 'route';
    const wrapId     = isRoute ? 'configFileSelectWrap' : 'mwConfigFileSelectWrap';
    const selId      = isRoute ? 'configFileSelect' : 'mwConfigFileSelect';
    const newInputId = isRoute ? 'newRouteFileName' : 'newMwFileName';
    const hidId      = isRoute ? 'configFile' : 'mwConfigFile';
    const wrap    = document.getElementById(wrapId);
    const sel     = document.getElementById(selId);
    const newInput = document.getElementById(newInputId);
    const hidEl   = document.getElementById(hidId);
    if (!sel) return;
    if (newInput) { newInput.style.display = 'none'; newInput.value = ''; }
    const onChange = isRoute ? onRouteConfigFileChange : onMwConfigFileChange;
    if (_activeAgent) {
        if (wrap) wrap.style.display = '';
        try {
            const r = await agentFetch('/api/configs');
            const data = await r.json();
            const files = (data.files || []).map(f => f.name).sort();
            _buildConfigSelectOptions(sel, files, true);
            sel.value = files.length === 1 ? files[0] : '';
            onChange(sel);
        } catch(e) { console.error('Failed to load agent configs', e); }
    } else {
        const show = MULTI_CONFIG || CONFIG_DIR_SET;
        if (wrap) wrap.style.display = show ? '' : 'none';
        _buildConfigSelectOptions(sel, CONFIG_PATHS_LIST.map(cp => cp.label), CONFIG_DIR_SET);
        const firstFile = [...sel.options].find(o => o.value && o.value !== '__new__');
        sel.value = firstFile ? firstFile.value : '';
        onChange(sel);
    }
}

function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

let _backdropMd = null;
function _onBackdropClick(e, fn) {
    if (e.target === e.currentTarget && _backdropMd === e.currentTarget) fn();
}

let _currentVersion = null;

function toggleLiveDd(id) {
    const menu = document.getElementById(id + '-menu');
    const btn  = document.getElementById(id + '-btn');
    const isOpen = menu.classList.contains('open');
    document.querySelectorAll('.live-dd-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.live-dd-btn-inner.open').forEach(b => b.classList.remove('open'));
    if (!isOpen) { menu.classList.add('open'); btn.classList.add('open'); }
}

let _shortcutsPanelOpen = false;

function toggleShortcutsPanel() {
    const panel = document.getElementById('shortcutsPanel');
    const btn   = document.getElementById('shortcutsBellBtn');
    if (!panel) return;
    _shortcutsPanelOpen = !_shortcutsPanelOpen;
    panel.classList.toggle('open', _shortcutsPanelOpen);
    if (btn) btn.style.color = _shortcutsPanelOpen ? 'var(--blue)' : '';
    if (_shortcutsPanelOpen) {
        const r = btn.getBoundingClientRect();
        const panelW = Math.min(320, window.innerWidth - 16);
        let left = r.right - panelW;
        if (left < 8) left = 8;
        panel.style.position = 'fixed';
        panel.style.top  = (r.bottom + 8) + 'px';
        panel.style.left = left + 'px';
        panel.style.width = panelW + 'px';
    }
}

function _isTyping() {
    const t = document.activeElement?.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || document.activeElement?.isContentEditable;
}

function _closeTopModal() {
    const modals = [
        ['tlsOptionsModal', closeTlsOptionModal],
        ['appModal', closeModal],
        ['mwModal', closeMwModal],
        ['settingsModal', closeSettingsModal],
        ['ipDiagModal', closeIpDiagModal],
        ['rmEditModal', window.rmCloseEditModal],
        ['rmGroupsModal', window.rmCloseGroupsModal],
    ];
    for (const [id, close] of modals) {
        const el = document.getElementById(id);
        if (el && getComputedStyle(el).display !== 'none' && typeof close === 'function') {
            close();
            return true;
        }
    }
    return false;
}

const THEMES = ['dark', 'light', 'system'];

function applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-tm-pref', theme);
    
    ['dark','light','system'].forEach(t => {
        document.getElementById('theme-'+t+'-m')?.classList.toggle('active', t === theme);
    });
}

const TM_PREF_DEFAULTS = {
    showStatCards: true, compactStatCards: false, showEntrypoints: true,
    showDocsLink: true, showApiLink: false, showShortcutsBtn: true,
    showIpDiagBtn: true, showTraefikBadge: true, showTmBadge: true,
    showRouteIcons: false,
    routeViewMode: 'grid', mwViewMode: 'grid', svcViewMode: 'grid',
};

let _prefSaveTimer = null;
let _prefPending = {};

function tmPref(key) {
    const server = window.TM_UI_PREFS || {};
    if (Object.prototype.hasOwnProperty.call(server, key)) return server[key];
    const local = localStorage.getItem(key);
    if (local !== null) {
        const dflt = TM_PREF_DEFAULTS[key];
        return typeof dflt === 'boolean' ? local !== 'false' : local;
    }
    return TM_PREF_DEFAULTS[key];
}

function tmSetPref(key, value) {
    window.TM_UI_PREFS = window.TM_UI_PREFS || {};
    window.TM_UI_PREFS[key] = value;
    localStorage.setItem(key, String(value));
    _prefPending[key] = value;
    clearTimeout(_prefSaveTimer);
    _prefSaveTimer = setTimeout(_tmFlushPrefs, 400);
}

function _tmFlushPrefs() {
    const payload = _prefPending;
    _prefPending = {};
    if (!Object.keys(payload).length) return;
    fetch('/api/settings/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ ui_prefs: payload })
    }).catch(() => {});
}

function _tmAdoptLocalPrefs() {
    const server = window.TM_UI_PREFS || {};
    if (Object.keys(server).length) return;
    const adopted = {};
    Object.keys(TM_PREF_DEFAULTS).forEach(k => {
        const v = localStorage.getItem(k);
        if (v === null) return;
        const dflt = TM_PREF_DEFAULTS[k];
        adopted[k] = typeof dflt === 'boolean' ? v !== 'false' : v;
    });
    if (!Object.keys(adopted).length) return;
    window.TM_UI_PREFS = adopted;
    fetch('/api/settings/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ ui_prefs: adopted })
    }).catch(() => {});
}

function _tmSyncViewIcons() {
    [['svcViewIcon', 'svcViewMode'], ['mwViewIcon', 'mwViewMode'], ['routeViewIcon', 'routeViewMode']]
        .forEach(([iconId, key]) => {
            const icon = document.getElementById(iconId);
            if (icon) icon.className = tmPref(key) === 'grid' ? 'ph-bold ph-list' : 'ph-bold ph-squares-four';
        });
}

function setTheme(theme) {
    localStorage.setItem('tm-theme', theme);
    applyTheme(theme);
    window.TM_DEFAULT_THEME = theme;
    const sel = document.getElementById('defaultThemeSelect');
    if (sel) sel.value = theme;
    fetch('/api/settings/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ default_theme: theme })
    }).catch(() => {});
}

function cycleTheme() {
    const cur = localStorage.getItem('tm-theme') || window.TM_DEFAULT_THEME || 'dark';
    const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    setTheme(next);
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    const icon = document.getElementById('hamburgerIcon');
    menu.style.display = '';
    const isOpen = menu.classList.toggle('open');
    icon.className = isOpen ? 'ph-bold ph-x text-xl' : 'ph-bold ph-list text-xl';
}
function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.remove('open');
    document.getElementById('hamburgerIcon').className = 'ph-bold ph-list text-xl';
}
const _autofillAllowed = new Set(['pwCurrent', 'pwNew', 'pwConfirm', 'otpVerifyCode']);

function _guardAutofillField(el) {
    el.dataset.afGuarded = '1';
    if (el.type === 'hidden' || _autofillAllowed.has(el.id)) return;
    el.setAttribute('autocomplete', el.type === 'password' ? 'new-password' : 'off');
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
    el.setAttribute('data-form-type', 'other');
}

function _sweepAutofillGuard() {
    document.querySelectorAll('input:not([data-af-guarded]), textarea:not([data-af-guarded]), select:not([data-af-guarded])')
        .forEach(_guardAutofillField);
    document.querySelectorAll('form:not([data-af-guarded])').forEach(f => {
        f.dataset.afGuarded = '1';
        f.setAttribute('autocomplete', 'off');
    });
}

let _afSweepQueued = false;

function _queueAutofillSweep() {
    if (_afSweepQueued) return;
    _afSweepQueued = true;
    requestAnimationFrame(() => {
        _afSweepQueued = false;
        _sweepAutofillGuard();
    });
}

function _initAutofillGuard() {
    _sweepAutofillGuard();
    new MutationObserver(_queueAutofillSweep)
        .observe(document.documentElement, { childList: true, subtree: true });
}

let _pwaInstallPrompt = null;

function installPWA() {
    if (!_pwaInstallPrompt) return;
    _pwaInstallPrompt.prompt();
    _pwaInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
            _pwaInstallPrompt = null;
            document.getElementById('pwaInstallBtn')?.classList.add('hidden');
        }
    });
}

function _emptyMountState({ icon, title, description, steps, note }) {
    const stepHtml = steps.map((step, i) => `
        <div class="text-left" style="max-width:480px;margin:0 auto">
            <p class="text-xs mb-2" style="color:var(--muted)">${steps.length > 1 ? `<span class="font-bold" style="color:var(--text)">Step ${i+1}.</span> ` : ''}${step.label}</p>
            <div class="relative rounded-lg overflow-hidden" style="background:var(--input-bg);border:1px solid var(--border)">
                <pre class="text-xs font-mono px-4 py-3 pr-16 leading-relaxed overflow-x-auto" style="color:var(--blue);white-space:pre">${step.code}</pre>
                <button onclick="_copyCode(this, ${JSON.stringify(step.code)})"
                    class="absolute top-2 right-2 flex items-center gap-1 text-xs px-2 py-1 rounded"
                    style="background:var(--btn-secondary-bg);border:1px solid var(--border);color:var(--muted);cursor:pointer;transition:all 0.15s"
                    onmouseover="this.style.borderColor='var(--blue)';this.style.color='var(--blue)'"
                    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
                    <i class="ph-bold ph-copy text-sm"></i> Copy
                </button>
            </div>
        </div>`).join('<div style="height:12px"></div>');

    const noteHtml = note ? `<p class="text-xs mt-4" style="color:var(--muted);opacity:0.7"><i class="ph-bold ph-info mr-1"></i>${note}</p>` : '';

    return `<div class="text-center py-12 px-4 rounded-xl" style="border:1px solid var(--border)">
        <i class="ph-light ${icon} text-5xl block mb-3 opacity-30" style="color:var(--muted)"></i>
        <p class="font-semibold mb-2" style="color:var(--text)">${title}</p>
        <p class="text-xs mb-6" style="color:var(--muted);max-width:400px;margin:0 auto 24px">${description}</p>
        <div class="space-y-3">${stepHtml}</div>
        ${noteHtml}
    </div>`;
}

function _copyCode(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="ph-bold ph-check text-sm"></i> Copied';
        btn.style.color      = 'var(--green)';
        btn.style.borderColor = 'var(--green)';
        setTimeout(() => {
            btn.innerHTML      = orig;
            btn.style.color      = 'var(--muted)';
            btn.style.borderColor = 'var(--border)';
        }, 2000);
    });
}

async function _populateTlsOptionsSelect() {
    const sel = document.getElementById('tlsOptionsProfileSelect');
    if (!sel) return;
    const current = sel.value;
    try {
        const res = await fetch('/api/tls-options');
        const opts = await res.json();
        const inner = `<option value="">None (default)</option>` + opts.map(o => `<option value="${_esc(o.name)}">${_esc(o.name)}</option>`).join('');
        sel.innerHTML = inner;
        sel.value = current;
    } catch(e) {}
}

let _geoEnabled = false, _geoAvailable = false, _geoStatusLoaded = false;
let _geoCache = {};
let _geoMapSvg = null, _geoMapLoading = null;
let _geoTooltipEl = null;

async function loadGeoStatus(force) {
    if (_geoStatusLoaded && !force) return _geoEnabled && _geoAvailable;
    try {
        const r = await fetch('/api/geoip/status').then(r => r.json());
        _geoEnabled = !!r.enabled; _geoAvailable = !!r.available;
    } catch(_) { _geoEnabled = false; _geoAvailable = false; }
    _geoStatusLoaded = true;
    return _geoEnabled && _geoAvailable;
}

async function geoLookup(ips) {
    if (!_geoEnabled || !_geoAvailable) return {};
    const uniq = [...new Set(ips.filter(Boolean))];
    const need = uniq.filter(ip => !(ip in _geoCache));
    if (need.length) {
        try {
            const r = await fetch('/api/geoip/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
                body: JSON.stringify({ ips: need })
            }).then(r => r.json());
            const res = r.results || {};
            need.forEach(ip => { _geoCache[ip] = res[ip] || null; });
            if (r.available === false) _geoAvailable = false;
        } catch(_) {}
    }
    const out = {};
    uniq.forEach(ip => { if (_geoCache[ip]) out[ip] = _geoCache[ip]; });
    return out;
}

function _flagEmoji(cc) {
    if (!cc || cc.length !== 2) return '';
    try { return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }
    catch(_) { return ''; }
}

function _geoCountryCounts(ips) {
    const counts = {};
    ips.forEach(ip => {
        const g = _geoCache[ip];
        if (g && g.country_code) {
            const cc = g.country_code;
            if (!counts[cc]) counts[cc] = { count: 0, name: g.country_name || cc };
            counts[cc].count++;
        }
    });
    return counts;
}

async function _ensureWorldMap() {
    if (_geoMapSvg) return _geoMapSvg;
    if (!_geoMapLoading) {
        _geoMapLoading = fetch('/static/world-map.svg').then(r => r.text()).then(t => { _geoMapSvg = t; return t; }).catch(() => { _geoMapLoading = null; return null; });
    }
    return _geoMapLoading;
}

function _geoTooltip() {
    if (!_geoTooltipEl) {
        _geoTooltipEl = document.createElement('div');
        _geoTooltipEl.className = 'tm-geo-tooltip';
        _geoTooltipEl.style.display = 'none';
        document.body.appendChild(_geoTooltipEl);
    }
    return _geoTooltipEl;
}

async function renderGeoMap(container, countryData, onCountryClick, activeCC) {
    if (!container) return;
    if (_geoTooltipEl) _geoTooltipEl.style.display = 'none';
    const svgText = await _ensureWorldMap();
    if (!svgText) { container.innerHTML = ''; return; }
    container.innerHTML = svgText;
    const svgEl = container.querySelector('svg');
    if (!svgEl) return;
    const counts = Object.values(countryData).map(d => d.count);
    const max = Math.max(1, ...counts);
    svgEl.querySelectorAll('path[data-cc]').forEach(p => {
        const cc = p.getAttribute('data-cc');
        const d  = countryData[cc];
        if (d && d.count > 0) {
            const t = Math.log(d.count + 1) / Math.log(max + 1);
            p.style.fill = 'var(--blue)';
            p.style.fillOpacity = (0.22 + 0.78 * t).toFixed(3);
            p.classList.add('tm-geo-active');
            if (activeCC && cc === activeCC) p.classList.add('tm-geo-selected');
        }
    });
    const tip = _geoTooltip();
    svgEl.addEventListener('mousemove', e => {
        const p = e.target.closest('path.tm-geo-active');
        if (!p) { tip.style.display = 'none'; return; }
        const cc = p.getAttribute('data-cc');
        const d  = countryData[cc] || {};
        tip.innerHTML = `${_flagEmoji(cc)} ${_esc(d.name || p.getAttribute('data-name') || cc)} <span style="color:var(--muted);margin-left:4px">${d.count || 0}</span>`;
        tip.style.display = 'block';
        tip.style.left = (e.clientX + 12) + 'px';
        tip.style.top  = (e.clientY + 12) + 'px';
    });
    svgEl.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    if (onCountryClick) {
        svgEl.addEventListener('click', e => {
            const p = e.target.closest('path.tm-geo-active');
            if (p) onCountryClick(p.getAttribute('data-cc'));
        });
    }
}

function _geoPanelHtml(panelId, countryData, activeCC, onClearAttr) {
    const entries = Object.entries(countryData).sort((a, b) => b[1].count - a[1].count);
    if (!entries.length) return '';
    const max = entries[0][1].count || 1;
    const top = entries.slice(0, 8).map(([cc, d]) => {
        const w = Math.max(4, Math.round((d.count / max) * 100));
        const sel = activeCC === cc;
        return `<div class="flex items-center gap-2 py-1 cursor-pointer" style="border-bottom:1px solid var(--border);${sel ? 'background:var(--input-bg)' : ''}" onclick="${panelId}_click('${cc}')">
            <span style="font-size:14px;line-height:1;flex-shrink:0">${_flagEmoji(cc)}</span>
            <span class="text-xs truncate" style="color:var(--text);flex:1;min-width:0" title="${_esc(d.name)}">${_esc(d.name)}</span>
            <div style="width:60px;height:6px;border-radius:3px;background:var(--input-bg);overflow:hidden;flex-shrink:0"><div style="height:100%;border-radius:3px;background:var(--blue);width:${w}%"></div></div>
            <span class="text-xs font-bold tabular-nums flex-shrink-0" style="color:var(--muted);min-width:28px;text-align:right">${d.count}</span>
        </div>`;
    }).join('');
    const activeChip = activeCC ? `<button onclick="${onClearAttr}" class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style="background:var(--input-bg);color:var(--blue);border:1px solid var(--border)">${_flagEmoji(activeCC)} ${_esc((countryData[activeCC] || {}).name || activeCC)} <i class="ph-bold ph-x"></i></button>` : '';
    return `<div class="rounded-xl p-4 mb-3" style="background:var(--card);border:1px solid var(--border)">
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)"><i class="ph-bold ph-globe-hemisphere-west mr-1"></i>Geography</span>
            ${activeChip}
        </div>
        <div class="tm-geo-grid">
            <div id="${panelId}Map" class="tm-geo-map"></div>
            <div>${top}</div>
        </div>
        <div class="text-xs mt-2" style="color:var(--muted)"><a href="https://db-ip.com" target="_blank" rel="noopener" style="color:var(--muted)">IP Geolocation by DB-IP</a></div>
    </div>`;
}

function classifyIp(ip) {
    if (!ip) return 'unknown';
    ip = ip.trim();
    const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const o = v4.slice(1).map(Number);
        if (o.some(n => n > 255)) return 'unknown';
        const [a, b] = o;
        if (a === 127) return 'loopback';
        if (a === 169 && b === 254) return 'link-local';
        if (a === 10) return 'private';
        if (a === 172 && b >= 16 && b <= 31) return 'private';
        if (a === 192 && b === 168) return 'private';
        if (a === 100 && b >= 64 && b <= 127) return 'cgnat';
        return 'public';
    }
    let v6 = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
    if (!v6.includes(':')) return 'unknown';
    if (v6 === '::1') return 'loopback';
    if (v6.startsWith('fe80')) return 'link-local';
    if (v6.startsWith('fc') || v6.startsWith('fd')) return 'private';
    if (v6.startsWith('::ffff:') && v6.slice(7).includes('.')) return classifyIp(v6.slice(7));
    return 'public';
}

const _IP_CLASS_META = {
    'public':     ['Public', 'ip-badge-public'],
    'private':    ['Private', 'ip-badge-private'],
    'cgnat':      ['CGNAT', 'ip-badge-cgnat'],
    'loopback':   ['Loopback', 'ip-badge-muted'],
    'link-local': ['Link-local', 'ip-badge-muted'],
    'unknown':    ['?', 'ip-badge-muted'],
};

function ipClassBadge(cls) {
    const [label, klass] = _IP_CLASS_META[cls] || _IP_CLASS_META['unknown'];
    return `<span class="ip-badge ${klass}">${label}</span>`;
}

function openIpDiagModal() {
    const m = document.getElementById('ipDiagModal');
    if (!m) return;
    m.style.display = 'flex';
    loadIpDiagnostic();
}

function closeIpDiagModal() {
    const m = document.getElementById('ipDiagModal');
    if (m) m.style.display = 'none';
}

async function loadIpDiagnostic() {
    const body = document.getElementById('ipDiagBody');
    if (!body) return;
    body.innerHTML = `<div class="text-xs py-4 text-center" style="color:var(--muted)">Loading...</div>`;
    let d;
    try {
        d = await fetch('/api/diagnostics/client-ip').then(r => r.json());
    } catch (_) {
        body.innerHTML = `<div class="text-xs py-4 text-center" style="color:var(--red)">Failed to load diagnostic.</div>`;
        return;
    }
    const row = (label, ip, cls, hint) => `
        <div style="border-bottom:1px solid var(--border);padding:8px 0">
            <div class="flex items-center gap-2">
                <span class="text-xs" style="color:var(--muted);min-width:120px">${label}</span>
                <span class="text-xs font-mono truncate" style="color:var(--text);flex:1;min-width:0" title="${_esc(ip || '')}">${ip ? _esc(ip) : '<span style="color:var(--muted)">-</span>'}</span>
                ${ip ? ipClassBadge(cls || classifyIp(ip)) : ''}
            </div>
            ${hint ? `<div class="text-xs" style="color:var(--muted);margin-top:5px;padding-left:128px">${hint}</div>` : ''}
        </div>`;

    const hdrRows = Object.entries(d.headers || {}).map(([k, v]) => `
        <div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid var(--border)">
            <span class="text-xs font-mono" style="color:var(--muted);min-width:120px">${_esc(k)}</span>
            <span class="text-xs font-mono truncate" style="color:${v ? 'var(--text)' : 'var(--muted)'};flex:1;min-width:0" title="${_esc(v || '')}">${v ? _esc(v) : 'not set'}</span>
        </div>`).join('');

    const spoofable = d.effective_class === 'private' || d.effective_class === 'loopback' || d.effective_class === 'cgnat';

    body.innerHTML = `
        <div class="rounded-xl p-3 mb-3" style="background:var(--card);border:1px solid var(--border)">
            ${row('App sees (client)', d.effective_ip, d.effective_class)}
            ${row('Socket peer', d.socket_peer, d.socket_peer_class, 'The direct TCP connection - your reverse proxy, or the real client if none.')}
            <div class="flex items-center gap-2 py-2">
                <span class="text-xs" style="color:var(--muted);min-width:120px">Trusted hops</span>
                <span class="text-xs font-mono" style="color:var(--text)">${d.proxy_hops}</span>
            </div>
        </div>
        <div class="text-xs font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Forwarding Headers</div>
        <div class="rounded-xl p-3 mb-3" style="background:var(--card);border:1px solid var(--border)">
            ${hdrRows}
        </div>
        ${spoofable ? `<div class="rounded-xl p-3 text-xs" style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);color:var(--text)"><i class="ph-bold ph-warning" style="color:var(--yellow);margin-right:6px"></i>The client IP the app trusts is <strong>${_esc(d.effective_class)}</strong>. If clients should reach you from the public internet, a proxy in front is rewriting it - check that your trusted hops and the upstream <code class="font-mono">trustedIPs</code> are set correctly, or real client IPs will be lost to logs, CrowdSec and ipAllowList.</div>` : ''}`;
}

function _initMobileFilterBars() {
    if (window.innerWidth > 640) return;
    document.querySelectorAll('.filter-bar:not([data-fb-init])').forEach(bar => {
        bar.dataset.fbInit = '1';
        const searchBtn = document.createElement('button');
        searchBtn.className = 'fb-search-icon';
        searchBtn.title = 'Search';
        searchBtn.innerHTML = '<i class="ph-bold ph-magnifying-glass" style="font-size:13px"></i>';
        searchBtn.onclick = () => {
            bar.classList.add('fb-open');
            bar.querySelector('input[type=text]')?.focus();
        };
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'fb-cancel-icon';
        cancelBtn.title = 'Cancel';
        cancelBtn.innerHTML = '<i class="ph-bold ph-arrow-left" style="font-size:13px"></i>';
        cancelBtn.onclick = () => {
            bar.classList.remove('fb-open');
            const inp = bar.querySelector('input[type=text]');
            if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); }
        };
        bar.insertBefore(cancelBtn, bar.firstChild);
        bar.insertBefore(searchBtn, bar.firstChild);
        if (bar.querySelector('.fb-secondary')) {
            const filterBtn = document.createElement('button');
            filterBtn.className = 'fb-filter-icon';
            filterBtn.title = 'More filters';
            filterBtn.innerHTML = '<i class="ph-bold ph-sliders" style="font-size:13px"></i>';
            filterBtn.onclick = () => {
                const open = bar.classList.toggle('fb-filter-open');
                filterBtn.classList.toggle('active', open);
            };
            bar.appendChild(filterBtn);
        }
    });
}

let _notifData       = [];
let _notifLastRead   = parseInt(localStorage.getItem('notifLastRead') || '0', 10);
let _notifPanelOpen  = false;

const _NOTIF_ICONS = {
    success: 'ph-check-circle',
    warning: 'ph-warning',
    error:   'ph-x-circle',
    info:    'ph-info',
};

function _notifRelTime(ts) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60)  return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchNotifications() {
    try {
        const res  = await fetch('/api/notifications');
        if (!res.ok) return;
        _notifData = await res.json();
        if (_notifLastRead > _notifData.length) {
            _notifLastRead = _notifData.length;
            localStorage.setItem('notifLastRead', _notifLastRead);
        }
        _renderNotifPanel();
    } catch(e) {}
}

function _renderNotifPanel() {
    const list  = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const badgeM = document.getElementById('notifBadgeMobile');
    const markReadBtn = document.getElementById('notifMarkRead');
    if (!list || !badge) return;

    const unreadCount = _notifData.filter((_, i) => i < (_notifData.length - _notifLastRead)).length;
    const hasUnread = unreadCount > 0;

    if (hasUnread) {
        badge.classList.remove('hidden');
        badgeM?.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
        badgeM?.classList.add('hidden');
    }

    if (markReadBtn) markReadBtn.style.display = hasUnread ? '' : 'none';

    const clearAllBtn = document.getElementById('notifClearAll');
    if (clearAllBtn) clearAllBtn.style.display = _notifData.length ? '' : 'none';

    if (!_notifData.length) {
        list.innerHTML = `<div class="notif-empty"><i class="ph-light ph-bell-slash" style="font-size:32px;opacity:0.3;display:block;margin-bottom:8px"></i>No notifications yet</div>`;
        return;
    }

    list.innerHTML = _notifData.map((n, i) => {
        const isUnread = i < (_notifData.length - _notifLastRead);
        const type  = n.type || 'info';
        const icon  = _NOTIF_ICONS[type] || 'ph-info';
        return `<div class="notif-item${isUnread ? ' unread' : ''}">
            <div class="notif-icon ${type}"><i class="ph-bold ${icon}"></i></div>
            <div class="notif-body">
                <div class="notif-msg">${_esc(n.msg)}</div>
                <div class="notif-ts">${_notifRelTime(n.ts)}</div>
            </div>
            <button class="notif-delete-btn" onclick="deleteNotification('${_esc(n.ts)}')" title="Dismiss"><i class="ph-bold ph-x"></i></button>
        </div>`;
    }).join('');
}

function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const btn   = document.getElementById('notifBellBtn');
    const btnM  = document.getElementById('notifBellBtnMobile');
    if (!panel) return;
    _notifPanelOpen = !_notifPanelOpen;
    panel.classList.toggle('open', _notifPanelOpen);
    const color = _notifPanelOpen ? 'var(--blue)' : '';
    if (btn)  btn.style.color  = color;
    if (btnM) btnM.style.color = color;
    if (_notifPanelOpen) {
        const activeBtn = (btnM && btnM.offsetParent) ? btnM : btn;
        if (activeBtn) {
            const r = activeBtn.getBoundingClientRect();
            const panelW = Math.min(360, window.innerWidth - 16);
            let left = r.right - panelW;
            if (left < 8) left = 8;
            panel.style.position = 'fixed';
            panel.style.top  = (r.bottom + 8) + 'px';
            panel.style.left = left + 'px';
            panel.style.right = 'auto';
            panel.style.width = panelW + 'px';
        }
    } else {
        markNotifsRead();
    }
}

function markNotifsRead() {
    _notifLastRead = _notifData.length;
    localStorage.setItem('notifLastRead', _notifLastRead);
    _renderNotifPanel();
}

async function deleteNotification(ts) {
    try {
        await fetch('/api/notifications/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ ts })
        });
        await fetchNotifications();
        if (_notifLastRead > 0) _notifLastRead = Math.max(0, _notifLastRead - 1);
        localStorage.setItem('notifLastRead', _notifLastRead);
        _renderNotifPanel();
    } catch(e) {}
}

async function clearAllNotifications() {
    try {
        await fetch('/api/notifications/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({})
        });
        _notifLastRead = 0;
        localStorage.setItem('notifLastRead', _notifLastRead);
        await fetchNotifications();
    } catch(e) {}
}
