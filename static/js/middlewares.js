function setMwProtocol(proto) {
    const hid = document.getElementById('mwProtocol');
    if (hid) hid.value = proto;
    const hbtn = document.getElementById('mwProtoHTTP');
    const tbtn = document.getElementById('mwProtoTCP');
    if (hbtn) hbtn.classList.toggle('active-http', proto === 'http');
    if (tbtn) tbtn.classList.toggle('active-http', proto === 'tcp');
    const tplWrap = document.getElementById('mwTemplateWrap');
    if (tplWrap) tplWrap.style.display = proto === 'tcp' ? 'none' : '';
    const wizBtn = document.getElementById('mwModeWizBtn');
    if (wizBtn) wizBtn.style.display = proto === 'tcp' ? 'none' : '';
    if (proto === 'tcp') {
        const tplSel = document.getElementById('mwTemplate');
        if (tplSel) tplSel.value = '';
        setMwMode('yaml');
        _showMwWizard('');
    }
}

function openMwModal() {
    const nameEl = document.getElementById('middlewareName');
    const contentEl = document.getElementById('middlewareContent');
    const editEl = document.getElementById('isMwEdit');
    const titleEl = document.getElementById('mwModalTitle');
    const modal = document.getElementById('mwModal');
    if (!modal) { console.error('mwModal not found'); return; }
    if (editEl) editEl.value = 'false';
    if (nameEl) nameEl.value = '';
    if (contentEl) contentEl.value = '';
    if (titleEl) titleEl.innerText = 'Add Middleware';
    const mwCfSel = document.getElementById('mwConfigFileSelect');
    const mwCfHid = document.getElementById('mwConfigFile');
    const newMwInput = document.getElementById('newMwFileName');
    if (newMwInput) { newMwInput.style.display = 'none'; newMwInput.value = ''; }
    _populateConfigFileSelect('mw').then(() => { modal.style.display = 'flex'; });
    const mwTplSel = document.getElementById('mwTemplate');
    if (mwTplSel) mwTplSel.value = '';
    setMwProtocol('http');
    const origProtoEl = document.getElementById('originalMwProtocol');
    if (origProtoEl) origProtoEl.value = '';
    setMwMode('yaml');
    _showMwWizard('');
    _initMwMonaco('');
    _loadCustomMwTemplates();
}

function closeMwModal() { document.getElementById('mwModal').style.display = 'none'; }

function togglePwVis(inputId, btn) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const show = el.type === 'password';
    el.type = show ? 'text' : 'password';
    btn.innerHTML = show ? '<i class="ph-bold ph-eye-slash text-sm"></i>' : '<i class="ph-bold ph-eye text-sm"></i>';
}

async function generateDigestAuth() {
    const user  = (document.getElementById('wizDaGenUser')?.value || '').trim();
    const realm = (document.getElementById('wizDaGenRealm')?.value || '').trim();
    const pass  = (document.getElementById('wizDaGenPass')?.value || '');
    if (!user || !realm || !pass) { showToast('Enter a username, realm and password', 'error'); return; }
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const res  = await fetch('/api/tools/digestauth', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token': csrf}, body: JSON.stringify({username: user, realm, password: pass}) });
        const json = await res.json();
        if (!json.ok) { showToast(json.error || 'Failed', 'error'); return; }
        const ta = document.getElementById('wizDaUsers');
        if (ta) ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + json.hash;
        document.getElementById('wizDaGenUser').value = '';
        document.getElementById('wizDaGenRealm').value = '';
        document.getElementById('wizDaGenPass').value = '';
    } catch(e) { showToast('Error generating hash', 'error'); }
}

async function generateHtpasswd() {
    const user = (document.getElementById('wizBaGenUser')?.value || '').trim();
    const pass = (document.getElementById('wizBaGenPass')?.value || '');
    if (!user || !pass) { showToast('Enter a username and password', 'error'); return; }
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content || '';
    try {
        const res  = await fetch('/api/tools/htpasswd', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-Token': csrf}, body: JSON.stringify({username: user, password: pass}) });
        const json = await res.json();
        if (!json.ok) { showToast(json.error || 'Failed', 'error'); return; }
        const ta = document.getElementById('wizBaUsers');
        if (ta) ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + json.hash;
        document.getElementById('wizBaGenUser').value = '';
        document.getElementById('wizBaGenPass').value = '';
    } catch(e) { showToast('Error generating hash', 'error'); }
}

function setMwMode(mode) {
    document.getElementById('mwCurrentMode').value = mode;
    const wizBtn  = document.getElementById('mwModeWizBtn');
    const yamlBtn = document.getElementById('mwModeYamlBtn');
    const wizSec  = document.getElementById('mwWizardSection');
    const edSec   = document.getElementById('mwEditorSection');
    if (mode === 'wizard') {
        wizBtn.classList.add('active-http');
        yamlBtn.classList.remove('active-http');
        if (wizSec) wizSec.style.display = '';
        if (edSec)  edSec.style.display  = 'none';
    } else {
        yamlBtn.classList.add('active-http');
        wizBtn.classList.remove('active-http');
        if (wizSec) wizSec.style.display = 'none';
        if (edSec)  edSec.style.display  = '';
        const tpl = document.getElementById('mwTemplate')?.value;
        if (tpl && _wizardTemplates.has(tpl)) {
            buildYamlFromWizard();
            const yaml = document.getElementById('middlewareContent')?.value || '';
            if (_mwMonacoEditor) {
                _mwMonacoEditor.setValue(yaml);
                setTimeout(() => _mwMonacoEditor.layout(), 50);
            } else {
                _initMwMonaco(yaml);
            }
        } else if (_mwMonacoEditor) {
            setTimeout(() => _mwMonacoEditor.layout(), 50);
        }
    }
}

const _wizardTemplates = new Set(['basicAuth','digestAuth','forwardAuth','forwardAuthAuthentik','forwardAuthAuthelia','forwardAuthGatekeeper','oidcAuth','ipAllowList','ipAllowListPrivate','rateLimit','secureHeaders','corsHeaders','encodedCharacters','redirectScheme','redirectRegex','stripPrefix','addPrefix','replacePath','compress','retry','circuitBreaker','buffering','chain','inFlightReq']);

const _wizKeyMap = {
    forwardAuthAuthentik: 'forwardAuth', forwardAuthAuthelia: 'forwardAuth',
    ipAllowListPrivate: 'ipAllowList',
};

function _wizIpStrategySync() {
    const mode = document.getElementById('wizIpStrategy')?.value || 'direct';
    const depthRow = document.getElementById('wizIpDepthRow');
    const exRow    = document.getElementById('wizIpExcludedRow');
    if (depthRow) depthRow.style.display = mode === 'depth' ? '' : 'none';
    if (exRow)    exRow.style.display    = mode === 'excluded' ? '' : 'none';
}

function _showMwWizard(tpl) {
    document.querySelectorAll('.mw-wiz-form').forEach(el => el.style.display = 'none');
    const none = document.getElementById('mwWiz-none');
    if (!tpl || !_wizardTemplates.has(tpl)) { if (none) none.style.display = ''; return; }
    const key = _wizKeyMap[tpl] || tpl;
    const sec = document.getElementById('mwWiz-' + key);
    if (sec) {
        sec.style.display = '';
        sec.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea').forEach(el => { el.value = ''; });
        sec.querySelectorAll('input[type=checkbox]').forEach(el => { el.checked = el.defaultChecked; });
    }
    if (key === 'ipAllowList') {
        const strat = document.getElementById('wizIpStrategy');
        if (strat) strat.value = 'direct';
        const depth = document.getElementById('wizIpDepth');
        if (depth) depth.value = '1';
        _wizIpStrategySync();
    }
    if (tpl === 'forwardAuthAuthentik') {
        const el = document.getElementById('wizFaAddress'); if (el) el.value = 'http://authentik-server:9000/outpost.goauthentik.io/auth/traefik';
        const hd = document.getElementById('wizFaHeaders'); if (hd) hd.value = 'X-authentik-username\nX-authentik-groups\nX-authentik-email\nX-authentik-name\nX-authentik-uid';
    } else if (tpl === 'forwardAuthAuthelia') {
        const el = document.getElementById('wizFaAddress'); if (el) el.value = 'http://authelia:9091/api/authz/forward-auth';
        const hd = document.getElementById('wizFaHeaders'); if (hd) hd.value = 'Remote-User\nRemote-Groups\nRemote-Name\nRemote-Email';
    } else if (tpl === 'forwardAuthGatekeeper') {
        const hd = document.getElementById('wizGkHeaders'); if (hd) hd.value = 'X-Auth-User\nX-Auth-Email\nX-Auth-Groups';
        const ga = document.getElementById('wizGkAuthorization'); if (ga) ga.checked = false;
    } else if (tpl === 'oidcAuth') {
        const sc = document.getElementById('wizOidcScopes'); if (sc) sc.value = 'openid\nprofile\nemail';
        const hd = document.getElementById('wizOidcHeaders'); if (hd) hd.value = 'X-Forwarded-User: preferred_username\nX-Forwarded-Email: email\nX-Forwarded-Name: name';
        const mx = document.getElementById('wizOidcSessionMaxAge'); if (mx) mx.value = '86400';
    } else if (tpl === 'ipAllowListPrivate') {
        const el = document.getElementById('wizIpCidrs'); if (el) el.value = '10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16\n127.0.0.1/32';
    }
}

function buildYamlFromWizard() {
    const tpl = document.getElementById('mwTemplate')?.value;
    if (!tpl || !_wizardTemplates.has(tpl)) return;
    let yaml = '';
    const key = _wizKeyMap[tpl] || tpl;

    const _lines = (id) => (document.getElementById(id)?.value || '').trim().split('\n').map(l => l.trim()).filter(Boolean);
    const _val   = (id, def='') => (document.getElementById(id)?.value || def).trim();
    const _chk   = (id, def=false) => document.getElementById(id)?.checked ?? def;

    if (key === 'basicAuth') {
        const users = _lines('wizBaUsers');
        const realm = _val('wizBaRealm');
        yaml = 'basicAuth:\n  users:\n' + users.map(l => '    - "' + l + '"').join('\n');
        if (realm) yaml += '\n  realm: "' + realm + '"';

    } else if (key === 'digestAuth') {
        const users = _lines('wizDaUsers');
        yaml = 'digestAuth:\n  users:\n' + users.map(l => '    - "' + l + '"').join('\n');

    } else if (key === 'forwardAuth') {
        const addr  = _val('wizFaAddress');
        const trust = _chk('wizFaTrust', true);
        const hdrs  = _lines('wizFaHeaders');
        const maxBody = _val('wizFaMaxBody');
        yaml = 'forwardAuth:\n  address: "' + addr + '"\n  trustForwardHeader: ' + trust;
        if (hdrs.length) yaml += '\n  authResponseHeaders:\n' + hdrs.map(h => '    - "' + h + '"').join('\n');
        if (maxBody && /^\d+$/.test(maxBody)) yaml += '\n  maxResponseBodySize: ' + maxBody;

    } else if (key === 'forwardAuthGatekeeper') {
        const url    = _val('wizGkUrl').replace(/\/+$/, '');
        const policy = _val('wizGkPolicy');
        const addr   = url ? url + '/auth/verify' + (policy ? '?policy=' + policy : '') : '';
        const trust  = _chk('wizGkTrust', false);
        const auth   = _chk('wizGkAuthorization', false);
        const hdrs   = _lines('wizGkHeaders');
        const allHdrs = auth ? ['Authorization', ...hdrs.filter(h => h !== 'Authorization')] : hdrs;
        const gkMaxBody = _val('wizGkMaxBody');
        yaml = 'forwardAuth:\n  address: "' + addr + '"\n  trustForwardHeader: ' + trust;
        if (allHdrs.length) yaml += '\n  authResponseHeaders:\n' + allHdrs.map(h => '    - "' + h + '"').join('\n');
        if (gkMaxBody && /^\d+$/.test(gkMaxBody)) yaml += '\n  maxResponseBodySize: ' + gkMaxBody;

    } else if (key === 'oidcAuth') {
        const providerUrl    = _val('wizOidcProviderUrl');
        const clientId       = _val('wizOidcClientId');
        const clientSecret   = _val('wizOidcClientSecret');
        const secret         = _val('wizOidcSecret');
        const scopes         = _lines('wizOidcScopes');
        const maxAge         = parseInt(_val('wizOidcSessionMaxAge','86400')) || 86400;
        const headerLines    = _lines('wizOidcHeaders');
        const bypassLines    = _lines('wizOidcBypass');
        const headers = headerLines.map(l => {
            const idx = l.indexOf(':');
            return idx > -1 ? { Name: l.slice(0, idx).trim(), Value: '{' + '{`' + '{' + '{ .claims.' + l.slice(idx+1).trim() + ' }' + '}`' + '}' + '}' } : null;
        }).filter(Boolean);
        yaml = 'plugin:\n  traefik-oidc-auth:';
        if (secret) yaml += '\n    Secret: "' + secret + '"';
        yaml += '\n    Provider:';
        if (providerUrl) yaml += '\n      Url: "' + providerUrl + '"';
        if (clientId)    yaml += '\n      ClientId: "' + clientId + '"';
        if (clientSecret) yaml += '\n      ClientSecret: "' + clientSecret + '"';
        if (scopes.length) yaml += '\n    Scopes:\n' + scopes.map(s => '      - ' + s).join('\n');
        yaml += '\n    SessionCookie:\n      MaxAge: ' + maxAge;
        if (headers.length) yaml += '\n    Headers:\n' + headers.map(h => '      - Name: "' + h.Name + '"\n        Value: "' + h.Value + '"').join('\n');
        if (bypassLines.length) yaml += '\n    BypassAuthenticationRule:\n' + bypassLines.map(r => '      - "' + r + '"').join('\n');

    } else if (key === 'rateLimit') {
        yaml = 'rateLimit:\n  average: ' + _val('wizRlAvg','100') + '\n  burst: ' + _val('wizRlBurst','50') + '\n  period: ' + _val('wizRlPeriod','1s');

    } else if (key === 'ipAllowList') {
        const cidrs = _lines('wizIpCidrs');
        yaml = 'ipAllowList:\n  sourceRange:\n' + cidrs.map(c => '    - "' + c + '"').join('\n');
        const strat = _val('wizIpStrategy', 'direct');
        if (strat === 'depth') {
            const depth = _val('wizIpDepth', '1');
            yaml += '\n  ipStrategy:\n    depth: ' + (/^\d+$/.test(depth) && +depth > 0 ? depth : '1');
        } else if (strat === 'excluded') {
            const excluded = _lines('wizIpExcluded');
            if (excluded.length) yaml += '\n  ipStrategy:\n    excludedIPs:\n' + excluded.map(c => '      - "' + c + '"').join('\n');
        }

    } else if (key === 'secureHeaders') {
        const lines = ['headers:'];
        if (_chk('wizShSsl'))     lines.push('  sslRedirect: true');
        if (_chk('wizShHsts')) {
            lines.push('  forceSTSHeader: true');
            lines.push('  stsSeconds: ' + _val('wizShHstsAge','315360000'));
            if (_chk('wizShSub'))     lines.push('  stsIncludeSubdomains: true');
            if (_chk('wizShPreload')) lines.push('  stsPreload: true');
        }
        if (_chk('wizShNosniff'))  lines.push('  contentTypeNosniff: true');
        if (_chk('wizShXss'))      lines.push('  browserXssFilter: true');
        if (_chk('wizShFrame'))    lines.push('  frameDeny: true');
        if (_chk('wizShReferrer')) lines.push('  referrerPolicy: "same-origin"');
        yaml = lines.join('\n');

    } else if (key === 'corsHeaders') {
        const methods = ['GET','POST','PUT','DELETE','PATCH','OPTIONS','HEAD']
            .filter(m => _chk('wizCors' + m.charAt(0) + m.slice(1).toLowerCase()));
        const origins = _lines('wizCorsOrigins');
        const hdrs    = _lines('wizCorsHeaders');
        const maxAge  = _val('wizCorsMaxAge','100');
        const vary    = _chk('wizCorsVary', true);
        const lines = ['headers:'];
        if (methods.length) lines.push('  accessControlAllowMethods:\n' + methods.map(m => '    - ' + m).join('\n'));
        if (hdrs.length)    lines.push('  accessControlAllowHeaders:\n' + hdrs.map(h => '    - "' + h + '"').join('\n'));
        if (origins.length) lines.push('  accessControlAllowOriginList:\n' + origins.map(o => '    - "' + o + '"').join('\n'));
        lines.push('  accessControlMaxAge: ' + maxAge);
        if (vary) lines.push('  addVaryHeader: true');
        yaml = lines.join('\n');

    } else if (key === 'encodedCharacters') {
        const opts = [
            ['allowEncodedSlash', 'wizEcSlash'],
            ['allowEncodedBackSlash', 'wizEcBackSlash'],
            ['allowEncodedSemicolon', 'wizEcSemicolon'],
            ['allowEncodedPercent', 'wizEcPercent'],
            ['allowEncodedQuestionMark', 'wizEcQuestion'],
            ['allowEncodedHash', 'wizEcHash'],
        ];
        const enabled = opts.filter(([k, id]) => _chk(id, false)).map(([k]) => k);
        yaml = enabled.length
            ? 'encodedCharacters:\n' + enabled.map(k => '  ' + k + ': true').join('\n')
            : 'encodedCharacters: {}';

    } else if (key === 'redirectScheme') {
        yaml = 'redirectScheme:\n  scheme: ' + _val('wizRsScheme','https') + '\n  permanent: ' + _chk('wizRsPermanent',true);

    } else if (key === 'redirectRegex') {
        yaml = 'redirectRegex:\n  regex: "' + _val('wizRrRegex') + '"\n  replacement: "' + _val('wizRrReplacement') + '"\n  permanent: ' + _chk('wizRrPermanent',true);

    } else if (key === 'stripPrefix') {
        const prefixes = _lines('wizSpPrefixes');
        yaml = 'stripPrefix:\n  prefixes:\n' + prefixes.map(p => '    - "' + p + '"').join('\n');

    } else if (key === 'addPrefix') {
        yaml = 'addPrefix:\n  prefix: "' + _val('wizApPrefix') + '"';

    } else if (key === 'replacePath') {
        yaml = 'replacePath:\n  path: "' + _val('wizRpPath') + '"';

    } else if (key === 'compress') {
        yaml = 'compress:\n  minResponseBodyBytes: ' + _val('wizCmpMin','1200');

    } else if (key === 'retry') {
        yaml = 'retry:\n  attempts: ' + _val('wizRtAttempts','4') + '\n  initialInterval: ' + _val('wizRtInterval','100ms');

    } else if (key === 'circuitBreaker') {
        yaml = 'circuitBreaker:\n  expression: "' + _val('wizCbExpr') + '"';

    } else if (key === 'buffering') {
        const retryExpr = _val('wizBufRetry');
        yaml = 'buffering:\n  maxRequestBodyBytes: ' + _val('wizBufReq','10485760') + '\n  maxResponseBodyBytes: ' + _val('wizBufRes','10485760');
        if (retryExpr) yaml += '\n  retryExpression: "' + retryExpr + '"';

    } else if (key === 'chain') {
        const mws = _lines('wizChMiddlewares');
        yaml = 'chain:\n  middlewares:\n' + mws.map(m => '    - ' + m).join('\n');

    } else if (key === 'inFlightReq') {
        yaml = 'inFlightReq:\n  amount: ' + _val('wizIfAmount','10');
    }

    if (yaml) {
        document.getElementById('middlewareContent').value = yaml;
        if (_mwMonacoEditor) _mwMonacoEditor.setValue(yaml);
    }
}

function onMwConfigFileChange(sel) {
    const newInput = document.getElementById('newMwFileName');
    const cfHid    = document.getElementById('mwConfigFile');
    if (sel.value === '__new__') {
        if (newInput) newInput.style.display = '';
        const mwName = (document.getElementById('middlewareName')?.value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        if (newInput && !newInput.value && mwName) newInput.value = `middlewares-${mwName}.yml`;
        if (cfHid) cfHid.value = newInput?.value || '';
    } else {
        if (newInput) { newInput.style.display = 'none'; newInput.value = ''; }
        if (cfHid) cfHid.value = sel.value;
    }
}

async function saveMwAjax(event) {
    event.preventDefault();
    const _mwCfWrap = document.getElementById('mwConfigFileSelectWrap');
    const _mwCfSel  = document.getElementById('mwConfigFileSelect');
    if (_mwCfWrap && _mwCfWrap.style.display !== 'none' && _mwCfSel && !_mwCfSel.value
            && !document.getElementById('mwConfigFile').value) {
        showToast('Select a config file for this middleware', 'error');
        return;
    }
    const mwMode = document.getElementById('mwCurrentMode')?.value;
    if (mwMode === 'wizard') {
        const tpl = document.getElementById('mwTemplate')?.value || '';
        if (tpl === 'basicAuth' || tpl === 'digestAuth') {
            const usersEl = document.getElementById(tpl === 'basicAuth' ? 'wizBaUsers' : 'wizDaUsers');
            const users = (usersEl?.value || '').trim().split('\n').map(l => l.trim()).filter(Boolean);
            if (!users.length) { showToast('Add at least one user before saving', 'error'); return; }
        }
        if (['forwardAuth','forwardAuthAuthentik','forwardAuthAuthelia'].includes(tpl)) {
            const addr = (document.getElementById('wizFaAddress')?.value || '').trim();
            if (!addr) { showToast('Forward auth address is required', 'error'); return; }
        }
        if (tpl === 'forwardAuthGatekeeper') {
            const url = (document.getElementById('wizGkUrl')?.value || '').trim();
            if (!url) { showToast('Gatekeeper URL is required', 'error'); return; }
        }
        buildYamlFromWizard();
    } else {
        const content = _mwMonacoEditor ? _mwMonacoEditor.getValue() : (document.getElementById('middlewareContent')?.value || '');
        if (_mwMonacoEditor) document.getElementById('middlewareContent').value = content;
        if (!content.trim()) { showToast('Middleware content cannot be empty', 'error'); return; }
    }
    const form = event.target;
    const mwFn = document.getElementById('newMwFileName');
    if (mwFn && mwFn.style.display !== 'none' && mwFn.value && !/\.ya?ml$/.test(mwFn.value)) {
        mwFn.value += '.yml';
        document.getElementById('mwConfigFile').value = mwFn.value;
    }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
        const fd = new FormData(form);
        if (_activeAgent) fd.append('agent_id', _activeAgent.id);
        const res = await fetch(form.action, { method:'POST', headers:{'X-Requested-With':'fetch'}, body: fd });
        const json = await res.json();
        showToast(json.message, json.ok ? 'success' : 'error');
        if (json.ok) { closeMwModal(); _cachedMiddlewares = null; refreshRoutes(); fetchNotifications(); if (typeof window.rmInvalidateData === 'function') window.rmInvalidateData(); setTimeout(fetchNotifications, 8000); }
    } catch(e) {
        showToast('Error saving middleware', 'error');
    } finally {
        btn.disabled = false;
    }
}

async function deleteMw(name, configFile) {
    if (!await _confirm('Delete middleware "' + name + '"?', 'Delete Middleware', 'Delete')) return;
    const data = new FormData();
    data.append('csrf_token', document.querySelector('meta[name="csrf-token"]')?.content || '');
    if (configFile) data.append('configFile', configFile);
    if (_activeAgent) data.append('agent_id', _activeAgent.id);
    try {
        const res = await fetch('/delete-middleware/' + encodeURIComponent(name), { method:'POST', headers:{'X-Requested-With':'fetch'}, body: data });
        const json = await res.json();
        showToast(json.message, json.ok ? 'success' : 'error');
        if (json.ok) { _cachedMiddlewares = null; refreshRoutes(); fetchNotifications(); if (typeof window.rmInvalidateData === 'function') window.rmInvalidateData(); }
    } catch(e) { showToast('Error deleting middleware', 'error'); }
}

function renderMwGrid(middlewares) {
    _allMiddlewares = middlewares;
    const grid = document.getElementById('mwGrid');
    if (!grid) return;
    const staticEmpty = document.getElementById('mwStaticEmpty');
    if (staticEmpty) staticEmpty.style.display = 'none';
    grid.innerHTML = middlewares.map(mw => {
        const typeLower = (mw.type || 'http').toLowerCase();
        const typeUpper = typeLower === 'tcp' ? 'TCP' : 'HTTP';
        const badgeClass = typeLower === 'tcp' ? 'badge-tcp' : 'badge-http';
        const mwJson = JSON.stringify(mw).replace(/'/g, '&#39;');
        const mwCfArg = mw.configFile ? `,'${_esc(mw.configFile)}'` : ',\'\'';
        const mwCfBadge = mw.configFile ? `<span class="badge badge-muted" style="font-size:9px;white-space:nowrap">${_esc(mw.configFile)}</span>` : '';
        const dataAttrs = `data-mwname="${_esc(mw.name.toLowerCase())}" data-mwtype="${typeLower}"`;
        const actions = `<div class="flex gap-1.5"><button type="button" data-mw='${mwJson}' onclick="openMwDetail(this)" class="pill-btn pill-btn-blue" title="View details"><i class="ph-bold ph-info text-xs"></i></button><button type="button" onclick="deleteMw('${_esc(mw.name)}'${mwCfArg})" class="pill-btn pill-btn-red" title="Delete"><i class="ph-bold ph-trash text-xs"></i></button><button type="button" data-mw='${mwJson}' onclick="handleMwEdit(this)" class="pill-btn pill-btn-blue" title="Edit"><i class="ph-bold ph-pencil-simple text-xs"></i></button></div>`;
        if (_mwViewMode === 'list') {
            return `<div class="svc-list-row mw-list-grid mw-card" ${dataAttrs}><div style="display:flex;align-items:center"><span class="badge ${badgeClass}" style="font-size:9px">${typeUpper}</span></div><div class="svc-list-col-name">${_esc(mw.name)}</div><div>${mwCfBadge}</div>${actions}</div>`;
        }
        return `<div class="card p-4 mw-card" ${dataAttrs}><div class="flex justify-between items-start mb-3"><div><div class="flex items-center gap-1.5 mb-1.5"><span class="badge ${badgeClass} w-fit">${typeUpper}</span>${mwCfBadge}</div><h3 class="font-bold text-sm" style="color:var(--text)">${_esc(mw.name)}</h3></div>${actions}</div><div class="rounded-md p-3 overflow-x-auto" style="background:var(--input-bg);border:1px solid var(--border)"><pre class="text-xs font-mono leading-relaxed" style="color:var(--green)">${_esc(mw.yaml)}</pre></div></div>`;
    }).join('');

    if (_mwViewMode === 'list') {
        const header = `<div class="svc-list-header mw-list-grid"><div>Protocol</div><div>Name</div><div>Config File</div><div></div></div>`;
        grid.className = '';
        grid.innerHTML = `<div class="svc-list">${header}${grid.innerHTML}</div>`;
    } else {
        grid.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
    }
    _mwCardEls = Array.from(grid.querySelectorAll('.mw-card'));
    const _mwCountEl = document.getElementById('countMw');
    if (_mwCountEl) _mwCountEl.textContent = middlewares.length;
    filterMw();
}

async function handleMwEdit(btn) {
    const mw = JSON.parse(btn.getAttribute('data-mw'));
    document.getElementById('isMwEdit').value = 'true';
    document.getElementById('originalMwId').value = mw.name;
    document.getElementById('middlewareName').value = mw.name;
    document.getElementById('mwModalTitle').innerText = 'Edit ' + mw.name;
    document.getElementById('mwConfigFile').value = mw.configFile || '';
    const newMwInput = document.getElementById('newMwFileName');
    if (newMwInput) { newMwInput.style.display = 'none'; newMwInput.value = ''; }
    const mwTplSel2 = document.getElementById('mwTemplate');
    if (mwTplSel2) mwTplSel2.value = '';
    const mwProto = (mw.type || 'http').toLowerCase();
    setMwProtocol(mwProto);
    const origProtoEl2 = document.getElementById('originalMwProtocol');
    if (origProtoEl2) origProtoEl2.value = mwProto;
    setMwMode('yaml');
    _showMwWizard('');
    await _populateConfigFileSelect('mw');
    const cfSel = document.getElementById('mwConfigFileSelect');
    if (mw.configFile) {
        if (cfSel) cfSel.value = mw.configFile;
        document.getElementById('mwConfigFile').value = mw.configFile;
    }
    document.getElementById('mwModal').style.display = 'flex';
    _initMwMonaco(mw.yaml.trim());
    _loadCustomMwTemplates();
}

const mwTemplates = {
    basicAuth: `basicAuth:\n  users:\n    - "admin:$apr1$H6uskkkW$IgXLP6ewTrSuBkTrqE8wj/"`,
    digestAuth: `digestAuth:\n  users:\n    - "admin:traefik:a2688e031edb4be6fe3079ef99a6274e"`,
    forwardAuth: `forwardAuth:\n  address: "http://auth-service:4181"\n  trustForwardHeader: true\n  authResponseHeaders:\n    - "X-Auth-User"\n    - "X-Auth-Token"`,
    forwardAuthAuthentik: `forwardAuth:\n  address: "http://authentik-server:9000/outpost.goauthentik.io/auth/traefik"\n  trustForwardHeader: true\n  authResponseHeaders:\n    - X-authentik-username\n    - X-authentik-groups\n    - X-authentik-email\n    - X-authentik-name\n    - X-authentik-uid`,
    forwardAuthAuthelia: `forwardAuth:\n  address: "http://authelia:9091/api/authz/forward-auth"\n  trustForwardHeader: true\n  authResponseHeaders:\n    - Remote-User\n    - Remote-Groups\n    - Remote-Name\n    - Remote-Email`,
    forwardAuthGatekeeper: `forwardAuth:\n  address: "https://auth.example.com/auth/verify"\n  trustForwardHeader: false\n  authResponseHeaders:\n    - "X-Auth-User"\n    - "X-Auth-Email"\n    - "X-Auth-Groups"`,
    oidcAuth: `plugin:\n  traefik-oidc-auth:\n    Secret: "change-me-32-char-secret"\n    Provider:\n      Url: "https://login.microsoftonline.com/{tenant}/v2.0"\n      ClientId: "client-id"\n      ClientSecret: "client-secret"\n    Scopes:\n      - openid\n      - profile\n      - email\n    SessionCookie:\n      MaxAge: 86400\n    Headers:\n      - Name: "X-Forwarded-User"\n        Value: "{{ '{{' }}\`{{ '{{' }} .claims.preferred_username {{ '}}' }}\`{{ '}}' }}"\n      - Name: "X-Forwarded-Email"\n        Value: "{{ '{{' }}\`{{ '{{' }} .claims.email {{ '}}' }}\`{{ '}}' }}"`,
    ipAllowList: `ipAllowList:\n  sourceRange:\n    - "127.0.0.1/32"\n    - "192.168.1.0/24"`,
    ipAllowListPrivate: `ipAllowList:\n  sourceRange:\n    - "10.0.0.0/8"\n    - "172.16.0.0/12"\n    - "192.168.0.0/16"\n    - "127.0.0.1/32"`,
    rateLimit: `rateLimit:\n  average: 100\n  burst: 50\n  period: 1s`,
    secureHeaders: `headers:\n  sslRedirect: true\n  forceSTSHeader: true\n  stsSeconds: 315360000\n  stsIncludeSubdomains: true\n  stsPreload: true\n  contentTypeNosniff: true\n  browserXssFilter: true\n  referrerPolicy: "same-origin"\n  frameDeny: true`,
    corsHeaders: `headers:\n  accessControlAllowMethods:\n    - GET\n    - OPTIONS\n    - PUT\n    - POST\n    - DELETE\n  accessControlAllowHeaders:\n    - "*"\n  accessControlAllowOriginList:\n    - "https://example.com"\n  accessControlMaxAge: 100\n  addVaryHeader: true`,
    redirectScheme: `redirectScheme:\n  scheme: https\n  permanent: true`,
    redirectRegex: `redirectRegex:\n  regex: "^http://(.*)"\n  replacement: "https://$${1}"\n  permanent: true`,
    stripPrefix: `stripPrefix:\n  prefixes:\n    - "/api"\n    - "/v1"`,
    addPrefix: `addPrefix:\n  prefix: "/api"`,
    replacePath: `replacePath:\n  path: "/foo"`,
    compress: `compress:\n  minResponseBodyBytes: 1200`,
    retry: `retry:\n  attempts: 4\n  initialInterval: 100ms`,
    circuitBreaker: `circuitBreaker:\n  expression: "NetworkErrorRatio() > 0.5"`,
    buffering: `buffering:\n  maxRequestBodyBytes: 10485760\n  maxResponseBodyBytes: 10485760\n  retryExpression: "IsNetworkError() && Attempts() < 2"`,
    chain: `chain:\n  middlewares:\n    - redirect-https\n    - secure-headers\n    - rate-limit`,
    inFlightReq: `inFlightReq:\n  amount: 10`,
};

async function _loadCustomMwTemplates() {
    const grp = document.getElementById('mwCustomOptgroup');
    if (!grp) return;
    try {
        const res  = await fetch('/api/mw/templates');
        const data = await res.json();
        const templates = data.templates || [];
        grp.innerHTML = templates.map(t => `<option value="custom:${t.id}">${_esc(t.name)}</option>`).join('');
        grp.style.display = templates.length ? '' : 'none';
    } catch(e) {
        grp.style.display = 'none';
    }
}

function applyMwTemplate(select) {
    const tpl = select.value;
    if (!tpl) return;
    if (tpl.startsWith('custom:')) {
        const id = tpl.slice(7);
        fetch('/api/mw/templates').then(r => r.json()).then(data => {
            const t = (data.templates || []).find(x => x.id === id);
            if (t) {
                setMwMode('yaml');
                if (_mwMonacoEditor) _mwMonacoEditor.setValue(t.yaml);
                else document.getElementById('middlewareContent').value = t.yaml;
            }
        });
    } else if (_wizardTemplates.has(tpl)) {
        _showMwWizard(tpl);
        setMwMode('wizard');
    } else if (mwTemplates[tpl]) {
        setMwMode('yaml');
        const val = mwTemplates[tpl];
        if (_mwMonacoEditor) _mwMonacoEditor.setValue(val);
        else document.getElementById('middlewareContent').value = val;
    }
}

let _mwFilter = 'all';
let _mwCardEls = [];
function filterMw(f) {
    if (f) {
        _mwFilter = f;
        ['all','http','tcp'].forEach(k => {
            document.getElementById('mwf-'+k)?.classList.toggle('active-http', k === f);
        });
    }
    const search = (document.getElementById('searchMw')?.value || '').toLowerCase();
    let visible = 0;
    for (const card of _mwCardEls) {
        const show = card.dataset.mwname.includes(search) && (_mwFilter === 'all' || card.dataset.mwtype === _mwFilter);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
    }
    const emptyEl = document.getElementById('mwEmpty');
    const emptyText = document.getElementById('mwEmptyText');
    if (emptyEl) {
        emptyEl.classList.toggle('hidden', visible > 0 || _mwCardEls.length === 0);
        if (emptyText) emptyText.textContent = search ? `No middlewares match "${search}"` : 'No middlewares found';
    }
}
let _mwViewMode = tmPref('mwViewMode');

function toggleMwView() {
    _mwViewMode = _mwViewMode === 'grid' ? 'list' : 'grid';
    tmSetPref('mwViewMode', _mwViewMode);
    const icon = document.getElementById('mwViewIcon');
    if (icon) icon.className = _mwViewMode === 'grid' ? 'ph-bold ph-list' : 'ph-bold ph-squares-four';
    renderMwGrid(_allMiddlewares);
}

function openMwDetail(btn) {
    const mw = JSON.parse(btn.getAttribute('data-mw'));
    const panel = document.getElementById('mwDetailPanel');
    const backdrop = document.getElementById('mwDetailBackdrop');
    const badge = document.getElementById('mwDetailProtoBadge');
    const title = document.getElementById('mwDetailTitle');
    const content = document.getElementById('mwDetailContent');
    const editBtn = document.getElementById('mwDetailEditBtn');

    const typeLower = (mw.type || 'http').toLowerCase();
    badge.className = 'badge badge-' + (typeLower === 'tcp' ? 'tcp' : 'http');
    badge.textContent = typeLower === 'tcp' ? 'TCP' : 'HTTP';
    title.textContent = mw.name;

    const isFileMw = !mw.provider || mw.provider === 'file';
    editBtn.style.display = isFileMw ? '' : 'none';
    if (isFileMw) {
        editBtn.onclick = () => {
            closeMwDetail();
            const fakeBtn = document.createElement('button');
            fakeBtn.setAttribute('data-mw', JSON.stringify(mw));
            handleMwEdit(fakeBtn);
        };
    }

    content.innerHTML = renderMwDetailPanel(mw);
    panel.classList.add('open');
    backdrop.classList.add('open');
    if (!setDetailDockOpen(true)) document.body.style.overflow = 'hidden';
}

function closeMwDetail() {
    setDetailDockOpen(false);
    document.getElementById('mwDetailPanel').classList.remove('open');
    document.getElementById('mwDetailBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}

function renderMwDetailPanel(mw) {
    const rows = [];

    const row = (label, val) => val ? `<div class="flex gap-3 py-2.5" style="border-bottom:1px solid var(--border)"><div class="text-xs font-semibold uppercase tracking-wider w-28 flex-shrink-0 pt-0.5" style="color:var(--muted)">${label}</div><div class="text-sm font-mono break-all" style="color:var(--text)">${val}</div></div>` : '';

    rows.push(row('Name', _esc(mw.name)));
    if (mw.type) rows.push(row('Protocol', (mw.type || '').toUpperCase()));
    if (mw.configFile) rows.push(row('Config File', _esc(mw.configFile)));

    let yamlHtml = '';
    if (mw.yaml) {
        yamlHtml = `<div class="mt-4"><div class="text-xs font-semibold uppercase tracking-wider mb-2" style="color:var(--muted)">Configuration</div><div class="rounded-lg p-4 overflow-x-auto" style="background:var(--input-bg);border:1px solid var(--border)"><pre class="text-xs font-mono leading-relaxed whitespace-pre-wrap" style="color:var(--green)">${_esc(mw.yaml)}</pre></div></div>`;
    }

    return `<div>${rows.join('')}</div>${yamlHtml}`;
}

let _allPlugins = [];

let _pluginCanManage = false;
let _pluginEditName  = null;
let _pluginStaticMonaco = null;
let _pluginMwMonaco = null;

async function refreshPluginsTab() {
    const container = document.getElementById('pluginsContent');
    container.innerHTML = `<div class="text-center py-16" style="color:var(--muted)"><i class="ph-light ph-spinner-gap text-4xl block mb-3 animate-spin opacity-40"></i><p>Loading plugins...</p></div>`;
    try {
        const availP = _activeAgent
            ? Promise.resolve({ available: false })
            : fetch('/api/static/available').then(r => r.json());
        const [res, avail] = await Promise.all([
            agentFetch('/api/traefik/plugins').then(r => r.json()),
            availP,
        ]);
        _pluginCanManage = !_activeAgent && avail.available === true;
        const addBtn = document.getElementById('pluginAddBtnWrap');
        if (addBtn) addBtn.style.display = _pluginCanManage ? 'flex' : 'none';

        const plugins = Array.isArray(res.plugins) ? res.plugins : [];

        if (res.error && plugins.length === 0) {
            container.innerHTML = `
            <div class="text-center py-10 rounded-xl" style="border:1px solid var(--border);color:var(--muted)">
                <i class="ph-light ph-puzzle-piece text-5xl block mb-3 opacity-30"></i>
                <p class="font-semibold mb-1" style="color:var(--text)">Static config not configured</p>
                <p class="text-xs max-w-xs mx-auto mb-5">To manage plugins here, mount your Traefik static config and set <code class="font-mono" style="color:var(--blue)">STATIC_CONFIG_PATH</code>.</p>
                <div class="flex flex-col gap-2 items-center text-xs">
                    <a href="https://get-traefik.xyzlab.dev" target="_blank" class="btn-secondary" style="text-decoration:none"><i class="ph-bold ph-terminal"></i> Install script</a>
                    <a href="https://traefik-manager.xyzlab.dev/env-vars#static-config-path" target="_blank" class="btn-secondary" style="text-decoration:none"><i class="ph-bold ph-book-open"></i> Setup docs</a>
                </div>
                <div class="mt-5 mx-auto text-left rounded-lg p-3 text-xs font-mono" style="max-width:420px;background:var(--input-bg);border:1px solid var(--border);color:var(--muted)">
                    <div style="color:var(--text);margin-bottom:4px">docker-compose.yml</div>
                    environment:<br>
                    &nbsp;&nbsp;- STATIC_CONFIG_PATH=/app/traefik.yml<br>
                    volumes:<br>
                    &nbsp;&nbsp;- /path/to/traefik.yml:/app/traefik.yml
                </div>
            </div>`;
            document.getElementById('pluginsTabCount').textContent = '0';
            return;
        }

        if (plugins.length === 0) {
            const addHint = _pluginCanManage
                ? `<button onclick="openPluginForm()" class="btn-primary text-xs mt-3"><i class="ph-bold ph-plus"></i> Add Plugin</button>`
                : `<p class="text-xs max-w-sm mx-auto mt-1">Add plugins under <code class="font-mono">experimental.plugins</code> in your <code class="font-mono">traefik.yml</code>.</p>`;
            container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)">
                <i class="ph-light ph-puzzle-piece text-5xl block mb-3 opacity-30"></i>
                <p class="font-medium mb-1">No plugins configured</p>
                ${addHint}
            </div>`;
            document.getElementById('pluginsTabCount').textContent = '0';
            return;
        }

        _allPlugins = plugins;
        document.getElementById('pluginsTabCount').textContent = plugins.length;
        renderPluginCards();
    } catch(e) {
        container.innerHTML = `<div class="text-center py-16 rounded-xl" style="color:var(--muted);border:1px solid var(--border)"><i class="ph-light ph-plug-slash text-5xl block mb-3 opacity-30"></i><p>Could not load plugin data</p></div>`;
    }
}

function filterPlugins() { renderPluginCards(); }

function _initPluginStaticMonaco(value) {
    const container = document.getElementById('pluginStaticEditorContainer');
    if (!container) return;
    if (_pluginStaticMonaco) {
        _pluginStaticMonaco.setValue(value);
        setTimeout(() => _pluginStaticMonaco.layout(), 50);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _pluginStaticMonaco = monaco.editor.create(container, {
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

function _initPluginMwMonaco(value) {
    const container = document.getElementById('pluginMwEditorContainer');
    if (!container) return;
    if (_pluginMwMonaco) {
        _pluginMwMonaco.setValue(value);
        setTimeout(() => _pluginMwMonaco.layout(), 50);
        return;
    }
    require(['vs/editor/editor.main'], function() {
        _ensureMonacoThemes().then(() => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            _pluginMwMonaco = monaco.editor.create(container, {
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

function openPluginForm(idx = -1) {
    const form = document.getElementById('pluginForm');
    const title = document.getElementById('pluginFormTitle');
    const addSection = document.getElementById('pluginFormAdd');
    const editSection = document.getElementById('pluginFormEdit');
    if (!form) return;
    if (idx >= 0 && idx < _allPlugins.length) {
        const p = _allPlugins[idx];
        document.getElementById('pluginFormName').value    = p.name || '';
        document.getElementById('pluginFormModule').value  = p.moduleName || '';
        document.getElementById('pluginFormVersion').value = p.version || '';
        _pluginEditName = p.name;
        if (title) title.textContent = 'Edit Plugin';
        if (addSection) addSection.style.display = 'none';
        if (editSection) editSection.style.display = 'block';
        form.style.display = 'block';
        document.getElementById('pluginFormName').focus();
    } else {
        _pluginEditName = null;
        if (title) title.textContent = 'Add Plugin';
        if (addSection) addSection.style.display = 'block';
        if (editSection) editSection.style.display = 'none';
        const rb = document.getElementById('pluginRestartBanner');
        if (rb) rb.style.display = 'none';
        form.style.display = 'block';
        setTimeout(() => {
            _initPluginStaticMonaco('experimental:\n  plugins:\n    myPlugin:\n      moduleName: github.com/author/plugin\n      version: v0.1.0');
            _initPluginMwMonaco('http:\n  middlewares:\n    my-myPlugin:\n      plugin:\n        myPlugin:\n          setting: value');
        }, 50);
    }
}

function closePluginForm() {
    const form = document.getElementById('pluginForm');
    if (form) form.style.display = 'none';
    _pluginEditName = null;
}

async function savePlugin() {
    if (_pluginEditName) {
        const name       = document.getElementById('pluginFormName').value.trim();
        const moduleName = document.getElementById('pluginFormModule').value.trim();
        const version    = document.getElementById('pluginFormVersion').value.trim();
        if (!name || !moduleName || !version) { showToast('Name, module, and version are required', 'error'); return; }
        const r1 = await fetch('/api/static/section', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ section: 'plugins', action: 'edit', name, old_name: _pluginEditName, payload: { moduleName, version } }),
        });
        const d1 = await r1.json();
        if (!d1.ok) { showToast(d1.error || 'Failed', 'error'); return; }
        const r2 = await fetch('/api/static/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ content: d1.raw }),
        });
        const d2 = await r2.json();
        if (!d2.ok) { showToast(d2.error || 'Failed to save', 'error'); return; }
        closePluginForm();
        showToast('Plugin saved - restart Traefik to apply', 'success');
        refreshPluginsTab();
    } else {
        const staticYaml = _pluginStaticMonaco ? _pluginStaticMonaco.getValue().trim() : '';
        const mwYaml = _pluginMwMonaco ? _pluginMwMonaco.getValue().trim() : '';
        if (!staticYaml) { showToast('Paste the static config snippet', 'error'); return; }
        const res = await fetch('/api/plugins/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
            body: JSON.stringify({ static_yaml: staticYaml, middleware_yaml: mwYaml }),
        });
        const data = await res.json();
        if (!data.ok) { showToast(data.error || 'Failed to install plugin', 'error'); return; }
        closePluginForm();
        const banner = document.getElementById('pluginRestartBanner');
        const detail = document.getElementById('pluginRestartBannerDetail');
        if (banner) {
            const names = (data.plugins || []).join(', ');
            const hasMw = mwYaml.length > 0 && !data.warning;
            if (detail) detail.textContent = `Plugin${data.plugins?.length > 1 ? 's' : ''} "${names}" saved to traefik.yml${hasMw ? ' and middleware saved to plugin-middlewares.yml' : ''}.`;
            banner.style.display = 'block';
        }
        if (data.warning) showToast(data.warning, 'warning');
        refreshPluginsTab();
    }
}

async function deletePlugin(name) {
    if (!await _confirm(`Remove plugin "${name}"?`, 'Remove Plugin', 'Remove')) return;
    const r1 = await fetch('/api/static/section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ section: 'plugins', action: 'remove', name, old_name: name, payload: {} }),
    });
    const d1 = await r1.json();
    if (!d1.ok) { showToast(d1.error || 'Failed', 'error'); return; }
    const r2 = await fetch('/api/static/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ..._csrfHeaders() },
        body: JSON.stringify({ content: d1.raw }),
    });
    const d2 = await r2.json();
    if (!d2.ok) { showToast(d2.error || 'Failed to save', 'error'); return; }
    showToast('Plugin removed - restart Traefik to apply', 'success');
    refreshPluginsTab();
}

function renderPluginCards() {
    const q = (document.getElementById('pluginsSearch')?.value || '').toLowerCase();
    const items = _allPlugins.filter(p =>
        !q || (p.name||'').toLowerCase().includes(q) || (p.moduleName||'').toLowerCase().includes(q)
    );
    if (items.length === 0) {
        document.getElementById('pluginsContent').innerHTML =
            `<div class="text-center py-12 rounded-xl" style="color:var(--muted);border:1px solid var(--border)">No plugins match your search</div>`;
        return;
    }
    const cards = items.map(p => {
        const idx        = _allPlugins.indexOf(p);
        const name       = p.name || 'Unknown';
        const version    = p.version || '-';
        const moduleName = p.moduleName || '';
        const repoUrl    = moduleName.startsWith('github.com/') ? 'https://' + moduleName : '';
        const mgmtBtns   = _pluginCanManage ? `
            <button onclick="openPluginForm(${idx})" class="btn-icon" title="Edit" style="padding:4px 6px"><i class="ph-bold ph-pencil text-sm"></i></button>
            <button onclick="deletePlugin('${_esc(name)}')" class="btn-icon" title="Remove" style="padding:4px 6px;color:var(--red)"><i class="ph-bold ph-trash text-sm"></i></button>` : '';
        return `
        <div class="card p-4 hover:border-blue-500/40 transition-all">
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="ph-bold ph-puzzle-piece text-sm shrink-0" style="color:var(--blue)"></i>
                    <span class="font-bold text-sm truncate" style="color:var(--text)" title="${_esc(name)}">${_esc(name)}</span>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    ${repoUrl ? `<a href="${_esc(repoUrl)}" target="_blank" class="btn-icon" title="View on GitHub" style="padding:4px 6px;text-decoration:none"><i class="ph-bold ph-arrow-square-out text-sm"></i></a>` : ''}
                    <button onclick="openPluginDetail(${idx})" class="btn-icon" title="View details" style="padding:4px 6px"><i class="ph-bold ph-info text-sm"></i></button>
                    ${mgmtBtns}
                </div>
            </div>
            <div class="space-y-2 text-xs">
                <div class="font-mono truncate" style="color:var(--muted)" title="${_esc(moduleName)}">${_esc(moduleName)}</div>
                <div class="flex items-center justify-between pt-1">
                    <span class="badge badge-muted" style="font-size:9px">${_esc(version.startsWith('v') ? version : 'v' + version)}</span>
                    <span class="badge badge-muted" style="font-size:9px">plugin</span>
                </div>
            </div>
        </div>`;
    }).join('');
    document.getElementById('pluginsContent').innerHTML =
        `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${cards}</div>`;
}

function openPluginDetail(idx) {
    const p = _allPlugins[idx];
    if (!p) return;

    const name       = p.name || 'Unknown';
    const version    = p.version || '-';
    const moduleName = p.moduleName || '';
    const repoUrl    = moduleName.startsWith('github.com/') ? 'https://' + moduleName : '';

    document.getElementById('pluginDetailTitle').textContent = name;

    const rows = [
        ['Name',        _esc(name)],
        ['Version',     _esc(version)],
        ['Module',      _esc(moduleName || '-')],
        ...(repoUrl ? [['Repository', `<a href="${_esc(repoUrl)}" target="_blank" style="color:var(--blue)">${_esc(repoUrl)} <i class="ph-bold ph-arrow-square-out text-sm"></i></a>`]] : []),
    ];

    const rowsHtml = rows.map(([k, v]) =>
        `<div class="detail-key">${_esc(k)}</div><div class="detail-val"><span class="font-mono" style="color:var(--text)">${v}</span></div>`
    ).join('');

    const settingsSection = p.settings ? `
        <div class="detail-section mb-4 mt-4">
            <div class="flex items-center gap-2 px-4 py-3" style="background:var(--card);border-bottom:1px solid var(--border)">
                <i class="ph-bold ph-sliders text-sm" style="color:var(--blue)"></i>
                <span class="font-bold text-sm" style="color:var(--text)">Configuration Schema</span>
            </div>
            <pre class="text-xs font-mono p-4 leading-relaxed overflow-x-auto" style="color:var(--muted);max-height:300px">${JSON.stringify(p.settings, null, 2).replace(/</g,'&lt;')}</pre>
        </div>` : '';

    document.getElementById('pluginDetailBody').innerHTML = `
        <div class="detail-section mb-4">
            <div class="flex items-center gap-2 px-4 py-3" style="background:var(--card);border-bottom:1px solid var(--border)">
                <i class="ph-bold ph-info text-sm" style="color:var(--blue)"></i>
                <span class="font-bold text-sm" style="color:var(--text)">Plugin Info</span>
            </div>
            <div class="detail-kv">${rowsHtml}</div>
        </div>
        ${settingsSection}`;

    document.getElementById('pluginDetailPanel').classList.add('open');
    document.getElementById('pluginDetailBackdrop').classList.add('open');
    if (!setDetailDockOpen(true)) document.body.style.overflow = 'hidden';
}

function closePluginDetail() {
    setDetailDockOpen(false);
    document.getElementById('pluginDetailPanel').classList.remove('open');
    document.getElementById('pluginDetailBackdrop').classList.remove('open');
    document.body.style.overflow = '';
}
