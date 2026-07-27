let _allLogLines    = [];
let _currentLogLines = 100;
let _logCountryFilter = '';

function setLogLines(n) {
    _currentLogLines = n;
    [100, 200, 500, 1000].forEach(v => {
        document.getElementById('log-' + v)?.classList.toggle('active-http', v === n);
    });
    refreshLogs();
}

async function refreshLogs() {
    const container = document.getElementById('logsContent');
    container.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-4xl block mb-3 animate-spin opacity-40"></i><p>Loading logs...</p></div>`;
    try {
        const res = await agentFetch(`/api/traefik/logs?lines=${_currentLogLines}`).then(r => r.json());
        if (res.error) {
            container.innerHTML = _emptyMountState({
                icon: 'ph-terminal',
                title: 'Access log not mounted',
                description: 'Stream live Traefik access logs by enabling access logging in Traefik and mounting the log file into this container.',
                steps: [
                    { label: 'Enable access logging in your <code class="font-mono">traefik.yml</code>:',
                      code: 'accessLog:\n  filePath: "/logs/access.log"' },
                    { label: 'Add this volume to the <code class="font-mono">traefik-manager</code> service in your <code class="font-mono">docker-compose.yml</code>:',
                      code: '- /path/to/traefik/logs/access.log:/app/logs/access.log:ro' },
                ],
                note: 'Traefik must be restarted after adding <code class="font-mono">accessLog</code> to traefik.yml.'
            });
            return;
        }
        _allLogLines = res.lines || [];
        await loadGeoStatus();
        if (_geoEnabled && _geoAvailable) {
            const ips = _allLogLines.map(l => { const e = parseLogLine(l); return e && e.ip; }).filter(Boolean);
            await geoLookup(ips);
        }
        renderLogs();
    } catch(e) {
        container.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><p>Failed to load logs</p></div>`;
    }
}

function logGeo_click(cc) {
    _logCountryFilter = (_logCountryFilter === cc) ? '' : cc;
    renderLogs();
}
function clearLogCountryFilter() { _logCountryFilter = ''; renderLogs(); }

const HTTP_STATUS = {
    200:'OK',201:'Created',202:'Accepted',204:'No Content',
    301:'Moved Permanently',302:'Found',303:'See Other',304:'Not Modified',307:'Temporary Redirect',308:'Permanent Redirect',
    400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',405:'Method Not Allowed',
    408:'Request Timeout',409:'Conflict',410:'Gone',422:'Unprocessable Entity',429:'Too Many Requests',
    500:'Internal Server Error',501:'Not Implemented',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'
};

function _fmtLogDuration(ns) {
    if (!ns) return '';
    if (ns >= 1e9) return (ns / 1e9).toFixed(2) + 's';
    if (ns >= 1e6) return Math.round(ns / 1e6) + 'ms';
    if (ns >= 1e3) return Math.round(ns / 1e3) + 'µs';
    return ns + 'ns';
}

function parseLogLine(raw) {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith('{')) {
        try {
            const j = JSON.parse(trimmed);
            if (j.RequestMethod || j.RequestPath || j.DownstreamStatus) {
                const durNs = typeof j.Duration === 'number' ? j.Duration : parseInt(j.Duration) || 0;
                const size = j.DownstreamContentSize != null ? j.DownstreamContentSize : (j.OriginContentSize != null ? j.OriginContentSize : '');
                return {
                    ip: j.ClientHost || (j.ClientAddr || '').split(':')[0] || '',
                    date: j.StartUTC || j.StartLocal || j.time || '',
                    method: j.RequestMethod || '',
                    path: j.RequestPath || '',
                    status: parseInt(j.DownstreamStatus) || parseInt(j.OriginStatus) || 0,
                    size: String(size),
                    service: j.ServiceName || '',
                    serviceUrl: j.ServiceURL || j.ServiceAddr || '',
                    duration: _fmtLogDuration(durNs),
                    raw
                };
            }
        } catch (_) {}
    }
    const full = raw.match(
        /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d+) (\S+) "[^"]*" "[^"]*" \S+ "([^"]*)" "([^"]*)" (\S+)/
    );
    if (full) return { ip:full[1], date:full[2], method:full[3], path:full[4],
        status:parseInt(full[5])||0, size:full[6], service:full[7], serviceUrl:full[8], duration:full[9], raw };
    const basic = raw.match(/^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d+) (\S+)/);
    if (basic) return { ip:basic[1], date:basic[2], method:basic[3], path:basic[4],
        status:parseInt(basic[5])||0, size:basic[6], service:'', serviceUrl:'', duration:'', raw };
    return null;
}

function filterLogs() { renderLogs(); }

function renderLogStats(entries) {
    const el = document.getElementById('logStats');
    if (!el || !entries.length) { if (el) el.style.display = 'none'; return; }
    const parsed = entries.map(e => typeof e === 'string' ? parseLogLine(e) : e).filter(Boolean);
    if (!parsed.length) { el.style.display = 'none'; return; }

    const total = parsed.length;
    const s2 = parsed.filter(e => e.status >= 200 && e.status < 300).length;
    const s3 = parsed.filter(e => e.status >= 300 && e.status < 400).length;
    const s4 = parsed.filter(e => e.status >= 400 && e.status < 500).length;
    const s5 = parsed.filter(e => e.status >= 500).length;
    const pct = v => total ? Math.round((v/total)*100) : 0;

    const parseDur = d => {
        if (!d || d === '-') return null;
        const ms = parseFloat(d);
        if (isNaN(ms)) return null;
        if (d.includes('ms')) return ms;
        if (d.endsWith('s')) return ms * 1000;
        return ms;
    };
    const durs = parsed.map(e => parseDur(e.duration)).filter(v => v !== null);
    const avgDur = durs.length ? durs.reduce((a,b)=>a+b,0)/durs.length : null;
    const maxDur = durs.length ? Math.max(...durs) : null;
    const fmtDur = v => v === null ? '-' : v >= 1000 ? (v/1000).toFixed(2)+'s' : Math.round(v)+'ms';
    const fast = durs.filter(d=>d<100).length;
    const mid  = durs.filter(d=>d>=100&&d<500).length;
    const slow = durs.filter(d=>d>=500).length;

    const topN = (key, n) => {
        const m = {};
        parsed.forEach(e => { const v = e[key]; if (v && v !== '-') m[v] = (m[v]||0) + 1; });
        return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n);
    };
    const topIps   = topN('ip', 6);
    const topPaths = topN('path', 6);
    const topSvcs  = topN('service', 5);
    const methods  = topN('method', 6);

    const hbar = (v, max, col) => `<div style="flex:1;height:6px;border-radius:3px;background:var(--input-bg);overflow:hidden"><div style="height:100%;border-radius:3px;background:${col};width:${max?Math.max(3,Math.round((v/max)*100)):0}%"></div></div>`;
    const topList = (pairs, col='var(--blue)', strip=false, decorate=null) => {
        const max = pairs[0]?.[1]||1;
        return pairs.map(([k,v]) => {
            const label = strip ? k.replace(/@docker|@file|@kubernetes/g,'') : k;
            return `<div class="flex items-center gap-2 py-1" style="border-bottom:1px solid var(--border)">
                <span class="text-xs font-mono truncate" style="color:var(--text);min-width:0;flex:1" title="${_esc(k)}">${_esc(label)}</span>
                ${decorate ? decorate(k) : ''}
                ${hbar(v, max, col)}
                <span class="text-xs font-bold flex-shrink-0 tabular-nums" style="color:var(--muted);min-width:28px;text-align:right">${v}</span>
            </div>`;
        }).join('');
    };

    const methodColors = {GET:'var(--blue)',POST:'var(--green)',PUT:'var(--yellow)',DELETE:'var(--red)',PATCH:'var(--purple)',HEAD:'var(--teal)'};

    const stackW = g => total ? Math.max(0,Math.round((g/total)*100)) : 0;

    el.innerHTML = `
    <div class="grid gap-3 mb-3 grid-cols-1 sm:grid-cols-3">
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--muted)">Status Codes</span>
                <span class="text-xs font-bold" style="color:var(--text)">${total} requests</span>
            </div>
            <div class="flex gap-4 mb-3">
                ${[['2xx',s2,'var(--green)'],['3xx',s3,'var(--blue)'],['4xx',s4,'var(--yellow)'],['5xx',s5,'var(--red)']].map(([l,v,c])=>
                    `<div><div class="text-xl font-bold" style="color:${c}">${v}</div><div class="text-xs" style="color:var(--muted)">${l} · ${pct(v)}%</div></div>`).join('')}
            </div>
            <div class="flex rounded-md overflow-hidden" style="height:8px;gap:1px">
                ${[['var(--green)',s2],['var(--blue)',s3],['var(--yellow)',s4],['var(--red)',s5]].map(([c,v])=>
                    stackW(v) > 0 ? `<div style="background:${c};width:${stackW(v)}%;border-radius:2px"></div>` : '').join('')}
            </div>
        </div>

        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wide mb-3" style="color:var(--muted)">Response Time</div>
            <div class="flex items-end gap-4 mb-3">
                <div><div class="text-2xl font-bold" style="color:var(--text)">${fmtDur(avgDur)}</div><div class="text-xs" style="color:var(--muted)">avg</div></div>
                <div><div class="text-sm font-bold" style="color:var(--muted)">${fmtDur(maxDur)}</div><div class="text-xs" style="color:var(--muted)">max</div></div>
            </div>
            <div class="grid gap-1.5" style="grid-template-columns:1fr 1fr 1fr">
                ${[['Fast','<100ms',fast,'var(--green)'],['Med','100-500',mid,'var(--yellow)'],['Slow','>500ms',slow,'var(--red)']].map(([l,s,v,c])=>
                    `<div class="rounded-lg p-2 text-center" style="background:var(--input-bg)"><div class="text-sm font-bold" style="color:${c}">${v}</div><div class="text-xs" style="color:var(--muted)">${l}</div></div>`).join('')}
            </div>
        </div>

        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wide mb-3" style="color:var(--muted)">Methods</div>
            <div class="space-y-1">
                ${methods.map(([m,v]) => {
                    const c = methodColors[m]||'var(--muted)';
                    const max = methods[0]?.[1]||1;
                    return `<div class="flex items-center gap-2">
                        <span class="text-xs font-bold flex-shrink-0" style="color:${c};min-width:52px">${_esc(m)}</span>
                        ${hbar(v, max, c)}
                        <span class="text-xs tabular-nums flex-shrink-0" style="color:var(--muted);min-width:28px;text-align:right">${v}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    </div>

    <div class="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Top IPs</div>
            ${topList(topIps, 'var(--blue)', false, ip => ipClassBadge(classifyIp(ip)))}
        </div>
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Top Paths</div>
            ${topList(topPaths, 'var(--teal)')}
        </div>
        <div class="rounded-xl p-4" style="background:var(--card);border:1px solid var(--border)">
            <div class="text-xs font-semibold uppercase tracking-wide mb-2" style="color:var(--muted)">Top Services</div>
            ${topList(topSvcs, 'var(--purple)', true)}
        </div>
    </div>`;
    el.style.display = '';
}

function renderLogs() {
    const container = document.getElementById('logsContent');
    const q = (document.getElementById('logSearch')?.value || '').toLowerCase();
    const searchLines = q ? _allLogLines.filter(l => l.toLowerCase().includes(q)) : _allLogLines;
    const geoOn = _geoEnabled && _geoAvailable;

    const searchParsed = searchLines.map(raw => ({ raw, e: parseLogLine(raw) }));
    const countryData = geoOn ? _geoCountryCounts(searchParsed.map(o => o.e && o.e.ip).filter(Boolean)) : {};
    if (_logCountryFilter && !countryData[_logCountryFilter]) _logCountryFilter = '';

    const visible = _logCountryFilter
        ? searchParsed.filter(o => o.e && _geoCache[o.e.ip] && _geoCache[o.e.ip].country_code === _logCountryFilter)
        : searchParsed;

    if (searchLines.length === 0) {
        document.getElementById('logStats')?.style && (document.getElementById('logStats').style.display = 'none');
        container.innerHTML = `<div class="text-center py-12" style="color:var(--muted)"><p>No log lines match</p></div>`;
        return;
    }
    renderLogStats(visible.map(o => o.raw));

    const statusColor = s => !s ? 'var(--muted)' : s >= 500 ? 'var(--red)' : s >= 400 ? 'var(--yellow)' : 'var(--green)';
    const methodColor = m => ({ GET:'var(--blue)', POST:'var(--green)', PUT:'var(--yellow)', DELETE:'var(--red)', PATCH:'var(--purple)' }[m] || 'var(--muted)');

    const cards = visible.map(({ raw, e }) => {
        if (!e) return `<div class="px-4 py-2 text-xs font-mono border-b" style="color:var(--muted);border-color:var(--border);overflow-x:auto;white-space:nowrap">${_esc(raw)}</div>`;
        const sc = statusColor(e.status);
        const mc = methodColor(e.method);
        const geo = _geoCache[e.ip];
        const flag = (geoOn && geo && geo.country_code) ? `<span style="font-size:12px;line-height:1;flex-shrink:0" title="${_esc(geo.country_name || geo.country_code)}">${_flagEmoji(geo.country_code)}</span>` : '';
        const svcLabel = e.service && e.service !== '-' ? `<span class="text-xs font-mono truncate" style="color:var(--blue);max-width:180px">${_esc(e.service.replace(/@docker|@file/,''))}</span>` : '';
        const durLabel = e.duration && e.duration !== '-' ? `<span class="text-xs" style="color:var(--muted)">${_esc(e.duration)}</span>` : '';
        const entryObj = JSON.stringify(e).replace(/'/g,"&#39;");
        const metaLine = [svcLabel, durLabel].filter(Boolean).join('<span style="color:var(--border);margin:0 4px">·</span>');
        return `<div class="flex items-start gap-3 px-4 py-2.5 border-b cursor-pointer hover:opacity-80 transition-opacity" style="border-color:var(--border)" onclick='openLogDetail(${entryObj})'>
            <span class="text-xs font-mono font-bold flex-shrink-0 mt-px" style="color:${mc};min-width:40px">${_esc(e.method)}</span>
            <span class="inline-flex items-center gap-1 flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded" style="background:${sc}18;color:${sc};border:1px solid ${sc}44;min-width:52px">${e.status||'-'} <span style="font-weight:400;opacity:.8">${e.status ? (HTTP_STATUS[e.status]||'') : 'tunnel'}</span></span>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-mono truncate" style="color:var(--text)" title="${_esc(e.path)}">${_esc(e.path)}</div>
                ${metaLine ? `<div class="flex items-center gap-1 mt-0.5">${metaLine}</div>` : ''}
            </div>
            <span class="text-xs flex-shrink-0 hidden sm:flex items-center gap-1 mt-px" style="color:var(--muted)">${flag}${_esc(e.ip)}</span>
        </div>`;
    }).join('');

    const geoPanel = (geoOn && Object.keys(countryData).length) ? _geoPanelHtml('logGeo', countryData, _logCountryFilter, 'clearLogCountryFilter()') : '';

    container.innerHTML = geoPanel + `<div class="rounded-xl overflow-hidden" style="border:1px solid var(--border)">
        <div class="flex items-center justify-between px-4 py-2 text-xs" style="background:var(--card);border-bottom:1px solid var(--border);color:var(--muted)">
            <span><i class="ph-bold ph-terminal mr-1"></i>Access Log</span>
            <span>${visible.length} entries</span>
        </div>
        <div style="max-height:600px;overflow-y:auto;background:var(--bg)">${cards}</div>
    </div>`;

    if (geoPanel) renderGeoMap(document.getElementById('logGeoMap'), countryData, logGeo_click, _logCountryFilter);
}

function openLogDetail(e) {
    const sc = !e.status ? 'var(--muted)' : e.status >= 500 ? 'var(--red)' : e.status >= 400 ? 'var(--yellow)' : 'var(--green)';
    const mc = { GET:'var(--blue)', POST:'var(--green)', PUT:'var(--yellow)', DELETE:'var(--red)', PATCH:'var(--purple)' }[e.method] || 'var(--muted)';
    document.getElementById('ldBadges').innerHTML =
        `<span class="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded" style="background:${sc}18;color:${sc};border:1px solid ${sc}44">${e.status||'-'} ${e.status ? (HTTP_STATUS[e.status]||'') : 'tunnel'}</span>` +
        `<span class="text-xs font-mono font-bold px-2 py-1 rounded" style="background:${mc}18;color:${mc};border:1px solid ${mc}44">${_esc(e.method)}</span>`;
    const _g = _geoCache[e.ip];
    const rows = [
        ['Path', e.path], ['IP', e.ip], ['Date', e.date],
        ...(_g && _g.country_code ? [['Country', `${_flagEmoji(_g.country_code)} ${_g.country_name || _g.country_code}`]] : []),
        ...(e.size && e.size !== '-' ? [['Size', e.size]] : []),
        ...(e.duration && e.duration !== '-' ? [['Duration', e.duration]] : []),
        ...(e.service && e.service !== '-' ? [['Service', e.service]] : []),
        ...(e.serviceUrl && e.serviceUrl !== '-' ? [['Backend URL', e.serviceUrl]] : []),
    ];
    document.getElementById('ldGrid').innerHTML = rows.map(([k,v],i) =>
        `<div class="flex items-start gap-3 px-4 py-2.5" style="${i<rows.length-1?'border-bottom:1px solid var(--border)':''}"><span class="text-xs font-medium flex-shrink-0" style="color:var(--muted);min-width:80px">${k}</span><span class="text-xs font-mono break-all" style="color:var(--text)">${_esc(v)}</span></div>`
    ).join('');
    document.getElementById('ldRaw').textContent = e.raw;
    document.getElementById('logDetailPanel').classList.add('open');
    const bd = document.getElementById('logDetailBackdrop');
    if (bd) { bd.style.opacity = '1'; bd.style.pointerEvents = 'auto'; }
}

function closeLogDetail() {
    document.getElementById('logDetailPanel').classList.remove('open');
    const bd = document.getElementById('logDetailBackdrop');
    if (bd) { bd.style.opacity = ''; bd.style.pointerEvents = ''; }
}
