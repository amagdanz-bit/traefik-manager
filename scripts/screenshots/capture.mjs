import puppeteer from 'puppeteer';
const BASE = 'http://tmshot-app:5000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });

async function capture(theme) {
    const ctx  = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    const shot = async name => { await sleep(600); await page.screenshot({ path: `/out/${theme}/${name}.png` }); console.log(`${theme}/${name}`); };
    const js = code => page.evaluate(code);
    const tab = async (t, ms=1800) => { await js(`switchTab('${t}')`); await sleep(ms); };

    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await js(`localStorage.setItem('tm-theme', '${theme}'); localStorage.setItem('tm-static-setup-v1', '1');`);
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4500);
    await js(`document.querySelectorAll('body > div[style*="--red"]').forEach(b => b.remove())`);
    await js(`fetch('/api/settings/ui', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', ..._csrfHeaders() }, body: JSON.stringify({ ui_prefs: { layoutMode: 'modern', statBarScope: 'all' } }) })`);
    await js(`tmSetPref('layoutMode', 'modern'); tmSetPref('statBarScope', 'all'); applyUiPrefs();`);
    await sleep(1200);

    await tab('services');
    await shot('routes-cards');
    await js(`toggleRouteView()`); await sleep(900); await shot('routes-list'); await js(`toggleRouteView()`); await sleep(500);
    await js(`openModal()`); await sleep(900);
    await js(`document.getElementById('serviceName').value = 'jellyfin'; document.getElementById('subdomain').value = 'jellyfin';`);
    await shot('routes-add-http');
    await js(`setProtocol('tcp')`); await sleep(500); await shot('routes-add-tcp');
    await js(`setProtocol('udp')`); await sleep(500); await shot('routes-add-udp');
    await js(`closeModal()`);

    await tab('middlewares');
    await shot('middlewares-cards');
    await js(`toggleMwView()`); await sleep(700); await shot('middlewares-list'); await js(`toggleMwView()`); await sleep(400);
    await js(`openMwModal()`); await sleep(900); await shot('middlewares-add');
    await js(`closeMwModal()`); await sleep(500);

    await tab('live', 2500);
    await shot('services-cards');
    await js(`toggleSvcView()`); await sleep(700); await shot('services-list'); await js(`toggleSvcView()`); await sleep(400);

    await tab('dashboard', 4500);
    await shot('dashboard');
    await tab('routemap', 2500);
    await shot('route-map');
    await tab('certs');
    await shot('certs');
    await js(`if (typeof _visibleTabsCache !== 'undefined' && !_visibleTabsCache.tls) toggleTabVisibility('tls')`); await sleep(700);
    await tab('tls', 2000);
    await shot('tls-options');
    await js(`if (typeof _visibleTabsCache !== 'undefined' && !_visibleTabsCache.crowdsec) toggleTabVisibility('crowdsec')`); await sleep(700);
    await tab('crowdsec', 4000);
    await shot('crowdsec');
    await tab('logs', 2500);
    await tab('plugins', 2000);
    await shot('plugins');
    await js(`openPluginForm()`); await sleep(1200); await shot('plugins-add');
    await js(`closePluginForm()`); await sleep(500);
    await shot('logs');

    await tab('services', 600);
    await js(`openSettingsModal('ui')`); await sleep(1400); await shot('settings-interface');
    await js(`switchSettingsPanel('auth')`); await sleep(900); await shot('settings-auth-password');
    await js(`switchAuthTab('apikeys', document.getElementById('auth-tab-apikeys'))`); await sleep(700); await shot('settings-auth-apikeys');
    await js(`switchAuthTab('oidc', document.getElementById('auth-tab-oidc'))`); await sleep(700); await shot('settings-auth-oidc');
    await js(`switchSettingsPanel('backups'); loadBackups()`); await sleep(1200); await shot('settings-backups');
    await js(`switchSettingsPanel('system')`); await sleep(900); await shot('settings-system');
    await js(`switchSettingsPanel('routes')`); await sleep(900); await shot('settings-routes');
    await js(`switchSettingsPanel('connection')`); await sleep(900); await shot('settings-connection');
    await js(`switchSettingsPanel('about')`); await sleep(1200); await shot('settings-about');
    await js(`closeSettingsModal()`);

    await js(`if (typeof _visibleTabsCache !== 'undefined' && !_visibleTabsCache.static) toggleTabVisibility('static')`); await sleep(800);
    await tab('static', 2500);
    await shot('static-config');

    await tab('dashboard', 3000);
    const row = await page.$('.rm-route-link');
    if (row) { await row.hover(); await sleep(400); await shot('dashboard-hover'); }

    await page.close(); await ctx.close();
}
await capture('dark');
await capture('light');
await browser.close();
console.log('done');
