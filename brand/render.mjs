// Render brand channel templates to exact-size PNGs
import puppeteer from 'puppeteer-core';
import { resolve } from 'path';

const specs = {
  'post-dark': [1080, 1080],
  'post-light': [1080, 1080],
  'story': [1080, 1920],
  'cover-linkedin': [1584, 396],
  'cover-x': [1500, 500],
  'cover-facebook': [851, 315],
  'cover-linkedin-company': [1512, 256],
  'cover-youtube': [2560, 1440],
  'cover-youtube-guide': [2560, 1440],
  'avatar': [512, 512],
  'og-image': [1200, 630],
};
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});
for (const [name, [w, h]] of Object.entries(specs)) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto('file://' + resolve(`brand/templates/${name}.html`), { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 900));
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await page.screenshot({ path: `brand/rendered/${name}.png` });
  console.log(name, 'ok');
  await page.close();
}
await browser.close();
