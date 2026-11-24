




'use strict';

const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { setTimeout: sleep } = require('node:timers/promises');

const RTMP_SERVER = 'rtmp://vsu.okcdn.ru/input/';
const DEFAULT_SOURCE = 'https://dadocric.st/player.php?id=starsp3&v=m';
const STREAM_KEYS = Object.freeze({
    '1'    : '15254238731883_15281627925099_najspfkgne',
    '1.1'  : '15254260751979_15281671637611_2plrcfqzze',
    '1.2'  : '15254285524587_15281717840491_7e6qdknzsu',
    '1.3'  : '16983200374379_18360218880619_efmw4fchxm',
    '1.4'  : '16983242579563_18360288741995_t2kh2jvcym',
    '1.5'  : '16983247822443_18360297982571_3zs5ml7gua',
    '1.6'  : '16983254834795_18360310237803_xrz3pf4uea',
    '1.7'  : '16983259553387_18360317971051_6khoe5efge',
    '1.8'  : '16983264468587_18360327342699_wsn7zgr7ee',
    '1.9'  : '16983269514859_18360335075947_363qzjlbte',
    '1.10' : '16983277641323_18360347921003_rpf6hkqpdm',
    '1.11' : '16983286554219_18360360503915_lrqraxbz3y',
    '2'    : '15254299352683_15281743071851_7dvz3h5d7q',
    '2.1'  : '15254308986475_15281761618539_3xca7oij3u',
    '2.2'  : '15254328122987_15281795566187_zjqa6bqzoq',
    '3'    : '15254341885547_15281821059691_hhlpb5vicy',
    '3.1'  : '15254357089899_15281848322667_sxeexgvzl4',
    '3.2'  : '15254367510123_15281868180075_pc4jrytfgm',
    '3.3'  : '17485986405995_19233134873195_iw63xjblny',
    '3.4'  : '17485996039787_19233150929515_d3yeoweuam',
    '3.5'  : '17486002789995_19233161611883_mbg22slybe',
    '3.6'  : '17486007770731_19233169934955_teme2zt4fm',
    '4'    : '15255022345835_15283095800427_vwrupxzstm',
    '4.1'  : '15255038074475_15283122080363_ai5qqp2we4',
    '4.2'  : '15255045480043_15283135842923_tldl4bhmii',
    '4.3'  : '15255208599147_15283449629291_abltofuc7m',
    '4.4'  : '15255217708651_15283466603115_bojrrqtlmu',
    '4.5'  : '15255227670123_15283486263915_jpntt54mve',
    '5'    : '17135767461483_18625099401835_4gpytlxk4a',
    '5.1'  : '15273713933931_15317494860395_avj47smmim',
    '5.2'  : '15273722257003_15317510195819_6edjluvdqi',
    '5.3'  : '15273739624043_15317541653099_ii4bxpvabe',
    '5.4'  : '15273750175339_15317561707115_csel26ku5a',
    '5.5'  : '15273760071275_15317579467371_cnewcj54me',
    '5.6'  : '15273767935595_15317595851371_3q43tk7tvm',
    '5.7'  : '15273778683499_15317616560747_4piekvs4wu',
    's1.1' : '14204232736303_14846150314543_37jq4ryehq',
    's1.2' : '14204288179759_14846247373359_tnsknmapva',
    's1.3' : '14204319768111_14846302489135_sr4ht4ccwq',
    's1.4' : '14204331957807_14846326147631_dji2acqcze',
    's1.5' : '14204346572335_14846351641135_5gvns4o5ue',
    's1.6' : '14204361252399_14846376479279_cjajhf4d3y',
    's1.7' : '14204370492975_14846393649711_6fduhdqite',
    's1.8' : '14204395527727_14846438017583_s2jlti7lsm',
    's1.9' : '14204411387439_14846464887343_f5lxgcqj5y',
    's1.10': '14204424691247_14846487562799_xmbvntt6wa',
    's2.1' : '14204490948143_14846603495983_kzevn36tii',
    's2.2' : '14204506742319_14846634494511_ta2rxyg2oy',
    's2.3' : '14204523322927_14846661233199_foqb3q7zb4',
    's2.4' : '14204540034607_14846689085999_gjejdie4uy',
    's2.5' : '14204555304495_14846715497007_zdanghuxzu',
    's2.6' : '14204565200431_14846734371375_ap3bqpabpu',
    's2.7' : '14204577259055_14846756194863_3ecad2535u',
    's2.8' : '14204588526969_14846785227311_4hjl46y62e',
    's2.9' : '14204592528943_14846785227311_4hjl46y62e',
    's2.10': '14206184136239_14849618610735_ihnbx7hkoi'
});

const QUALITY = {
    '360p': [640, 360, 800],
    '480p': [854, 480, 1500],
    '720p': [1280, 720, 3000],
    '1080p': [1920, 1080, 4500],
};
const MAX_RUN_MS = 350 * 60_000;

function parseDuration(value) {
    if (/^\d+(?:\.\d+)?$/.test(value)) {
        return Math.round(Number(value) * 60_000);
    }

    const units = { h: 3_600_000, m: 60_000, s: 1_000 };
    const token = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/iy;
    let duration = 0;
    let index = 0;
    while (index < value.length) {
        token.lastIndex = index;
        const match = token.exec(value);
        if (!match) return NaN;
        duration += Number(match[1]) * units[match[2][0].toLowerCase()];
        index = token.lastIndex;
        while (/\s/.test(value[index] || '')) index++;
    }
    return Math.round(duration);
}

function loadConfig(env) {
    const requestedQuality = (env.STREAM_QUALITY || '720p').trim();
    const quality = requestedQuality.includes('1080p') ? '1080p' : requestedQuality;
    if (!Object.hasOwn(QUALITY, quality)) {
        throw new Error('STREAM_QUALITY must be 360p, 480p, 720p or 1080p.');
    }

    const channel = (env.OKRU_STREAM_ID || '1').trim();
    if (!Object.hasOwn(STREAM_KEYS, channel)) {
        throw new Error('OKRU_STREAM_ID does not match a configured channel.');
    }

    const durationMs = parseDuration((env.CUSTOM_DURATION || '10m').trim());
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_RUN_MS) {
        throw new Error('CUSTOM_DURATION must be greater than zero and at most 5h 50m.');
    }

    const sources = (env.TARGET_URLS || DEFAULT_SOURCE).split(/[,|]/)
        .map(value => value.split('::')[0].trim().replace(/^!/, '').trim())
        .filter(Boolean)
        .map((value, index) => {
            try {
                const source = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value)
                    ? value
                    : 'https://' + value);
                if (!['http:', 'https:'].includes(source.protocol) || source.username || source.password) {
                    throw new Error();
                }
                return source.href;
            } catch {
                throw new Error('Invalid HTTP(S) source at position ' + (index + 1) + '.');
            }
        });
    if (sources.length === 0) throw new Error('TARGET_URLS has no sources.');

    const [width, height, bitrate] = QUALITY[quality];
    return {
        sources, width, height, bitrate, durationMs,
        channel,
        audio: (env.ENABLE_STREAM_AUDIO || 'ON').trim().toUpperCase() !== 'OFF',
        serverSelection: (env.SERVER_SELECTION || 'None').trim(),
        publishUrl: RTMP_SERVER + STREAM_KEYS[channel],
        chromePath: env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
        display: env.DISPLAY,
        pulseMonitor: env.STREAM_PULSE_MONITOR || 'stream_capture.monitor',
    };
}

// Puppeteer serializes these functions and runs them inside the selected frame.
function readPlayer(control) {
    function visibleArea(element) {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).visibility === 'visible' ? rect.width * rect.height : 0;
    }

    const candidates = Array.from(document.querySelectorAll('video')).map(video => {
        return { video, area: visibleArea(video) };
    }).filter(item => item.area > 0).sort((a, b) => b.area - a.area);
    const video = candidates[0]?.video;
    const root = video?.closest('.jwplayer') || (!video
        ? Array.from(document.querySelectorAll('.jwplayer[id]')).find(element => visibleArea(element) > 0)
        : null);
    let player;
    if (root?.id && typeof window.jwplayer === 'function') {
        try {
            player = window.jwplayer(root.id);
        } catch {}
    }
    if (!video) {
        if (!player?.play) return null;
        if (control && ['idle', 'paused'].includes(player.getState?.())) player.play();
        return { id: root.id, area: visibleArea(root), playing: false };
    }

    if (control) {
        document.documentElement.style.setProperty('background', 'black', 'important');
        if (document.body) {
            document.body.style.setProperty('overflow', 'hidden', 'important');
        }
        const stage = root || video;
        for (const [name, value] of Object.entries({
            position: 'fixed', inset: '0', width: '100vw', height: '100vh',
            'z-index': '2147483647', background: 'black', 'pointer-events': 'none',
        })) {
            stage.style.setProperty(name, value, 'important');
        }
        video.style.setProperty('width', '100%', 'important');
        video.style.setProperty('height', '100%', 'important');
        video.style.setProperty('object-fit', 'contain', 'important');
        video.controls = false;
        root?.querySelector('.jw-controls')?.style.setProperty('visibility', 'hidden', 'important');

        if (player?.getMute && player?.setMute && player.getMute() === control.audio) {
            player.setMute(!control.audio);
        }
        video.muted = !control.audio;

        if (video.paused) {
            if (player?.play && ['idle', 'paused', 'complete'].includes(player.getState?.())) {
                player.play();
            } else {
                video.play().catch(() => {});
            }
        }

        const duration = player?.getDuration?.();
        if ((video.duration === Infinity || duration === Infinity || duration < 0) &&
            video.readyState >= 2 && video.seekable.length > 0) {
            const range = video.seekable.length - 1;
            const edge = video.seekable.end(range);
            if (edge - video.currentTime > 15) {
                video.currentTime = Math.max(video.seekable.start(range), edge - 3);
            }
        }
    }

    if (!video.dataset.captureId) video.dataset.captureId = String(Math.random());
    return {
        id: video.dataset.captureId,
        area: candidates[0].area,
        playing: !video.paused && !video.ended && video.readyState >= 2,
        position: video.currentTime,
        frames: video.getVideoPlaybackQuality?.().totalVideoFrames ?? 0,
    };
}

function selectServer(label) {
    const options = Array.from(document.querySelectorAll('button, a, [role="button"], div'));
    const visible = options.filter(node => node.getClientRects().length &&
        (node.tagName !== 'DIV' || node.getAttribute('role') === 'button' || !node.children.length));
    const control = visible.find(node => node.textContent.trim() === label)
        || visible.find(node => node.textContent.trim().includes(label));
    if (!control) return false;
    control.click();
    return true;
}

async function samplePlayer(page, audio, preferredFrame) {
    const frames = page.frames();
    const samples = await Promise.all(frames.map(async frame => {
        const sample = await frame.evaluate(readPlayer, null).catch(() => null);
        return sample && { ...sample, frame };
    }));
    const candidates = samples.filter(Boolean).sort((a, b) => b.area - a.area);
    const selected = candidates.find(sample => sample.frame === preferredFrame && sample.playing)
        || candidates.find(sample => sample.playing) || candidates[0];
    if (!selected) return null;

    for (let frame = selected.frame; frame.parentFrame(); frame = frame.parentFrame()) {
        const element = await frame.frameElement().catch(() => null);
        if (!element) return null;
        try {
            await element.evaluate(iframe => {
                for (const [name, value] of Object.entries({
                    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
                    border: '0', 'z-index': '2147483647',
                })) {
                    iframe.style.setProperty(name, value, 'important');
                }
                document.documentElement.style.setProperty('overflow', 'hidden', 'important');
            }).catch(() => {});
        } finally {
            await element.dispose().catch(() => {});
        }
    }
    const sample = await selected.frame.evaluate(readPlayer, { audio }).catch(() => null);
    return sample && { ...sample, frame: selected.frame };
}

function advancing(previous, current) {
    return Boolean(current?.playing && previous?.id === current.id &&
        (current.position > previous.position + 0.05 || current.frames > previous.frames));
}

function monitorMedia(page) {
    const manifests = new Map();
    let errors = 0;
    page.on('response', async response => {
        let path;
        try {
            path = new URL(response.url()).pathname;
        } catch {
            return;
        }
        if (!/\.(m3u8|mpd|ts|m4s|aac|mp4)$/i.test(path)) return;
        if (response.status() >= 400) {
            errors++;
            return;
        }
        if (!response.ok()) return;
        errors = 0;
        if (!/\.m3u8$/i.test(path)) return;

        const text = await response.text().catch(() => '');
        const sequence = /^#EXT-X-MEDIA-SEQUENCE:(\d+)/m.exec(text)?.[1];
        if (!sequence || /^#EXT-X-ENDLIST/m.test(text)) return;

        const key = response.url().split('?')[0];
        const last = manifests.get(key);
        if (last?.sequence !== sequence) {
            if (manifests.size >= 32 && !last) manifests.delete(manifests.keys().next().value);
            manifests.set(key, { sequence, advancedAt: performance.now() });
        }
    });
    return () => {
        const sequences = [...manifests.values()];
        const stale = sequences.length > 0 &&
            sequences.every(item => performance.now() - item.advancedAt > 25_000);
        return errors >= 6 ? 'media HTTP errors' : stale ? 'HLS sequence unchanged' : 'OK';
    };
}

function monitorImage(page, { width, height }) {
    const clip = {
        x: Math.floor(width * 0.15), y: Math.floor(height * 0.15),
        width: Math.floor(width * 0.7), height: Math.floor(height * 0.7),
    };
    let lastHash;
    let lastChange = performance.now();
    const recent = [];
    return async () => {
        const buffer = await page.screenshot({
            type: 'jpeg', quality: 20, clip, captureBeyondViewport: false,
        }).catch(() => null);
        if (!buffer) return 'unavailable';
        const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
        const now = performance.now();
        if (hash === lastHash) return now - lastChange >= 18_000 ? 'static' : 'OK';
        lastHash = hash;
        lastChange = now;
        recent.push(hash);
        if (recent.length > 18) recent.shift();
        return recent.filter(sample => sample === hash).length >= 5 ? 'repeating' : 'OK';
    };
}

function startPublisher(config) {
    const { width, height, bitrate, display, audio } = config;
    const audioInput = audio
        ? ['-thread_queue_size', '512', '-f', 'pulse', '-i', config.pulseMonitor]
        : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
    const args = [
        '-hide_banner', '-nostdin', '-loglevel', 'warning', '-progress', 'pipe:1',
        '-thread_queue_size', '64', '-f', 'x11grab', '-draw_mouse', '0',
        '-video_size', width + 'x' + height, '-framerate', '30', '-i', display + '+0,0',
        ...audioInput,
        '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'ultrafast',
        '-pix_fmt', 'yuv420p', '-g', '60', '-sc_threshold', '0',
        '-b:v', bitrate + 'k', '-maxrate', bitrate + 'k', '-bufsize', (bitrate * 2) + 'k',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
        '-flvflags', 'no_duration_filesize', '-rw_timeout', '15000000', '-f', 'flv', config.publishUrl,
    ];
    const process = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const state = { frames: 0, ended: false };
    let progress = '';
    process.stdout.setEncoding('utf8').on('data', data => {
        progress += data;
        const lines = progress.split('\n');
        progress = lines.pop();
        for (const line of lines) {
            const frames = /^frame=\s*(\d+)\s*$/.exec(line);
            if (frames) state.frames = Number(frames[1]);
        }
    });
    let diagnostic = '';
    process.stderr.setEncoding('utf8').on('data', data => {
        diagnostic = (diagnostic + data).slice(-4_096);
    });

    const stopped = new Promise(resolve => {
        process.once('error', error => {
            state.detail = error.code || 'spawn error';
        });
        process.once('close', (code, signal) => {
            state.ended = true;
            state.detail ||= code === null ? signal : 'exit ' + code;
            const message = diagnostic.trim().split('\n').findLast(line =>
                /error|failed|cannot|denied/i.test(line));
            if (message) {
                const key = config.publishUrl.split('/').at(-1);
                state.detail += ': ' + message
                    .replace(/\b(?:https?|rtmps?|tcp):\/\/\S+/gi, '[endpoint]')
                    .replaceAll(key, '[key]').slice(0, 180);
            }
            resolve();
        });
    });

    state.stop = async () => {
        if (state.ended) return;
        process.kill('SIGINT');
        const timeout = setTimeout(() => process.kill('SIGKILL'), 4_000);
        try {
            await stopped;
        } finally {
            clearTimeout(timeout);
        }
    };
    return state;
}

async function waitForPlayback(page, config, signal) {
    const deadline = performance.now() + 30_000;
    let previous;
    while (performance.now() < deadline) {
        const sample = await samplePlayer(page, config.audio, previous?.frame);
        if (advancing(previous, sample)) return sample;
        previous = sample;
        await sleep(500, undefined, { signal });
    }
    throw new Error('playback did not start within 30 seconds');
}

async function supervise(page, config, initial, publisher, networkStatus, signal) {
    let lastMotion = performance.now();
    let lastLog = lastMotion;
    let lastImageSample = lastMotion - 6_000;
    let lastPublishMotion = lastMotion;
    let lastPublishedFrames = 0;
    let image = 'unavailable';
    const readImage = monitorImage(page, config);
    let previous = initial;

    while (!signal.aborted) {
        await sleep(2_000, undefined, { signal });
        if (publisher.ended) throw new Error('FFmpeg stopped (' + publisher.detail + ')');
        if (publisher.frames > lastPublishedFrames) {
            if (lastPublishedFrames === 0) {
                console.log('[publish] FFmpeg encoded frames for channel ' + config.channel);
            }
            lastPublishedFrames = publisher.frames;
            lastPublishMotion = performance.now();
        } else if (performance.now() - lastPublishMotion > 20_000) {
            throw new Error('FFmpeg reported no new frames for 20 seconds');
        }

        const sample = await samplePlayer(page, config.audio, previous?.frame);
        const now = performance.now();
        if (advancing(previous, sample)) lastMotion = now;
        if (now - lastMotion > 18_000) {
            throw new Error('playback stopped advancing (' + networkStatus() + ')');
        }
        if (now - lastImageSample >= 6_000) {
            image = await readImage();
            lastImageSample = now;
        }
        const network = networkStatus();
        if ((image === 'static' || image === 'repeating') && network !== 'OK') {
            throw new Error('visual signal ' + image + ' with ' + network);
        }
        if (now - lastLog >= 20_000) {
            console.log('[health] publisher frames=' + publisher.frames + ' media=' + network + ' image=' + image);
            lastLog = now;
        }
        previous = sample;
    }
}

async function launchBrowser(config, launcher) {
    const browser = await launcher.launch({
        executablePath: config.chromePath,
        headless: false,
        timeout: 20_000,
        protocolTimeout: 8_000,
        defaultViewport: null,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        args: [
            '--kiosk', '--window-position=0,0', '--ozone-platform=x11',
            '--window-size=' + config.width + ',' + config.height,
            '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage',
        ],
    });
    browser.on('targetcreated', async target => {
        if (target.type() === 'page' && target.opener()) {
            const popup = await target.page().catch(() => null);
            await popup?.close().catch(() => {});
        }
    });
    return browser;
}

async function run(config, launcher = require('puppeteer-core')) {
    if (!config.display) throw new Error('Start stream.js under Xvfb so DISPLAY is set.');
    const controller = new AbortController();
    const { signal } = controller;
    const stop = () => controller.abort();
    const timer = setTimeout(stop, config.durationMs);
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    let browser;
    let established = false;
    let attemptsWithoutOutput = 0;
    let activePage;
    const closePage = () => { void activePage?.close().catch(() => {}); };
    signal.addEventListener('abort', closePage, { once: true });

    try {
        for (let attempt = 0; !signal.aborted; attempt++) {
            const index = attempt % config.sources.length;
            const label = (index + 1) + '/' + config.sources.length;
            let page;
            let publisher;
            try {
                if (!browser?.connected) {
                    await browser?.close().catch(() => {});
                    browser = await launchBrowser(config, launcher);
                }
                signal.throwIfAborted();
                page = await browser.newPage();
                activePage = page;
                const readNetwork = monitorMedia(page);
                await page.bringToFront();
                console.log('[source] Opening ' + label);
                const response = await page.goto(config.sources[index], {
                    waitUntil: 'domcontentloaded', timeout: 30_000,
                }).catch(() => { throw new Error('navigation failed'); });
                if (response && response.status() >= 400) {
                    throw new Error('source returned HTTP ' + response.status());
                }
                if (config.serverSelection && config.serverSelection !== 'None') {
                    await page.waitForFunction(selectServer, { timeout: 10_000 }, config.serverSelection)
                        .then(handle => handle.dispose())
                        .catch(() => { throw new Error('configured server control was not found'); });
                }
                const initial = await waitForPlayback(page, config, signal);
                signal.throwIfAborted();
                publisher = startPublisher(config);
                await supervise(page, config, initial, publisher, readNetwork, signal);
            } catch (error) {
                if (!signal.aborted) {
                    console.warn('[failover] Source ' + label + ': ' + error.message);
                }
            } finally {
                if (publisher) {
                    await publisher.stop();
                    if (publisher.frames > 0) established = true;
                }
                activePage = undefined;
                if (page) await page.close().catch(() => {});
            }
            if (signal.aborted) break;
            attemptsWithoutOutput = publisher?.frames > 0 ? 0 : attemptsWithoutOutput + 1;
            if (attemptsWithoutOutput >= Math.max(2, config.sources.length * 2)) {
                throw new Error('No source produced output after two passes.');
            }
            await sleep(1_000, undefined, { signal }).catch(error => {
                if (!signal.aborted) throw error;
            });
        }

        if (!established) throw new Error('The run ended without any reported output frames.');
        console.log('[stop] Stream stopped.');
    } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', closePage);
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
        if (browser) await browser.close();
    }
}

if (require.main === module) {
    Promise.resolve().then(() => {
        if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Linux' ||
            process.env.RUNNER_ENVIRONMENT !== 'github-hosted') {
            throw new Error('Use a GitHub-hosted Linux Actions runner.');
        }
        return run(loadConfig(process.env));
    }).catch(error => {
        console.error('[stream] ' + error.message);
        process.exitCode = 1;
    });
}

module.exports = { loadConfig, run };















// ============================ clasude ka Alhamdullah teek tak abey wuu woo balck and white issue bey nahey hai k player hide and off huu jata har 10 seconds me =====================







// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// puppeteer.use(StealthPlugin());

// const fs = require('fs');
// const path = require('path');
// const os = require('os');
// const crypto = require('crypto');
// const { spawn, exec, execSync } = require('child_process');

// // obs-websocket-js import: v5 ke different builds ke liye safe
// const obsLib = require('obs-websocket-js');
// const OBSWebSocket = obsLib.OBSWebSocket || obsLib.default || obsLib;

// // =========================================================================================
// // 🛡️ GLOBAL CRASH SHIELD
// // =========================================================================================
// process.on('uncaughtException', (err) => console.error('[💥] UNCAUGHT EXCEPTION:', err.message));
// process.on('unhandledRejection', (reason) => console.error('[💥] UNHANDLED REJECTION:', reason));

// // Har engine restart par naya instance banta hai (reconnect issue fix)
// let obs = new OBSWebSocket();

// // =========================================================================================
// // ⚙️ CONFIGURATION & ENV VARIABLES
// // =========================================================================================
// const selectedQuality = process.env.STREAM_QUALITY || '720p';
// const SERVER_SELECTION = (process.env.SERVER_SELECTION || 'None').trim();
// const PROXY_ENGINE = process.env.PROXY_ENGINE || 'Cloudflare WARP (Recommended)';
// const ENABLE_STREAM_AUDIO = process.env.ENABLE_STREAM_AUDIO !== 'OFF';
// const SELECTED_CHANNEL = (process.env.OKRU_STREAM_ID || '1').trim();

// // const FORCE_REFRESH_MS = 9 * 60 * 1000;
// const FORCE_REFRESH_MS = 900000000 * 60 * 1000;

// // Health monitor tuning
// const STALE_MANIFEST_MS = 60000;      // itni der same media-sequence rahe to stale
// const NET_ERROR_LIMIT = 8;            // lagataar itne segment errors par failover
// const VISUAL_FREEZE_MS = 25000;       // screen bilkul same rahe to frozen
// const ENABLE_LOOP_DETECT = false;     // scoreboard/ticker streams par false positive deta hai

// const NO_REFRESH_DOMAINS = [
//     'youtube.com', 'facebook.com', 'streamed.pk', 'cricstreams.',
//     'sport4u.online', 'vercel.app', 'netlify.app'
// ];

// let RES_W = 1280, RES_H = 720, BITRATE = 3000;
// if (selectedQuality === '360p') { RES_W = 640; RES_H = 360; BITRATE = 800; }
// else if (selectedQuality === '480p') { RES_W = 854; RES_H = 480; BITRATE = 1500; }
// else if (selectedQuality === '720p') { RES_W = 1280; RES_H = 720; BITRATE = 3000; }
// else if (selectedQuality.includes('1080p')) { RES_W = 1920; RES_H = 1080; BITRATE = 4500; }

// const STREAM_KEYS = {
//     '1'    : '15254238731883_15281627925099_najspfkgne',
//     '1.1'  : '15254260751979_15281671637611_2plrcfqzze',
//     '1.2'  : '15254285524587_15281717840491_7e6qdknzsu',
//     '1.3'  : '16983200374379_18360218880619_efmw4fchxm',
//     '1.4'  : '16983242579563_18360288741995_t2kh2jvcym',
//     '1.5'  : '16983247822443_18360297982571_3zs5ml7gua',
//     '1.6'  : '16983254834795_18360310237803_xrz3pf4uea',
//     '1.7'  : '16983259553387_18360317971051_6khoe5efge',
//     '1.8'  : '16983264468587_18360327342699_wsn7zgr7ee',
//     '1.9'  : '16983269514859_18360335075947_363qzjlbte',
//     '1.10' : '16983277641323_18360347921003_rpf6hkqpdm',
//     '1.11' : '16983286554219_18360360503915_lrqraxbz3y',
//     '2'    : '15254299352683_15281743071851_7dvz3h5d7q',
//     '2.1'  : '15254308986475_15281761618539_3xca7oij3u',
//     '2.2'  : '15254328122987_15281795566187_zjqa6bqzoq',
//     '3'    : '15254341885547_15281821059691_hhlpb5vicy',
//     '3.1'  : '15254357089899_15281848322667_sxeexgvzl4',
//     '3.2'  : '15254367510123_15281868180075_pc4jrytfgm',
//     '3.3'  : '17485986405995_19233134873195_iw63xjblny',
//     '3.4'  : '17485996039787_19233150929515_d3yeoweuam',
//     '3.5'  : '17486002789995_19233161611883_mbg22slybe',
//     '3.6'  : '17486007770731_19233169934955_teme2zt4fm',
//     '4'    : '15255022345835_15283095800427_vwrupxzstm',
//     '4.1'  : '15255038074475_15283122080363_ai5qqp2we4',
//     '4.2'  : '15255045480043_15283135842923_tldl4bhmii',
//     '4.3'  : '15255208599147_15283449629291_abltofuc7m',
//     '4.4'  : '15255217708651_15283466603115_bojrrqtlmu',
//     '4.5'  : '15255227670123_15283486263915_jpntt54mve',
//     '5'    : '17135767461483_18625099401835_4gpytlxk4a',
//     '5.1'  : '15273713933931_15317494860395_avj47smmim',
//     '5.2'  : '15273722257003_15317510195819_6edjluvdqi',
//     '5.3'  : '15273739624043_15317541653099_ii4bxpvabe',
//     '5.4'  : '15273750175339_15317561707115_csel26ku5a',
//     '5.5'  : '15273760071275_15317579467371_cnewcj54me',
//     '5.6'  : '15273767935595_15317595851371_3q43tk7tvm',
//     '5.7'  : '15273778683499_15317616560747_4piekvs4wu',
//     's1.1' : '14204232736303_14846150314543_37jq4ryehq',
//     's1.2' : '14204288179759_14846247373359_tnsknmapva',
//     's1.3' : '14204319768111_14846302489135_sr4ht4ccwq',
//     's1.4' : '14204331957807_14846326147631_dji2acqcze',
//     's1.5' : '14204346572335_14846351641135_7gvns4o5ue',
//     's1.6' : '14204361252399_14846376479279_cjajhf4d3y',
//     's1.7' : '14204370492975_14846393649711_6fduhdqite',
//     's1.8' : '14204395527727_14846438017583_s2jlti7lsm',
//     's1.9' : '14204411387439_14846464887343_f5lxgcqj5y',
//     's1.10': '14204424691247_14846487562799_xmbvntt6wa',
//     's2.1' : '14204490948143_14846603495983_kzevn36tii',
//     's2.2' : '14204506742319_14846634494511_ta2rxyg2oy',
//     's2.3' : '14204523322927_14846661233199_foqb3q7zb4',
//     's2.4' : '14204540034607_14846689085999_gjejdie4uy',
//     's2.5' : '14204555304495_14846715497007_zdanghuxzu',
//     's2.6' : '14204565200431_14846734371375_ap3bqpabpu',
//     's2.7' : '14204577259055_14846756194863_3ecad2535u',
//     's2.8' : '14204592528943_14846785227311_4hjl46y62e',
//     's2.9' : '14204602621487_14846802594351_ilnp6lxekq',
//     's2.10': '14206184136239_14849618610735_ihnbx7hkoi'
// };

// const ACTIVE_STREAM_KEY = STREAM_KEYS[SELECTED_CHANNEL] || STREAM_KEYS['1'];

// // =========================================================================================
// // 🔗 MULTI-URL PARSER
// // =========================================================================================
// const rawUrls = (process.env.TARGET_URLS || 'https://dadocric.st/player.php?id=starsp3&v=m').trim();
// const urlList = rawUrls
//     .split(/[,|]/)
//     .map(u => {
//         let clean = u.split('::')[0].trim().replace(/^!/, '');
//         if (clean && !clean.startsWith('http')) clean = 'https://' + clean;
//         return clean;
//     })
//     .filter(u => u.length > 8);

// if (urlList.length === 0) urlList.push('https://dadocric.st/player.php?id=starsp3&v=m');

// let currentUrlIndex = 0;
// let browser = null;
// let page = null;
// let obsProcess = null;

// // =========================================================================================
// // 📊 3-PILLAR HEALTH MONITOR STATE (Network + Manifest + Visual Hash)
// // =========================================================================================
// let netStats = {};
// let visualStats = {};

// function resetMonitorStats() {
//     netStats = {
//         lastSegmentOkTime: Date.now(),
//         segmentErrorCount: 0,
//         lastHttpStatus: 200,
//         lastMediaSeq: null,
//         lastSeqAdvanceTime: Date.now(),
//         seenManifest: false,
//         programDateTimeLagSec: 0
//     };
//     visualStats = {
//         lastCheckTime: 0,
//         lastHash: null,
//         sameHashSince: Date.now(),
//         recentHashes: []
//     };
// }
// resetMonitorStats();

// console.log(`[🚀] Engine Locked: ${RES_W}x${RES_H} @ ${BITRATE}kbps | Channel: ${SELECTED_CHANNEL}`);
// console.log(`[📋] Loaded ${urlList.length} URLs for Failover:`, urlList);

// // =========================================================================================
// // 🎥 OBS CONFIGURATION (With OBS 30+ WebSocket Plugin Fix)
// // =========================================================================================
// function setupOBSConfig() {
//     const obsDir = path.join(os.homedir(), '.config', 'obs-studio');
//     const profilesDir = path.join(obsDir, 'basic', 'profiles', 'Untitled');
//     const scenesDir = path.join(obsDir, 'basic', 'scenes');
//     const wsPluginDir = path.join(obsDir, 'plugin_config', 'obs-websocket');

//     fs.mkdirSync(profilesDir, { recursive: true });
//     fs.mkdirSync(scenesDir, { recursive: true });
//     fs.mkdirSync(wsPluginDir, { recursive: true });

//     fs.writeFileSync(path.join(obsDir, 'global.ini'), `[General]\nLicenseAccepted=true\nFirstRun=true\n[BasicWindow]\nShowAutoConfig=false\nWarned=true\n[OBSWebSocket]\nServerEnabled=true\nServerPort=4455\nServerPassword=secret\n`);

//     fs.writeFileSync(path.join(wsPluginDir, 'config.json'), JSON.stringify({
//         alerts_enabled: false,
//         auth_required: true,
//         first_load: false,
//         server_enabled: true,
//         server_password: "secret",
//         server_port: 4455
//     }, null, 2));

//     fs.writeFileSync(path.join(profilesDir, 'basic.ini'), `[General]\nName=Untitled\n[Video]\nBaseCX=${RES_W}\nBaseCY=${RES_H}\nOutputCX=${RES_W}\nOutputCY=${RES_H}\nFPSCommon=30\n[Output]\nMode=Advanced\n[AdvOut]\nTrackIndex=1\nRecType=Standard\nEncoder=obs_x264\n[obs_x264]\nbitrate=${BITRATE}\nkeyint_sec=2\npreset=ultrafast\nprofile=main\ntune=zerolatency\n`);

//     const serviceJson = {
//         settings: { server: "rtmp://vsu.okcdn.ru/input/", key: ACTIVE_STREAM_KEY.trim() },
//         type: "rtmp_custom"
//     };
//     fs.writeFileSync(path.join(profilesDir, 'service.json'), JSON.stringify(serviceJson, null, 2));

//     const sceneJson = {
//         current_scene: "MainScene",
//         current_program_scene: "MainScene",
//         name: "Untitled",
//         scene_order: [{ name: "WaitingScene" }, { name: "MainScene" }],
//         sources: [
//             { id: "xshm_input", name: "Screen", settings: { show_cursor: false } },
//             { id: "pulse_output_capture", name: "Audio", settings: {} },
//             { id: "scene", name: "MainScene", settings: { items: [{ name: "Screen", id: 1, visible: true }, { name: "Audio", id: 2, visible: true }] } },
//             { id: "scene", name: "WaitingScene", settings: { items: [{ name: "Screen", id: 1, visible: true }] } }
//         ]
//     };
//     fs.writeFileSync(path.join(scenesDir, 'Untitled.json'), JSON.stringify(sceneJson, null, 2));
// }

// // =========================================================================================
// // 🪟 HIDE OBS WINDOW & FORCE CHROME ON TOP (async - event loop block nahi karta)
// // =========================================================================================
// let windowFixBusy = false;
// function keepChromeOnTopAndHideOBS() {
//     if (windowFixBusy) return;
//     windowFixBusy = true;
//     const cmd =
//         'xdotool search --name "OBS" windowmove 5000 5000 windowminimize 2>/dev/null; ' +
//         `xdotool search --onlyvisible --class "chrome" windowmove 0 0 windowsize ${RES_W} ${RES_H} windowactivate 2>/dev/null; ` +
//         'wmctrl -a "Chrome" 2>/dev/null; true';
//     exec(cmd, { timeout: 5000 }, () => { windowFixBusy = false; });
// }

// // =========================================================================================
// // 🛡️ POPUP & AD FIREWALL + CHECK #1: NETWORK & HLS MANIFEST FRESHNESS MONITOR
// // =========================================================================================
// async function setupPageProtections(p) {
//     try {
//         await p.setRequestInterception(true);
//         p.on('request', (req) => {
//             const url = req.url().toLowerCase();
//             const badWords = ['popads', 'exoclick', 'adsterra', 'onclickads', 'doubleclick', 'adexchangerapid', 'bet365', '1xbet'];
//             if (badWords.some(w => url.includes(w))) return req.abort().catch(() => {});
//             req.continue().catch(() => {});
//         });

//         p.on('response', async (res) => {
//             try {
//                 const url = res.url().toLowerCase();
//                 const status = res.status();
//                 const isManifest = url.includes('.m3u8') || url.includes('.mpd');
//                 const isSegment = url.includes('.ts') || url.includes('.m4s') || url.includes('.aac') || url.includes('.mp4');

//                 if (isManifest || isSegment) {
//                     netStats.lastHttpStatus = status;
//                     if (status >= 200 && status < 400) {
//                         netStats.lastSegmentOkTime = Date.now();
//                         netStats.segmentErrorCount = 0;
//                     } else if (status >= 400) {
//                         netStats.segmentErrorCount++;
//                     }
//                 }

//                 if (url.includes('.m3u8') && status >= 200 && status < 300) {
//                     const text = await res.text().catch(() => '');
//                     if (text && text.includes('#EXTM3U')) {
//                         const seqMatch = text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/i);
//                         if (seqMatch) {
//                             netStats.seenManifest = true;
//                             const seq = parseInt(seqMatch[1], 10);
//                             if (netStats.lastMediaSeq === null || seq !== netStats.lastMediaSeq) {
//                                 netStats.lastMediaSeq = seq;
//                                 netStats.lastSeqAdvanceTime = Date.now();
//                             }
//                         }

//                         const pdtMatches = text.match(/#EXT-X-PROGRAM-DATE-TIME:([^\r\n]+)/gi);
//                         if (pdtMatches && pdtMatches.length > 0) {
//                             const lastPdtLine = pdtMatches[pdtMatches.length - 1];
//                             const isoStr = lastPdtLine.replace(/#EXT-X-PROGRAM-DATE-TIME:/i, '').trim();
//                             const pdtTime = Date.parse(isoStr);
//                             if (!isNaN(pdtTime)) {
//                                 netStats.programDateTimeLagSec = Math.round((Date.now() - pdtTime) / 1000);
//                             }
//                         }
//                     }
//                 }
//             } catch (e) {}
//         });

//         p.on('requestfailed', (req) => {
//             const url = req.url().toLowerCase();
//             if (url.includes('.m3u8') || url.includes('.ts') || url.includes('.m4s')) {
//                 netStats.segmentErrorCount++;
//             }
//         });

//         await p.evaluateOnNewDocument(() => {
//             window.open = () => null;
//             window.alert = () => {};
//             window.confirm = () => true;
//             window.prompt = () => null;
//             const style = document.createElement('style');
//             style.textContent = `html, body { background-color: #000 !important; overflow: hidden !important; margin: 0 !important; }`;
//             document.documentElement.appendChild(style);
//         });
//     } catch (e) {}
// }

// async function showLoadingOverlay(p, title, subtitle) {
//     try {
//         await p.evaluate((t, s) => {
//             if (window.self !== window.top) return;
//             let el = document.getElementById('bot-loading-ui');
//             if (!el) {
//                 el = document.createElement('div');
//                 el.id = 'bot-loading-ui';
//                 el.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#000;z-index:2147483647;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;font-family:sans-serif;';
//                 document.documentElement.appendChild(el);
//             }
//             el.innerHTML = `<h1 style="font-size:38px;margin-bottom:10px;color:#e50914;">${t}</h1><p style="font-size:20px;color:#aaa;">${s}</p>`;
//         }, title, subtitle);
//     } catch (e) {}
// }

// async function hideLoadingOverlay(p) {
//     try {
//         await p.evaluate(() => {
//             const el = document.getElementById('bot-loading-ui');
//             if (el) el.remove();
//         });
//     } catch (e) {}
// }

// // =========================================================================================
// // 🎬 VIDEO PLAYER AUTO-PLAY, LIVE EDGE CLICK & FULLSCREEN LOCK
// // =========================================================================================
// async function lockAndPlayVideo(p) {
//     if (!p) return;
//     try {
//         if (SERVER_SELECTION !== 'None') {
//             await p.evaluate((srv) => {
//                 const btn = Array.from(document.querySelectorAll('button, a, div')).find(b => b.innerText && b.innerText.trim().includes(srv));
//                 if (btn) btn.click();
//             }, SERVER_SELECTION).catch(() => {});
//             await new Promise(r => setTimeout(r, 2000));
//         }

//         for (let attempt = 0; attempt < 8; attempt++) {
//             let playing = false;
//             for (const frame of p.frames()) {
//                 if (frame.isDetached()) continue;
//                 try {
//                     const status = await frame.evaluate((audioEnabled) => {
//                         const playAndLiveSelectors = '.jw-icon-display, .jw-icon-playback, .jw-icon-live, button[data-plyr="play"], .vjs-big-play-button, .vjs-play-control, .vjs-live-control, [class*="unmute"], .fp-play, .clappr-player, video';
//                         document.querySelectorAll(playAndLiveSelectors).forEach(el => { try { el.click(); } catch(e){} });

//                         let isPlaying = false;
//                         document.querySelectorAll('video').forEach(v => {
//                             if (v.paused) v.play().catch(() => {});
//                             v.muted = !audioEnabled;
//                             v.volume = audioEnabled ? 1.0 : 0.0;
//                             if (!v.paused && v.readyState >= 2) isPlaying = true;
//                         });
//                         return isPlaying;
//                     }, ENABLE_STREAM_AUDIO);
//                     if (status) { playing = true; break; }
//                 } catch (e) {}
//             }
//             if (playing) break;
//             await new Promise(r => setTimeout(r, 1500));
//         }

//         for (const frame of p.frames()) {
//             if (frame.isDetached()) continue;
//             await frame.evaluate((audioEnabled) => {
//                 if (window.__frameLockActive) return;
//                 window.__frameLockActive = true;
//                 setInterval(() => {
//                     document.documentElement.style.setProperty('background', '#000', 'important');
//                     if (document.body) document.body.style.setProperty('background', '#000', 'important');

//                     const v = document.querySelector('video');
//                     if (v) {
//                         if (v.paused) {
//                             v.play().catch(() => {});
//                             const resumeSelectors = '.jw-icon-display, .jw-icon-playback, button[data-plyr="play"], .vjs-play-control, .vjs-big-play-button, .fp-play';
//                             document.querySelectorAll(resumeSelectors).forEach(btn => { try { btn.click(); } catch(e){} });
//                         }

//                         const liveBtns = document.querySelectorAll('.jw-icon-live, .vjs-live-control, [class*="live-button"], [aria-label*="Live"]');
//                         liveBtns.forEach(btn => {
//                             const cls = (btn.className || '').toString().toLowerCase();
//                             if (cls.includes('not-live') || cls.includes('behind') || cls.includes('dvr')) {
//                                 try { btn.click(); } catch(e){}
//                             }
//                         });

//                         if (v.clientWidth > 50 || !v.paused) {
//                             v.muted = !audioEnabled;
//                             v.volume = audioEnabled ? 1.0 : 0.0;
//                             const wrap = v.closest('.jwplayer, #player, .plyr, .vjs-player, [data-player], .player-poster') || v;
//                             wrap.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;z-index:2147483646 !important;background:#000 !important;';
//                             v.style.cssText = 'width:100% !important;height:100% !important;object-fit:contain !important;';
//                             document.querySelectorAll('.jw-controls, .plyr__controls, .vjs-control-bar').forEach(c => c.style.setProperty('display', 'none', 'important'));
//                             return;
//                         }
//                     }

//                     const iframes = Array.from(document.querySelectorAll('iframe'));
//                     let best = null, maxArea = 5000;
//                     iframes.forEach(f => {
//                         const area = f.clientWidth * f.clientHeight;
//                         if (area > maxArea && f.clientWidth >= f.clientHeight) { maxArea = area; best = f; }
//                     });
//                     if (best) {
//                         iframes.forEach(f => { if (f !== best) f.style.setProperty('display', 'none', 'important'); });
//                         best.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;width:100vw !important;height:100vh !important;z-index:2147483645 !important;border:none !important;background:#000 !important;display:block !important;visibility:visible !important;';
//                     }
//                 }, 1000);
//             }, ENABLE_STREAM_AUDIO).catch(() => {});
//         }
//     } catch (e) {}
// }

// // =========================================================================================
// // 🖼️ CHECK #3B: VISUAL FRAME HASH FREEZE (& optional repeat-loop detection)
// // =========================================================================================
// async function checkVisualFreshness(p) {
//     const now = Date.now();
//     if (now - visualStats.lastCheckTime < 6000) {
//         return { visualStatus: 'OK' };
//     }
//     visualStats.lastCheckTime = now;

//     try {
//         // clip hata diya: kiosk/fullscreen me clip kabhi kabhi fail hota tha
//         const buf = await p.screenshot({ type: 'jpeg', quality: 20 });
//         const frameHash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 12);

//         if (visualStats.lastHash === frameHash) {
//             const frozenMs = now - visualStats.sameHashSince;
//             if (frozenMs > VISUAL_FREEZE_MS) {
//                 return { visualStatus: 'VISUAL_FROZEN', frozenSec: Math.round(frozenMs / 1000), hash: frameHash };
//             }
//         } else {
//             visualStats.lastHash = frameHash;
//             visualStats.sameHashSince = now;

//             if (ENABLE_LOOP_DETECT) {
//                 visualStats.recentHashes.push(frameHash);
//                 if (visualStats.recentHashes.length > 24) visualStats.recentHashes.shift();
//                 const occurrences = visualStats.recentHashes.filter(h => h === frameHash).length;
//                 if (occurrences >= 8) {
//                     return { visualStatus: 'CONTENT_LOOP', hash: frameHash };
//                 }
//             }
//         }

//         return { visualStatus: 'OK', hash: frameHash };
//     } catch (e) {
//         return { visualStatus: 'OK' };
//     }
// }

// // =========================================================================================
// // 💓 CHECK #2: PLAYBACK HEALTH
// // =========================================================================================
// async function checkStreamHealth(p) {
//     if (!p) return { status: 'DEAD' };
//     try {
//         const checks = p.frames().map(async (frame) => {
//             if (frame.isDetached()) return null;
//             try {
//                 return await Promise.race([
//                     frame.evaluate(() => {
//                         const v = document.querySelector('video');
//                         if (!v) return null;

//                         const frames = v.getVideoPlaybackQuality
//                             ? v.getVideoPlaybackQuality().totalVideoFrames
//                             : (v.webkitDecodedFrameCount || 0);

//                         if (v.paused) {
//                             v.play().catch(() => {});
//                             const btns = document.querySelectorAll('.jw-icon-display, .jw-icon-live, .vjs-play-control, .vjs-live-control, button[data-plyr="play"]');
//                             btns.forEach(b => { try { b.click(); } catch(e){} });
//                             return { status: 'PAUSED_RESUMING', paused: true, readyState: v.readyState, currentTime: v.currentTime, frames };
//                         }

//                         if (v.readyState >= 2 || frames > 0) {
//                             return { status: 'HEALTHY', paused: false, readyState: v.readyState, currentTime: v.currentTime, frames };
//                         }
//                         return null;
//                     }),
//                     new Promise(r => setTimeout(() => r(null), 1500))
//                 ]);
//             } catch (e) { return null; }
//         });

//         const results = await Promise.all(checks);
//         const healthy = results.find(r => r && r.status === 'HEALTHY');
//         if (healthy) return healthy;

//         const pausedStream = results.find(r => r && r.status === 'PAUSED_RESUMING');
//         if (pausedStream) return pausedStream;

//         return { status: 'LOADING_OR_DEAD' };
//     } catch (e) {
//         return { status: 'DEAD' };
//     }
// }

// async function loadCurrentUrl(reason) {
//     const targetUrl = urlList[currentUrlIndex];
//     console.log(`\n[🔄] ${reason} -> Loading URL [${currentUrlIndex + 1}/${urlList.length}]: ${targetUrl}`);
//     resetMonitorStats();

//     try { await obs.call('SetCurrentProgramScene', { sceneName: 'WaitingScene' }); } catch (e) {}
//     try {
//         await page.goto('about:blank');
//         await page.bringToFront();
//         keepChromeOnTopAndHideOBS();
//         await showLoadingOverlay(page, "CONNECTING STREAM", `Server ${currentUrlIndex + 1} of ${urlList.length}`);
//         await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
//         await showLoadingOverlay(page, "OPTIMIZING PLAYER", "Locking fullscreen video...");
//         await lockAndPlayVideo(page);
//         await hideLoadingOverlay(page);
//         keepChromeOnTopAndHideOBS();
//     } catch (e) {
//         console.log(`[⚠️] Page navigation warning: ${e.message}`);
//     }
//     try { await obs.call('SetCurrentProgramScene', { sceneName: 'MainScene' }); } catch (e) {}
// }

// // =========================================================================================
// // 🐕 WATCHDOG
// // =========================================================================================
// async function startWatchdog() {
//     let lastTime = -1, lastFrames = -1, lastWallClock = Date.now();
//     let freezeStart = Date.now(), urlStart = Date.now();
//     let deadStrikes = 0, ticks = 0;

//     const failover = async (reason) => {
//         currentUrlIndex = (currentUrlIndex + 1) % urlList.length;
//         await loadCurrentUrl(reason);
//         freezeStart = Date.now(); urlStart = Date.now();
//         lastTime = -1; lastFrames = -1; lastWallClock = Date.now();
//         deadStrikes = 0;
//     };

//     while (true) {
//         if (!browser || !browser.isConnected()) throw new Error('Browser disconnected');

//         keepChromeOnTopAndHideOBS();
//         const currentUrl = urlList[currentUrlIndex];
//         const health = await checkStreamHealth(page);

//         // 1. Network & Manifest state (har tick par, health se independent)
//         let networkState = 'OK';
//         if (netStats.segmentErrorCount >= NET_ERROR_LIMIT) {
//             networkState = `NET_ERROR_${netStats.lastHttpStatus}`;
//         } else if (netStats.seenManifest && (Date.now() - netStats.lastSeqAdvanceTime > STALE_MANIFEST_MS)) {
//             networkState = 'STALE_MANIFEST';
//         }

//         // Network fail ho to health se pehle hi failover
//         if (networkState !== 'OK') {
//             await failover(`NETWORK/MANIFEST FAIL (${networkState})`);
//             continue;
//         }

//         if (health.status === 'HEALTHY' || health.status === 'PAUSED_RESUMING') {
//             deadStrikes = 0;

//             if (health.status === 'PAUSED_RESUMING') {
//                 console.log(`[⏯️] Live Video was PAUSED -> Sent Auto-Play & Live-Edge click!`);
//                 await lockAndPlayVideo(page);
//             }

//             const now = Date.now();
//             const wallElapsed = (now - lastWallClock) / 1000;
//             const timeDelta = lastTime !== -1 ? Math.abs(health.currentTime - lastTime) : wallElapsed;
//             const speedRatio = wallElapsed > 0 ? (timeDelta / wallElapsed).toFixed(2) : '1.00';
//             lastWallClock = now;

//             const framesMoved = (lastFrames === -1) || (health.frames !== lastFrames);
//             const timeMoved = (lastTime === -1) || (health.currentTime !== lastTime);
//             const isMoving = framesMoved || timeMoved;

//             const visualCheck = await checkVisualFreshness(page);

//             if (!isMoving) {
//                 if (Date.now() - freezeStart > 18000) {
//                     await failover('PLAYBACK FROZEN (No Frame/Time Movement for 18s)');
//                     continue;
//                 }
//             } else if (visualCheck.visualStatus === 'VISUAL_FROZEN') {
//                 await failover(`VISUAL SCREEN FROZEN (${visualCheck.frozenSec}s Static Frame)`);
//                 continue;
//             } else if (visualCheck.visualStatus === 'CONTENT_LOOP') {
//                 await failover('FRESHNESS FAIL (Repeating Visual Loop Detected)');
//                 continue;
//             } else {
//                 lastTime = health.currentTime;
//                 lastFrames = health.frames;
//                 freezeStart = Date.now();
//                 await hideLoadingOverlay(page);
//             }

//             const isExempt = NO_REFRESH_DOMAINS.some(d => currentUrl.includes(d));
//             if (!isExempt && (Date.now() - urlStart > FORCE_REFRESH_MS)) {
//                 await loadCurrentUrl('SCHEDULED REFRESH');
//                 freezeStart = Date.now(); urlStart = Date.now(); lastTime = -1; lastFrames = -1;
//             }

//             ticks++;
//             if (ticks === 1 || ticks % 10 === 0) {
//                 console.log(
//                     `[💓] REPORT | Net: ${networkState} (HTTP:${netStats.lastHttpStatus}, Seq:${netStats.lastMediaSeq ?? 'N/A'}) | ` +
//                     `Playback: ${health.status} (Speed:${speedRatio}x, Time:${health.currentTime !== undefined ? health.currentTime.toFixed(1) + 's' : 'N/A'}, Frames:${health.frames ?? 'N/A'}) | ` +
//                     `Freshness: ${visualCheck.visualStatus} | URL [${currentUrlIndex + 1}/${urlList.length}]`
//                 );
//             }
//         } else {
//             deadStrikes++;
//             console.log(`[⚠️] Stream Unhealthy (${health.status} | Net: ${networkState}) - Strike ${deadStrikes}/5`);
//             if (deadStrikes >= 5) {
//                 await failover('5 STRIKES -> FAILOVER NEXT URL');
//             }
//         }

//         await new Promise(r => setTimeout(r, 2000));
//     }
// }

// // =========================================================================================
// // 🚀 ENGINE STARTUP & AUTO-RESTART
// // =========================================================================================
// async function startEngine() {
//     console.log('[*] Configuring & Starting OBS Studio...');
//     setupOBSConfig();

//     // Naya OBS WebSocket instance har restart par
//     try { await obs.disconnect(); } catch (e) {}
//     obs = new OBSWebSocket();

//     obsProcess = spawn('obs', ['--startstreaming', '--minimize-to-tray', '--disable-updater']);
//     obsProcess.on('error', (e) => console.error('[OBS Spawn Error]:', e.message));

//     obsProcess.stdout.on('data', (data) => {
//         const line = data.toString().trim();
//         if (line.includes('rtmp') || line.includes('stream') || line.includes('Websocket') || line.includes('output')) {
//             console.log(`[OBS]: ${line}`);
//         }
//     });
//     obsProcess.stderr.on('data', (data) => {
//         const msg = data.toString().trim();
//         if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('fail')) {
//             console.log(`[OBS Error]: ${msg}`);
//         }
//     });

//     await new Promise(r => setTimeout(r, 6000));

//     let obsConnected = false;
//     for (let i = 0; i < 12; i++) {
//         try {
//             await obs.connect('ws://127.0.0.1:4455', 'secret');
//             obsConnected = true;
//             console.log('[+] OBS WebSocket Connected!');
//             break;
//         } catch (e) {
//             await new Promise(r => setTimeout(r, 2000));
//         }
//     }

//     if (obsConnected) {
//         try { await obs.call('StartStream'); } catch (e) {}
//     }

//     const args = [
//         '--no-sandbox', '--disable-setuid-sandbox', `--window-size=${RES_W},${RES_H}`,
//         '--window-position=0,0', '--kiosk', '--start-fullscreen',
//         '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage',
//         '--disable-blink-features=AutomationControlled', '--use-gl=egl'
//     ];

//     if (PROXY_ENGINE.includes('Cloudflare')) args.push('--proxy-server=socks5://127.0.0.1:40000');

//     const ublockPath = path.join(process.cwd(), 'ublock-lite');
//     if (fs.existsSync(path.join(ublockPath, 'manifest.json'))) {
//         args.push(`--disable-extensions-except=${ublockPath}`);
//         args.push(`--load-extension=${ublockPath}`);
//         console.log('[🛡️] uBlock Origin Lite MV3 Extension Loaded!');
//     }

//     browser = await puppeteer.launch({
//         headless: false,
//         defaultViewport: { width: RES_W, height: RES_H },
//         ignoreDefaultArgs: ['--enable-automation'],
//         args
//     });

//     page = (await browser.pages())[0];

//     browser.on('targetcreated', async (target) => {
//         if (target.type() === 'page') {
//             const newPage = await target.page().catch(() => null);
//             if (newPage && newPage !== page) {
//                 setTimeout(() => newPage.close().catch(() => {}), 300);
//             }
//         }
//     });

//     keepChromeOnTopAndHideOBS();
//     await setupPageProtections(page);
//     await loadCurrentUrl('INITIAL BOOT');
//     await startWatchdog();
// }

// async function cleanup() {
//     try { await obs.disconnect(); } catch (e) {}
//     if (browser) { try { await browser.close(); } catch (e) {} browser = null; }
//     if (obsProcess) { try { obsProcess.kill('SIGKILL'); } catch (e) {} obsProcess = null; }
//     // pkill ko har process ke liye alag chalana zaroori hai
//     try {
//         execSync('pkill -9 -x obs || true; pkill -9 -f chrome || true; pkill -9 -x ffplay || true', { stdio: 'ignore' });
//     } catch (e) {}
// }

// // =========================================================================================
// // ⏱️ PROFESSIONAL MULTI-FORMAT DURATION PARSER & RELAY ENGINE (Supports 1h 10min, 0h 10min, 10h, 24/7)
// // =========================================================================================
// const RAW_DURATION = (process.env.CUSTOM_DURATION || '24/7').trim();
// const MAX_SINGLE_RUN_MS = 21000000; // 5h 50m (350 mins) - GitHub 6h hard limit se 10m pehle handover

// function parseFlexibleDuration(input) {
//     if (!input) return null;
//     const str = input.toLowerCase().trim();
//     if (str === '24/7' || str === 'infinite' || str === 'forever' || str === '0') return null;

//     let totalMs = 0;
//     let matched = false;

//     const regex = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)/g;
//     let match;
//     while ((match = regex.exec(str)) !== null) {
//         matched = true;
//         const val = parseFloat(match[1]);
//         const unit = match[2];
//         if (unit.startsWith('h')) totalMs += val * 3600 * 1000;
//         else if (unit.startsWith('m')) totalMs += val * 60 * 1000;
//         else if (unit.startsWith('s')) totalMs += val * 1000;
//     }

//     // Sirf number likha ho (jaise "120") -> minutes
//     if (!matched && /^\d+(\.\d+)?$/.test(str)) {
//         totalMs = parseFloat(str) * 60 * 1000;
//         matched = true;
//     }

//     return (matched && totalMs > 0) ? Math.round(totalMs) : null;
// }

// function formatMsToDurationString(ms) {
//     const totalSeconds = Math.max(1, Math.round(ms / 1000));
//     const hours = Math.floor(totalSeconds / 3600);
//     const minutes = Math.floor((totalSeconds % 3600) / 60);
//     const seconds = totalSeconds % 60;

//     const parts = [];
//     if (hours > 0) parts.push(`${hours}h`);
//     if (minutes > 0) parts.push(`${minutes}m`);
//     if (hours === 0 && minutes === 0 && seconds > 0) parts.push(`${seconds}s`);
//     return parts.join(' ') || '1m';
// }

// /**
//  * Next GitHub Actions run trigger. Fail hone par retry karta hai
//  * aur handover fail ho to current stream ko zinda rakhta hai (band nahi karta).
//  */
// function triggerNextWorkflow(nextDurationValue, attempt = 1) {
//     const MAX_ATTEMPTS = 4;
//     console.log(`\n[🔄] Handover Initiated (attempt ${attempt}/${MAX_ATTEMPTS}) -> custom_duration="${nextDurationValue}"...`);

//     const args = [
//         'workflow', 'run', 'main.yml',
//         '-f', `target_urls=${process.env.TARGET_URLS || ''}`,
//         '-f', `okru_stream_channel=${SELECTED_CHANNEL}`,
//         '-f', `server_selection=${SERVER_SELECTION}`,
//         '-f', `stream_quality=${selectedQuality}`,
//         '-f', `proxy_engine=${PROXY_ENGINE}`,
//         '-f', `enable_stream_audio=${process.env.ENABLE_STREAM_AUDIO || 'ON'}`,
//         '-f', `custom_duration=${nextDurationValue}`
//     ];

//     let settled = false;
//     const retryOrGiveUp = (why) => {
//         if (attempt < MAX_ATTEMPTS) {
//             console.error(`[⚠️] Handover failed (${why}). Retrying in 30s...`);
//             setTimeout(() => triggerNextWorkflow(nextDurationValue, attempt + 1), 30000);
//         } else {
//             console.error(`[❌] Handover failed after ${MAX_ATTEMPTS} attempts (${why}). Current stream chalti rahegi jab tak runner band na ho.`);
//             console.error('[ℹ️] Check: gh CLI installed? GH_TOKEN set? workflow me "permissions: actions: write" hai?');
//         }
//     };

//     let res;
//     try {
//         res = spawn('gh', args, { stdio: 'inherit' });
//     } catch (e) {
//         return retryOrGiveUp(e.message);
//     }

//     res.on('error', (e) => {
//         if (settled) return;
//         settled = true;
//         retryOrGiveUp(e.message);
//     });

//     res.on('close', (code) => {
//         if (settled) return;
//         settled = true;
//         if (code !== 0) return retryOrGiveUp(`exit code ${code}`);

//         console.log('[+] Next workflow triggered. Keeping current stream alive for 60s overlap...');
//         setTimeout(async () => {
//             try { await obs.call('StopStream'); } catch (e) {}
//             await cleanup();
//             process.exit(0);
//         }, 60000);
//     });
// }

// const totalRequestedMs = parseFlexibleDuration(RAW_DURATION);

// if (totalRequestedMs === null) {
//     // MODE 1: 24/7 INFINITE STREAM
//     console.log(`[♾️] Duration Mode: 24/7 Infinite | Current Runner will hand over after 5h 50m.`);
//     setTimeout(() => {
//         triggerNextWorkflow('24/7');
//     }, MAX_SINGLE_RUN_MS);

// } else if (totalRequestedMs <= MAX_SINGLE_RUN_MS) {
//     // MODE 2: SHORT/MEDIUM DURATION (<= 5h 50m) - isi runner me stop
//     console.log(`[⏱️] Duration Mode: Fixed (${RAW_DURATION} -> ${formatMsToDurationString(totalRequestedMs)}) | Stream will STOP completely when timer ends.`);
//     setTimeout(async () => {
//         console.log(`\n[🛑] Target Duration (${RAW_DURATION}) Reached! Stopping OBS & Ending Action...`);
//         try { await obs.call('StopStream'); } catch (e) {}
//         await cleanup();
//         process.exit(0);
//     }, totalRequestedMs);

// } else {
//     // MODE 3: LONG DURATION (> 5h 50m) - baqi waqt next Action ko pass
//     const remainingMs = totalRequestedMs - MAX_SINGLE_RUN_MS;
//     const nextDurationStr = formatMsToDurationString(remainingMs);
//     console.log(`[⏱️] Duration Mode: Long Relay (${RAW_DURATION} total) | Running 5h 50m now, then passing "${nextDurationStr}" to Next Action!`);

//     setTimeout(() => {
//         triggerNextWorkflow(nextDurationStr);
//     }, MAX_SINGLE_RUN_MS);
// }

// (async () => {
//     while (true) {
//         try { await startEngine(); }
//         catch (err) {
//             console.error('[🚨] Engine Error, restarting in 3s:', err.message);
//             await cleanup();
//             await new Promise(r => setTimeout(r, 3000));
//         }
//     }
// })();
