// ── Shared provider card renderer (matches Routes tab card style) ─────────────
function renderProviderMiddlewareSection(middlewares, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!middlewares || middlewares.length === 0) { el.innerHTML = ''; return; }
    const cards = middlewares.map(mw => {
        const name = (mw.name || '').split('@')[0];
        const type = mw.type || '';
        const st   = (mw.status || '').toLowerCase();
        const dot  = st === 'enabled' ? 'status-online' : (st === 'disabled' || st === 'error') ? 'status-offline' : 'status-unknown';
        return `<div class="card p-3 flex items-center gap-3">
            <span class="status-dot ${dot}" style="flex-shrink:0"></span>
            <div class="min-w-0 flex-1">
                <div class="text-sm font-semibold font-mono truncate" style="color:var(--text)" title="${_esc(name)}">${_esc(name)}</div>
                ${type ? `<div class="text-xs mt-0.5" style="color:var(--muted)">${_esc(type)}</div>` : ''}
            </div>
        </div>`;
    }).join('');
    el.innerHTML = `<div class="mt-6 pt-4" style="border-top:1px solid var(--border)">
        <div class="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style="color:var(--muted)">
            <i class="ph-bold ph-plugs-connected"></i> Middlewares <span class="font-normal">(${middlewares.length})</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">${cards}</div>
    </div>`;
}

function renderProviderCard(r, opts = {}) {
    const proto = (r._proto || 'HTTP').toUpperCase();
    const name  = (r.name  || '').split('@')[0];
    const svc   = (r.service || '').split('@')[0];

    const protoBadge = proto === 'TCP'  ? `<span class="badge badge-tcp">TCP</span>`
                     : proto === 'UDP'  ? `<span class="badge badge-udp">UDP</span>`
                     :                   `<span class="badge badge-http">HTTP</span>`;

    const tlsBadge = r.tls ? `<span class="badge badge-green" style="font-size:9px"><i class="ph-bold ph-lock"></i> TLS</span>` : '';

    const st = (r.status || '').toLowerCase();
    const dotCls = st === 'enabled' ? 'status-online' : (st === 'disabled' || st === 'error') ? 'status-offline' : 'status-unknown';

    const hostMatch = (r.rule || '').match(/Host\(`([^`]+)`\)/);
    const domain    = hostMatch ? hostMatch[1] : null;
    const isHTTP    = proto === 'HTTP';

    const externalBtn = (domain && isHTTP)
        ? `<a href="https://${domain}" target="_blank" class="pill-btn pill-btn-blue" title="Open site"><i class="ph-bold ph-arrow-square-out text-sm"></i></a>`
        : '';

    const domainBlock = isHTTP
        ? `<div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
               <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color:var(--muted)">Domain</div>
               <div class="text-xs font-mono truncate" style="color:var(--blue)" title="${_esc(r.rule || '-')}">${_esc(domain || r.rule || '-')}</div>
           </div>`
        : (r.rule ? `<div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
               <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color:var(--muted)">Rule</div>
               <div class="text-xs font-mono truncate" style="color:var(--blue)">${_esc(r.rule)}</div>
           </div>` : '');

    const targetBlock = opts.target
        ? `<div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
               <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color:var(--muted)">Target</div>
               <div class="text-xs font-mono truncate" style="color:var(--green)">${_esc(opts.target)}</div>
           </div>`
        : '';

    const epHtml = (r.entryPoints || []).length
        ? `<div class="flex flex-wrap gap-1">${(r.entryPoints || []).map(ep => `<span class="badge badge-muted text-xs">${_esc(ep)}</span>`).join('')}</div>`
        : '';

    const mwHtml = (r.middlewares || []).length
        ? `<div class="flex flex-wrap gap-1">${(r.middlewares || []).map(mw => `<span class="badge" style="background:rgba(163,113,247,0.1);color:var(--purple);border:1px solid rgba(163,113,247,0.25)">${_esc(mw.split('@')[0])}</span>`).join('')}</div>`
        : '';

    return `
    <div class="card route-card">
        <div class="route-card-inner p-4 pb-2">
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        ${protoBadge}${tlsBadge}<span class="status-dot ${dotCls}"></span>
                    </div>
                    <h3 class="font-bold text-sm mt-1.5 truncate" style="color:var(--text)" title="${_esc(name)}">${_esc(name)}</h3>
                    <div class="text-xs font-mono truncate" style="color:var(--muted)">${_esc(svc)}</div>
                </div>
                <div class="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    ${opts.extraBadges || ''}${externalBtn}
                    ${opts.onDetailClick ? `<button onclick="${opts.onDetailClick}" class="pill-btn pill-btn-blue" title="View details"><i class="ph-bold ph-info text-sm"></i></button>` : ''}
                </div>
            </div>
            <div class="space-y-2">
                ${domainBlock}${targetBlock}${opts.extraRows || ''}${epHtml}${mwHtml}
            </div>
        </div>
    </div>`;
}
