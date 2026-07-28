let _allServices = [];
let _svcFilter = 'all';
let _protoLiveFilter = 'all';
let _providerFilter = 'all';
let _svcViewMode = tmPref('svcViewMode');

function toggleSvcView() {
    _svcViewMode = _svcViewMode === 'grid' ? 'list' : 'grid';
    tmSetPref('svcViewMode', _svcViewMode);
    const icon = document.getElementById('svcViewIcon');
    if (icon) icon.className = _svcViewMode === 'grid' ? 'ph-bold ph-list' : 'ph-bold ph-squares-four';
    renderServicesTable();
}

function _setLiveDdActive(menuId, val) {
    document.querySelectorAll('#' + menuId + ' .live-dd-item').forEach(el => {
        const oc = el.getAttribute('onclick') || '';
        el.classList.toggle('active', oc.includes("'" + val + "'"));
    });
}

function pickLiveStatus(val, label) {
    _svcFilter = val;
    document.getElementById('dd-status-label').textContent = label;
    document.getElementById('dd-status-btn').classList.toggle('active', val !== 'all');
    _setLiveDdActive('dd-status-menu', val);
    toggleLiveDd('dd-status');
    renderServicesTable();
}

function pickLiveProto(val, label) {
    _protoLiveFilter = val;
    document.getElementById('dd-proto-label').textContent = label;
    document.getElementById('dd-proto-btn').classList.toggle('active', val !== 'all');
    _setLiveDdActive('dd-proto-menu', val);
    toggleLiveDd('dd-proto');
    renderServicesTable();
}

function pickLiveProvider(val, label) {
    _providerFilter = val;
    document.getElementById('dd-provider-label').textContent = label;
    document.getElementById('dd-provider-btn').classList.toggle('active', val !== 'all');
    _setLiveDdActive('dd-provider-menu', val);
    toggleLiveDd('dd-provider');
    renderServicesTable();
}

function filterLiveProto(p) { pickLiveProto(p, p === 'all' ? 'All Protocols' : p); }
function filterLiveProvider(v) { pickLiveProvider(v, v === 'all' ? 'All Providers' : v); }

function clearLiveFilters() {
    pickLiveStatus('all', 'All Status');
    pickLiveProto('all', 'All Protocols');
    pickLiveProvider('all', 'All Providers');
    document.querySelectorAll('.live-dd-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.live-dd-btn-inner.open').forEach(b => b.classList.remove('open'));
    const s = document.getElementById('svcSearch');
    if (s) { s.value = ''; }
    renderServicesTable();
}

async function refreshLiveView() {
    const container = document.getElementById('liveContent');
    container.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-4xl block mb-3 animate-spin opacity-40"></i><p>Loading services...</p></div>`;

    try {
        const r = await agentFetch('/api/traefik/services');
        const res = await r.json();
        if (res.error) {
            container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)"><i class="ph-light ph-plug-slash text-5xl block mb-3 opacity-30"></i><p class="font-medium">Traefik API not reachable</p><p class="text-sm mt-2 font-mono px-4" style="color:var(--text-secondary);word-break:break-all">${_esc(res.error)}</p></div>`;
            return;
        }
        const http = (res.http || []).map(s => ({ ...s, _proto: 'HTTP' }));
        const tcp  = (res.tcp  || []).map(s => ({ ...s, _proto: 'TCP' }));
        const udp  = (res.udp  || []).map(s => ({ ...s, _proto: 'UDP' }));
        _allServices = [...http, ...tcp, ...udp].sort((a,b) => (a.name||'').localeCompare(b.name||''));

        if (_allServices.length === 0) {
            container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)"><i class="ph-light ph-plug-slash text-5xl block mb-3 opacity-30"></i><p class="font-medium">Traefik API not reachable</p><p class="text-sm mt-1">Set <code class="font-mono">TRAEFIK_API_URL</code> and enable <code class="font-mono">api: {}</code> in Traefik static config</p></div>`;
            return;
        }

        renderServicesTable();
    } catch(e) {
        container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)"><i class="ph-light ph-plug-slash text-5xl block mb-3 opacity-30"></i><p class="font-medium">Traefik API not reachable</p></div>`;
    }
}

function filterServices(f) {
    if (f && f !== _svcFilter) {
        const labels = { all: 'All Status', success: 'Success', warning: 'Warnings', error: 'Errors' };
        pickLiveStatus(f, labels[f] || f);
        return;
    }
    renderServicesTable();
}

function renderServicesTable() {
    const search = (document.getElementById('svcSearch')?.value || '').toLowerCase();
    const statusOf = s => {
        const st = (s.status || '').toLowerCase();
        if (st === 'enabled') return 'success';
        if (st === 'disabled' || st === 'error') return 'error';
        return 'warning';
    };
    const providerOf = s => {
        const name = s.name || '';
        const parts = name.split('@');
        return parts.length > 1 ? parts[parts.length-1] : 'file';
    };

    const uniqueProtos = [...new Set(_allServices.map(s => s._proto).filter(Boolean))].sort();
    const uniqueProviders = [...new Set(_allServices.map(providerOf))].sort();
    const protoMenu = document.getElementById('dd-proto-menu');
    if (protoMenu) {
        protoMenu.innerHTML = ['all', ...uniqueProtos].map(p => {
            const label = p === 'all' ? 'All Protocols' : p;
            return `<button class="live-dd-item${_protoLiveFilter === p ? ' active' : ''}" onclick="pickLiveProto('${p}','${label}')">${label}</button>`;
        }).join('');
    }
    const provMenu = document.getElementById('dd-provider-menu');
    if (provMenu) {
        provMenu.innerHTML = ['all', ...uniqueProviders].map(v => {
            const label = v === 'all' ? 'All Providers' : v;
            return `<button class="live-dd-item${_providerFilter === v ? ' active' : ''}" onclick="pickLiveProvider('${v}','${label}')">${label}</button>`;
        }).join('');
    }

    let items = [];
    for (let i = 0; i < _allServices.length; i++) {
        const s = _allServices[i];
        if (_svcFilter !== 'all' && statusOf(s) !== _svcFilter) continue;
        if (_protoLiveFilter !== 'all' && s._proto !== _protoLiveFilter) continue;
        if (_providerFilter !== 'all' && providerOf(s) !== _providerFilter) continue;
        if (search && !(s.name||'').toLowerCase().includes(search)) continue;
        items.push({s, globalIdx: i});
    }

    const typeOf = s => {
        if (s.loadBalancer) return 'loadbalancer';
        if (s.mirroring)    return 'mirroring';
        if (s.failover)     return 'failover';
        if (s.weighted)     return 'weighted';
        return null;
    };

    const cards = items.map(({s, globalIdx}) => {
        const proto     = s._proto || 'HTTP';
        const name      = (s.name || '').split('@')[0];
        const provider  = providerOf(s);
        const type      = typeOf(s);
        const st        = statusOf(s);

        const stColor = st === 'success' ? 'var(--green)' : st === 'error' ? 'var(--red)' : 'var(--yellow)';
        const stLabel = st === 'success' ? 'Success'      : st === 'error' ? 'Error'      : 'Warning';

        // Server health from serverStatus map (Traefik API)
        const serverStatus  = s.serverStatus || {};
        const serverEntries = Object.entries(serverStatus);
        const activeCount   = serverEntries.filter(([,v]) => (v||'').toLowerCase() === 'up').length;
        const serverSummary = serverEntries.length > 0 ? `${activeCount}/${serverEntries.length} active` : null;
        const srvColor      = serverEntries.length > 0 && activeCount === serverEntries.length ? 'var(--green)' : 'var(--orange)';

        // Used-by router chips
        const usedBy = s.usedBy || [];
        const usedByHtml = usedBy.length > 0 ? `
            <div class="svc-card-usedby">
                ${usedBy.slice(0, 3).map(r => {
                    const rName = r.includes('@') ? r.split('@')[0] : r;
                    return `<span class="svc-used-chip"><i class="ph-bold ph-git-branch" style="font-size:9px"></i>${_esc(rName)}</span>`;
                }).join('')}
                ${usedBy.length > 3 ? `<span class="svc-used-chip">+${usedBy.length - 3}</span>` : ''}
            </div>` : '';

        return `
        <div class="card svc-card" onclick="openSvcDetail(${globalIdx})">
            <div class="svc-card-header">
                <div class="flex items-center gap-1.5">
                    <span class="badge badge-${proto.toLowerCase()}" style="font-size:9px">${proto}</span>
                    ${type ? `<span class="svc-type-badge">${type}</span>` : ''}
                </div>
                <span class="svc-status-chip" style="color:${stColor};background:color-mix(in srgb,${stColor} 12%,transparent);border-color:color-mix(in srgb,${stColor} 35%,transparent)">
                    <span class="svc-status-dot" style="background:${stColor}"></span>${stLabel}
                </span>
            </div>
            <div class="svc-card-name">${_esc(name)}</div>
            <div class="svc-card-meta">
                <span class="svc-meta-chip"><i class="ph-bold ph-database" style="font-size:10px"></i>${_esc(provider)}</span>
                ${serverSummary ? `<span class="svc-meta-chip" style="color:${srvColor};background:color-mix(in srgb,${srvColor} 10%,transparent);border-color:color-mix(in srgb,${srvColor} 35%,transparent)"><i class="ph-bold ph-server" style="font-size:10px"></i>${serverSummary}</span>` : ''}
            </div>
            ${usedByHtml}
        </div>`;
    }).join('');

    const empty = items.length === 0
        ? `<div class="text-center py-12" style="color:var(--muted)">No services match filter</div>`
        : '';

    if (_svcViewMode === 'list') {
        const rows = items.map(({s, globalIdx}) => {
            const proto     = s._proto || 'HTTP';
            const name      = (s.name || '').split('@')[0];
            const provider  = providerOf(s);
            const type      = typeOf(s);
            const st        = statusOf(s);
            const stColor   = st === 'success' ? 'var(--green)' : st === 'error' ? 'var(--red)' : 'var(--yellow)';
            const serverStatus  = s.serverStatus || {};
            const serverEntries = Object.entries(serverStatus);
            const activeCount   = serverEntries.filter(([,v]) => (v||'').toLowerCase() === 'up').length;
            const serverSummary = serverEntries.length > 0 ? `${activeCount}/${serverEntries.length}` : null;
            const srvColor      = serverEntries.length > 0 && activeCount === serverEntries.length ? 'var(--green)' : 'var(--orange)';
            const usedBy        = s.usedBy || [];
            const lbServers     = (s.loadBalancer?.servers || []);
            const serverUrls    = lbServers.length > 0
                ? lbServers
                : serverEntries.map(([url]) => ({ url }));
            const serverUrlHtml = serverUrls.length > 0
                ? `<div style="display:flex;flex-direction:column;gap:2px">${serverUrls.map(sv => {
                    const url = sv.url || sv.address || '';
                    const isUp = (serverStatus[url] || '').toLowerCase() === 'up';
                    const isDown = serverStatus[url] && !isUp;
                    const color = isDown ? 'var(--red)' : 'var(--green)';
                    return `<span class="text-xs font-mono truncate" style="color:${color}" title="${_esc(url)}">${_esc(url)}</span>`;
                }).join('')}</div>`
                : '<span style="color:var(--muted);font-size:11px">-</span>';
            return `<div class="svc-list-row" onclick="openSvcDetail(${globalIdx})">
                <div class="svc-list-col-status"><span class="svc-status-dot" style="background:${stColor}"></span></div>
                <div class="svc-list-col-proto">
                    <span class="badge badge-${proto.toLowerCase()}" style="font-size:9px">${proto}</span>
                    ${type ? `<span class="svc-type-badge">${type}</span>` : ''}
                </div>
                <div class="svc-list-col-name">${_esc(name)}</div>
                <div class="svc-list-col-url overflow-hidden">${serverUrlHtml}</div>
                <div class="svc-list-col-provider"><span class="svc-meta-chip"><i class="ph-bold ph-database" style="font-size:10px"></i>${_esc(provider)}</span></div>
                <div class="svc-list-col-servers">${serverSummary ? `<span class="svc-meta-chip" style="color:${srvColor};background:color-mix(in srgb,${srvColor} 10%,transparent);border-color:color-mix(in srgb,${srvColor} 35%,transparent)"><i class="ph-bold ph-server" style="font-size:10px"></i>${serverSummary}</span>` : '<span style="color:var(--muted);font-size:11px">-</span>'}</div>
                <div class="svc-list-col-usedby">${usedBy.length > 0 ? `<span class="svc-used-chip"><i class="ph-bold ph-git-branch" style="font-size:9px"></i>${usedBy.length}</span>` : '<span style="color:var(--muted);font-size:11px">-</span>'}</div>
            </div>`;
        }).join('');
        const header = `<div class="svc-list-header">
            <div class="svc-list-col-status"></div>
            <div class="svc-list-col-proto">Protocol</div>
            <div class="svc-list-col-name">Name</div>
            <div class="svc-list-col-url">Backend URL</div>
            <div class="svc-list-col-provider">Provider</div>
            <div class="svc-list-col-servers">Servers</div>
            <div class="svc-list-col-usedby">Used By</div>
        </div>`;
        document.getElementById('liveContent').innerHTML = `<div class="svc-list">${header}${rows}${empty}</div>`;
    } else {
        document.getElementById('liveContent').innerHTML = `<div class="svc-card-grid">${cards}${empty}</div>`;
    }

    document.getElementById('svcTabCount').textContent = _allServices.filter(s => s._proto === 'HTTP').length;
}

function openSvcDetail(idx) {
    const s = _allServices[idx];
    if (!s) return;

    const panel   = document.getElementById('svcDetailPanel');
    const backdrop = document.getElementById('svcDetailBackdrop');
    const body    = document.getElementById('svcDetailBody');

    
    const proto = s._proto || 'HTTP';
    document.getElementById('svcDetailProtoBadge').className = `badge badge-${proto.toLowerCase()}`;
    document.getElementById('svcDetailProtoBadge').textContent = proto;
    document.getElementById('svcDetailTitle').textContent = (s.name || '').split('@')[0];

    const provider = (s.name || '').includes('@') ? s.name.split('@').pop() : 'file';
    const type = s.loadBalancer ? 'loadbalancer' : s.mirroring ? 'mirroring' : s.weighted ? 'weighted' : s.failover ? 'failover' : '-';
    const status = s.status || 'unknown';
    const statusBadge = status === 'enabled'
        ? `<span class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-green-500"></span><span class="text-green-400">Success</span></span>`
        : status === 'disabled' || status === 'error'
        ? `<span class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-red-500"></span><span class="text-red-400">Error</span></span>`
        : `<span class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-yellow-500"></span><span class="text-yellow-400">Warning</span></span>`;

    const lb = s.loadBalancer || {};
    const servers = lb.servers || [];
    const passHostHeader = lb.passHostHeader !== undefined ? String(lb.passHostHeader) : 'true';

    
    const serversHtml = servers.length > 0 ? `
        <table class="w-full text-left mt-2">
            <thead style="background:var(--card)">
                <tr>
                    <th class="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style="color:var(--muted)">Status</th>
                    <th class="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style="color:var(--muted)">URL</th>
                </tr>
            </thead>
            <tbody>
                ${servers.map(sv => `
                <tr style="border-top:1px solid var(--border)">
                    <td class="px-3 py-2.5">
                        <span class="flex items-center gap-1.5"><span class="inline-block w-2 h-2 rounded-full bg-green-500"></span><span class="text-green-400 text-xs">Active</span></span>
                    </td>
                    <td class="px-3 py-2.5 font-mono text-xs break-all" style="color:var(--text)">${_esc(sv.url || sv.address || '-')}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : `<div class="text-xs mt-2" style="color:var(--muted)">No servers configured</div>`;

    
    const usedBy = s.usedBy || [];
    const usedByHtml = usedBy.length > 0
        ? usedBy.map(r => `<span class="badge badge-muted mr-1 mb-1">${_esc(r)}</span>`).join('')
        : `<span class="text-xs" style="color:var(--muted)">-</span>`;

    const kv = (label, val, isHtml = false) => `
        <div class="flex items-start py-2.5" style="border-bottom:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wider w-40 shrink-0 pt-0.5" style="color:var(--muted)">${label}</div>
            <div class="text-sm ${isHtml ? '' : 'font-mono'} flex-1" style="color:var(--text)">${isHtml ? val : val}</div>
        </div>`;

    body.innerHTML = `
        
        <div class="mb-5">
            <div class="flex items-center gap-2 mb-3">
                <i class="ph-bold ph-info" style="color:var(--blue)"></i>
                <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--muted)">Service Details</span>
            </div>
            <div class="card p-0 overflow-hidden">
                <div class="px-4">
                    ${kv('Type', type)}
                    ${kv('Provider', `<span class="badge badge-muted">${provider}</span>`, true)}
                    ${kv('Status', statusBadge, true)}
                    ${kv('Pass Host Header', `<span class="badge ${passHostHeader === 'true' ? 'badge-green' : 'badge-red'}">${passHostHeader === 'true' ? 'True' : 'False'}</span>`, true)}
                </div>
            </div>
        </div>

        
        <div class="mb-5">
            <div class="flex items-center gap-2 mb-3">
                <i class="ph-bold ph-globe" style="color:var(--green)"></i>
                <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--muted)">Servers</span>
                <span class="badge badge-muted">${servers.length}</span>
            </div>
            <div class="card p-0 overflow-hidden">${serversHtml}</div>
        </div>

        
        <div class="mb-5">
            <div class="flex items-center gap-2 mb-3">
                <i class="ph-bold ph-git-branch" style="color:var(--purple)"></i>
                <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--muted)">Used by Routers</span>
            </div>
            <div class="card px-4 py-3">${usedByHtml}</div>
        </div>`;

    backdrop.classList.add('open');
    panel.classList.add('open');
}

function closeSvcDetail() {
    document.getElementById('svcDetailPanel').classList.remove('open');
    document.getElementById('svcDetailBackdrop').classList.remove('open');
}
