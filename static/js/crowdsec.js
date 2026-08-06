let _csDecisions = [];
let _csAlerts    = [];
let _csTypeFilter    = 'all';
let _csView          = 'decisions';
let _csLapiOnline    = false;
let _csDecisionsPage = 1;
let _csBanType       = 'ban';
let _csCountryFilter = '';
const _CS_PAGE_SIZE  = 100;

function _csIp(d) { return (d.value || '').split('/')[0]; }
function csGeo_click(cc) { _csCountryFilter = (_csCountryFilter === cc) ? '' : cc; _csDecisionsPage = 1; _csApplyFilters(); }
function clearCsCountryFilter() { _csCountryFilter = ''; _csDecisionsPage = 1; _csApplyFilters(); }

let _csRefreshing = false, _csRefreshQueued = false;
async function refreshCrowdSecTab() {
    if (_csRefreshing) { _csRefreshQueued = true; return; }
    _csRefreshing = true;
    try {
        await _csRefreshInner();
    } finally {
        _csRefreshing = false;
        if (_csRefreshQueued) { _csRefreshQueued = false; refreshCrowdSecTab(); }
    }
}

async function _csRefreshInner() {
    const decEl   = document.getElementById('csDecisionsTable');
    const altEl   = document.getElementById('csAlertsTable');
    const statsEl = document.getElementById('crowdsecStats');
    const notCfgEl = document.getElementById('csNotConfigured');
    if (!_activeAgent && !window._hostCsEnabled) {
        if (notCfgEl) notCfgEl.style.setProperty('display', 'flex', 'important');
        if (decEl) decEl.closest('#csDecisionsSection')?.style.setProperty('display','none');
        if (statsEl) statsEl.innerHTML = '';
        return;
    }
    if (notCfgEl) notCfgEl.style.setProperty('display', 'none', 'important');
    if (!decEl) return;
    _renderCsLoading('Fetching decisions and alerts...');
    try {
        const [decRes, altRes] = await Promise.all([
            agentFetch('/api/crowdsec/decisions'),
            agentFetch('/api/crowdsec/alerts'),
        ]);
        if (!decRes.ok) {
            if (decRes.status === 404 && _activeAgent) {
                if (notCfgEl) notCfgEl.style.setProperty('display', 'flex', 'important');
                if (decEl) decEl.closest('#csDecisionsSection')?.style.setProperty('display','none');
                if (statsEl) statsEl.innerHTML = '';
                return;
            }
            _csLapiOnline = false;
            let errMsg = `CrowdSec LAPI unavailable (HTTP ${decRes.status})`;
            try { errMsg = (await decRes.json()).error || errMsg; } catch {}
            _renderCsStats([], [], false, statsEl);
            decEl.innerHTML = `<div class="text-center py-8 text-xs" style="color:var(--muted)">${_esc(errMsg)}</div>`;
            if (altEl) altEl.innerHTML = '';
            return;
        }
        _csLapiOnline = true;
        const rawDec  = await decRes.json();
        let altErr    = '';
        let rawAlt    = [];
        if (altRes.ok) {
            rawAlt = await altRes.json();
        } else {
            try { altErr = (await altRes.json()).error || ''; } catch {}
        }
        _csDecisions = Array.isArray(rawDec) ? rawDec : [];
        _csAlerts    = Array.isArray(rawAlt) ? rawAlt : [];
        _csDecisionsPage = 1;
        await loadGeoStatus();
        if (_geoEnabled && _geoAvailable) {
            const ips = [
                ..._csDecisions.map(d => (d.value || '').split('/')[0]),
                ..._csAlerts.map(a => a.source && a.source.ip),
            ].filter(Boolean);
            if (ips.length > 4000) _csSetLoadingMsg(`Locating ${ips.length.toLocaleString()} addresses...`);
            await geoAggregate(ips);
        }
        _renderCsStats(_csDecisions, _csAlerts, _csLapiOnline, statsEl);
        _csRenderStatsPanels(_csDecisions, _csAlerts);
        _csRenderBanRecent();
        _csApplyFilters();
        if (altEl && !altRes.ok) {
            const hint = altErr ? _esc(altErr) : 'Alerts unavailable - bouncer key may lack read:alerts permission, or set CROWDSEC_MACHINE_ID / CROWDSEC_MACHINE_PASSWORD';
            altEl.innerHTML = `<div class="text-center py-8 text-xs" style="color:var(--muted)">${hint}</div>`;
        }
    } catch(e) {
        _csLapiOnline = false;
        _renderCsStats([], [], false, statsEl);
        const err = `<div class="text-center py-8 text-xs" style="color:var(--muted)">Could not reach CrowdSec LAPI</div>`;
        decEl.innerHTML = err;
        if (altEl) altEl.innerHTML = err;
    }
}

function _setCsView(view, btn) {
    _csView = view;
    _csDecisionsPage = 1;
    document.querySelectorAll('[id^="cs-view-"]').forEach(b => b.classList.remove('active-http'));
    if (btn) btn.classList.add('active-http');
    const typeFilter   = document.getElementById('csTypeFilter');
    const addBtn       = document.getElementById('csAddDecisionBtn');
    const decSection   = document.getElementById('csDecisionsSection');
    const altSection   = document.getElementById('csAlertsSection');
    const isDecisions  = view === 'decisions';
    if (typeFilter) typeFilter.style.display  = isDecisions ? '' : 'none';
    if (addBtn)     addBtn.style.display      = isDecisions ? '' : 'none';
    if (decSection) decSection.style.display  = isDecisions ? '' : 'none';
    if (altSection) altSection.style.display  = isDecisions ? 'none' : '';
    _csApplyFilters();
}

function _setCsType(type, btn) {
    _csTypeFilter = type;
    _csDecisionsPage = 1;
    document.querySelectorAll('[id^="cs-type-"]').forEach(b => b.classList.remove('active-http'));
    if (btn) btn.classList.add('active-http');
    _csApplyFilters();
}

function _setCsPage(n) {
    _csDecisionsPage = n;
    _csApplyFilters();
}

function _csRenderGeoPanel(ips) {
    const panel = document.getElementById('csGeoPanel');
    if (!panel) return;
    const geoOn = _geoEnabled && _geoAvailable;
    const countryData = geoOn ? _geoCountryCounts((ips || []).filter(Boolean)) : {};
    if (_csCountryFilter && !countryData[_csCountryFilter]) _csCountryFilter = '';
    if (!geoOn || !Object.keys(countryData).length) { panel.innerHTML = ''; return; }
    panel.innerHTML = _geoPanelHtml('csGeo', countryData, _csCountryFilter, 'clearCsCountryFilter()');
    renderGeoMap(document.getElementById('csGeoMap'), countryData, csGeo_click, _csCountryFilter);
}

function _csApplyFilters() {
    const q = (document.getElementById('csSearch')?.value || '').toLowerCase().trim();
    const geoOn = _geoEnabled && _geoAvailable;
    const ccOf = ip => { const g = _geoCache[ip]; return g && g.country_code; };
    if (_csView === 'decisions') {
        const decEl = document.getElementById('csDecisionsTable');
        const base = _csDecisions.filter(d => {
            if (_csTypeFilter !== 'all' && d.type !== _csTypeFilter) return false;
            if (q && !((d.value||'').toLowerCase().includes(q) || (d.scenario||'').toLowerCase().includes(q) || (d.origin||'').toLowerCase().includes(q))) return false;
            return true;
        });
        _csRenderGeoPanel(base.map(_csIp));
        const filtered = (geoOn && _csCountryFilter) ? base.filter(d => ccOf(_csIp(d)) === _csCountryFilter) : base;
        if (decEl) _renderCsDecisions(filtered, decEl);
    } else {
        const altEl = document.getElementById('csAlertsTable');
        const base = _csAlerts.filter(a => {
            if (!q) return true;
            const ip = (a.source && a.source.ip) ? a.source.ip : '';
            return ip.toLowerCase().includes(q) || (a.scenario||'').toLowerCase().includes(q);
        });
        _csRenderGeoPanel(base.map(a => a.source && a.source.ip));
        const filtered = (geoOn && _csCountryFilter) ? base.filter(a => ccOf(a.source && a.source.ip) === _csCountryFilter) : base;
        if (altEl) _renderCsAlerts(filtered, altEl);
    }
}

function openCsBanModal() {
    document.getElementById('csBanIp').value       = '';
    document.getElementById('csBanReason').value   = '';
    document.getElementById('csBanDuration').value = '24h';
    const errEl = document.getElementById('csBanError');
    if (errEl) errEl.style.display = 'none';
    _setCsBanType('ban');
    _csRenderBanRecent();
    document.getElementById('csBanModal').classList.add('open');
    document.getElementById('csBanBackdrop').classList.add('open');
    if (!setDetailDockOpen(true)) document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('csBanIp')?.focus(), 50);
}

function closeCsBanModal() {
    setDetailDockOpen(false);
    document.getElementById('csBanModal').classList.remove('open');
    document.getElementById('csBanBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

function _csRenderBanRecent() {
    const el = document.getElementById('csBanRecent');
    if (!el) return;
    const mine = _csDecisions
        .filter(d => ['manual', 'cscli'].includes((d.origin || '').toLowerCase()))
        .sort((a, b) => (b.id || 0) - (a.id || 0));
    const countEl = document.getElementById('csBanRecentCount');
    if (countEl) countEl.textContent = mine.length ? mine.length.toLocaleString() : '';
    if (!mine.length) {
        el.innerHTML = `<div class="text-center py-6 text-xs" style="color:var(--muted)">No custom decisions yet - decisions you add appear here</div>`;
        return;
    }
    const colour = { ban: 'var(--red)', captcha: 'var(--yellow)', bypass: 'var(--green)' };
    el.innerHTML = mine.map(d => {
        const until = d.until ? new Date(d.until).toLocaleString() : (d.duration || '-');
        return `<div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid var(--border)">
            <span class="font-mono text-xs truncate" style="color:var(--text);flex:1;min-width:0" title="${_esc(d.value || '-')}">${_esc(d.value || '-')}</span>
            <span class="text-xs font-semibold flex-shrink-0" style="color:${colour[d.type] || 'var(--muted)'}">${_esc(d.type || '-')}</span>
            <span class="text-xs truncate" style="color:var(--muted);max-width:150px" title="${_esc(d.scenario || '')}">${_esc(d.scenario || '')}</span>
            <span class="text-xs flex-shrink-0 tabular-nums" style="color:var(--muted)" title="Expires">${_esc(String(until))}</span>
            ${d.id ? `<button onclick="csUnban(${d.id})" class="btn-icon text-xs flex-shrink-0" title="Unban / delete decision" style="color:var(--red)"><i class="ph-bold ph-trash"></i></button>` : '<span class="text-xs flex-shrink-0" style="color:var(--muted);opacity:.6">syncing...</span>'}
        </div>`;
    }).join('');
}

function _setCsBanType(type, btn) {
    _csBanType = type;
    document.querySelectorAll('[id^="csBanType-"]').forEach(b => b.classList.remove('active-http'));
    const el = document.getElementById('csBanType-' + type);
    if (el) el.classList.add('active-http');
}

async function submitCsBan() {
    const ip = (document.getElementById('csBanIp')?.value || '').trim();
    const errEl   = document.getElementById('csBanError');
    const errMsg  = document.getElementById('csBanErrorMsg');
    const submitBtn = document.querySelector('#csBanModal button[onclick="submitCsBan()"]');
    if (errEl) errEl.style.display = 'none';
    if (!ip) {
        if (errEl && errMsg) { errMsg.textContent = 'IP/Range is required'; errEl.style.display = 'flex'; }
        return;
    }
    const duration = document.getElementById('csBanDuration')?.value || '24h';
    const reason   = (document.getElementById('csBanReason')?.value || '').trim();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Adding...'; }
    try {
        const res = await agentFetch('/api/crowdsec/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ value: ip, type: _csBanType, duration, reason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add decision');
        _csDecisions.unshift({ value: ip, type: _csBanType, scenario: reason || 'manual ban from Traefik Manager', origin: 'manual', duration });
        _csRenderBanRecent();
        document.getElementById('csBanIp').value = '';
        addNotification('success', `Decision added: ${_csBanType} ${ip} for ${duration}`);
        setTimeout(refreshCrowdSecTab, 800);
    } catch(e) {
        if (errEl && errMsg) { errMsg.textContent = e.message || 'Failed to add decision'; errEl.style.display = 'flex'; }
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Add Decision'; }
    }
}

const CS_STAT_CARDS = [
    { label: 'Total Alerts',     icon: 'ph-shield-slash' },
    { label: 'Active Decisions', icon: 'ph-crosshair-simple' },
    { label: 'LAPI Status',      icon: 'ph-pulse' },
];

function _renderCsLoading(msg) {
    const statsEl = document.getElementById('crowdsecStats');
    if (statsEl) {
        statsEl.innerHTML = CS_STAT_CARDS.map(s => `
            <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)">${s.label}</span>
                    <i class="ph-bold ${s.icon} text-base" style="color:var(--muted);opacity:0.35"></i>
                </div>
                <div class="cs-skeleton"></div>
            </div>`).join('');
    }
    const panel = document.getElementById('csGeoPanel');
    if (panel) panel.innerHTML = '';
    const extra = document.getElementById('csStatsPanels');
    if (extra) extra.innerHTML = '';
    _csSetLoadingMsg(msg);
}

function _csSetLoadingMsg(msg) {
    const html = `<div class="text-center py-10" style="color:var(--muted)">
        <i class="ph-light ph-spinner-gap text-3xl block mb-2 animate-spin opacity-40"></i>
        <p class="text-xs">${_esc(msg || 'Loading...')}</p></div>`;
    const decEl = document.getElementById('csDecisionsTable');
    const altEl = document.getElementById('csAlertsTable');
    if (decEl) decEl.innerHTML = html;
    if (altEl) altEl.innerHTML = html;
}

function _renderCsStats(decisions, alerts, lapiOnline, el) {
    if (!el) return;
    const byType = {};
    decisions.forEach(d => { const t = d.type || 'other'; byType[t] = (byType[t] || 0) + 1; });
    const breakdown = Object.entries(byType).sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${n.toLocaleString()} ${_esc(t)}`).join(' \u00b7 ');

    const stats = [
        { label: 'Total Alerts', value: alerts.length.toLocaleString(), sub: '',
          color: 'var(--blue)', icon: 'ph-shield-slash', on: alerts.length > 0 },
        { label: 'Active Decisions', value: decisions.length.toLocaleString(), sub: breakdown,
          color: 'var(--red)', icon: 'ph-crosshair-simple', on: decisions.length > 0 },
        { label: 'LAPI Status', value: lapiOnline ? 'Online' : 'Offline', sub: '',
          color: lapiOnline ? 'var(--green)' : 'var(--red)', icon: 'ph-pulse', on: true },
    ];
    el.innerHTML = stats.map(s => `
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)">${s.label}</span>
                <i class="ph-bold ${s.icon} text-base" style="color:${s.color};opacity:0.7"></i>
            </div>
            <div class="text-2xl font-bold" style="color:${s.on ? s.color : 'var(--muted)'}">${s.value}</div>
            ${s.sub ? `<div class="text-xs mt-1 truncate" style="color:var(--muted)" title="${_esc(s.sub)}">${s.sub}</div>` : ''}
        </div>`).join('');
}

function _csTopList(title, icon, entries, colour) {
    if (!entries.length) return '';
    const total = entries.reduce((n, e) => n + e[1], 0) || 1;
    const max = entries[0][1] || 1;
    const rows = entries.slice(0, 8).map(([label, n]) => {
        const w = Math.max(4, Math.round((n / max) * 100));
        return `<div class="flex items-center gap-2 py-1" style="border-bottom:1px solid var(--border)">
            <span class="text-xs truncate" style="color:var(--text);flex:1;min-width:0" title="${_esc(label)}">${_esc(label)}</span>
            <div style="width:60px;height:6px;border-radius:3px;background:var(--input-bg);overflow:hidden;flex-shrink:0"><div style="height:100%;border-radius:3px;background:${colour};width:${w}%"></div></div>
            <span class="text-xs font-bold tabular-nums flex-shrink-0" style="color:var(--muted);min-width:44px;text-align:right">${n.toLocaleString()}</span>
            <span class="text-xs tabular-nums flex-shrink-0" style="color:var(--muted);opacity:.65;min-width:38px;text-align:right">${(n / total * 100).toFixed(1)}%</span>
        </div>`;
    }).join('');
    return `<div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
        <div class="text-xs font-semibold uppercase tracking-wide mb-3" style="color:var(--muted)"><i class="ph-bold ${icon} mr-1"></i>${title}</div>
        ${rows}
    </div>`;
}

function _csActivityHtml(alerts) {
    const stamps = alerts.map(a => Date.parse(a.start_at || a.created_at)).filter(t => !isNaN(t));
    if (stamps.length < 2) return '';
    const min = Math.min(...stamps), max = Math.max(...stamps);
    const spanH = (max - min) / 3600000;
    const byDay = spanH > 48;
    let bucketMs = byDay ? 86400000 : 3600000;
    const MAX_BUCKETS = 72;
    while ((max - min) / bucketMs > MAX_BUCKETS) bucketMs *= 2;
    const buckets = new Map();
    stamps.forEach(t => {
        const k = Math.floor(t / bucketMs) * bucketMs;
        buckets.set(k, (buckets.get(k) || 0) + 1);
    });
    const keys = [];
    for (let k = Math.floor(min / bucketMs) * bucketMs; k <= max; k += bucketMs) keys.push(k);
    const peak = Math.max(...buckets.values()) || 1;
    const bars = keys.map(k => {
        const n = buckets.get(k) || 0;
        const h = Math.round((n / peak) * 100);
        const when = new Date(k).toLocaleString(undefined,
            byDay ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', hour: 'numeric' });
        return `<div class="cs-bar-col" title="${_esc(when)}: ${n} alert${n === 1 ? '' : 's'}">
            <div class="cs-bar" style="height:${Math.max(h, n ? 3 : 0)}%"></div></div>`;
    }).join('');
    const fmt = t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
        <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)"><i class="ph-bold ph-chart-bar mr-1"></i>Alert Activity</span>
            <span class="text-xs" style="color:var(--muted)">per ${byDay ? 'day' : 'hour'}</span>
        </div>
        <div class="cs-bars">${bars}</div>
        <div class="flex items-center justify-between text-xs mt-1" style="color:var(--muted)">
            <span>${fmt(min)}</span><span>peak ${peak.toLocaleString()}</span><span>${fmt(max)}</span>
        </div>
    </div>`;
}

function _csRenderStatsPanels(decisions, alerts) {
    const el = document.getElementById('csStatsPanels');
    if (!el) return;
    const scen = {};
    decisions.forEach(d => { const k = d.scenario || 'unknown'; scen[k] = (scen[k] || 0) + 1; });
    const top = Object.entries(scen).sort((a, b) => b[1] - a[1]);
    const parts = [_csActivityHtml(alerts), _csTopList('Top Scenarios', 'ph-list-magnifying-glass', top, 'var(--purple)')].filter(Boolean);
    el.innerHTML = parts.length ? `<div class="cs-panel-grid mb-3">${parts.join('')}</div>` : '';
}

function _renderCsDecisions(allFiltered, el) {
    const total     = allFiltered.length;
    const totalPages = Math.max(1, Math.ceil(total / _CS_PAGE_SIZE));
    if (_csDecisionsPage > totalPages) _csDecisionsPage = totalPages;
    const start    = (_csDecisionsPage - 1) * _CS_PAGE_SIZE;
    const decisions = allFiltered.slice(start, start + _CS_PAGE_SIZE);

    const countEl = document.getElementById('csDecisionCount');
    if (countEl) countEl.textContent = total;

    if (total === 0) {
        el.innerHTML = `<div class="text-center py-10 text-xs" style="color:var(--muted)">No active decisions</div>`;
        return;
    }
    const geoOn = _geoEnabled && _geoAvailable;
    const rows = decisions.map(d => {
        const until    = d.until ? new Date(d.until).toLocaleString() : (d.duration || '-');
        const scenario = _esc(d.scenario || '-');
        const origin   = _esc(d.origin || '-');
        const g = _geoCache[_csIp(d)];
        const geoCell = geoOn ? `<td class="px-3 py-2 text-xs">${g && g.country_code ? _geoChip(g.country_code, g.country_name) : '<span style="color:var(--muted)">-</span>'}</td>` : '';
        return `<tr style="border-top:1px solid var(--border)">
            <td class="px-3 py-2 font-mono text-xs" style="color:var(--text)">${_esc(d.value || '-')}</td>
            ${geoCell}
            <td class="px-3 py-2 text-xs"><span class="badge ${d.type === 'ban' ? 'badge-red' : d.type === 'captcha' ? 'badge-yellow' : 'badge-green'}">${_esc(d.type || '-')}</span></td>
            <td class="px-3 py-2 text-xs" style="color:var(--muted)">${_esc(origin)}</td>
            <td class="px-3 py-2 text-xs" style="color:var(--muted)">${scenario}</td>
            <td class="px-3 py-2 text-xs" style="color:var(--muted)">${_esc(String(until))}</td>
            <td class="px-3 py-2 text-xs text-right">
                ${d.id ? `<button onclick="csUnban(${d.id})" class="btn-icon text-xs" title="Unban / delete decision" style="color:var(--red)"><i class="ph-bold ph-trash"></i></button>` : ''}
            </td>
        </tr>`;
    }).join('');

    const paginationBar = totalPages > 1 ? `
        <div class="flex items-center justify-between px-3 py-2" style="border-top:1px solid var(--border);background:var(--input-bg)">
            <span class="text-xs" style="color:var(--muted)">Showing ${start + 1}-${Math.min(start + _CS_PAGE_SIZE, total)} of ${total}</span>
            <div class="flex items-center gap-1">
                <button onclick="_setCsPage(${_csDecisionsPage - 1})" ${_csDecisionsPage <= 1 ? 'disabled' : ''} class="btn-icon text-xs" style="${_csDecisionsPage <= 1 ? 'opacity:0.3;cursor:default' : ''}"><i class="ph-bold ph-caret-left"></i></button>
                <span class="text-xs px-2" style="color:var(--muted)">Page ${_csDecisionsPage} of ${totalPages}</span>
                <button onclick="_setCsPage(${_csDecisionsPage + 1})" ${_csDecisionsPage >= totalPages ? 'disabled' : ''} class="btn-icon text-xs" style="${_csDecisionsPage >= totalPages ? 'opacity:0.3;cursor:default' : ''}"><i class="ph-bold ph-caret-right"></i></button>
            </div>
        </div>` : '';

    el.innerHTML = `<table class="w-full text-left" style="border-collapse:collapse">
        <thead><tr style="background:var(--input-bg)">
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">IP / Scope</th>
            ${geoOn ? '<th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Country</th>' : ''}
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Type</th>
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Origin</th>
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Scenario</th>
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Expires</th>
            <th class="px-3 py-2 text-xs font-semibold text-right" style="color:var(--muted)">Action</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>${paginationBar}`;
}

function _renderCsAlerts(alerts, el) {
    document.getElementById('csAlertCount').textContent = alerts.length;
    if (alerts.length === 0) {
        el.innerHTML = `<div class="text-center py-10 text-xs" style="color:var(--muted)">No recent alerts</div>`;
        return;
    }
    const geoOn = _geoEnabled && _geoAvailable;
    const rows = alerts.map(a => {
        const when = a.start_at || a.created_at;
        const ts  = when ? new Date(when).toLocaleString() : '-';
        const rawIp = (a.source && a.source.ip) ? a.source.ip : '';
        const ip  = rawIp ? _esc(rawIp) : '-';
        const scenario = _esc(a.scenario || '-');
        const blocked = a.remediation === true || (a.decisions || []).length > 0;
        const g = _geoCache[rawIp];
        const geoCell = geoOn ? `<td class="px-3 py-2 text-xs">${g && g.country_code ? _geoChip(g.country_code, g.country_name) : '<span style="color:var(--muted)">-</span>'}</td>` : '';
        return `<tr style="border-top:1px solid var(--border)">
            <td class="px-3 py-2 text-xs" style="color:var(--muted)">${_esc(ts)}</td>
            <td class="px-3 py-2 font-mono text-xs" style="color:var(--text)">${ip}</td>
            ${geoCell}
            <td class="px-3 py-2 text-xs" style="color:var(--muted)">${scenario}</td>
            <td class="px-3 py-2 text-xs text-center">${blocked ? '<i class="ph-bold ph-shield-check" style="color:var(--green)" title="A decision was issued"></i>' : '<span style="color:var(--muted)">-</span>'}</td>
        </tr>`;
    }).join('');
    el.innerHTML = `<table class="w-full text-left" style="border-collapse:collapse">
        <thead><tr style="background:var(--input-bg)">
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Time</th>
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Source IP</th>
            ${geoOn ? '<th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Country</th>' : ''}
            <th class="px-3 py-2 text-xs font-semibold" style="color:var(--muted)">Scenario</th>
            <th class="px-3 py-2 text-xs font-semibold text-center" style="color:var(--muted)">Blocked</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
}

async function csUnban(id) {
    if (!confirm(`Delete decision ${id} (unban IP)?`)) return;
    try {
        const res = await agentFetch(`/api/crowdsec/decisions/${id}`, {
            method: 'DELETE'
        }).then(r => r.json());
        if (res.ok) { addNotification('success', `Decision ${id} deleted`); refreshCrowdSecTab(); }
        else addNotification('error', res.error || 'Failed to delete decision');
    } catch(e) { addNotification('error', 'Request failed'); }
}

function _geoChip(cc, name) {
    if (!cc) return '';
    const flag = _flagEmoji(cc);
    const label = name || (typeof _geoNames !== 'undefined' && _geoNames[cc]) || cc;
    return `<span class="inline-flex items-center gap-1 text-xs" style="color:var(--muted)" title="${_esc(label)}">${flag ? `<span style="font-size:13px;line-height:1">${flag}</span>` : ''}<span>${_esc(label)}</span></span>`;
}
