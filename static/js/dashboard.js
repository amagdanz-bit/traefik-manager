async function loadOverviewStats() {
    try {
        const [overview, routers, services, middlewares, version, entrypoints] = await Promise.allSettled([
            agentFetch('/api/traefik/overview').then(r => r.json()),
            agentFetch('/api/traefik/routers').then(r => r.json()),
            agentFetch('/api/traefik/services').then(r => r.json()),
            agentFetch('/api/traefik/middlewares').then(r => r.json()),
            agentFetch('/api/traefik/version').then(r => r.json()),
            agentFetch('/api/traefik/entrypoints').then(r => r.json()),
        ]);

        
        const apiUp = version.status === 'fulfilled' && version.value?.Version;
        const dotColor = apiUp ? 'var(--green)' : 'var(--red)';
        const dotEl  = document.getElementById('apiStatusDot');
        const dotElM = document.getElementById('apiStatusDotMobile');
        if (dotEl)  dotEl.style.background  = dotColor;
        if (dotElM) dotElM.style.background = dotColor;

        if (version.status === 'fulfilled' && version.value && version.value.Version) {
            _currentVersion = version.value.Version;
            document.getElementById('versionText').textContent = 'v' + _currentVersion;
            const vtm = document.getElementById('versionTextMobile');
            if (vtm) vtm.textContent = 'v' + _currentVersion;
            if (tmPref('showTraefikBadge')) {
                document.getElementById('versionBadge')?.classList.remove('hidden');
                document.getElementById('versionBadgeMobile')?.classList.remove('hidden');
                document.getElementById('versionBadgeMobile')?.classList.add('flex');
            }
            checkForUpdate(_currentVersion);
            checkTraefikAdvisories(_currentVersion);
        }


        const apiStatusMap = {};

        function pct(n, total) { return total === 0 ? '0%' : Math.round(n / total * 100) + '%'; }

        function renderDonut(svgId, s, w, e) {
            const svg = document.getElementById(svgId);
            if (!svg) return;
            const total = s + w + e, r = 30, cx = 40, cy = 40;
            const circ = 2 * Math.PI * r;
            if (total === 0) {
                svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="14"/>`;
                return;
            }
            function seg(n, offsetFrac, color) {
                if (n === 0) return '';
                const len = (n / total) * circ;
                return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${len} ${circ}" transform="rotate(${offsetFrac * 360 - 90} ${cx} ${cy})"/>`;
            }
            svg.innerHTML =
                `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="14"/>` +
                seg(s, 0,             '#22c55e') +
                seg(w, s/total,       '#f59e0b') +
                seg(e, (s+w)/total,   '#ef4444');
        }

        function renderBar(elId, success, warn, err) {
            const el = document.getElementById(elId);
            if (!el) return;
            const total = success + warn + err;
            if (total === 0) { el.style.background = 'var(--border)'; el.innerHTML = ''; return; }
            el.innerHTML = [
                success ? `<div style="width:${success/total*100}%;background:#22c55e;height:100%"></div>` : '',
                warn    ? `<div style="width:${warn/total*100}%;background:#eab308;height:100%"></div>` : '',
                err     ? `<div style="width:${err/total*100}%;background:#ef4444;height:100%"></div>` : '',
            ].join('');
        }

        function statusCounts(arr) {
            const s = arr.filter(x => x.status === 'enabled').length;
            const e = arr.filter(x => x.status === 'disabled' || x.status === 'error').length;
            const w = arr.length - s - e;
            return { s, w, e };
        }

        if (routers.status === 'fulfilled') {
            const http = routers.value.http || [];
            const tcp  = routers.value.tcp  || [];
            const udp  = routers.value.udp  || [];
            const tcpAll = [...tcp, ...udp];

            [...http, ...tcp, ...udp].forEach(r => {
                const shortName = (r.name || '').split('@')[0];
                apiStatusMap[shortName] = { status: r.status || 'unknown', error: r.error || null };
            });

            const _isFile = r => (r.provider || (r.name||'').split('@')[1]||'') === 'file';
            const httpStat   = _activeAgent ? http.filter(_isFile)   : http;
            const tcpAllStat = _activeAgent ? tcpAll.filter(_isFile) : tcpAll;

            const hc = statusCounts(httpStat);
            document.getElementById('statHttpRouters').textContent = httpStat.length;
            document.getElementById('statHttpSuccess').textContent = hc.s;
            document.getElementById('pctHttpSuccess').textContent  = pct(hc.s, httpStat.length);
            document.getElementById('statHttpWarn').textContent    = hc.w;
            document.getElementById('pctHttpWarn').textContent     = pct(hc.w, httpStat.length);
            document.getElementById('statHttpErr').textContent     = hc.e;
            document.getElementById('pctHttpErr').textContent      = pct(hc.e, httpStat.length);
            document.getElementById('cmpHttpSuccess').textContent  = hc.s;
            document.getElementById('cmpHttpWarn').textContent     = hc.w;
            document.getElementById('cmpHttpErr').textContent      = hc.e;
            renderDonut('donutHttp', hc.s, hc.w, hc.e);
            renderBar('barHttpRouters', hc.s, hc.w, hc.e);

            const dockerCount = [...http, ...tcpAll].filter(r => (r.provider || (r.name||'').split('@')[1]||'') === 'docker').length;
            document.getElementById('dockerTabCount').textContent = dockerCount || '-';

            const tc = statusCounts(tcpAllStat);
            document.getElementById('statTcpUdp').textContent     = tcpAllStat.length;
            document.getElementById('statTcpSuccess').textContent  = tc.s;
            document.getElementById('pctTcpSuccess').textContent   = pct(tc.s, tcpAllStat.length);
            document.getElementById('statTcpWarn').textContent     = tc.w;
            document.getElementById('pctTcpWarn').textContent      = pct(tc.w, tcpAllStat.length);
            document.getElementById('statTcpErr').textContent      = tc.e;
            document.getElementById('pctTcpErr').textContent       = pct(tc.e, tcpAllStat.length);
            document.getElementById('cmpTcpSuccess').textContent   = tc.s;
            document.getElementById('cmpTcpWarn').textContent      = tc.w;
            document.getElementById('cmpTcpErr').textContent       = tc.e;
            renderDonut('donutTcp', tc.s, tc.w, tc.e);
            renderBar('barTcpRouters', tc.s, tc.w, tc.e);
        }

        
        document.querySelectorAll('.route-card').forEach(card => {
            const routeName = card.dataset.routekey || '';
            const statusEl = card.querySelector('.status-dot');
            if (!statusEl) return;
            const entry = apiStatusMap[routeName];
            const apiStatus = entry ? entry.status : null;
            const apiError  = entry ? entry.error  : null;
            if (apiStatus === 'enabled') {
                statusEl.className = 'status-dot status-online';
                statusEl.title = 'Enabled';
            } else if (apiStatus === 'disabled' || apiStatus === 'error') {
                statusEl.className = 'status-dot status-offline';
                statusEl.title = apiError ? `Error: ${apiError}` : 'Disabled / Error';
                
                if (apiError) {
                    let errEl = card.querySelector('.card-error-msg');
                    if (!errEl) {
                        errEl = document.createElement('div');
                        errEl.className = 'card-error-msg';
                        errEl.style.cssText = 'margin-top:8px;padding:6px 10px;border-radius:6px;font-size:11px;font-family:monospace;color:var(--red);background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.25);word-break:break-word;line-height:1.4';
                        card.appendChild(errEl);
                    }
                    errEl.innerHTML = `<i class="ph-bold ph-warning-circle" style="font-size:11px;margin-right:4px"></i>${apiError}`;
                }
            } else if (apiStatus) {
                statusEl.className = 'status-dot status-unknown';
                statusEl.title = `Status: ${apiStatus}`;
            } else {

                const proto = card.dataset.protocol;
                if (proto === 'http' && card.dataset.enabled !== 'false') {
                    const domains = (card.dataset.domains || '').split('|').filter(d => d && !d.includes('{') && !d.includes('*'));
                    const domain = domains[0];
                    if (domain) {
                        const tgt = card.dataset.target || '';
                        const pingUrl = `/api/ping?url=${encodeURIComponent('https://' + domain)}${tgt ? '&fallback=' + encodeURIComponent(tgt) : ''}`;
                        fetch(pingUrl)
                            .then(r => r.json())
                            .then(data => {
                                statusEl.className = data.ok ? 'status-dot status-online' : 'status-dot status-offline';
                                statusEl.title = data.ok
                                    ? (data.self ? `Online (self)` : data.via_target ? `Backend online · ${data.latency_ms}ms` : `Online · ${data.latency_ms}ms (${data.status_code})`)
                                    : `Unreachable${data.error ? ': ' + data.error : ''}`;
                            })
                            .catch(() => { statusEl.className = 'status-dot status-unknown'; statusEl.title = 'Ping failed'; });
                        return;
                    }
                }
                statusEl.className = 'status-dot status-unknown';
                statusEl.title = 'Status unknown (API unavailable)';
            }
        });

        if (services.status === 'fulfilled') {
            const http = services.value.http || [];
            const sc = statusCounts(http);
            document.getElementById('statServices').textContent   = http.length;
            document.getElementById('statSvcSuccess').textContent = sc.s;
            document.getElementById('pctSvcSuccess').textContent  = pct(sc.s, http.length);
            document.getElementById('statSvcWarn').textContent    = sc.w;
            document.getElementById('pctSvcWarn').textContent     = pct(sc.w, http.length);
            document.getElementById('statSvcErr').textContent     = sc.e;
            document.getElementById('pctSvcErr').textContent      = pct(sc.e, http.length);
            document.getElementById('cmpSvcSuccess').textContent  = sc.s;
            document.getElementById('cmpSvcWarn').textContent     = sc.w;
            document.getElementById('cmpSvcErr').textContent      = sc.e;
            renderDonut('donutSvc', sc.s, sc.w, sc.e);
            renderBar('barServices', sc.s, sc.w, sc.e);
            document.getElementById('svcTabCount').textContent = http.length;
        }

        if (middlewares.status === 'fulfilled') {
            let all = [...(middlewares.value.http||[]), ...(middlewares.value.tcp||[])];
            if (_activeAgent && _allMiddlewares && _allMiddlewares.length > 0) {
                const _managedMwNames = new Set(_allMiddlewares.map(m => m.name));
                all = all.filter(m => _managedMwNames.has((m.name || '').split('@')[0]));
            }
            const mc = statusCounts(all);
            document.getElementById('statMiddlewares').textContent = all.length;
            document.getElementById('statMwSuccess').textContent   = mc.s;
            document.getElementById('pctMwSuccess').textContent    = pct(mc.s, all.length);
            document.getElementById('statMwWarn').textContent      = mc.w;
            document.getElementById('pctMwWarn').textContent       = pct(mc.w, all.length);
            document.getElementById('statMwErr').textContent       = mc.e;
            document.getElementById('pctMwErr').textContent        = pct(mc.e, all.length);
            document.getElementById('cmpMwSuccess').textContent    = mc.s;
            document.getElementById('cmpMwWarn').textContent       = mc.w;
            document.getElementById('cmpMwErr').textContent        = mc.e;
            renderDonut('donutMw', mc.s, mc.w, mc.e);
            renderBar('barMiddlewares', mc.s, mc.w, mc.e);
        }

        
        if (entrypoints.status === 'fulfilled' && Array.isArray(entrypoints.value) && entrypoints.value.length > 0) {
            const list = document.getElementById('entrypointsList');
            list.innerHTML = entrypoints.value.map(ep => {
                const addr = ep.address || '';
                const port = addr.split(':').pop();
                const isHttp = ['80','8080'].includes(port);
                const isHttps = ['443','8443'].includes(port);
                const color = isHttps ? 'var(--green)' : isHttp ? 'var(--blue)' : 'var(--muted)';
                return `<div class="ep-pill">
                    <span class="d-flat font-semibold" style="color:${color}">${_esc(ep.name)}</span>
                    <span class="font-mono text-xs" style="color:var(--muted)">${_esc(addr)}</span>
                </div>`;
            }).join('');
            _applyEntrypointsVisibility();
            const epNames = entrypoints.value.map(e => e.name);
            if (!_activeAgent) {
                try {
                    const srRes = await fetch('/api/settings/self-route');
                    const sr = await srRes.json();
                    if (sr.domain && sr.entry_point && !epNames.includes(sr.entry_point)) {
                        _showSelfRouteEpWarning(sr.entry_point, sr.default_entry_point || epNames[0]);
                    }
                } catch(e) {}
            }
        }

    } catch (e) {
        console.warn('Traefik API unavailable:', e);
    }

    
    agentFetch('/api/traefik/certs').then(r => r.json()).then(res => {
        const n = (res.certs || []).length;
        document.getElementById('certsTabCount').textContent = n || '-';
    }).catch(() => {});

    agentFetch('/api/traefik/plugins').then(r => r.json()).then(res => {
        const n = (res.plugins || []).length;
        document.getElementById('pluginsTabCount').textContent = n || '-';
    }).catch(() => {});
}
