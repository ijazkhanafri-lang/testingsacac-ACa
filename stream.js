const puppeteer = require('puppeteer');
const { spawn } = require('child_process');

// Hardcoded OK.ru RTMP ingest base URL (alternative ingest: rtmp://vsu.mycdn.me/input/)
const OK_RU_RTMP_BASE = 'rtmp://vsu.okcdn.ru/input/';

// Hardcoded Stream Keys mapped to selector IDs (1, 1.1, 1.2, etc.)
// Replace the placeholder values with your actual OK.ru stream keys
const STREAM_KEYS = {
  '1': 'PASTE_OK_RU_STREAM_KEY_1_HERE',
  '1.1': 'PASTE_OK_RU_STREAM_KEY_1_1_HERE',
  '1.2': 'PASTE_OK_RU_STREAM_KEY_1_2_HERE',
  '1.3': 'PASTE_OK_RU_STREAM_KEY_1_3_HERE',
  '2': 'PASTE_OK_RU_STREAM_KEY_2_HERE',
  '2.1': 'PASTE_OK_RU_STREAM_KEY_2_1_HERE',
  '2.2': 'PASTE_OK_RU_STREAM_KEY_2_2_HERE'
};

// Workflow inputs / environment variables
const STREAM_KEY_ID = (process.env.STREAM_KEY_ID || '1').trim();
const STREAM_URL = (process.env.STREAM_URL || 'https://thedaddy.li/stream/stream-598.php').trim();
const DURATION_MINUTES = parseFloat(process.env.DURATION_MINUTES || '240');
const MAX_DURATION_SEC = Math.max(60, Math.round(DURATION_MINUTES * 60));

const CHROME_PATH = process.env.CHROME_PATH || '/usr/bin/google-chrome';
const DISPLAY = process.env.DISPLAY || ':99';
const AUDIO_SOURCE = process.env.AUDIO_SOURCE || 'virtual_speaker.monitor';
const RESOLUTION = process.env.RESOLUTION || '1280x720';
const FPS = process.env.FPS || '30';

// Resolve selected key ID to full OK.ru RTMP URL
function resolveRtmpUrl(keyId) {
  const mapped = STREAM_KEYS[keyId] || keyId;
  if (!mapped || mapped.startsWith('PASTE_OK_RU_STREAM_KEY')) {
    console.error(`[CONFIG_ERROR] Stream key for ID "${keyId}" is not set in STREAM_KEYS.`);
    process.exit(1);
  }
  if (mapped.startsWith('rtmp://') || mapped.startsWith('rtmps://')) {
    return mapped;
  }
  return `${OK_RU_RTMP_BASE}${mapped}`;
}

const RTMP_URL = resolveRtmpUrl(STREAM_KEY_ID);
const MASKED_RTMP = RTMP_URL.replace(/([^/]{4})$/, '****');

let ffmpegProcess = null;
let browser = null;

function startFFmpeg() {
  if (ffmpegProcess) return;

  console.log(`[FFMPEG] Starting RTMP capture -> Key ID: ${STREAM_KEY_ID} (${MASKED_RTMP})`);
  const args = [
    '-y',
    '-thread_queue_size', '1024',
    '-f', 'x11grab',
    '-framerate', FPS,
    '-video_size', RESOLUTION,
    '-i', `${DISPLAY}.0+0,0`,
    '-thread_queue_size', '1024',
    '-f', 'pulse',
    '-i', AUDIO_SOURCE,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p',
    '-g', String(Number(FPS) * 2),
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    RTMP_URL
  ];

  ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

  ffmpegProcess.stderr.on('data', (data) => {
    const line = data.toString();
    if (line.includes('Error') || line.includes('failed') || line.includes('Conversion failed')) {
      console.error('[FFMPEG_ERR]', line.trim());
    }
  });

  ffmpegProcess.on('close', (code) => {
    console.log(`[FFMPEG] Process exited with code ${code}`);
    ffmpegProcess = null;
  });
}

async function cleanup() {
  console.log('[SYSTEM] Shutting down stream...');
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

(async () => {
  console.log(`[INIT] Key ID: ${STREAM_KEY_ID} | URL: ${STREAM_URL} | Duration: ${DURATION_MINUTES} min (${MAX_DURATION_SEC}s)`);

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    defaultViewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1280,720',
      '--window-position=0,0',
      '--kiosk',
      '--no-first-run',
      '--no-default-browser-check',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  // Close popups/popunders automatically
  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const newPage = await target.page().catch(() => null);
      if (newPage) {
        const pages = await browser.pages();
        if (pages.length > 1) {
          console.log('[POPUP] Closing spawned tab:', target.url());
          await newPage.close().catch(() => {});
        }
      }
    }
  });

  const [page] = await browser.pages();

  // Stealth & WebGL shims
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, param);
    };
  });

  // Log HTTP 4xx/5xx stream blocks
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && (url.includes('.m3u8') || url.includes('.ts') || url.includes('dembed'))) {
      console.error(`[HTTP_${status}] Blocked or failed stream request: ${url}`);
    }
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[JW_')) {
      console.log(text);
    }
  });

  console.log(`[NAV] Opening ${STREAM_URL}`);
  await page.goto(STREAM_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise((r) => setTimeout(r, 6000));

  // Find inner JW Player iframe (#thatframe / dembed.st) if nested, otherwise fall back to main page
  const findPlayerFrame = () => {
    return (
      page.frames().find(
        (f) => f.url().includes('dembed.st') || f.url().includes('premiumtv') || f.name() === 'thatframe'
      ) ||
      page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith('http')) ||
      page.mainFrame()
    );
  };

  let playerFrame = findPlayerFrame();
  console.log('[FRAME] Active player frame:', playerFrame.url());

  // Attach JW Player error listeners
  await playerFrame.evaluate(() => {
    const attachListeners = () => {
      if (typeof window.jwplayer !== 'function') return false;
      const jw = window.jwplayer();
      if (!jw || typeof jw.on !== 'function') return false;

      jw.on('error', (err) => {
        console.error('[JW_ERROR]', JSON.stringify({
          code: err.code,
          message: err.message,
          type: err.type
        }));
      });

      jw.on('setupError', (err) => {
        console.error('[JW_SETUP_ERROR]', JSON.stringify({
          code: err.code,
          message: err.message,
          type: err.type
        }));
      });

      return true;
    };

    if (!attachListeners()) {
      const iv = setInterval(() => {
        if (attachListeners()) clearInterval(iv);
      }, 500);
    }
  }).catch(() => {});

  // Fullscreen stretch outer and inner player containers to 1280x720
  await page.evaluate(() => {
    const outer = document.querySelector('#playerFrame, iframe');
    if (outer) {
      outer.style.position = 'fixed';
      outer.style.inset = '0';
      outer.style.width = '100vw';
      outer.style.height = '100vh';
      outer.style.zIndex = '999999';
      outer.style.border = 'none';
    }
  }).catch(() => {});

  await playerFrame.evaluate(() => {
    const inner = document.querySelector('#thatframe, iframe');
    if (inner) {
      inner.style.position = 'fixed';
      inner.style.inset = '0';
      inner.style.width = '100vw';
      inner.style.height = '100vh';
      inner.style.zIndex = '999999';
      inner.style.border = 'none';
    }
    const playerDiv = document.querySelector('#player');
    if (playerDiv) {
      playerDiv.style.position = 'fixed';
      playerDiv.style.inset = '0';
      playerDiv.style.width = '100vw';
      playerDiv.style.height = '100vh';
      playerDiv.style.zIndex = '999999';
    }
  }).catch(() => {});

  // Click center to bypass overlay & satisfy autoplay gesture
  await page.mouse.click(640, 360);
  await new Promise((r) => setTimeout(r, 1500));
  await page.mouse.click(640, 360);

  // Force unmute & play
  const playbackState = await playerFrame.evaluate(async () => {
    const result = { jwState: 'unknown', videoReadyState: 0, videoSrc: '' };
    if (typeof window.jwplayer === 'function') {
      const jw = window.jwplayer();
      if (jw) {
        try {
          jw.setMute(false);
          jw.setVolume(100);
          jw.play();
          result.jwState = jw.getState ? jw.getState() : 'called_play';
        } catch (e) {
          result.jwState = `err:${e.message}`;
        }
      }
    }
    const video = document.querySelector('video.jw-video, video');
    if (video) {
      video.muted = false;
      video.volume = 1.0;
      try {
        await video.play();
      } catch (_) {}
      result.videoReadyState = video.readyState;
      result.videoSrc = video.src || '';
    }
    return result;
  }).catch(() => ({}));

  console.log('[PLAYER_STATUS]', JSON.stringify(playbackState));

  // Start broadcasting to OK.ru
  startFFmpeg();

  // Watchdog & duration timer
  let lastTime = -1;
  let stallCount = 0;
  const startTime = Date.now();

  const watchdog = setInterval(async () => {
    const elapsedSec = (Date.now() - startTime) / 1000;
    if (elapsedSec >= MAX_DURATION_SEC) {
      console.log(`[TIMER] Reached configured duration of ${DURATION_MINUTES} minutes. Stopping...`);
      clearInterval(watchdog);
      await cleanup();
      return;
    }

    try {
      playerFrame = findPlayerFrame();
      const status = await playerFrame.evaluate(() => {
        const video = document.querySelector('video.jw-video, video');
        const jw = typeof window.jwplayer === 'function' ? window.jwplayer() : null;
        if (jw && jw.getState && jw.getState() !== 'playing') {
          jw.setMute(false);
          jw.setVolume(100);
          jw.play();
        }
        if (video) {
          if (video.paused) video.play().catch(() => {});
          if (video.muted) video.muted = false;
          return { currentTime: video.currentTime, paused: video.paused };
        }
        return null;
      });

      if (status) {
        if (status.currentTime === lastTime) {
          stallCount++;
          console.warn(`[WATCHDOG] Stream stalled (${stallCount}/6) at t=${status.currentTime}`);
          if (stallCount >= 6) {
            console.warn('[WATCHDOG] Reloading page to recover stream...');
            stallCount = 0;
            await page.reload({ waitUntil: 'domcontentloaded' });
          }
        } else {
          stallCount = 0;
          lastTime = status.currentTime;
        }
      }
    } catch (err) {
      console.warn('[WATCHDOG] Check warning:', err.message);
    }
  }, 5000);
})();
