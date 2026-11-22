// QA: overflow, axe WCAG 2 A/AA, keyboard navigation, mobile menu, screenshots
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE = 'http://localhost:4321';
const OUT = '/downloads';
const axeSrc = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
const report = { overflow: [], axe: {}, keyboard: {}, menu: {} };

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const pages = ['/', '/services', '/audiences', '/faq', '/about'];
const widths = [320, 390, 768, 1280];

async function open(w, p, h = 850) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h });
  await page.goto(BASE + p, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 700));
  return page;
}

// 1. Horizontal overflow on every page x width
for (const w of widths) {
  for (const p of pages) {
    const page = await open(w, p);
    const diff = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (diff > 0) report.overflow.push({ page: p, width: w, overflowPx: diff });
    await page.close();
  }
}
report.overflowClean = report.overflow.length === 0;

// 2. axe-core WCAG 2.0 A/AA
for (const [p, w] of [['/', 1280], ['/', 390], ['/faq', 390], ['/services', 1280]]) {
  const page = await open(w, p);
  await page.evaluate(axeSrc);
  const res = await page.evaluate(async () => await axe.run({ runOnly: ['wcag2a', 'wcag2aa'] }));
  report.axe[`${p}@${w}`] = res.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
  await page.close();
}

// 3. Keyboard: skip link is first Tab stop and works
{
  const page = await open(390, '/');
  await page.keyboard.press('Tab');
  report.keyboard.firstTabStop = await page.evaluate(() => ({
    tag: document.activeElement.tagName, cls: String(document.activeElement.className), text: document.activeElement.textContent.trim(),
  }));
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 300));
  report.keyboard.skipLinkTarget = await page.evaluate(() => ({
    hash: location.hash,
    mainFocused: document.activeElement.id === 'main-content' || document.activeElement === document.querySelector('#main-content'),
  }));
  await page.close();
}

// 4. Keyboard-only mobile menu: Tab to summary, Enter opens, Tab reaches links, Enter navigates
{
  const page = await open(390, '/');
  let found = false;
  for (let i = 0; i < 30 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement.tagName === 'SUMMARY');
  }
  report.menu.summaryReachableByTab = found;
  if (found) {
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 250));
    report.menu.opensWithEnter = await page.evaluate(() => document.querySelector('.nav-menu').open);
    await page.keyboard.press('Tab');
    const link = await page.evaluate(() => ({ tag: document.activeElement.tagName, href: document.activeElement.getAttribute('href'), text: document.activeElement.textContent.trim() }));
    report.menu.firstLinkAfterSummary = link;
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 900));
    report.menu.keyboardNavigatedTo = await page.evaluate(() => location.pathname);
  }
  await page.close();
}

// 5. Mouse: menu opens, كل link works (services), FAQ details toggles
{
  const page = await open(390, '/');
  await page.click('.nav-menu summary');
  await new Promise(r => setTimeout(r, 250));
  report.menu.opensWithClick = await page.evaluate(() => document.querySelector('.nav-menu').open);
  await page.screenshot({ path: `${OUT}/v4-menu390.png` });
  await page.click('.menu-nav a[href="/services"]');
  await new Promise(r => setTimeout(r, 900));
  report.menu.clickNavigatedTo = await page.evaluate(() => location.pathname);
  await page.close();

  const faq = await open(390, '/faq');
  const before = await faq.evaluate(() => document.querySelectorAll('details.faq-item[open], .faq details[open]').length);
  await faq.evaluate(() => { const s = document.querySelector('main details summary'); s && s.click(); });
  const after = await faq.evaluate(() => document.querySelectorAll('main details[open]').length);
  report.faqAccordion = { openBefore: before, openAfterClick: after, total: await faq.evaluate(() => document.querySelectorAll('main details').length) };
  await faq.screenshot({ path: `${OUT}/v4-faq390.png` });
  await faq.close();
}

// 6. Screenshots
const d = await open(1280, '/', 900);
await d.screenshot({ path: `${OUT}/v4-index1280.png` });
await d.evaluate(() => document.querySelector('.cta-band').scrollIntoView());
await new Promise(r => setTimeout(r, 500));
await d.screenshot({ path: `${OUT}/v4-ctaband1280.png` });
const s = await open(1280, '/services', 900);
await s.screenshot({ path: `${OUT}/v4-services1280.png` });
await s.close();
await d.close();
const m = await open(390, '/', 844);
await m.screenshot({ path: `${OUT}/v4-index390.png` });
await m.close();
const m320 = await open(320, '/', 760);
await m320.screenshot({ path: `${OUT}/v4-index320.png` });
await m320.close();

await browser.close();
writeFileSync('/tmp/qa-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
