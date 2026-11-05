'use strict';

// Records a demo video of the sync indexes modal, using the Mongoose Studio UI running on
// localhost:3333 and a Chrome started with `--remote-debugging-port=9222`.
//
//   node videos/recordSyncIndexes.js           Record to ~/Videos/mongoose-studio/sync-indexes-demo.webm
//   node videos/recordSyncIndexes.js --reset   Drop the indexes the demo builds, so it can run again
//
// The demo really runs the sync, so it changes the indexes in the database behind the UI.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const baseUrl = 'http://localhost:3333/studio';
const browserURL = 'http://localhost:9222';
const model = 'User';
const demoIndexNames = ['email_1_isDeleted_1', 'location_2dsphere', 'role_1'];
const outputDir = path.join(os.homedir(), 'Videos', 'mongoose-studio');
const outputPath = path.join(outputDir, 'sync-indexes-demo.webm');
const rawOutputPath = path.join(outputDir, 'sync-indexes-demo.raw.webm');
const viewport = { width: 1920, height: 1080 };
const annotationsCSSUrl = 'https://cdn.jsdelivr.net/gh/syabro/neat-annotations/neat-annotations.css';
const annotationFontUrl = 'https://fonts.googleapis.com/css2?family=Shantell+Sans&display=swap';
// Same duration so the cursor reaches its target right as the zoom finishes
const cursorMoveMS = 1000;
const zoomMS = 1000;
const menuZoom = 2;
const maxZoom = 1.45;

const overlayCSS = `
  #demo-cursor {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 2147483647;
    width: 34px;
    height: 34px;
    pointer-events: none;
    filter: drop-shadow(0 2px 3px rgb(0 0 0 / 40%));
    transition: transform ${cursorMoveMS}ms cubic-bezier(0.45, 0, 0.2, 1);
  }
  .demo-annotation {
    position: fixed;
    z-index: 2147483646;
    pointer-events: none;
    color-scheme: light;
    --ann-label-max-width: 340px;
    animation: demo-annotation-in 300ms ease-out;
  }
  .demo-annotation::after {
    padding: 0.15em 0.5em;
    border-radius: 8px;
    background: rgb(255 255 255 / 92%);
    font-size: 1.75rem;
    font-weight: 600;
    opacity: 1;
  }
  .demo-annotation::before { opacity: 1; }
  @keyframes demo-annotation-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  html { overflow: hidden; }
  body {
    transform-origin: 0 0;
    transition: transform ${zoomMS}ms cubic-bezier(0.45, 0, 0.2, 1);
  }
`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

async function run() {
  if (process.argv.includes('--reset')) {
    await reset();
    return;
  }

  const { diffIndexes } = await callAPI('getIndexes', {});
  if (diffIndexes.toCreate.length === 0) {
    throw new Error('No indexes to sync. Run `node videos/recordSyncIndexes.js --reset` first.');
  }

  const browser = await puppeteer.connect({ browserURL, defaultViewport: null });
  // Use a new tab so the demo leaves the tabs open in the debug Chrome alone
  const page = await browser.newPage();
  try {
    await page.setViewport(viewport);
    await page.bringToFront();
    // Otherwise Chrome stops painting, and the video freezes, if the window loses focus
    await page.emulateFocusedPage(true);
    await record(page);
  } finally {
    await page.close();
    await browser.disconnect();
  }

  // Puppeteer pipes the video to the file, so the file doesn't have a duration and players
  // can't seek. Copying the video into a new file fixes that without re-encoding.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', rawOutputPath, '-c', 'copy', outputPath]);
  fs.unlinkSync(rawOutputPath);
  console.log(`Saved ${outputPath}`);
}

function logStep(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

async function record(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle2' });
  const menuButton = await page.waitForSelector('button[aria-label="More actions"]', { visible: true });
  await addOverlays(page);

  const recorder = await page.screencast({ path: rawOutputPath });
  try {
    await sleep(1000);

    logStep('Opening the indexes modal');
    // 1. Open the actions menu and go to indexes
    await zoomTo(page, menuButton, menuZoom);
    await annotate(page, menuButton, 'More actions', 'ann-n');
    await sleep(800);
    await clearAnnotations(page);
    await clickCursor(page);

    const indexesButton = await findButton(page, 'Indexes');
    await annotate(page, indexesButton, 'View indexes', 'ann-e');
    await moveCursor(page, indexesButton);
    await sleep(800);
    await clearAnnotations(page);
    await page.mouse.click(cursorPosition.x, cursorPosition.y);

    logStep('Zooming in');
    // 2. Zoom in on the indexes modal, leaving room for the sync indexes modal. Don't wait,
    // because the modal opens mostly off screen while zoomed in on the menu.
    await zoomTo(page, await page.waitForSelector('.modal-container'));
    const syncButton = await findButton(page, 'Sync Indexes');

    // 3. Open the sync indexes modal
    await annotate(page, syncButton, 'New: sync your schema indexes', 'ann-w');
    await moveCursor(page, syncButton);
    await sleep(1500);
    await clearAnnotations(page);
    await clickCursor(page);

    logStep('Starting the sync');
    // 4. Confirm which indexes will be created, and run the sync
    const confirmButton = await findButton(page, 'Sync indexes');
    await sleep(800);
    await annotate(page, confirmButton, 'Confirm what will change, then sync', 'ann-n');
    await moveCursor(page, confirmButton);
    await sleep(2000);
    await clearAnnotations(page);
    await clickCursor(page);

    // 5. Success closes the modal automatically. On failure, stay on the errors and close it.
    await moveCursor(page, null);
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return !text.includes('Sync indexes?') || text.includes('Failed');
    }, { timeout: 10 * 60 * 1000 });
    await sleep(500);
    logStep('Sync finished');
    const failed = await page.evaluate(() => document.body.innerText.includes('Failed'));
    if (failed) {
      throw new Error('Sync failed, not showing the success annotation');
    }

    const { mongoDBIndexes, diffIndexes } = await callAPI('getIndexes', {});
    if (diffIndexes.toCreate.length > 0 || diffIndexes.toDrop.length > 0) {
      throw new Error('Indexes are not in sync after the sync finished');
    }
    await annotateBuiltIndexes(page, mongoDBIndexes.length - 1);
    await sleep(4000);
  } finally {
    logStep('Stopping the recording');
    await recorder.stop();
    logStep('Recording stopped');
  }
}

async function addOverlays(page) {
  const annotationsCSS = await fetch(annotationsCSSUrl).then(res => res.text());
  await page.addStyleTag({ content: annotationsCSS + overlayCSS });
  await page.addStyleTag({ url: annotationFontUrl });
  await page.evaluate(async() => {
    await document.fonts.load('600 28px "Shantell Sans"');

    // Add these to `<html>`, because the zoom transforms `<body>`
    const cursor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cursor.id = 'demo-cursor';
    cursor.setAttribute('viewBox', '0 0 24 24');
    cursor.innerHTML = '<path d="M5 2 L5 20 L10 15.5 L13.5 22 L16.5 20.5 L13 14 L19.5 14 Z" ' +
      'fill="black" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>';
    cursor.style.transform = `translate(${window.innerWidth * 0.55}px, ${window.innerHeight * 0.55}px)`;
    document.documentElement.appendChild(cursor);
  });
}

// `neat-annotations` wraps the target, which would break elements that Vue owns, so
// instead put an empty annotation on top of the target.
async function annotate(page, target, note, direction, color = 'ann-blue') {
  await target.evaluate((el, note, classes) => {
    const { left, top, width, height } = el.getBoundingClientRect();
    const annotation = document.createElement('span');
    annotation.className = `demo-annotation ann ann-no-mark ${classes}`;
    annotation.dataset.note = note;
    Object.assign(annotation.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    });
    document.documentElement.appendChild(annotation);
  }, note, `${direction} ${color}`);
}

async function annotateBuiltIndexes(page, numIndexes) {
  // The last row, so the note goes below the table rather than on top of the other indexes
  const lastIndexName = demoIndexNames[demoIndexNames.length - 1];
  const lastRow = await page.waitForSelector(`::-p-xpath(//table//tr[.//button[normalize-space()="${lastIndexName}"]])`);
  await annotate(page, lastRow, `All ${numIndexes} indexes built!`, 'ann-n', 'ann-green');
}

async function clearAnnotations(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.demo-annotation').forEach(el => el.remove());
  });
}

function findButton(page, text) {
  return page.waitForSelector(`::-p-xpath(//button[normalize-space()="${text}"])`, { visible: true });
}

let cursorPosition = null;

async function moveCursor(page, target) {
  if (target == null) {
    await moveCursorTo(page, { x: viewport.width * 0.9, y: viewport.height * 0.9 });
    return;
  }
  const { x, y, width, height } = await target.boundingBox();
  await moveCursorTo(page, { x: x + width / 2, y: y + height / 2 });
}

async function moveCursorTo(page, position) {
  cursorPosition = position;
  await page.evaluate(({ x, y }) => {
    document.getElementById('demo-cursor').style.transform = `translate(${x}px, ${y}px)`;
  }, position);
  await page.mouse.move(position.x, position.y, { steps: 10 });
  await sleep(cursorMoveMS);
}

async function clickCursor(page) {
  await page.mouse.click(cursorPosition.x, cursorPosition.y);
  await sleep(600);
}

// Scale `<body>` to `scale`, or to fill most of the screen with `target`, and move the
// cursor to where `target` ends up. The sync indexes modal is rendered inside the indexes
// modal, so it gets the same zoom, and `maxZoom` needs to leave room for it.
async function zoomTo(page, target, scale) {
  const center = await target.evaluate((el, scale, maxZoom) => {
    const body = document.body;
    const current = new DOMMatrix(getComputedStyle(body).transform);
    const { innerWidth, innerHeight } = window;
    const rect = el.getBoundingClientRect();
    // Where the target is on the page, without the zoom that is currently applied
    const pageX = (rect.left + rect.width / 2 - current.e) / current.a;
    const pageY = (rect.top + rect.height / 2 - current.f) / current.d;

    scale = scale ?? Math.min(
      maxZoom,
      innerWidth * 0.94 / el.offsetWidth,
      innerHeight * 0.9 / el.offsetHeight
    );
    // Center the target, without showing anything past the edge of the page
    const x = Math.min(0, Math.max(innerWidth * (1 - scale), innerWidth / 2 - pageX * scale));
    const y = Math.min(0, Math.max(innerHeight * (1 - scale), innerHeight / 2 - pageY * scale));
    body.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    return { x: x + pageX * scale, y: y + pageY * scale };
  }, scale, maxZoom);

  await moveCursorTo(page, center);
  await sleep(300);
}

async function reset() {
  const { mongoDBIndexes } = await callAPI('getIndexes', {});
  for (const { name } of mongoDBIndexes) {
    if (demoIndexNames.includes(name)) {
      await callAPI('dropIndex', { name });
      console.log(`Dropped ${name}`);
    }
  }
}

async function callAPI(action, params) {
  const res = await fetch(`${baseUrl}/api/Model/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, ...params })
  });
  if (!res.ok) {
    throw new Error(`${action} failed with status ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
