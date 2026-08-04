let _rmEditingGroupIdx = -1;

function rmRenderGroupsList() {
    const list = document.getElementById('rmGroupsList');
    if (!list) return;
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const groups = _rmConfig.custom_groups || [];
    if (!groups.length) {
        list.innerHTML = `<div class="text-xs py-3 text-center" style="color:var(--muted)">No custom groups yet.</div>`;
        return;
    }
    list.innerHTML = groups.map((g, i) => {
        const color = RM_GROUP_COLORS[i % RM_GROUP_COLORS.length];
        if (_rmEditingGroupIdx === i) {
            return `<div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--border)">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
                <input type="text" id="rmGroupEditInput" class="input-field" style="flex:1;height:28px;font-size:12px" value="${esc(g.name)}" onkeydown="if(event.key==='Enter')rmSaveGroupRename(${i});else if(event.key==='Escape')rmCancelGroupEdit()">
                <button onclick="rmSaveGroupRename(${i})" class="btn-icon" style="padding:3px 6px;flex-shrink:0"><i class="ph-bold ph-check text-xs" style="color:var(--green)"></i></button>
                <button onclick="rmCancelGroupEdit()" class="btn-icon" style="padding:3px 6px;flex-shrink:0"><i class="ph-bold ph-x text-xs" style="color:var(--muted)"></i></button>
            </div>`;
        }
        return `<div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--border)">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;display:inline-block"></span>
            <span class="text-xs font-semibold" style="color:var(--text);flex:1">${esc(g.name)}</span>
            <button onclick="rmStartGroupEdit(${i})" class="btn-icon" style="padding:3px 6px;flex-shrink:0"><i class="ph-bold ph-pencil-simple text-xs" style="color:var(--muted)"></i></button>
            <button onclick="rmDeleteCustomGroup(${i})" class="btn-icon" style="padding:3px 6px;flex-shrink:0"><i class="ph-bold ph-trash text-xs" style="color:var(--muted)"></i></button>
        </div>`;
    }).join('');
    if (_rmEditingGroupIdx >= 0) {
        const input = document.getElementById('rmGroupEditInput');
        if (input) { input.focus(); input.select(); }
    }
}

window.rmOpenGroupsModal = function() {
    _rmEditingGroupIdx = -1;
    rmRenderGroupsList();
    document.getElementById('rmGroupsModal').style.display = 'flex';
};

window.rmCloseGroupsModal = function() {
    _rmEditingGroupIdx = -1;
    document.getElementById('rmGroupsModal').style.display = 'none';
};

window.rmStartGroupEdit = function(i) {
    _rmEditingGroupIdx = i;
    rmRenderGroupsList();
};

window.rmCancelGroupEdit = function() {
    _rmEditingGroupIdx = -1;
    rmRenderGroupsList();
};

window.rmSaveGroupRename = async function(i) {
    const input = document.getElementById('rmGroupEditInput');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName) return;
    const oldName = _rmConfig.custom_groups[i].name;
    _rmConfig.custom_groups[i].name = newName;
    if (oldName !== newName && _rmConfig.route_overrides) {
        Object.values(_rmConfig.route_overrides).forEach(ov => {
            if (ov.group === oldName) ov.group = newName;
        });
    }
    _rmEditingGroupIdx = -1;
    await rmSaveConfig();
    rmRenderGroupsList();
    if (window.rmInvalidateGroups) window.rmInvalidateGroups();
};

window.rmAddCustomGroup = async function() {
    const nameEl = document.getElementById('rmNewGroupName');
    const name   = nameEl.value.trim();
    if (!name) return;
    _rmConfig.custom_groups.push({ name });
    await rmSaveConfig();
    rmRenderGroupsList();
    nameEl.value = '';
    if (window.rmInvalidateGroups) window.rmInvalidateGroups();
};

window.rmDeleteCustomGroup = async function(i) {
    const removed = _rmConfig.custom_groups.splice(i, 1)[0];
    if (removed && _rmConfig.route_overrides) {
        Object.values(_rmConfig.route_overrides).forEach(ov => {
            if (ov.group === removed.name) delete ov.group;
        });
    }
    await rmSaveConfig();
    rmRenderGroupsList();
    if (window.rmInvalidateGroups) window.rmInvalidateGroups();
};

let _rmEditRouteId   = null;
let _rmEditIconType  = 'auto';

window.rmOpenEditModal = function(routeId) {
    _rmEditRouteId = routeId;
    const ov = (_rmConfig.route_overrides || {})[routeId] || {};

    document.getElementById('rmEditDisplayName').value = ov.display_name || '';
    document.getElementById('rmEditUrl').value = ov.url || '';
    document.getElementById('rmEditLinkDisabled').checked = !!ov.link_disabled;

    _rmEditIconType = ov.icon_type || 'auto';
    document.getElementById('rmEditIconSlug').value = ov.icon_slug || '';
    document.getElementById('rmEditIconUrl').value  = ov.icon_url  || '';
    rmEditSetIconType(_rmEditIconType);

    const sel = document.getElementById('rmEditGroup');
    sel.innerHTML = '<option value="">Auto-detect</option>';
    const allGroups = [
        ...(_rmConfig.custom_groups || []).map(g => g.name),
        ...['Media','Monitoring','Infrastructure','Security','Home','Files & Data','Network','Dev','Servers','Other']
    ];
    allGroups.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        opt.selected = (ov.group || '') === name;
        sel.appendChild(opt);
    });

    document.getElementById('rmEditModal').style.display = 'flex';
};

window.rmCloseEditModal = function() {
    document.getElementById('rmEditModal').style.display = 'none';
    _rmEditRouteId = null;
};

window.rmEditSetIconType = function(type) {
    _rmEditIconType = type;
    ['auto','slug','url'].forEach(t => {
        document.getElementById(`rmEditIconBtn${t.charAt(0).toUpperCase()+t.slice(1)}`).classList.toggle('active', t === type);
    });
    document.getElementById('rmEditIconSlugRow').style.display = type === 'slug' ? 'block' : 'none';
    document.getElementById('rmEditIconUrlRow').style.display  = type === 'url'  ? 'block' : 'none';
    rmEditPreviewIcon();
};

window.rmEditPreviewIcon = function() {
    const prev  = document.getElementById('rmEditIconPreview');
    const label = document.getElementById('rmEditIconPreviewLabel');
    let url = '';
    if (_rmEditIconType === 'slug') {
        const slug = document.getElementById('rmEditIconSlug').value.trim();
        if (slug) url = `${RM_ICON_CDN}/${slug}.png`;
    } else if (_rmEditIconType === 'url') {
        url = document.getElementById('rmEditIconUrl').value.trim();
    } else if (_rmEditRouteId) {
        let s = _rmEditRouteId.split('@')[0].replace(/:\d+$/, '').replace(/[-_](?:service|svc|router|app|container|pod)s?$/i, '');
        url = `${RM_ICON_CDN}/${s.toLowerCase().replace(/[^a-z0-9-]/g, '')}.png`;
    }
    if (url) {
        prev.src = url;
        prev.style.display = 'block';
        label.textContent  = _rmEditIconType === 'auto' ? 'Auto-detected' : '';
        prev.onerror = () => { prev.style.display = 'none'; label.textContent = 'No icon found'; };
    } else {
        prev.style.display = 'none';
        label.textContent  = '';
    }
};

window.rmSaveRouteEdit = async function() {
    if (!_rmEditRouteId) return;
    if (!_rmConfig.route_overrides) _rmConfig.route_overrides = {};
    const ov = {};
    const dn = document.getElementById('rmEditDisplayName').value.trim();
    if (dn) ov.display_name = dn;
    ov.icon_type = _rmEditIconType;
    if (_rmEditIconType === 'slug') ov.icon_slug = document.getElementById('rmEditIconSlug').value.trim();
    if (_rmEditIconType === 'url')  ov.icon_url  = document.getElementById('rmEditIconUrl').value.trim();
    const grp = document.getElementById('rmEditGroup').value;
    if (grp) ov.group = grp;
    const linkUrl = document.getElementById('rmEditUrl').value.trim();
    if (linkUrl) ov.url = linkUrl;
    if (document.getElementById('rmEditLinkDisabled').checked) ov.link_disabled = true;
    _rmConfig.route_overrides[_rmEditRouteId] = ov;
    await rmSaveConfig();
    rmCloseEditModal();
    if (window.rmInvalidateGroups) window.rmInvalidateGroups();
};

(function() {

const POD_RULES = [
    { name: 'Media',          icon: 'ph-film-strip',          color: '#24a1de', keywords: ['plex','jellyfin','emby','navidrome','kavita','komga','audiobookshelf','sonarr','radarr','lidarr','readarr','whisparr','prowlarr','qbittorrent','transmission','deluge','sabnzbd','nzbget','bazarr','tautulli','overseerr','requestrr','immich','photoprism','pigallery','damselfly'] },
    { name: 'Monitoring',     icon: 'ph-chart-line-up',       color: '#e2c041', keywords: ['grafana','prometheus','alertmanager','loki','uptime','kuma','glances','netdata','zabbix','influx','telegraf','speedtest','myspeed','healthchecks','statping','gatus','scrutiny'] },
    { name: 'Infrastructure', icon: 'ph-wrench',              color: '#8b949e', keywords: ['traefik','portainer','proxmox','cockpit','nginx','caddy','haproxy','watchtower','dozzle','komodo','flint','gitea','gitlab','forgejo','drone','jenkins','vault','consul','nomad','ansible','terraform','penpot','n8n','windmill'] },
    { name: 'Security',       icon: 'ph-shield-check',        color: '#3fb950', keywords: ['authentik','authelia','vaultwarden','bitwarden','crowdsec','fail2ban','wireguard','vpn','keycloak','zitadel','casdoor','lldap','kanidm'] },
    { name: 'Home',           icon: 'ph-house',               color: '#a371f7', keywords: ['homeassistant','home-assistant','nodered','node-red','esphome','zigbee2mqtt','z2m','frigate','scrypted','wyze','tuya','matter','openhabing'] },
    { name: 'Files & Data',   icon: 'ph-folder-open',         color: '#39d353', keywords: ['nextcloud','seafile','filebrowser','syncthing','paperless','mealie','tandoor','grocy','bookstack','wiki','notion','obsidian','miniflux','freshrss','wallabag','linkding','shlink'] },
    { name: 'Network',        icon: 'ph-network',             color: '#58a6ff', keywords: ['pihole','adguard','unifi','technitium','bind','nginx-proxy','ddclient','cloudflare','tailscale','zerotier','headscale','netbird'] },
    { name: 'Dev',            icon: 'ph-code',                color: '#f0883e', keywords: ['gitea','gitlab','forgejo','github','gogs','drone','jenkins','argocd','harbor','registry','sonar','nexus','artifactory','semaphore','woodpecker','act','renovate','dependabot','code-server','coder','vscode','jupyter','jupyterlab','mlflow','airflow','prefect','dagster'] },
    { name: 'Servers',        icon: 'ph-desktop-tower',       color: '#79c0ff', keywords: ['proxmox','cockpit','idrac','ilo','ipmi','esxi','xcp','xen','hyperv','kvm','pve','unraid','truenas','freenas','opnsense','pfsense','mikrotik','synology','qnap','asustor'] },
];

const INFRA_MW_PATTERNS = ['redirect','https','hsts','www','scheme','compress','gzip','secure','force-https','http-to-https','local-ip','buffering','retry','error'];

function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function rmIsInfraMw(name) {
    const n = name.toLowerCase().split('@')[0];
    return INFRA_MW_PATTERNS.some(p => n.includes(p));
}

function rmIconSlug(route) {
    let s = (route.service_name || route.name || '').split('@')[0];
    s = s.replace(/:\d+$/, '');
    s = s.replace(/[-_](?:service|svc|router|app|container|pod)s?$/i, '');
    return s.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function rmGetIconUrl(route) {
    const ov = (_rmConfig.route_overrides || {})[route.id] || {};
    if (ov.icon_type === 'url' && ov.icon_url)   return ov.icon_url;
    if (ov.icon_type === 'slug' && ov.icon_slug) return `${RM_ICON_CDN}/${ov.icon_slug}.png`;
    const tmName = (_rmConfig.tm_route_name || 'traefik-manager').toLowerCase();
    if ((route.name || '').toLowerCase() === tmName) return '/static/icons/icon.png';
    return `${RM_ICON_CDN}/${rmIconSlug(route)}.png`;
}

function rmGetPod(route) {
    const ov = (_rmConfig.route_overrides || {})[route.id] || {};
    if (ov.group) {
        const custom = window.rmGetCustomGroups();
        const ci = custom.findIndex(g => g.name === ov.group);
        if (ci >= 0) return { name: custom[ci].name, icon: 'ph-tag', color: RM_GROUP_COLORS[ci % RM_GROUP_COLORS.length] };
        const bi = POD_RULES.find(p => p.name === ov.group);
        if (bi) return bi;
    }
    const n = (route.name || '').toLowerCase().replace(/[-_]/g,'');
    const s = (route.service_name || '').toLowerCase().replace(/[-_]/g,'');
    for (const pod of POD_RULES) {
        if (pod.keywords.some(k => n.includes(k.replace(/[-_]/g,'')) || s.includes(k.replace(/[-_]/g,'')))) {
            return pod;
        }
    }
    return { name: 'Other', icon: 'ph-squares-four', color: '#8b949e' };
}

function rmGetSecurity(route) {
    if (route.tls || route.certResolver) return 'secure';
    const eps = route.entryPoints || [];
    const lowerEps = eps.map(e => e.toLowerCase());
    if (lowerEps.some(e => e === 'web' || e === 'http' || e === 'http80' || e === 'websecure' === false)) {
        if (!lowerEps.some(e => e.includes('secure') || e.includes('https') || e.includes('443'))) {
            return 'public';
        }
    }
    if (lowerEps.some(e => e.includes('secure') || e.includes('https') || e.includes('443'))) return 'secure';
    if (lowerEps.some(e => e === 'web' || e.includes('80'))) return 'public';
    return 'internal';
}

let _dashProto    = 'all';
let _dashProvider = 'all';
let _dashSearch   = '';
let _dashDrawn    = false;

function _dashFilteredRoutes() {
    return _rmAllRoutes.filter(r => {
        if (r.enabled === false) return false;
        if (_dashProto !== 'all' && r.protocol !== _dashProto) return false;
        if (_dashProvider !== 'all' && (r.provider || 'file') !== _dashProvider) return false;
        if (_dashSearch && !(r.name||'').toLowerCase().includes(_dashSearch)) return false;
        return true;
    });
}

window.dashFilterProvider = function(p) {
    _dashProvider = p;
    document.querySelectorAll('#dashProviderFilters .proto-btn').forEach(b => b.classList.remove('active-http'));
    const btn = document.getElementById('dashpf-' + p);
    if (btn) btn.classList.add('active-http');
    dashRender();
};

function dashRenderProviderFilters() {
    const providers = [...new Set(_rmAllRoutes.map(r => r.provider || 'file'))].sort();
    const container = document.getElementById('dashProviderFilters');
    if (!container) return;
    if (providers.length <= 1) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    container.innerHTML = '';
    ['all', ...providers].forEach(p => {
        const btn = document.createElement('button');
        btn.id = 'dashpf-' + p;
        btn.className = 'proto-btn text-xs px-3 py-1.5' + (p === _dashProvider ? ' active-http' : '');
        btn.textContent = p === 'all' ? 'All' : p;
        btn.onclick = () => window.dashFilterProvider(p);
        container.appendChild(btn);
    });
}

window.refreshDashboardTab = async function() {
    if (!_dashDrawn) {
        document.getElementById('dashLoading').classList.remove('hidden');
        document.getElementById('dashPodsContainer').classList.add('hidden');
        document.getElementById('dashEmpty').classList.add('hidden');
    }

    const ok = await window.rmEnsureData();

    document.getElementById('dashLoading').classList.add('hidden');
    if (!ok) {
        if (!_dashDrawn) showToast('Could not load dashboard data. Retrying on next open.', 'error');
        return;
    }
    _dashDrawn = true;
    dashRenderProviderFilters();
    dashRender();
};

window.dashFilterProto = function(proto) {
    _dashProto = proto;
    document.querySelectorAll('#tab-dashboard .proto-btn').forEach(b => b.classList.remove('active-http'));
    document.getElementById('dashf-' + proto).classList.add('active-http');
    dashRender();
};

window.dashApplyFilter = function() {
    _dashSearch = document.getElementById('dashSearch').value.toLowerCase();
    dashRender();
};

function dashRender() {
    const routes = _dashFilteredRoutes();
    const pods   = document.getElementById('dashPodsContainer');
    const empty  = document.getElementById('dashEmpty');

    if (!routes.length) {
        pods.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    pods.classList.remove('hidden');
    dashRenderPods(routes);
}

function dashRenderPods(routes) {
    const grid = document.getElementById('dashPodsGrid');
    grid.innerHTML = '';

    const podMap = new Map();
    routes.forEach(r => {
        const pod = rmGetPod(r);
        if (!podMap.has(pod.name)) podMap.set(pod.name, { meta: pod, routes: [] });
        podMap.get(pod.name).routes.push(r);
    });

    const sortedPods = [...podMap.values()].sort((a, b) => {
        const ai = POD_RULES.findIndex(p => p.name === a.meta.name);
        const bi = POD_RULES.findIndex(p => p.name === b.meta.name);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });

    sortedPods.forEach(({ meta, routes: podRoutes }) => {
        grid.appendChild(dashBuildPod(meta, podRoutes));
    });

}

const DASH_POD_LIMIT = 5;
const DASH_ICON_LIMIT = 25;

function dashPodDensity() {
    return typeof tmPref === 'function' && tmPref('dashPodDensity') === 'icons' ? 'icons' : 'list';
}

function dashBuildIconTile(r) {
    const ov  = (_rmConfig.route_overrides || {})[r.id] || {};
    const url = _dashLaunchUrl(r, ov);
    const el  = document.createElement(url ? 'a' : 'div');
    el.className = 'rm-tile' + (url ? ' rm-tile-link' : '');
    if (url) { el.href = url; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    const st      = _rmRouterStatus[r.name] || null;
    const presCls = st ? (st.err || !st.up ? 'rm-presence-down' : 'rm-presence-up') : 'rm-presence-unknown';
    const name    = ov.display_name || r.name;
    el.title = url ? `${name} - ${url.replace(/^https?:\/\//, '')}` : name;
    el.innerHTML = `
        <span class="rm-tile-ic">
            <img class="rm-tile-img" src="${_esc(rmGetIconUrl(r))}" onerror="window.rmIconFallback(this)" data-slug="${_esc(rmIconSlug(r))}" alt="">
            <span class="rm-presence ${presCls}"></span>
        </span>
        <span class="rm-tile-name">${_esc(name)}</span>
    `;
    return el;
}

function dashBuildPod(meta, routes) {
    const pod = document.createElement('div');
    pod.className = 'rm-pod';
    pod.style.setProperty('--pod-color', meta.color);

    const icons    = dashPodDensity() === 'icons';
    const limit    = icons ? DASH_ICON_LIMIT : DASH_POD_LIMIT;
    const overflow = routes.length > limit;

    pod.innerHTML = `
        <div class="rm-pod-hdr">
            <i class="ph-bold ${_esc(meta.icon)} rm-pod-icon"></i>
            <span class="rm-pod-name">${_esc(meta.name)}</span>
            <span class="rm-pod-count">${routes.length}</span>
        </div>
        <div class="rm-pod-body${icons ? ' rm-pod-tiles' : ''}"></div>
        ${overflow ? `<button class="rm-pod-expand" data-expanded="false">
            <i class="ph-bold ph-caret-down" style="font-size:10px"></i>
            Show ${routes.length - limit} more
        </button>` : ''}
    `;

    const body = pod.querySelector('.rm-pod-body');
    routes.forEach((r, i) => {
        const row = icons ? dashBuildIconTile(r) : dashBuildRouteRow(r);
        if (overflow && i >= limit) row.classList.add('rm-pod-overflow', 'rm-pod-hidden');
        body.appendChild(row);
    });

    if (overflow) {
        const btn = pod.querySelector('.rm-pod-expand');
        btn.addEventListener('click', () => {
            const expanded = btn.dataset.expanded === 'true';
            btn.dataset.expanded = String(!expanded);
            const hiddenCount = routes.length - limit;
            pod.querySelectorAll('.rm-pod-overflow').forEach(el => {
                el.classList.toggle('rm-pod-hidden', expanded);
            });
            btn.innerHTML = expanded
                ? `<i class="ph-bold ph-caret-down" style="font-size:10px"></i> Show ${hiddenCount} more`
                : `<i class="ph-bold ph-caret-up" style="font-size:10px"></i> Show less`;
        });
    }

    return pod;
}

function _dashLaunchUrl(r, ov) {
    if (ov.link_disabled) return null;
    if (ov.url) return ov.url;
    if ((r.protocol || 'http') !== 'http') return null;
    const rule = r.rule || '';
    const host = (rule.match(/Host\(`([^`]+)`\)/) || [])[1];
    if (!host || host.includes('*')) return null;
    const path = (rule.match(/PathPrefix\(`([^`]+)`\)/) || [])[1] || '';
    return (r.tls ? 'https' : 'http') + '://' + host + path;
}

window.rmOpenRouteInfo = function(routeId) {
    const r = _rmAllRoutes.find(x => x.id === routeId);
    if (r) openRouteDetail(r.name, r.protocol, r);
};

function dashBuildRouteRow(r) {
    const ov  = (_rmConfig.route_overrides || {})[r.id] || {};
    const url = _dashLaunchUrl(r, ov);
    const row = document.createElement(url ? 'a' : 'div');
    row.className = 'rm-route-row' + (url ? ' rm-route-link' : '');

    const sec         = rmGetSecurity(r);
    const mws         = r.middlewares || [];
    const proto       = (r.protocol || 'http').toUpperCase();
    const target      = r.target || r.service_name || '';
    const displayName = ov.display_name || r.name;
    const iconUrl     = rmGetIconUrl(r);
    const iconSlug    = rmIconSlug(r);

    let tip = url ? `${url} \u2192 ${target}` : target;
    if (mws.length) tip += ' \u2022 ' + mws.map(m => m.split('@')[0]).join(', ');
    row.title = tip;
    if (url) {
        row.href   = url;
        row.target = '_blank';
        row.rel    = 'noopener noreferrer';
    }

    const st        = _rmRouterStatus[r.name] || null;
    const presCls   = st ? (st.err || !st.up ? 'rm-presence-down' : 'rm-presence-up') : 'rm-presence-unknown';
    const presTitle = st ? (st.err ? 'Router error' : (st.up ? 'Up' : 'Down')) : 'Status unknown';

    const protoBadge = proto !== 'HTTP'
        ? `<span class="rm-proto-pill rm-proto-${proto.toLowerCase()}">${proto}</span>`
        : '';

    let sub;
    if (url) {
        let glyph = '';
        if (sec === 'public') {
            glyph = `<i class="ph-bold ph-lock-simple-open rm-sec-glyph rm-sec-public" title="Public - no TLS"></i>`;
        } else if (sec === 'internal') {
            glyph = `<i class="ph-bold ph-house-line rm-sec-glyph rm-sec-internal" title="Internal only"></i>`;
        }
        sub = `<div class="rm-route-sub rm-sub-link">${glyph}<span class="rm-sub-text">${_esc(url.replace(/^https?:\/\//, ''))}</span></div>`;
    } else {
        sub = `<div class="rm-route-sub"><span class="rm-sub-text">${_esc(target)}</span></div>`;
    }

    row.innerHTML = `
        <span class="rm-route-ic">
            <img class="rm-route-icon" src="${_esc(iconUrl)}" onerror="window.rmIconFallback(this)" data-slug="${_esc(iconSlug)}" alt="">
            <span class="rm-presence ${presCls}" title="${presTitle}"></span>
        </span>
        <div class="rm-route-info">
            <div class="rm-route-name">${protoBadge}${_esc(displayName)}</div>
            ${sub}
        </div>
        <span class="rm-row-rail">
            ${url ? '<i class="ph-bold ph-arrow-up-right rm-launch-hint"></i>' : ''}
            <span class="rm-row-btn" role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();window.rmOpenRouteInfo('${_esc(r.id)}')" title="Details"><i class="ph-bold ph-info"></i></span>
            <span class="rm-row-btn" role="button" tabindex="0" onclick="event.preventDefault();event.stopPropagation();window.rmOpenEditModal('${_esc(r.id)}')" title="Edit"><i class="ph-bold ph-pencil-simple"></i></span>
        </span>
    `;
    return row;
}


window.rmInvalidateGroups = function() {
    if (document.getElementById('tab-dashboard')?.classList.contains('active')) dashRender();
};

window.rmInvalidateDashboard = function() {
    _dashDrawn = false;
};

})();
