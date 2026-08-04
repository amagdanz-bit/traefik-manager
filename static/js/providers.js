// ── Shared provider card renderer (matches Routes tab card style) ─────────────
function renderProviderMiddlewareSection(middlewares, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!middlewares || middlewares.length === 0) { el.innerHTML = ''; return; }
    const modern = _tmModern();
    const cards = middlewares.map(mw => {
        const name = (mw.name || '').split('@')[0];
        const type = mw.type || '';
        const st   = (mw.status || '').toLowerCase();
        const dot  = st === 'enabled' ? 'status-online' : (st === 'disabled' || st === 'error') ? 'status-offline' : 'status-unknown';
        if (modern) {
            return `<div class="tm-card tm-card-flat" style="--tm-accent:var(--purple)">
                <div class="tm-head">
                    <span class="tm-ic tm-ic-tile"><i class="ph-bold ${_tmMwIcon({ yaml: type })}"></i><span class="status-dot ${dot}"></span></span>
                    <div class="tm-head-txt">
                        <div class="tm-title"><span class="tm-name">${_esc(name)}</span></div>
                        ${type ? `<div class="tm-sub">${_esc(type)}</div>` : ''}
                    </div>
                </div>
            </div>`;
        }
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
        <div class="${modern ? 'tm-card-grid' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'}">${cards}</div>
    </div>`;
}

function providerGridClass() {
    return _tmModern() ? 'tm-card-grid' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
}

function _tmProviderCard(r, opts, ctx) {
    const { proto, name, svc, domain, isHTTP, dotCls, extUrl } = ctx;
    const glyphs = proto === 'UDP' ? ''
        : r.tls ? '<i class="ph-bold ph-lock-simple tm-glyph" style="color:var(--muted)" title="TLS"></i>'
                : '<i class="ph-bold ph-lock-simple-open tm-glyph" style="color:var(--yellow)" title="No TLS"></i>';

    const simpleHost = /^Host\(`[^`]+`\)(\s*\|\|\s*Host\(`[^`]+`\))*$/.test((r.rule || '').trim());
    const vals = [];
    if (isHTTP && simpleHost && domain) {
        vals.push(`<div class="tm-val tm-val-host"><i class="ph-bold ph-globe-simple"></i><span class="tm-v">${_esc(domain)}</span>${_tmCopy(domain)}</div>`);
    } else if (r.rule) {
        vals.push(`<div class="tm-val tm-val-rule"><i class="ph-bold ph-brackets-curly"></i><span class="tm-v" title="${_esc(r.rule)}">${_esc(r.rule)}</span>${_tmCopy(r.rule)}</div>`);
    }
    if (opts.target) {
        vals.push(`<div class="tm-val tm-val-target"><i class="ph-bold ph-arrow-elbow-down-right"></i><span class="tm-v">${_esc(opts.target)}</span>${_tmCopy(opts.target)}</div>`);
    }
    for (const row of (opts.rows || [])) {
        if (!row.value) continue;
        vals.push(`<div class="tm-val"><i class="ph-bold ${row.icon || 'ph-dot'}"></i><span class="tm-v" style="color:var(--muted)" title="${_esc(row.label || '')}">${_esc(row.value)}</span>${_tmCopy(row.value)}</div>`);
    }

    const meta = [
        (r.entryPoints || []).length ? `<span>${_esc((r.entryPoints || []).join(' · '))}</span>` : '',
        (r.middlewares || []).length ? `<span class="tm-mw">${(r.middlewares || []).map(mw => _esc(mw.split('@')[0])).join(' · ')}</span>` : '',
        svc ? `<span class="tm-svcname">${_esc(svc)}</span>` : '',
    ].filter(Boolean).join('<span class="tm-sep"> · </span>');

    const rail = `<span class="tm-rail tm-rail-sm" onclick="event.stopPropagation()">` +
        (extUrl ? `<a href="${extUrl}" target="_blank" rel="noopener" class="tm-btn" title="Open site" onclick="event.stopPropagation()"><i class="ph-bold ph-arrow-square-out"></i></a>` : '') +
        (opts.onDetailClick ? `<button type="button" class="tm-btn" title="Details" onclick="event.stopPropagation();${opts.onDetailClick}"><i class="ph-bold ph-info"></i></button>` : '') +
        '</span>';

    return `<div class="tm-card"${opts.onDetailClick ? ` onclick="${opts.onDetailClick}"` : ''} style="--tm-accent:var(--blue)">
        <div class="tm-head">
            <span class="tm-ic-bare"><span class="status-dot ${dotCls}"></span></span>
            <div class="tm-head-txt">
                <div class="tm-title">${proto !== 'HTTP' ? `<span class="tm-proto tm-proto-${proto.toLowerCase()}">${proto}</span>` : ''}<span class="tm-name">${_esc(name)}</span>${glyphs}</div>
                ${opts.tag ? `<div class="tm-sub">${_esc(opts.tag)}</div>` : ''}
            </div>${rail}
        </div>
        ${vals.length ? `<div class="tm-vals">${vals.join('')}</div>` : ''}
        <div class="tm-foot"><span class="tm-meta">${meta}</span></div>
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

    const extUrl = (domain && isHTTP && !domain.includes('{') && !domain.includes('*')) ? 'https://' + domain : '';

    if (_tmModern()) {
        return _tmProviderCard(r, opts, { proto, name, svc, domain, isHTTP, dotCls, extUrl });
    }

    const externalBtn = extUrl
        ? `<a href="${extUrl}" target="_blank" class="pill-btn pill-btn-blue" title="Open site"><i class="ph-bold ph-arrow-square-out text-sm"></i></a>`
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

    const rowsBlock = (opts.rows || []).filter(row => row.value).map(row =>
        `<div class="rounded-md p-2.5" style="background:var(--input-bg);border:1px solid var(--border)">
               <div class="text-xs font-semibold uppercase tracking-wider mb-1" style="color:var(--muted)">${_esc(row.label || '')}</div>
               <div class="text-xs font-mono truncate" style="color:var(--muted)">${_esc(row.value)}</div>
           </div>`).join('');

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
                ${domainBlock}${targetBlock}${rowsBlock}${epHtml}${mwHtml}
            </div>
        </div>
    </div>`;
}
