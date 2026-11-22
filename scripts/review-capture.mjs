// Review capture: full-page screenshots (1280 + 390) and rendered copy per page
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:8791';
const OUT = '/downloads/onetech-review-assets';
const pages = [['/', 'home'], ['/services', 'services'], ['/audiences', 'audiences'], ['/faq', 'faq'], ['/about', 'about']];

const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
for (const [path, name] of pages) {
  for (const [w, h, tag] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h });
    await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 400));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: true });
    if (tag === 'desktop') {
      const copy = await page.evaluate(() => document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText);
      writeFileSync(`${OUT}/${name}-copy.txt`, copy);
    }
    await page.close();
    console.log(`captured ${name}-${tag}`);
  }
}
await browser.close();
