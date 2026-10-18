import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CLIENT_DIST = path.join(REPO_ROOT, 'client/dist');
const DEMOS_DIR = path.join(REPO_ROOT, 'demos/latest');
const GALLERY_DIR = path.join(DEMOS_DIR, 'gallery');

// Dynamically import Playwright
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const fallbackPlaywright = path.resolve(REPO_ROOT, '../sm3/node_modules/playwright/index.mjs');
  ({ chromium } = await import(fallbackPlaywright));
}

// 1. Static HTTP Server for client/dist (supporting base path /driver-hub-prototype/)
function startServer(port = 8790) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };

  const server = http.createServer((req, res) => {
    let rawPath = req.url.split('?')[0];
    if (rawPath.startsWith('/driver-hub-prototype/')) {
      rawPath = rawPath.replace('/driver-hub-prototype/', '/');
    }
    let filePath = path.join(CLIENT_DIST, rawPath === '/' ? 'index.html' : rawPath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA routing
        filePath = path.join(CLIENT_DIST, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      console.log(`[HTTP] Serving Driver Hub from ${CLIENT_DIST} on http://127.0.0.1:${port}`);
      resolve(server);
    });
  });
}

// 2. Interactive Cursor Helper
async function injectCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.style.position = 'fixed';
    c.style.top = '0';
    c.style.left = '0';
    c.style.width = '18px';
    c.style.height = '18px';
    c.style.borderRadius = '50%';
    c.style.backgroundColor = 'rgba(56, 189, 248, 0.75)';
    c.style.border = '2px solid #ffffff';
    c.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.9)';
    c.style.pointerEvents = 'none';
    c.style.zIndex = '9999999';
    c.style.transform = 'translate(-50%, -50%)';
    c.style.transition = 'width 0.12s ease, height 0.12s ease, background-color 0.12s ease';
    document.body.appendChild(c);
    window.__setCursor = (x, y) => {
      c.style.left = `${x}px`;
      c.style.top = `${y}px`;
    };
  });
}

async function smoothMove(page, targetX, targetY, steps = 18, delayMs = 15) {
  await page.mouse.move(targetX, targetY, { steps });
  await page.evaluate(({ x, y }) => window.__setCursor?.(x, y), { x: targetX, y: targetY });
  if (delayMs > 0) await page.waitForTimeout(delayMs);
}

async function smoothClick(page, selectorOrBox, steps = 16) {
  let targetX, targetY;
  if (typeof selectorOrBox === 'string') {
    const el = page.locator(selectorOrBox).first();
    const box = await el.boundingBox();
    if (!box) {
      console.warn(`[WARN] Element ${selectorOrBox} not visible for click`);
      return;
    }
    targetX = box.x + box.width / 2;
    targetY = box.y + box.height / 2;
  } else if (selectorOrBox && typeof selectorOrBox.boundingBox === 'function') {
    const box = await selectorOrBox.boundingBox();
    if (!box) {
      console.warn(`[WARN] Element handle not visible for click`);
      return;
    }
    targetX = box.x + box.width / 2;
    targetY = box.y + box.height / 2;
  } else {
    targetX = selectorOrBox.x;
    targetY = selectorOrBox.y;
  }

  await smoothMove(page, targetX, targetY, steps);
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '13px';
      c.style.height = '13px';
      c.style.backgroundColor = 'rgba(244, 63, 94, 0.9)';
    }
  });
  await page.waitForTimeout(100);
  if (typeof selectorOrBox === 'string') {
    await page.locator(selectorOrBox).first().click();
  } else if (selectorOrBox && typeof selectorOrBox.click === 'function') {
    await selectorOrBox.click();
  } else {
    await page.mouse.click(targetX, targetY);
  }
  await page.evaluate(() => {
    const c = document.getElementById('demo-cursor');
    if (c) {
      c.style.width = '18px';
      c.style.height = '18px';
      c.style.backgroundColor = 'rgba(56, 189, 248, 0.75)';
    }
  });
  await page.waitForTimeout(200);
}

// 3. WebP Thumbnail Generator
async function generateWebPThumbnail(browser, sourcePngPath, outWebPPath) {
  console.log(`[Thumbnail] Generating WebP from ${sourcePngPath}...`);
  const page = await browser.newPage();
  const pngDataUrl = `data:image/png;base64,${fs.readFileSync(sourcePngPath).toString('base64')}`;

  const webpBase64 = await page.evaluate(async (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 384;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const webpData = canvas.toDataURL('image/webp', 0.88);
        resolve(webpData.split(',')[1]);
      };
      img.src = dataUrl;
    });
  }, pngDataUrl);

  fs.writeFileSync(outWebPPath, Buffer.from(webpBase64, 'base64'));
  await page.close();
  console.log(`[Thumbnail] Saved WebP (${fs.statSync(outWebPPath).size} bytes) to ${outWebPPath}`);
}

async function main() {
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  const server = await startServer(8790);

  const tempVideoDir = path.join(DEMOS_DIR, 'temp_raw_video');
  fs.mkdirSync(tempVideoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--mute-audio'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2, // Hi-DPI crystal clear screenshots
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1280, height: 720 },
    },
  });

  const page = await context.newPage();
  const startTime = Date.now();

  try {
    console.log('[Recording] Navigating to http://127.0.0.1:8790/driver-hub-prototype/?role=split ...');
    await page.goto('http://127.0.0.1:8790/driver-hub-prototype/?role=split', { waitUntil: 'networkidle' });

    // Wait for Leaflet map tiles and containers to mount
    await page.waitForSelector('.leaflet-container', { timeout: 15000 });
    await page.waitForTimeout(1000);

    await injectCursor(page);
    await page.evaluate(() => window.__setCursor?.(640, 360));
    await page.waitForTimeout(600);

    // -------------------------------------------------------------------
    // Beat 1: Side-by-Side Dual Smartphone Overview (0.0s - 4.5s)
    // -------------------------------------------------------------------
    console.log('[1/6] Capturing Overview Still...');
    await smoothMove(page, 400, 300, 16);
    await page.waitForTimeout(600);
    await smoothMove(page, 880, 300, 16);
    await page.waitForTimeout(600);

    const still1 = path.join(GALLERY_DIR, '01-split-view-dual-device-overview.png');
    await page.screenshot({ path: still1 });
    console.log(`  -> Saved ${path.basename(still1)}`);

    // -------------------------------------------------------------------
    // Beat 2: Rider Tier Selection & Booking (4.5s - 9.0s)
    // -------------------------------------------------------------------
    console.log('[2/6] Selecting Comfort Tier & Inspecting Fare...');
    // Locate tier buttons in Rider phone (left phone)
    const comfortBtn = page.locator('button:has-text("Comfort")').first();
    if (await comfortBtn.isVisible()) {
      await smoothClick(page, comfortBtn);
      await page.waitForTimeout(800);
    }

    const still2 = path.join(GALLERY_DIR, '02-rider-tier-selection-fare-estimate.png');
    await page.screenshot({ path: still2 });
    console.log(`  -> Saved ${path.basename(still2)}`);

    // Click "Solicitar Conductor"
    console.log('  -> Tapping "Solicitar Conductor"...');
    const requestRideBtn = page.locator('button:has-text("Solicitar Conductor")').first();
    await smoothClick(page, requestRideBtn);
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------
    // Beat 3: Driver Incoming Ride Offer Modal (9.0s - 13.5s)
    // -------------------------------------------------------------------
    console.log('[3/6] Waiting for Driver Incoming Offer Modal...');
    await page.waitForSelector('button:has-text("Aceptar Viaje")', { timeout: 8000 });
    await page.waitForTimeout(600);

    // Move cursor over offer modal
    await smoothMove(page, 950, 520, 18);
    await page.waitForTimeout(500);

    const still3 = path.join(GALLERY_DIR, '03-driver-incoming-offer-modal.png');
    await page.screenshot({ path: still3 });
    console.log(`  -> Saved ${path.basename(still3)}`);

    // Driver accepts the ride
    console.log('  -> Driver accepting ride...');
    const acceptBtn = page.locator('button:has-text("Aceptar Viaje")').first();
    await smoothClick(page, acceptBtn);
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------
    // Beat 4: Live Telemetry & Drive to Pickup (13.5s - 19.0s)
    // -------------------------------------------------------------------
    console.log('[4/6] Driving towards Pickup location...');
    // Wait for telemetry movement
    await page.waitForTimeout(2500);

    // Move cursor over the live route on map
    await smoothMove(page, 920, 340, 20);
    await page.waitForTimeout(500);

    const still4 = path.join(GALLERY_DIR, '04-live-pickup-telemetry-tracking.png');
    await page.screenshot({ path: still4 });
    console.log(`  -> Saved ${path.basename(still4)}`);

    // Let the car finish arriving at pickup or trigger explicit arrival button
    const arriveBtn = page.locator('button:has-text("Llegar ya"), button:has-text("Notificar que he llegado")').first();
    if (await arriveBtn.isVisible()) {
      console.log('  -> Driver notifies arrival at pickup...');
      await smoothClick(page, arriveBtn);
      await page.waitForTimeout(1200);
    }

    // -------------------------------------------------------------------
    // Beat 5: Trip In-Progress Simulation (19.0s - 25.0s)
    // -------------------------------------------------------------------
    console.log('[5/6] Passenger boarded - Starting trip towards destination...');
    const startTripBtn = page.locator('button:has-text("Iniciar Viaje al Destino")').first();
    if (await startTripBtn.isVisible()) {
      await smoothClick(page, startTripBtn);
      await page.waitForTimeout(1200);
    }

    // Observe in_progress on both phones
    await smoothMove(page, 440, 360, 18);
    await page.waitForTimeout(1200);
    await smoothMove(page, 920, 360, 18);
    await page.waitForTimeout(1500);

    const still5 = path.join(GALLERY_DIR, '05-trip-in-progress-route-simulation.png');
    await page.screenshot({ path: still5 });
    console.log(`  -> Saved ${path.basename(still5)}`);

    // Wait until trip reaches destination (or fast forward if simulator finishes)
    console.log('  -> Simulating trip progress to destination...');
    // Check if Complete button becomes enabled or simulator finishes
    const completeBtn = page.locator('button:has-text("Finalizar y Cobrar Viaje"), button:has-text("Esperando llegada")').first();
    await page.waitForFunction(() => {
      const btn = document.querySelector('button:not([disabled])');
      const allButtons = Array.from(document.querySelectorAll('button'));
      return allButtons.some(b => b.textContent && b.textContent.includes('Finalizar y Cobrar Viaje') && !b.disabled);
    }, { timeout: 10000 }).catch(async () => {
      // If still driving, wait a moment
      console.log('  -> Waiting for arrival at destination...');
      await page.waitForTimeout(2000);
    });

    // -------------------------------------------------------------------
    // Beat 6: Trip Completion, Earnings & Passenger Rating (25.0s - 30.5s)
    // -------------------------------------------------------------------
    console.log('[6/6] Completing trip and recording summary...');
    const finishTripBtn = page.locator('button:has-text("Finalizar y Cobrar Viaje")').first();
    if (await finishTripBtn.isVisible() && await finishTripBtn.isEnabled()) {
      await smoothClick(page, finishTripBtn);
      await page.waitForTimeout(1000);
    }

    // Move cursor over rider 5-star rating on left phone
    const riderStar5 = page.locator('div.border-t button').nth(4);
    if (await riderStar5.isVisible()) {
      await smoothClick(page, riderStar5);
      await page.waitForTimeout(600);
    }

    // Move cursor to driver earnings on right phone
    await smoothMove(page, 920, 420, 18);
    await page.waitForTimeout(600);

    const still6 = path.join(GALLERY_DIR, '06-trip-completion-earnings-summary.png');
    await page.screenshot({ path: still6 });
    console.log(`  -> Saved ${path.basename(still6)}`);

    // -------------------------------------------------------------------
    // Final Steady Hold to Reach ~30.5s Recording Target
    // -------------------------------------------------------------------
    const elapsedMs = Date.now() - startTime;
    const remainingMs = 30500 - elapsedMs;
    if (remainingMs > 0) {
      console.log(`[Hold] Holding final state for ${(remainingMs / 1000).toFixed(1)}s to complete 30.5s recording...`);
      await page.waitForTimeout(remainingMs);
    }
  } catch (err) {
    console.error('[PLAYWRIGHT ERROR IN TRY]', err);
    throw err;
  } finally {
    const videoObj = page.video();
    await context.close();
    await browser.close();
    server.close();

    // Video path resolution
    const rawVideoPath = await videoObj.path();
    console.log(`[Video] Raw recording saved at: ${rawVideoPath}`);

    const finalWebM = path.join(DEMOS_DIR, 'demo.webm');
    const ffmpegMac = path.resolve(process.env.HOME, 'Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac');

    if (fs.existsSync(ffmpegMac)) {
      console.log(`[FFmpeg] Transcoding video with VP9 to exact 30.5s duration...`);
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegMac, [
          '-y',
          '-i', rawVideoPath,
          '-t', '30.5',
          '-c:v', 'libvpx-vp9',
          '-b:v', '850k',
          '-crf', '30',
          '-an',
          finalWebM,
        ], { stdio: 'inherit' });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}`));
        });
      });
    } else {
      console.log(`[Video] Moving raw WebM to ${finalWebM}...`);
      fs.copyFileSync(rawVideoPath, finalWebM);
    }

    // Clean up temp dir
    try {
      fs.rmSync(tempVideoDir, { recursive: true, force: true });
    } catch (_) {}

    // Generate thumbnail webp from primary card poster: 01-split-view-dual-device-overview.png
    const sourceStill = path.join(GALLERY_DIR, '01-split-view-dual-device-overview.png');
    if (fs.existsSync(sourceStill)) {
      const helperBrowser = await chromium.launch({ headless: true });
      try {
        const cardThumbWebP = path.join(DEMOS_DIR, 'thumb.webp');
        await generateWebPThumbnail(helperBrowser, sourceStill, cardThumbWebP);

        // Copy thumbnail into netfix / beta-livive-net / thumbnails directories
        const rootThumb = path.resolve(REPO_ROOT, '../thumbnails/driver-hub-prototype.webp');
        const betaThumb = path.resolve(REPO_ROOT, '../beta-livive-net/thumbnails/driver-hub-prototype.webp');

        for (const tPath of [rootThumb, betaThumb]) {
          if (fs.existsSync(path.dirname(tPath))) {
            fs.copyFileSync(cardThumbWebP, tPath);
            console.log(`[Thumbnail] Copied to ${tPath}`);
          }
        }
      } finally {
        await helperBrowser.close();
      }
    }

    console.log('[SUCCESS] All Driver Hub Prototype showcase assets captured!');
    console.log(`  - Video: ${finalWebM} (${fs.statSync(finalWebM).size} bytes)`);
    for (const f of fs.readdirSync(GALLERY_DIR).sort()) {
      const p = path.join(GALLERY_DIR, f);
      console.log(`  - Gallery: ${f} (${fs.statSync(p).size} bytes)`);
    }
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
