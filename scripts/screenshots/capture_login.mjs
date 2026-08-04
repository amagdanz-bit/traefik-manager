import puppeteer from 'puppeteer';
const BASE = 'http://tmshot-app:5000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] });

for (const theme of ['dark', 'light']) {
    const ctx  = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.evaluate(`localStorage.setItem('tm-theme', '${theme}')`);
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    await page.screenshot({ path: `/out/${theme}/login.png` });
    console.log(`${theme}/login`);
    await ctx.close();
}
await browser.close();
