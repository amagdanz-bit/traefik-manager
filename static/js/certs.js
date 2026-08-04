let _allCerts   = [];

function filterCerts() { renderCertCards(); }

function renderCertCards() {
    const q   = (document.getElementById('certsSearch')?.value || '').toLowerCase();
    const now = Date.now();
    const items = _allCerts.filter(cert =>
        !q || (cert.main||'').toLowerCase().includes(q) || (cert.sans||[]).some(d => d.toLowerCase().includes(q))
    );
    if (items.length === 0) {
        document.getElementById('certsContent').innerHTML =
            `<div class="text-center py-12 rounded-xl" style="color:var(--muted);border:1px solid var(--border)">No certificates match your search</div>`;
        return;
    }
    const cards = items.map(cert => {
        const main     = cert.main || 'Unknown';
        const sans     = cert.sans || [];
        const resolver = cert.resolver || '-';
        let daysLeft = null, expiryStr = '-';
        if (cert.not_after) {
            const expiry = new Date(cert.not_after);
            if (!isNaN(expiry)) {
                daysLeft  = Math.ceil((expiry - now) / 86400000);
                expiryStr = expiry.toLocaleDateString();
            }
        }
        const expiryColor = daysLeft === null ? 'var(--muted)' : daysLeft < 7 ? 'var(--red)' : daysLeft < 30 ? 'var(--yellow)' : 'var(--green)';
        const expiryBadge = daysLeft !== null
            ? `<span class="badge" style="background:${daysLeft<7?'rgba(248,81,73,0.15)':daysLeft<30?'rgba(210,153,34,0.15)':'rgba(63,185,80,0.15)'};color:${expiryColor};border-color:${expiryColor}40">${daysLeft}d left</span>`
            : '';
        if (_tmModern()) {
            const extra = sans.filter(d => d !== main);
            const vals = extra.slice(0, 2).map(d =>
                `<div class="tm-val tm-val-host"><i class="ph-bold ph-globe-simple"></i><span class="tm-v">${_esc(d)}</span>${_tmCopy(d)}</div>`).join('')
                + (extra.length > 2 ? `<div class="tm-val"><i class="ph-bold ph-dot" style="opacity:0"></i><span class="tm-more" title="${_esc(extra.join(', '))}">+${extra.length - 2} more</span></div>` : '');
            return `<div class="tm-card tm-card-flat"${daysLeft !== null && daysLeft < 7 ? ' data-health="down"' : ''} style="--tm-accent:${expiryColor}">
                <div class="tm-head">
                    <span class="tm-ic tm-ic-tile"><i class="ph-bold ph-certificate"></i></span>
                    <div class="tm-head-txt">
                        <div class="tm-title"><span class="tm-name">${_esc(main)}</span></div>
                        <div class="tm-sub">${_esc(resolver)}</div>
                    </div>
                </div>
                ${vals ? `<div class="tm-vals">${vals}</div>` : ''}
                <div class="tm-foot"><span class="tm-meta">expires ${_esc(expiryStr)}${extra.length ? ` · ${extra.length + 1} domains` : ''}</span>${daysLeft !== null ? `<span class="tm-cf" style="color:${expiryColor}">${daysLeft}d left</span>` : ''}</div>
            </div>`;
        }
        return `<div class="card p-4">
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="ph-bold ph-shield-check text-sm shrink-0" style="color:var(--green)"></i>
                    <span class="font-bold text-sm truncate" style="color:var(--text)" title="${_esc(main)}">${_esc(main)}</span>
                </div>
                ${expiryBadge}
            </div>
            ${sans.length ? `<div class="flex flex-wrap gap-1 mb-3">${sans.map(d=>`<span class="badge badge-muted" style="font-size:9px">${_esc(d)}</span>`).join('')}</div>` : ''}
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div><span style="color:var(--muted)">Resolver</span><div class="font-mono mt-0.5" style="color:var(--text)">${_esc(resolver)}</div></div>
                <div><span style="color:var(--muted)">Expires</span><div class="font-mono mt-0.5" style="color:${expiryColor}">${expiryStr}</div></div>
            </div>
        </div>`;
    }).join('');
    document.getElementById('certsContent').innerHTML =
        `<div class="${_tmModern() ? 'tm-card-grid' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}">${cards}</div>`;
}

async function refreshCertsTab() {
    const container = document.getElementById('certsContent');
    container.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-4xl block mb-3 animate-spin opacity-40"></i><p>Loading certificates...</p></div>`;
    try {
        const res  = await agentFetch('/api/traefik/certs').then(r => r.json());
        const certs = Array.isArray(res.certs) ? res.certs : [];

        if (res.error && certs.length === 0) {
            container.innerHTML = _emptyMountState({
                icon: 'ph-shield',
                title: 'acme.json not mounted',
                description: 'Mount your Traefik <code class="font-mono" style="color:var(--blue)">acme.json</code> into this container read-only to view and track your TLS certificates.',
                steps: [
                    { label: 'Add this volume to the <code class="font-mono">traefik-manager</code> service in your <code class="font-mono">docker-compose.yml</code>:',
                      code: '- /path/to/traefik/acme.json:/app/acme.json:ro' },
                ],
                note: 'No Traefik restart needed - only traefik-manager needs to be updated.'
            });
            document.getElementById('certsTabCount').textContent = '0';
            return;
        }

        if (certs.length === 0) {
            container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)">
                <i class="ph-light ph-shield text-5xl block mb-3 opacity-30"></i>
                <p class="font-medium">No certificates found</p>
                <p class="text-xs mt-1">acme.json may be empty - certs are issued on first request.</p>
            </div>`;
            document.getElementById('certsTabCount').textContent = '0';
            return;
        }

        _allCerts = certs;
        document.getElementById('certsTabCount').textContent = certs.length;
        renderCertCards();
    } catch(e) {
        container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)"><i class="ph-light ph-plug-slash text-5xl block mb-3 opacity-30"></i><p>Could not load certificate data</p></div>`;
    }
}

let _tlsOptions = [];

async function refreshTlsOptionsTab() {
    const el = document.getElementById('tlsOptsContent');
    if (!el) return;
    el.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-4xl block mb-3 animate-spin opacity-40"></i><p>Loading TLS profiles...</p></div>`;
    try {
        const res = await fetch('/api/tls-options');
        _tlsOptions = await res.json();
        renderTlsOptions(_tlsOptions);
    } catch(e) {
        el.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-bold ph-warning text-3xl block mb-2"></i><p>Failed to load TLS profiles</p></div>`;
    }
}

function filterTlsOptions() {
    const q = (document.getElementById('tlsOptsSearch')?.value || '').toLowerCase();
    renderTlsOptions(_tlsOptions.filter(o => o.name.toLowerCase().includes(q)));
}

function _tlsVer(v) {
    return String(v).replace(/^VersionTLS(\d)(\d)$/, 'TLS $1.$2');
}

function _tmTlsOptCard(o, i, cfShow) {
    const mtls = o.clientAuthType && o.clientAuthType !== 'NoClientCert';
    const sub = [
        o.minVersion ? _tlsVer(o.minVersion) + '+' : '',
        o.maxVersion ? 'max ' + _tlsVer(o.maxVersion) : '',
        o.sniStrict ? 'SNI strict' : '',
        mtls ? 'mTLS' : '',
    ].filter(Boolean).join(' \u00b7 ') || 'defaults';

    const val = (icon, text, title) => `<div class="tm-val"><i class="ph-bold ${icon}"></i><span class="tm-v" title="${_esc(title || text)}">${_esc(text)}</span></div>`;
    const vals = [
        o.cipherSuites?.length ? val('ph-list-numbers', `${o.cipherSuites.length} cipher suite${o.cipherSuites.length > 1 ? 's' : ''}`, o.cipherSuites.join('\n')) : '',
        o.curvePreferences?.length ? val('ph-circle-notch', o.curvePreferences.join(', ')) : '',
        o.alpnProtocols?.length ? val('ph-swap', o.alpnProtocols.join(', ')) : '',
        mtls ? val('ph-identification-card', o.clientAuthType) : '',
    ].filter(Boolean).join('');

    const rail = `<span class="tm-rail" onclick="event.stopPropagation()">` +
        `<button type="button" class="tm-btn" title="Details" data-idx="${i}" onclick="event.stopPropagation();_tlsOptInfo(this)"><i class="ph-bold ph-info"></i></button>` +
        `<button type="button" class="tm-btn" title="Edit" data-idx="${i}" onclick="event.stopPropagation();_tlsOptEdit(this)"><i class="ph-bold ph-pencil-simple"></i></button>` +
        `<button type="button" class="tm-btn" title="Delete" onclick="event.stopPropagation();deleteTlsOption('${_esc(o.name)}','${_esc(o.configFile || '')}')"><i class="ph-bold ph-trash"></i></button>` +
        '</span>';

    return `<div class="tm-card tls-opt-card" data-name="${_esc(o.name.toLowerCase())}" data-idx="${i}" style="--tm-accent:var(--green)" onclick="openTlsOptDetail(_tlsOptions[${i}])">
        <div class="tm-head">
            <span class="tm-ic tm-ic-tile"><i class="ph-bold ph-lock-key"></i></span>
            <div class="tm-head-txt">
                <div class="tm-title"><span class="tm-name">${_esc(o.name)}</span></div>
                <div class="tm-sub">${_esc(sub)}</div>
            </div>${rail}
        </div>
        ${vals ? `<div class="tm-vals">${vals}</div>` : ''}
        <div class="tm-foot"><span class="tm-meta">${_tmTlsOptUsage(o)}</span>${cfShow ? _tmCf(o.configFile) : ''}</div>
    </div>`;
}

function _tmTlsOptUsage(o) {
    const pool = window._lastRenderedApps || (typeof APP_DATA !== 'undefined' ? APP_DATA : []) || [];
    const n = pool.filter(r => r.tlsOptionsProfile === o.name).length;
    return n ? `used by ${n} route${n > 1 ? 's' : ''}` : 'unused';
}

function renderTlsOptions(opts) {
    const el = document.getElementById('tlsOptsContent');
    if (!el) return;
    if (!opts || opts.length === 0) {
        el.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-lock-key text-4xl block mb-3 opacity-30"></i><p class="text-sm">No TLS profiles defined.</p><p class="text-xs mt-1">Click <strong>Add TLS Profile</strong> to create one.</p></div>`;
        return;
    }
    const cfShow = new Set(opts.map(o => o.configFile).filter(Boolean)).size > 1;
    const cards = opts.map(o => {
        const i = _tlsOptions.indexOf(o);
        if (_tmModern()) return _tmTlsOptCard(o, i, cfShow);
        const cfBadge = o.configFile ? `<span class="badge badge-muted" style="font-size:9px">${_esc(o.configFile)}</span>` : '';
        const verBadge = o.minVersion ? `<span class="badge badge-green" style="font-size:9px"><i class="ph-bold ph-lock"></i> ${_esc(_tlsVer(o.minVersion))}+</span>` : '';
        const sniBadge = o.sniStrict ? `<span class="badge" style="font-size:9px;background:rgba(36,161,222,0.12);color:var(--blue);border:1px solid rgba(36,161,222,0.35)">SNI Strict</span>` : '';
        const mtlsBadge = (o.clientAuthType && o.clientAuthType !== 'NoClientCert') ? `<span class="badge badge-muted" style="font-size:9px">mTLS</span>` : '';

        const mkRow = (label, val) => `
            <div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
                <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color:var(--muted)">${label}</div>
                <div class="text-xs font-mono" style="color:var(--text)">${val}</div>
            </div>`;
        const mkListRow = (label, items) => items?.length ? `
            <div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
                <div class="text-xs font-semibold uppercase tracking-wider mb-1.5" style="color:var(--muted)">${label}</div>
                <pre class="font-mono leading-relaxed" style="color:var(--green);font-size:11px">${items.map(v => _esc(v)).join('\n')}</pre>
            </div>` : '';

        const rows = [];
        if (o.cipherSuites?.length) rows.push(mkListRow('Cipher Suites', o.cipherSuites));
        if (o.curvePreferences?.length) rows.push(mkRow('Curves', _esc(o.curvePreferences.join(', '))));
        if (o.alpnProtocols?.length) rows.push(mkRow('ALPN', _esc(o.alpnProtocols.join(', '))));
        if (o.clientAuthType && o.clientAuthType !== 'NoClientCert') rows.push(mkRow('Client Auth', _esc(o.clientAuthType)));

        return `<div class="card route-card tls-opt-card" data-name="${_esc(o.name.toLowerCase())}" data-idx="${i}">
            <div class="route-card-inner p-4 pb-2">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1.5">${verBadge}${sniBadge}${mtlsBadge}${cfBadge}</div>
                        <h3 class="font-bold text-sm font-mono truncate" style="color:var(--text)" title="${_esc(o.name)}">${_esc(o.name)}</h3>
                    </div>
                    <div class="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        <button type="button" data-idx="${i}" onclick="_tlsOptInfo(this)" class="pill-btn pill-btn-blue" title="View details"><i class="ph-bold ph-info text-xs"></i></button>
                        <button type="button" onclick="deleteTlsOption('${_esc(o.name)}','${_esc(o.configFile || '')}')" class="pill-btn pill-btn-red" title="Delete"><i class="ph-bold ph-trash text-xs"></i></button>
                        <button type="button" data-idx="${i}" onclick="_tlsOptEdit(this)" class="pill-btn pill-btn-blue" title="Edit"><i class="ph-bold ph-pencil-simple text-xs"></i></button>
                    </div>
                </div>
                <div class="space-y-2">${rows.join('')}</div>
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div class="${_tmModern() ? 'tm-card-grid' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'}">${cards}</div>`;
}

function _tlsOptEdit(btn) {
    const idx = parseInt(btn.getAttribute('data-idx'));
    openTlsOptionModal(_tlsOptions[idx]);
}

function _tlsOptInfo(btn) {
    const idx = parseInt(btn.getAttribute('data-idx'));
    openTlsOptDetail(_tlsOptions[idx]);
}

function openTlsOptDetail(o) {
    document.getElementById('tlsOptDetailTitle').textContent = o.name;
    document.getElementById('tlsOptDetailEditBtn').onclick = () => { closeTlsOptDetail(); openTlsOptionModal(o); };
    const row = (label, val) => val ? `<div class="flex gap-3 py-2.5" style="border-bottom:1px solid var(--border)"><div class="text-xs font-semibold uppercase tracking-wider w-36 flex-shrink-0 pt-0.5" style="color:var(--muted)">${label}</div><div class="text-sm font-mono break-all" style="color:var(--text)">${val}</div></div>` : '';
    const listRow = (label, items) => items?.length ? `<div class="py-2.5" style="border-bottom:1px solid var(--border)"><div class="text-xs font-semibold uppercase tracking-wider mb-2" style="color:var(--muted)">${label}</div><div class="space-y-1">${items.map(v => `<div class="text-xs font-mono px-2 py-1 rounded" style="background:var(--input-bg);color:var(--green)">${_esc(v)}</div>`).join('')}</div></div>` : '';
    const rows = [
        row('Config File',   _esc(o.configFile || '')),
        row('Min Version',   o.minVersion ? _esc(o.minVersion) : ''),
        row('Max Version',   o.maxVersion ? _esc(o.maxVersion) : ''),
        row('SNI Strict',    o.sniStrict ? 'Yes' : ''),
        listRow('Cipher Suites',    o.cipherSuites),
        listRow('Curve Preferences', o.curvePreferences),
        listRow('ALPN Protocols',   o.alpnProtocols),
        row('Client Auth Type', o.clientAuthType && o.clientAuthType !== 'NoClientCert' ? _esc(o.clientAuthType) : ''),
        listRow('CA Files', o.clientAuthCAs),
    ].filter(Boolean).join('');
    const allRoutes = window._lastRenderedApps || APP_DATA || [];
    const usedBy = allRoutes.filter(r => r.tlsOptionsProfile === o.name);
    const usedByHtml = `<div class="mt-5">
        <div class="text-xs font-semibold uppercase tracking-wider mb-2" style="color:var(--muted)">Used By</div>
        ${usedBy.length ? usedBy.map(r => `<div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--border)">
            <span class="badge badge-http" style="font-size:9px">HTTP</span>
            <span class="text-sm font-mono truncate" style="color:var(--text)">${_esc(r.name)}</span>
            ${r.configFile ? `<span class="badge badge-muted ml-auto" style="font-size:9px;flex-shrink:0">${_esc(r.configFile)}</span>` : ''}
        </div>`).join('') : `<div class="text-xs py-2" style="color:var(--muted)">No routes using this profile.</div>`}
    </div>`;
    const yamlHtml = o.yaml ? `<div class="mt-5"><button onclick="const b=this.nextElementSibling;const open=b.style.display!=='none';b.style.display=open?'none':'block';this.querySelector('i').className='ph-bold '+(open?'ph-caret-right':'ph-caret-down')+' text-xs mr-1'" class="flex items-center text-xs mb-2" style="color:var(--muted);background:none;border:none;cursor:pointer;padding:0"><i class="ph-bold ph-caret-right text-xs mr-1"></i><span class="font-semibold uppercase tracking-wider">Raw YAML</span></button><div style="display:none"><div class="rounded-lg p-4 overflow-x-auto" style="background:var(--input-bg);border:1px solid var(--border)"><pre class="text-xs font-mono leading-relaxed" style="color:var(--green)">${_esc(o.yaml)}</pre></div></div></div>` : '';
    document.getElementById('tlsOptDetailContent').innerHTML = `<div>${rows}</div>${usedByHtml}${yamlHtml}`;
    document.getElementById('tlsOptDetailPanel').classList.add('open');
    setDetailDockOpen(true);
    document.getElementById('tlsOptDetailBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeTlsOptDetail() {
    setDetailDockOpen(false);
    document.getElementById('tlsOptDetailPanel').classList.remove('open');
    document.getElementById('tlsOptDetailBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

function onTlsOptConfigFileChange(sel) {
    const newInput = document.getElementById('tlsOptNewFileName');
    if (newInput) newInput.style.display = sel.value === '__new__' ? 'block' : 'none';
}

function toggleTlsClientAuthCAs(val) {
    const row = document.getElementById('tlsClientAuthCAsRow');
    if (row) row.style.display = (val && val !== '' && val !== 'NoClientCert') ? 'block' : 'none';
}

function openTlsOptionModal(opt) {
    const modal = document.getElementById('tlsOptionsModal');
    const isEdit = !!opt;
    document.getElementById('tlsOptionsModalTitle').textContent = isEdit ? 'Edit TLS Profile' : 'Add TLS Profile';
    document.getElementById('tlsOptEditName').value    = isEdit ? (opt.name || '') : '';
    document.getElementById('tlsOptName').value        = isEdit ? (opt.name || '') : '';
    document.getElementById('tlsOptName').readOnly     = isEdit;
    document.getElementById('tlsOptMinVersion').value  = isEdit ? (opt.minVersion || '') : '';
    document.getElementById('tlsOptMaxVersion').value  = isEdit ? (opt.maxVersion || '') : '';
    document.getElementById('tlsOptSniStrict').checked = isEdit ? !!opt.sniStrict : false;
    document.getElementById('tlsOptCiphers').value     = isEdit ? (opt.cipherSuites || []).join('\n') : '';
    document.getElementById('tlsOptCurves').value      = isEdit ? (opt.curvePreferences || []).join('\n') : '';
    document.getElementById('tlsOptAlpn').value        = isEdit ? (opt.alpnProtocols || []).join('\n') : '';
    const caType = isEdit ? (opt.clientAuthType || '') : '';
    document.getElementById('tlsOptClientAuthType').value = caType;
    document.getElementById('tlsOptClientAuthCAs').value  = isEdit ? (opt.clientAuthCAs || []).join('\n') : '';
    toggleTlsClientAuthCAs(caType);
    const cfSel = document.getElementById('tlsOptConfigFileSelect');
    if (cfSel) cfSel.value = isEdit ? (opt.configFile || '') : '';
    const newFileInput = document.getElementById('tlsOptNewFileName');
    if (newFileInput) { newFileInput.style.display = 'none'; newFileInput.value = ''; }
    document.getElementById('tlsOptConfigFile').value = isEdit ? (opt.configFile || '') : '';
    modal.style.display = 'flex';
}

function closeTlsOptionModal() {
    document.getElementById('tlsOptionsModal').style.display = 'none';
}

async function saveTlsOption() {
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const name = document.getElementById('tlsOptName').value.trim();
    if (!name) { showToast('Profile name is required', 'error'); return; }
    const cfSel = document.getElementById('tlsOptConfigFileSelect');
    let configFile = cfSel ? cfSel.value : (document.getElementById('tlsOptConfigFile').value || '');
    if (configFile === '__new__') {
        const newName = (document.getElementById('tlsOptNewFileName')?.value || '').trim();
        if (!newName) { showToast('Enter a filename for the new config file', 'error'); return; }
        configFile = newName.endsWith('.yml') || newName.endsWith('.yaml') ? newName : newName + '.yml';
    }
    const toList = v => v.split('\n').map(s => s.trim()).filter(Boolean);
    const caType = document.getElementById('tlsOptClientAuthType').value;
    const body = {
        name,
        configFile,
        minVersion:        document.getElementById('tlsOptMinVersion').value,
        maxVersion:        document.getElementById('tlsOptMaxVersion').value,
        sniStrict:         document.getElementById('tlsOptSniStrict').checked,
        cipherSuites:      toList(document.getElementById('tlsOptCiphers').value),
        curvePreferences:  toList(document.getElementById('tlsOptCurves').value),
        alpnProtocols:     toList(document.getElementById('tlsOptAlpn').value),
        clientAuthType:    caType,
        clientAuthCAs:     toList(document.getElementById('tlsOptClientAuthCAs').value),
    };
    try {
        const res = await fetch('/api/tls-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', 'X-CSRF-Token': token },
            body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.ok) {
            closeTlsOptionModal();
            showToast('TLS profile saved');
            refreshTlsOptionsTab();
            _populateTlsOptionsSelect();
        } else {
            showToast(json.message || 'Save failed', 'error');
        }
    } catch(e) { showToast('Save failed', 'error'); }
}

async function deleteTlsOption(name, configFile) {
    if (!confirm(`Delete TLS profile "${name}"?`)) return;
    const token = document.querySelector('meta[name="csrf-token"]')?.content || '';
    const params = configFile ? `?configFile=${encodeURIComponent(configFile)}` : '';
    try {
        const res = await fetch(`/api/tls-options/${encodeURIComponent(name)}${params}`, {
            method: 'DELETE',
            headers: { 'X-Requested-With': 'fetch', 'X-CSRF-Token': token },
        });
        const json = await res.json();
        if (json.ok) {
            showToast('TLS profile deleted');
            refreshTlsOptionsTab();
            _populateTlsOptionsSelect();
        } else {
            showToast(json.message || 'Delete failed', 'error');
        }
    } catch(e) { showToast('Delete failed', 'error'); }
}
