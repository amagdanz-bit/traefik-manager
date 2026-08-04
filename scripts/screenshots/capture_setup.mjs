import puppeteer from 'puppeteer';
const BASE = 'http://tmshot-app:5000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });

const PANELS = [
    [0, 'setup-welcome'],
    [1, 'setup-connection'],
    [2, 'setup-self-route'],
    [3, 'setup-monitoring'],
    [4, 'setup-password'],
];

for (const theme of ['dark', 'light']) {
    const ctx  = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    const js = code => page.evaluate(code);

    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await js(`localStorage.setItem('tm-theme', '${theme}')`);
    await page.type('#password', 'screenshot-demo-password');
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('form[action$="/login"] button[type="submit"]'),
    ]);
    await page.goto(BASE + '/setup', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    if (!(await js(`!!document.getElementById('panel-4')`))) {
        throw new Error('setup wizard did not render its final panel');
    }

    await js(`document.getElementById('s_apiurl').value = 'http://traefik:8080';
              document.getElementById('s_domains').value = 'example.com, example.lan';
              document.getElementById('s_resolver').value = 'letsencrypt';`);
    await js(`['dashboard','routemap','certs','logs'].forEach(t => { if (!setupTabs[t]) toggleSetupTab(t); })`);
    await js(`document.getElementById('s_password').value = 'correct-horse-battery';
              document.getElementById('s_confirm').value = 'correct-horse-battery';
              checkPwMatch();`);

    for (const [step, name] of PANELS) {
        await js(`goTo(${step})`);
        await sleep(900);
        await page.screenshot({ path: `/out/${theme}/${name}.png` });
        console.log(`${theme}/${name}`);
    }
    await ctx.close();
}
await browser.close();
