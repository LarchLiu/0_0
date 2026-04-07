#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { open } from '@cloudgeek/glimpse';
import { readdir, readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const { values } = parseArgs({
  options: {
    width:  { type: 'string' },
    height: { type: 'string' },
    title:  { type: 'string', default: 'Fitness Coach' },
  },
});

const width  = values.width  == null ? null : Number.parseInt(values.width, 10);
const height = values.height == null ? null : Number.parseInt(values.height, 10);
const title  = values.title;

if (width != null && (!Number.isFinite(width) || width < 640)) {
  console.error('Invalid --width. Expected an integer >= 640.');
  process.exit(2);
}
if (height != null && (!Number.isFinite(height) || height < 480)) {
  console.error('Invalid --height. Expected an integer >= 480.');
  process.exit(2);
}

// ── Standards directory ──
const STANDARDS_DIR = join(homedir(), '.fitness-coach', 'standards');
await mkdir(STANDARDS_DIR, { recursive: true });

async function listStandards() {
  try {
    const files = await readdir(STANDARDS_DIR);
    const list = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await readFile(join(STANDARDS_DIR, f), 'utf-8');
        const obj = JSON.parse(raw);
        list.push({
          filename: f,
          name: obj.name || f.replace(/\.json$/, ''),
          createdAt: obj.createdAt || '',
          duration: obj.duration || 0,
          totalFrames: obj.totalFrames || 0,
          fps: obj.fps || 5,
          videoPath: obj.videoPath || '',
          frames: obj.frames || [],
        });
      } catch { /* skip corrupt files */ }
    }
    return list;
  } catch { return []; }
}

const initialStandards = await listStandards();

const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fitness Coach</title>
<style>
  :root {
    --bg-0: #04050b;
    --bg-1: #0c1022;
    --panel: rgba(8, 12, 26, 0.82);
    --panel-border: rgba(130, 180, 255, 0.2);
    --cyan: #56f0ff;
    --lime: #8dff65;
    --magenta: #ff5ea9;
    --amber: #ffc15a;
    --purple: #a77bff;
    --text: #f4f7ff;
    --muted: #94a4c8;
    --danger: #ff7a94;
    --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 100vw; height: 100vh; overflow: hidden;
    font-family: -apple-system, 'SF Pro Display', 'PingFang SC', 'Noto Sans SC', sans-serif;
    background: var(--bg-0);
    color: var(--text);
    user-select: none; -webkit-user-select: none;
  }

  /* ── Screen container ── */
  .screen { display: none; position: fixed; inset: 0; flex-direction: column; }
  .screen.active { display: flex; }

  /* ── Home screen ── */
  #home-screen {
    justify-content: center; align-items: center;
    background: radial-gradient(ellipse at 50% 30%, rgba(86,240,255,0.06) 0%, var(--bg-0) 70%);
  }
  .home-inner { width: 100%; max-width: 560px; padding: 32px; }
  .home-title {
    font-size: 32px; font-weight: 800; text-align: center; margin-bottom: 6px;
    background: linear-gradient(135deg, var(--cyan), var(--purple));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .home-sub { text-align: center; color: var(--muted); font-size: 14px; margin-bottom: 36px; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 12px 24px; border-radius: 10px; border: 1px solid var(--panel-border);
    background: var(--panel); color: var(--text); font-size: 15px; font-weight: 600;
    cursor: pointer; transition: all 0.2s;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .btn:hover { border-color: var(--cyan); box-shadow: 0 0 20px rgba(86,240,255,0.15); }
  .btn-primary { background: linear-gradient(135deg, rgba(86,240,255,0.15), rgba(167,123,255,0.15)); border-color: var(--cyan); }
  .btn-danger { border-color: var(--danger); color: var(--danger); }
  .btn-danger:hover { border-color: var(--magenta); box-shadow: 0 0 20px rgba(255,94,169,0.15); }
  .btn-sm { padding: 8px 14px; font-size: 13px; }
  .btn-block { width: 100%; }

  .standard-list { margin-top: 24px; }
  .standard-list-title { font-size: 14px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
  .standard-item {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px; border-radius: 10px;
    background: var(--panel); border: 1px solid var(--panel-border);
    margin-bottom: 8px; transition: border-color 0.2s;
  }
  .standard-item:hover { border-color: rgba(130,180,255,0.4); }
  .standard-info { flex: 1; min-width: 0; }
  .standard-name { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .standard-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .standard-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .empty-state { text-align: center; color: var(--muted); padding: 40px 20px; font-size: 14px; line-height: 1.8; }

  .home-footer { display: flex; gap: 10px; margin-top: 20px; }

  /* ── Record screen ── */
  #record-screen {
    justify-content: center; align-items: center;
    background: var(--bg-0);
  }
  .record-inner { width: 100%; max-width: 640px; padding: 32px; }
  .record-title { font-size: 22px; font-weight: 700; margin-bottom: 24px; text-align: center; }

  .file-drop {
    border: 2px dashed var(--panel-border); border-radius: 14px;
    padding: 48px 24px; text-align: center; cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
  }
  .file-drop:hover, .file-drop.dragover {
    border-color: var(--cyan); background: rgba(86,240,255,0.04);
  }
  .file-drop-icon { font-size: 42px; margin-bottom: 12px; }
  .file-drop-text { color: var(--muted); font-size: 14px; }
  .file-drop input[type="file"] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer;
  }

  .record-progress { margin-top: 24px; display: none; }
  .record-progress.visible { display: block; }
  .progress-label { font-size: 13px; color: var(--muted); margin-bottom: 8px; }
  .progress-bar-wrap {
    height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%; border-radius: 4px;
    background: linear-gradient(90deg, var(--cyan), var(--lime));
    transition: width 0.15s linear; width: 0%;
  }
  .progress-stats { font-size: 12px; color: var(--muted); margin-top: 6px; }

  .record-preview { margin-top: 24px; display: none; text-align: center; }
  .record-preview.visible { display: block; }
  .preview-canvas-wrap {
    position: relative; display: inline-block;
    border-radius: 10px; overflow: hidden; border: 1px solid var(--panel-border);
    background: #000;
  }
  .record-name-input {
    margin-top: 16px; width: 100%; padding: 12px 16px; border-radius: 8px;
    border: 1px solid var(--panel-border); background: var(--bg-1);
    color: var(--text); font-size: 15px; outline: none;
  }
  .record-name-input:focus { border-color: var(--cyan); }
  .record-actions { display: flex; gap: 10px; margin-top: 16px; justify-content: center; }

  /* ── Score screen ── */
  #score-screen { background: #000; }

  .score-main {
    position: relative; flex: 1; overflow: hidden;
  }
  #std-video {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: contain; background: #000; z-index: 0;
  }
  #cam-video {
    position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none;
  }
  #skeleton-canvas {
    position: absolute; inset: 0; width: 100%; height: 100%;
    transform: scaleX(-1); pointer-events: none; z-index: 1;
  }

  .score-hud {
    z-index: 10; pointer-events: none;
    display: flex; justify-content: center; gap: 24px; padding: 10px 20px;
    background: var(--bg-0); flex-shrink: 0;
  }
  .hud-pill {
    background: var(--panel); border: 1px solid var(--panel-border);
    border-radius: 8px; padding: 8px 16px; text-align: center;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .hud-pill .lbl { font-size: 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .hud-pill .val { font-size: 20px; font-weight: 700; }
  .hud-pill.score .val { color: var(--lime); }
  .hud-pill.avg .val { color: var(--cyan); }
  .hud-pill.time .val { color: var(--text); }

  .score-bottom {
    z-index: 10; flex-shrink: 0;
    padding: 8px 20px 12px;
    background: var(--bg-0);
  }
  .score-progress-wrap {
    height: 6px; border-radius: 3px; background: rgba(255,255,255,0.1); overflow: hidden;
    margin-bottom: 10px;
  }
  .score-progress-fill {
    height: 100%; border-radius: 3px;
    background: linear-gradient(90deg, var(--cyan), var(--lime));
    transition: width 0.1s linear; width: 0%;
  }
  .score-chart-wrap {
    height: 60px; border-radius: 6px; background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.06); overflow: hidden; margin-bottom: 10px;
  }
  #score-chart { width: 100%; height: 100%; }
  .score-btns {
    display: flex; gap: 10px; justify-content: center;
  }

  /* ── Countdown overlay ── */
  .countdown-overlay {
    position: fixed; inset: 0; z-index: 50;
    display: none; justify-content: center; align-items: center;
    background: rgba(4,5,11,0.85);
  }
  .countdown-overlay.active { display: flex; }
  .countdown-text {
    font-size: 120px; font-weight: 900;
    color: var(--cyan);
    text-shadow: 0 0 60px rgba(86,240,255,0.5);
    animation: countPulse 0.5s ease-out;
  }
  @keyframes countPulse {
    0% { transform: scale(1.6); opacity: 0.3; }
    100% { transform: scale(1); opacity: 1; }
  }

  /* ── Result screen ── */
  #result-screen {
    justify-content: center; align-items: center;
    background: radial-gradient(ellipse at 50% 40%, rgba(141,255,101,0.06) 0%, var(--bg-0) 70%);
  }
  .result-inner { width: 100%; max-width: 520px; padding: 32px; text-align: center; }
  .result-title { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
  .result-sub { font-size: 14px; color: var(--muted); margin-bottom: 28px; }

  .result-score-big {
    font-size: 72px; font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, var(--lime), var(--cyan));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  }
  .result-score-label { font-size: 14px; color: var(--muted); margin-top: 4px; margin-bottom: 24px; }

  .result-stats { display: flex; gap: 16px; justify-content: center; margin-bottom: 28px; flex-wrap: wrap; }
  .result-stat {
    background: var(--panel); border: 1px solid var(--panel-border);
    border-radius: 10px; padding: 14px 20px; min-width: 100px;
  }
  .result-stat .lbl { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
  .result-stat .val { font-size: 22px; font-weight: 700; margin-top: 2px; }

  .result-chart-wrap {
    height: 80px; border-radius: 8px; background: var(--panel); border: 1px solid var(--panel-border);
    overflow: hidden; margin-bottom: 24px;
  }
  #result-chart { width: 100%; height: 100%; }

  .result-actions { display: flex; gap: 10px; justify-content: center; }

  /* ── ML status ── */
  .ml-status {
    position: fixed; top: 12px; right: 12px; z-index: 100;
    font-size: 11px; color: var(--muted); padding: 4px 10px;
    background: var(--panel); border: 1px solid var(--panel-border);
    border-radius: 6px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  }

  /* ── Debug toast ── */
  .debug-toast-container {
    position: fixed; top: 40px; right: 12px; z-index: 200;
    display: flex; flex-direction: column; gap: 6px;
  }
  .debug-toast {
    background: rgba(255,80,80,0.9); color: #fff; font-size: 12px;
    padding: 8px 14px; border-radius: 6px; max-width: 360px;
    word-break: break-word; animation: toastIn 0.3s ease-out;
  }
  @keyframes toastIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

  /* ── Camera fallback ── */
  .cam-fallback {
    position: absolute; inset: 0; display: none;
    flex-direction: column; justify-content: center; align-items: center;
    background: var(--bg-0); color: var(--muted); text-align: center; padding: 40px;
  }
  .cam-fallback.active { display: flex; }
  .cam-fallback-icon { font-size: 48px; margin-bottom: 16px; }
  .cam-fallback-title { font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
  .cam-fallback-detail { font-size: 13px; line-height: 1.6; }
</style>
</head>
<body>

  <!-- ML Status -->
  <div class="ml-status" id="ml-status">ML: loading...</div>

  <!-- Debug Toast Container -->
  <div class="debug-toast-container" id="debug-toasts"></div>

  <!-- ====== HOME SCREEN ====== -->
  <div class="screen active" id="home-screen">
    <div class="home-inner">
      <div class="home-title">Fitness Coach</div>
      <div class="home-sub">AI fitness coach - real-time pose scoring</div>
      <button class="btn btn-primary btn-block" onclick="goRecord()">+ record new standard</button>
      <div class="standard-list">
        <div class="standard-list-title">saved standards</div>
        <div id="standard-list-container"></div>
      </div>
      <div class="home-footer">
        <button class="btn btn-block" onclick="doExit()">exit</button>
      </div>
    </div>
  </div>

  <!-- ====== RECORD SCREEN ====== -->
  <div class="screen" id="record-screen">
    <div class="record-inner">
      <div class="record-title">record new standard</div>
      <div class="file-drop" id="file-drop">
        <div class="file-drop-icon">upload</div>
        <div class="file-drop-text">click or drop video file here</div>
        <input type="file" accept="video/*" id="video-file-input">
      </div>
      <div class="record-progress" id="record-progress">
        <div class="progress-label" id="record-progress-label">extracting pose data...</div>
        <div class="progress-bar-wrap"><div class="progress-bar-fill" id="record-progress-fill"></div></div>
        <div class="progress-stats" id="record-progress-stats"></div>
      </div>
      <div class="record-preview" id="record-preview">
        <div class="preview-canvas-wrap">
          <canvas id="preview-canvas" width="320" height="240"></canvas>
        </div>
        <input class="record-name-input" id="record-name" type="text" placeholder="enter standard name...">
        <div class="record-actions">
          <button class="btn btn-primary" id="save-btn" onclick="saveStandard()">save</button>
          <button class="btn" onclick="goHome()">cancel</button>
        </div>
      </div>
      <div style="margin-top: 16px; text-align: center;">
        <button class="btn btn-sm" onclick="goHome()">back</button>
      </div>
    </div>
  </div>

  <!-- ====== SCORE SCREEN ====== -->
  <div class="screen" id="score-screen">
    <div class="score-hud">
      <div class="hud-pill score"><div class="lbl">score</div><div class="val" id="hud-score">--</div></div>
      <div class="hud-pill avg"><div class="lbl">average</div><div class="val" id="hud-avg">--</div></div>
      <div class="hud-pill time"><div class="lbl">time</div><div class="val" id="hud-time">0:00</div></div>
    </div>
    <div class="score-main" id="score-main">
      <video id="std-video" playsinline></video>
      <video id="cam-video" playsinline autoplay muted></video>
      <canvas id="skeleton-canvas"></canvas>
      <div id="visibility-warning" style="
        position: absolute; inset: 0; z-index: 5;
        display: none; justify-content: center; align-items: center;
        pointer-events: none;
      ">
        <div style="
          background: rgba(4,5,11,0.75); padding: 16px 28px; border-radius: 12px;
          border: 1px solid rgba(255,94,169,0.4); text-align: center;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        ">
          <div style="font-size: 28px; margin-bottom: 6px;">&#x26A0;</div>
          <div style="color: var(--magenta); font-size: 16px; font-weight: 600;">Please show your full body</div>
          <div style="color: var(--muted); font-size: 12px; margin-top: 4px;">Ensure all key joints are visible</div>
        </div>
      </div>
      <div class="cam-fallback" id="cam-fallback">
        <div class="cam-fallback-icon">!</div>
        <div class="cam-fallback-title" id="cam-fallback-title">camera unavailable</div>
        <div class="cam-fallback-detail" id="cam-fallback-detail"></div>
      </div>
    </div>
    <div class="score-bottom">
      <div class="score-progress-wrap"><div class="score-progress-fill" id="score-progress-fill"></div></div>
      <div class="score-chart-wrap"><canvas id="score-chart"></canvas></div>
      <div class="score-btns">
        <button class="btn btn-sm" onclick="finishScoring()">finish</button>
        <button class="btn btn-sm" onclick="restartScoring()">restart</button>
      </div>
    </div>
  </div>

  <!-- ====== COUNTDOWN OVERLAY ====== -->
  <div class="countdown-overlay" id="countdown-overlay">
    <div class="countdown-text" id="countdown-text">3</div>
  </div>

  <!-- ====== CALIBRATION OVERLAY ====== -->
  <div id="calibration-overlay" style="
    position: fixed; inset: 0; z-index: 45;
    display: none; flex-direction: column;
    justify-content: center; align-items: center;
    background: rgba(4,5,11,0.92);
  ">
    <div style="position: relative; width: 300px; display: flex; flex-direction: column; align-items: center;">
      <div id="calibration-silhouette" style="position: relative; width: 200px; height: 320px; margin-bottom: 20px; opacity: 0.3; transition: opacity 0.3s;">
        <!-- Simple human silhouette SVG -->
        <svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
          <circle cx="60" cy="22" r="14" fill="none" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="60" y1="36" x2="60" y2="110" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="30" y1="55" x2="90" y2="55" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="30" y1="55" x2="18" y2="90" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="18" y1="90" x2="14" y2="120" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="90" y1="55" x2="102" y2="90" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="102" y1="90" x2="106" y2="120" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="42" y1="110" x2="78" y2="110" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="42" y1="110" x2="35" y2="155" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="35" y1="155" x2="32" y2="195" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="78" y1="110" x2="85" y2="155" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="85" y1="155" x2="88" y2="195" stroke="var(--cyan)" stroke-width="1.5"/>
        </svg>
        <!-- Progress ring overlaid around silhouette -->
        <div style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 240px; height: 360px; pointer-events: none;">
          <svg viewBox="0 0 240 360" style="width:100%;height:100%;">
            <rect x="4" y="4" width="232" height="352" rx="20" ry="20" fill="none" stroke="rgba(86,240,255,0.1)" stroke-width="3"/>
            <rect id="calibration-ring" x="4" y="4" width="232" height="352" rx="20" ry="20" fill="none" stroke="var(--cyan)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1164" stroke-dashoffset="1164" style="transition: stroke-dashoffset 0.1s linear;"/>
          </svg>
        </div>
      </div>
      <div id="calibration-message" style="font-size: 18px; font-weight: 600; text-align: center; color: var(--cyan); margin-bottom: 8px; min-height: 28px;">Stand in front of the camera</div>
      <div id="calibration-hint" style="font-size: 13px; color: var(--muted); text-align: center; min-height: 20px;">Ensure your full body is visible</div>
      <div id="calibration-landmark-count" style="font-size: 12px; color: var(--muted); margin-top: 12px; font-variant-numeric: tabular-nums;">landmarks: --/33</div>
      <button class="btn btn-sm" style="margin-top: 20px;" onclick="skipCalibration()">skip calibration</button>
    </div>
  </div>

  <!-- ====== RESULT SCREEN ====== -->
  <div class="screen" id="result-screen">
    <div class="result-inner">
      <div class="result-title">results</div>
      <div class="result-sub" id="result-standard-name"></div>
      <div class="result-score-big" id="result-avg-score">0</div>
      <div class="result-score-label">average score</div>
      <div class="result-stats">
        <div class="result-stat"><div class="lbl">highest</div><div class="val" id="result-high" style="color:var(--lime)">0</div></div>
        <div class="result-stat"><div class="lbl">lowest</div><div class="val" id="result-low" style="color:var(--magenta)">0</div></div>
        <div class="result-stat"><div class="lbl">duration</div><div class="val" id="result-duration" style="color:var(--cyan)">0s</div></div>
      </div>
      <div class="result-chart-wrap"><canvas id="result-chart"></canvas></div>
      <div class="result-actions">
        <button class="btn btn-primary" onclick="restartScoring()">try again</button>
        <button class="btn" onclick="goHome()">home</button>
      </div>
    </div>
  </div>

  <!-- ====== ERROR HANDLERS ====== -->
  <script>
    window.addEventListener('error', function(e) {
      showDebugToast('Error', e.message || String(e));
    });
    window.addEventListener('unhandledrejection', function(e) {
      showDebugToast('Promise', e.reason && e.reason.message ? e.reason.message : String(e.reason));
    });
    function showDebugToast(tag, msg) {
      var c = document.getElementById('debug-toasts');
      if (!c) return;
      var d = document.createElement('div');
      d.className = 'debug-toast';
      d.textContent = '[' + tag + '] ' + msg;
      c.appendChild(d);
      setTimeout(function() { d.remove(); }, 8000);
    }
  <\/script>

  <!-- ====== MAIN APPLICATION ====== -->
  <script type="module">

    // ── Saved standards (metadata only, injected by Node.js) ──
    const SAVED_STANDARDS = ${JSON.stringify(initialStandards)};

    // ── State ──
    let appState = 'home';        // home | record | scoring | countdown | result
    let poseLandmarker = null;
    let poseLandmarkerReady = false;
    let currentStandard = null;    // full standard data with frames
    let currentStandardName = '';
    let onlineDTW = null;
    let cameraStream = null;
    let scoringRAF = null;
    let scoringStartTime = 0;
    let scoreHistory = [];
    let extractedFrames = [];      // temp storage during recording
    let lastValidUserFrame = null;   // cached last valid frame for fallback
    let visibilityWarningEl = null;  // cached DOM ref
    let landmarkSmoother = null;
    let bioValidator = null;

    // ── Pose connections for skeleton drawing ──
    const POSE_CONNECTIONS = [
      // Head
      [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
      // Torso + limbs
      [11,13],[13,15],[12,14],[14,16],
      [11,12],[11,23],[12,24],[23,24],
      [23,25],[25,27],[24,26],[26,28],
      [27,29],[29,31],[28,30],[30,32],
      [15,17],[15,19],[15,21],[16,18],[16,20],[16,22],
    ];

    // ── Joint angle definitions ──
    const JOINT_ANGLES = [
      { name: 'leftElbow',     points: [11, 13, 15] },
      { name: 'rightElbow',    points: [12, 14, 16] },
      { name: 'leftShoulder',  points: [13, 11, 23] },
      { name: 'rightShoulder', points: [14, 12, 24] },
      { name: 'leftHip',       points: [11, 23, 25] },
      { name: 'rightHip',      points: [12, 24, 26] },
      { name: 'leftKnee',      points: [23, 25, 27] },
      { name: 'rightKnee',     points: [24, 26, 28] },
      { name: 'leftAnkle',     points: [25, 27, 31] },
      { name: 'rightAnkle',    points: [26, 28, 32] },
      { name: 'torsoLean',     points: [11, 23, 25] },
      { name: 'spineAngle',    points: [12, 24, 26] },
    ];

    // ── Key joints that must be visible for valid scoring ──
    const KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    //                  LSh  RSh  LEl  REl  LWr  RWr  LHi  RHi  LKn  RKn  LAn  RAn
    const KEY_JOINT_VISIBILITY_THRESHOLD = 0.6;

    /**
     * Check if key joints have sufficient visibility.
     * @param {Array} landmarks - raw landmarks array (33 items with .visibility)
     * @returns {{ valid: boolean, visibleCount: number, totalRequired: number }}
     */
    function validateFrameVisibility(landmarks) {
      let visibleCount = 0;
      for (const idx of KEY_JOINTS) {
        if (idx < landmarks.length && landmarks[idx].visibility >= KEY_JOINT_VISIBILITY_THRESHOLD) {
          visibleCount++;
        }
      }
      return {
        valid: visibleCount >= KEY_JOINTS.length,
        visibleCount,
        totalRequired: KEY_JOINTS.length,
      };
    }

    // ── Bone segments for length consistency checking ──
    const BONE_SEGMENTS = [
      { name: 'leftUpperArm',  from: 11, to: 13 },
      { name: 'leftForearm',   from: 13, to: 15 },
      { name: 'rightUpperArm', from: 12, to: 14 },
      { name: 'rightForearm',  from: 14, to: 16 },
      { name: 'leftThigh',     from: 23, to: 25 },
      { name: 'leftShin',      from: 25, to: 27 },
      { name: 'rightThigh',    from: 24, to: 26 },
      { name: 'rightShin',     from: 26, to: 28 },
      { name: 'shoulderWidth', from: 11, to: 12 },
      { name: 'hipWidth',      from: 23, to: 24 },
    ];

    // ── Joint angle physiological limits (degrees) ──
    const JOINT_ANGLE_LIMITS = {
      leftElbow:     { min: 10,  max: 175 },
      rightElbow:    { min: 10,  max: 175 },
      leftShoulder:  { min: 0,   max: 190 },
      rightShoulder: { min: 0,   max: 190 },
      leftHip:       { min: 0,   max: 180 },
      rightHip:      { min: 0,   max: 180 },
      leftKnee:      { min: 0,   max: 180 },
      rightKnee:     { min: 0,   max: 180 },
      leftAnkle:     { min: 50,  max: 170 },
      rightAnkle:    { min: 50,  max: 170 },
    };

    const BONE_LENGTH_ANOMALY_THRESHOLD = 0.30;

    // ───────────────────────────────────────────────────
    // MATH UTILITIES
    // ───────────────────────────────────────────────────

    function computeAngle3D(lm, a, b, c) {
      const ba = { x: lm[a].x - lm[b].x, y: lm[a].y - lm[b].y, z: lm[a].z - lm[b].z };
      const bc = { x: lm[c].x - lm[b].x, y: lm[c].y - lm[b].y, z: lm[c].z - lm[b].z };
      const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
      const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y + ba.z * ba.z);
      const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y + bc.z * bc.z);
      if (magBA < 1e-6 || magBC < 1e-6) return 0;
      return Math.acos(Math.max(-1, Math.min(1, dot / (magBA * magBC)))) * (180 / Math.PI);
    }

    function extractAllAngles(worldLandmarks) {
      const angles = {};
      for (const ja of JOINT_ANGLES) {
        angles[ja.name] = computeAngle3D(worldLandmarks, ja.points[0], ja.points[1], ja.points[2]);
      }
      return angles;
    }

    function normalizeToHipCenter(worldLandmarks) {
      const hipCenter = {
        x: (worldLandmarks[23].x + worldLandmarks[24].x) / 2,
        y: (worldLandmarks[23].y + worldLandmarks[24].y) / 2,
        z: (worldLandmarks[23].z + worldLandmarks[24].z) / 2,
      };
      return worldLandmarks.map(lm => {
        const dx = lm.x - hipCenter.x;
        const dy = lm.y - hipCenter.y;
        const dz = lm.z - hipCenter.z;
        const mag = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        return { x: dx / mag, y: dy / mag, z: dz / mag, visibility: lm.visibility };
      });
    }

    function flattenVectors(normalizedLandmarks) {
      // Use all 33 landmarks (0-32) including head
      const arr = [];
      for (let i = 0; i < 33; i++) {
        const lm = normalizedLandmarks[i];
        if (lm.visibility < 0.3) {
          arr.push(0, 0, 0);
        } else {
          arr.push(lm.x, lm.y, lm.z);
        }
      }
      return arr;
    }

    function cosineSimilarity(a, b) {
      let dot = 0, magA = 0, magB = 0;
      const len = Math.min(a.length, b.length);
      for (let i = 0; i < len; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
      }
      magA = Math.sqrt(magA);
      magB = Math.sqrt(magB);
      if (magA < 1e-6 || magB < 1e-6) return 0;
      return dot / (magA * magB);
    }

    function computeFrameScore(userFrame, stdFrame) {
      // Vector cosine similarity (overall pose shape)
      const userVecs = flattenVectors(userFrame.normalizedLandmarks);
      const stdVecs  = flattenVectors(stdFrame.normalizedLandmarks);
      const vectorSim = cosineSimilarity(userVecs, stdVecs);

      // Angle cosine similarity (joint precision)
      const userAngles = Object.values(userFrame.angles);
      const stdAngles  = Object.values(stdFrame.angles);
      const angleSim = cosineSimilarity(userAngles, stdAngles);

      // Blend: 70% vector + 30% angle, map from ~0.5-1.0 range to 0-100
      const rawScore = 0.7 * vectorSim + 0.3 * angleSim;
      return Math.max(0, Math.min(100, (rawScore - 0.5) * 200));
    }

    // ── Per-joint score for color coding ──
    function computePerJointScores(userFrame, stdFrame) {
      const scores = {};
      for (const ja of JOINT_ANGLES) {
        const diff = Math.abs(userFrame.angles[ja.name] - stdFrame.angles[ja.name]);
        if (diff <= 10) scores[ja.name] = 100;
        else if (diff <= 40) scores[ja.name] = 100 * (1 - (diff - 10) / 30);
        else scores[ja.name] = 0;
      }
      return scores;
    }

    // ───────────────────────────────────────────────────
    // ONLINE DTW
    // ───────────────────────────────────────────────────

    class OnlineDTW {
      constructor(standardFrames, windowSize = 30) {
        this.std = standardFrames;
        this.windowSize = windowSize;
        this.stdPtr = 0;
        this.scores = [];
        this.matchPath = [];
      }

      feed(userFrame) {
        const searchStart = Math.max(0, this.stdPtr - 5);
        const searchEnd   = Math.min(this.std.length - 1, this.stdPtr + this.windowSize);

        let bestScore = -Infinity;
        let bestIdx   = this.stdPtr;

        for (let i = searchStart; i <= searchEnd; i++) {
          const score = computeFrameScore(userFrame, this.std[i]);
          const jumpPenalty = Math.abs(i - this.stdPtr) * 2;
          const adjusted = score - jumpPenalty;
          if (adjusted > bestScore) {
            bestScore = adjusted;
            bestIdx   = i;
          }
        }

        if (bestIdx >= this.stdPtr) {
          this.stdPtr = bestIdx;
        }

        const frameScore = Math.max(0, bestScore);
        this.scores.push(frameScore);
        this.matchPath.push({ userFrame: this.scores.length - 1, stdFrame: this.stdPtr });

        return {
          score: frameScore,
          stdIdx: this.stdPtr,
          progress: this.std.length > 1 ? this.stdPtr / (this.std.length - 1) : 1,
          isComplete: this.stdPtr >= this.std.length - 1,
        };
      }

      getAverageScore() {
        if (this.scores.length === 0) return 0;
        return this.scores.reduce((a, b) => a + b, 0) / this.scores.length;
      }

      getHighScore() {
        if (this.scores.length === 0) return 0;
        return Math.max(...this.scores);
      }

      getLowScore() {
        if (this.scores.length === 0) return 0;
        return Math.min(...this.scores);
      }
    }

    // ───────────────────────────────────────────────────
    // TEMPORAL SMOOTHING (SLIDING WINDOW)
    // ───────────────────────────────────────────────────

    class LandmarkSmoother {
      constructor(windowSize = 5) {
        this.windowSize = windowSize;
        this.buffer = [];
      }

      reset() {
        this.buffer = [];
      }

      /**
       * Add a frame and return the smoothed result.
       * @param {{ normalizedLandmarks: Array, angles: Object }} frame
       * @returns {{ normalizedLandmarks: Array, angles: Object }}
       */
      feed(frame) {
        this.buffer.push(frame);
        if (this.buffer.length > this.windowSize) {
          this.buffer.shift();
        }

        if (this.buffer.length === 1) {
          return frame;
        }

        // Average normalized landmarks
        const numLandmarks = frame.normalizedLandmarks.length;
        const smoothedLandmarks = [];
        for (let i = 0; i < numLandmarks; i++) {
          let sx = 0, sy = 0, sz = 0, sv = 0;
          for (const f of this.buffer) {
            sx += f.normalizedLandmarks[i].x;
            sy += f.normalizedLandmarks[i].y;
            sz += f.normalizedLandmarks[i].z;
            sv += f.normalizedLandmarks[i].visibility;
          }
          const n = this.buffer.length;
          smoothedLandmarks.push({ x: sx / n, y: sy / n, z: sz / n, visibility: sv / n });
        }

        // Average angles
        const smoothedAngles = {};
        const angleKeys = Object.keys(frame.angles);
        for (const key of angleKeys) {
          let sum = 0;
          for (const f of this.buffer) {
            sum += f.angles[key];
          }
          smoothedAngles[key] = sum / this.buffer.length;
        }

        return { normalizedLandmarks: smoothedLandmarks, angles: smoothedAngles };
      }
    }

    // ───────────────────────────────────────────────────
    // BIOMECHANICAL VALIDATION
    // ───────────────────────────────────────────────────

    class BiomechanicalValidator {
      constructor() {
        this.boneLengthStats = {};
        this.frameCount = 0;
        this.warmupFrames = 10;
      }

      reset() {
        this.boneLengthStats = {};
        this.frameCount = 0;
      }

      _dist3D(lmA, lmB) {
        const dx = lmA.x - lmB.x;
        const dy = lmA.y - lmB.y;
        const dz = lmA.z - lmB.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      /**
       * Validate a frame against biomechanical constraints.
       * @param {Array} worldLandmarks - raw world landmarks (33 items)
       * @param {Object} angles - computed angles from extractAllAngles
       * @returns {{ valid: boolean, reason: string|null }}
       */
      validate(worldLandmarks, angles) {
        this.frameCount++;

        // Check joint angle limits
        for (const [jointName, limits] of Object.entries(JOINT_ANGLE_LIMITS)) {
          if (angles[jointName] == null) continue;
          if (angles[jointName] < limits.min || angles[jointName] > limits.max) {
            if (this.frameCount > this.warmupFrames) {
              return { valid: false, reason: 'angle_out_of_range:' + jointName };
            }
          }
        }

        // Check bone length consistency
        for (const seg of BONE_SEGMENTS) {
          const len = this._dist3D(worldLandmarks[seg.from], worldLandmarks[seg.to]);
          if (len < 1e-6) continue;

          if (!this.boneLengthStats[seg.name]) {
            this.boneLengthStats[seg.name] = { sum: 0, count: 0, avg: 0 };
          }

          const stats = this.boneLengthStats[seg.name];

          if (stats.count > 0) {
            const deviation = Math.abs(len - stats.avg) / stats.avg;
            if (deviation > BONE_LENGTH_ANOMALY_THRESHOLD && this.frameCount > this.warmupFrames) {
              return { valid: false, reason: 'bone_length_anomaly:' + seg.name };
            }
          }

          stats.sum += len;
          stats.count++;
          stats.avg = stats.sum / stats.count;
        }

        return { valid: true, reason: null };
      }
    }

    // ───────────────────────────────────────────────────
    // MEDIAPIPE POSELANDMARKER
    // ───────────────────────────────────────────────────

    async function initPoseLandmarker() {
      const statusEl = document.getElementById('ml-status');
      statusEl.textContent = 'ML: loading model...';

      try {
        const vision = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs'
        );
        const { PoseLandmarker, FilesetResolver } = vision;
        window.__PoseLandmarker = PoseLandmarker;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        poseLandmarkerReady = true;
        statusEl.textContent = 'ML: ready';
      } catch (err) {
        statusEl.textContent = 'ML: load failed';
        showDebugToast('PoseLandmarker', err.message || String(err));
      }
    }

    async function switchToVideoMode() {
      if (!poseLandmarker) return;
      await poseLandmarker.setOptions({ runningMode: 'VIDEO' });
    }

    async function switchToImageMode() {
      if (!poseLandmarker) return;
      await poseLandmarker.setOptions({ runningMode: 'IMAGE' });
    }

    // ───────────────────────────────────────────────────
    // DRAWING
    // ───────────────────────────────────────────────────

    function scoreToColor(score) {
      if (score >= 90) return '#8dff65';
      if (score >= 70) return '#56f0ff';
      if (score >= 50) return '#ffc15a';
      return '#ff5ea9';
    }

    function drawSkeleton(ctx, landmarks, w, h, color, lineWidth, jointScores) {
      // Draw connections
      ctx.lineWidth = lineWidth;
      for (const [a, b] of POSE_CONNECTIONS) {
        if (a >= landmarks.length || b >= landmarks.length) continue;
        if (landmarks[a].visibility < 0.4 || landmarks[b].visibility < 0.4) continue;
        ctx.strokeStyle = color || 'rgba(86,240,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
        ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
        ctx.stroke();
      }

      // Draw joints
      const JOINT_LANDMARK_MAP = {
        leftElbow: 13, rightElbow: 14,
        leftShoulder: 11, rightShoulder: 12,
        leftHip: 23, rightHip: 24,
        leftKnee: 25, rightKnee: 26,
        leftAnkle: 27, rightAnkle: 28,
      };

      for (let i = 0; i < 33; i++) {
        if (i >= landmarks.length) continue;
        if (landmarks[i].visibility < 0.4) continue;
        let jColor = color || '#56f0ff';
        let radius = 4;

        // Color-code by joint score if available
        if (jointScores) {
          for (const [jname, lmIdx] of Object.entries(JOINT_LANDMARK_MAP)) {
            if (lmIdx === i && jointScores[jname] != null) {
              jColor = scoreToColor(jointScores[jname]);
              if (jointScores[jname] < 50) radius = 7;
              else if (jointScores[jname] < 70) radius = 5;
              break;
            }
          }
        }

        ctx.beginPath();
        ctx.arc(landmarks[i].x * w, landmarks[i].y * h, radius, 0, Math.PI * 2);
        ctx.fillStyle = jColor;
        ctx.fill();
      }
    }

    function drawScoreChart(canvasId, scores, maxPoints) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      if (scores.length < 2) return;

      const points = maxPoints ? scores.slice(-maxPoints) : scores;
      const step = w / Math.max(points.length - 1, 1);

      // Draw line
      ctx.beginPath();
      ctx.strokeStyle = '#56f0ff';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < points.length; i++) {
        const x = i * step;
        const y = h - (points[i] / 100) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Fill area
      ctx.lineTo((points.length - 1) * step, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = 'rgba(86,240,255,0.08)';
      ctx.fill();
    }

    // ───────────────────────────────────────────────────
    // SCREEN MANAGEMENT
    // ───────────────────────────────────────────────────

    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById(id).classList.add('active');
    }

    function goHome() {
      stopCamera();
      cancelAnimationFrame(scoringRAF);
      appState = 'home';
      showScreen('home-screen');
      renderStandardList();
    }
    window.goHome = goHome;

    function goRecord() {
      appState = 'record';
      showScreen('record-screen');
      document.getElementById('record-progress').classList.remove('visible');
      document.getElementById('record-preview').classList.remove('visible');
      document.getElementById('video-file-input').value = '';
      extractedFrames = [];
    }
    window.goRecord = goRecord;

    function doExit() {
      stopCamera();
      window.glimpse.send({ type: 'exit' });
    }
    window.doExit = doExit;

    // ───────────────────────────────────────────────────
    // STANDARD LIST RENDERING
    // ───────────────────────────────────────────────────

    let standardsList = [...SAVED_STANDARDS];

    function renderStandardList() {
      const container = document.getElementById('standard-list-container');
      if (standardsList.length === 0) {
        container.innerHTML = '<div class="empty-state">no saved standards yet<br>click "record new standard" to get started</div>';
        return;
      }
      container.innerHTML = standardsList.map((s, i) => {
        const dur = s.duration ? s.duration.toFixed(1) + 's' : '?';
        const frames = s.totalFrames || '?';
        return '<div class="standard-item">' +
          '<div class="standard-info">' +
            '<div class="standard-name">' + escHtml(s.name) + '</div>' +
            '<div class="standard-meta">' + dur + ' / ' + frames + ' frames</div>' +
          '</div>' +
          '<div class="standard-actions">' +
            '<button class="btn btn-sm btn-primary" onclick="startScoring(' + i + ')">start</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteStandard(' + i + ')">delete</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function escHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ───────────────────────────────────────────────────
    // VIDEO FRAME EXTRACTION (RECORDING)
    // ───────────────────────────────────────────────────

    const videoFileInput = document.getElementById('video-file-input');
    const fileDrop = document.getElementById('file-drop');

    fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
    fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
    fileDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDrop.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) {
        processVideoFile(e.dataTransfer.files[0]);
      }
    });

    videoFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processVideoFile(e.target.files[0]);
      }
    });

    let lastSelectedVideoPath = ''; // set by glimpse.swift via window.__selectedFilePaths

    async function processVideoFile(file) {
      if (!poseLandmarkerReady) {
        showDebugToast('Record', 'ML model not ready yet, please wait...');
        return;
      }

      // Capture file path injected by glimpse.swift's runOpenPanel
      await new Promise(r => setTimeout(r, 100)); // brief wait for JS injection
      if (window.__selectedFilePaths && window.__selectedFilePaths.length > 0) {
        lastSelectedVideoPath = window.__selectedFilePaths[0];
        window.__selectedFilePaths = null;
      } else {
        lastSelectedVideoPath = '';
      }

      await switchToImageMode();

      const progressEl    = document.getElementById('record-progress');
      const progressFill  = document.getElementById('record-progress-fill');
      const progressLabel = document.getElementById('record-progress-label');
      const progressStats = document.getElementById('record-progress-stats');
      const previewEl     = document.getElementById('record-preview');

      progressEl.classList.add('visible');
      previewEl.classList.remove('visible');
      progressLabel.textContent = 'loading video...';
      progressFill.style.width = '0%';

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error('cannot load video'));
      });

      const duration = video.duration;
      const fps = 5;
      const totalFrames = Math.floor(duration * fps);
      extractedFrames = [];

      progressLabel.textContent = 'extracting pose data...';

      let skippedVisibility = 0;
      let skippedBiomech = 0;
      const recBioValidator = new BiomechanicalValidator();

      // Track per-landmark visibility across all valid frames for calibration
      const landmarkVisibilitySums = new Float64Array(33);
      let validFrameCountForCalibration = 0;

      // Seek frame by frame
      for (let i = 0; i < totalFrames; i++) {
        const t = i / fps;
        video.currentTime = t;
        await new Promise(resolve => { video.onseeked = resolve; });

        try {
          const result = poseLandmarker.detect(video);

          if (result.worldLandmarks && result.worldLandmarks.length > 0 &&
              result.landmarks && result.landmarks.length > 0) {
            const wl = result.worldLandmarks[0];
            const nl = result.landmarks[0]; // normalized 2D for drawing

            // ── Visibility gate (recording) ──
            const visCheck = validateFrameVisibility(nl);
            if (!visCheck.valid) {
              skippedVisibility++;
              continue;
            }

            const normalizedLm = normalizeToHipCenter(wl);
            const angles = extractAllAngles(wl);

            // ── Biomechanical validation (recording) ──
            const bioCheck = recBioValidator.validate(wl, angles);
            if (!bioCheck.valid) {
              skippedBiomech++;
              continue;
            }

            extractedFrames.push({
              t,
              normalizedLandmarks: normalizedLm,
              drawLandmarks: nl.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
              angles,
            });

            // Accumulate per-landmark visibility for calibration profile
            validFrameCountForCalibration++;
            for (let li = 0; li < 33 && li < nl.length; li++) {
              landmarkVisibilitySums[li] += nl[li].visibility;
            }
          }
        } catch (e) {
          // skip frame on error
        }

        const pct = ((i + 1) / totalFrames * 100).toFixed(1);
        progressFill.style.width = pct + '%';
        progressStats.textContent = (i + 1) + ' / ' + totalFrames + ' frames (' + pct + '%)';
      }

      URL.revokeObjectURL(video.src);

      if (extractedFrames.length < 5) {
        progressLabel.textContent = 'failed: not enough valid frames detected (' + extractedFrames.length + ')';
        return;
      }

      // ── Post-process: temporal smoothing of standard data ──
      if (extractedFrames.length > 1) {
        const recSmoother = new LandmarkSmoother(5);
        extractedFrames = extractedFrames.map(f => {
          const smoothed = recSmoother.feed(f);
          return { ...f, normalizedLandmarks: smoothed.normalizedLandmarks, angles: smoothed.angles };
        });
      }

      // ── Build calibration profile from recording data ──
      // Determine which landmarks are consistently visible in the standard video
      // so that scoring calibration only requires what the standard actually has.
      const calibrationProfile = { requiredLandmarks: [], landmarkAvgVisibility: {} };
      if (validFrameCountForCalibration > 0) {
        for (let li = 0; li < 33; li++) {
          const avgVis = landmarkVisibilitySums[li] / validFrameCountForCalibration;
          calibrationProfile.landmarkAvgVisibility[li] = Math.round(avgVis * 1000) / 1000;
          // A landmark is "required" if it was visible (>= 0.6) on average across valid frames
          if (avgVis >= 0.6) {
            calibrationProfile.requiredLandmarks.push(li);
          }
        }
      }
      // Store on extractedFrames' parent scope so saveStandard can access it
      window.__lastCalibrationProfile = calibrationProfile;

      const skippedTotal = skippedVisibility + skippedBiomech;
      let statsMsg = extractedFrames.length + ' valid frames out of ' + totalFrames;
      if (skippedTotal > 0) {
        statsMsg += ' (skipped ' + skippedVisibility + ' low-visibility, ' + skippedBiomech + ' anomalous)';
      }
      progressLabel.textContent = 'extraction done! ' + statsMsg;

      // Show preview
      previewEl.classList.add('visible');
      document.getElementById('record-name').value = file.name.replace(/\\.[^.]+$/, '');
      playPreviewAnimation(extractedFrames);
    }

    let previewRAF = null;
    function playPreviewAnimation(frames) {
      cancelAnimationFrame(previewRAF);
      const canvas = document.getElementById('preview-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 240;
      let idx = 0;
      const fps = 5;
      let lastTime = 0;

      function tick(ts) {
        if (ts - lastTime >= 1000 / fps) {
          lastTime = ts;
          ctx.clearRect(0, 0, 320, 240);
          ctx.fillStyle = '#0c1022';
          ctx.fillRect(0, 0, 320, 240);

          if (frames[idx] && frames[idx].drawLandmarks) {
            drawSkeleton(ctx, frames[idx].drawLandmarks, 320, 240, 'rgba(86,240,255,0.7)', 2, null);
          }

          idx = (idx + 1) % frames.length;
        }
        previewRAF = requestAnimationFrame(tick);
      }
      previewRAF = requestAnimationFrame(tick);
    }

    window.saveStandard = function() {
      const name = document.getElementById('record-name').value.trim();
      if (!name) {
        showDebugToast('Save', 'please enter a name');
        return;
      }
      if (extractedFrames.length === 0) return;

      const data = {
        name,
        createdAt: new Date().toISOString(),
        fps: 5,
        duration: extractedFrames[extractedFrames.length - 1].t,
        totalFrames: extractedFrames.length,
        videoPath: lastSelectedVideoPath,
        calibration: window.__lastCalibrationProfile || { requiredLandmarks: [], landmarkAvgVisibility: {} },
        frames: extractedFrames.map(f => ({
          t: f.t,
          normalizedLandmarks: f.normalizedLandmarks,
          drawLandmarks: f.drawLandmarks,
          angles: f.angles,
        })),
      };

      window.glimpse.send({ type: 'save_standard', data });

      // Update local list (include frames so it can be used immediately)
      standardsList.push({
        filename: name.replace(/[^a-zA-Z0-9_\\-\\u4e00-\\u9fff]/g, '_') + '.json',
        name: data.name,
        createdAt: data.createdAt,
        duration: data.duration,
        totalFrames: data.totalFrames,
        fps: data.fps,
        videoPath: data.videoPath,
        calibration: data.calibration,
        frames: data.frames,
      });

      cancelAnimationFrame(previewRAF);
      goHome();
    };

    window.deleteStandard = function(idx) {
      const s = standardsList[idx];
      if (!s) return;
      window.glimpse.send({ type: 'delete_standard', filename: s.filename });
      standardsList.splice(idx, 1);
      renderStandardList();
    };

    // ───────────────────────────────────────────────────
    // CAMERA
    // ───────────────────────────────────────────────────

    async function startCamera() {
      const video = document.getElementById('cam-video');
      const fallback = document.getElementById('cam-fallback');
      fallback.classList.remove('active');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraFallback('camera API unavailable', 'your browser or system does not support camera access');
        return false;
      }

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length === 0) {
          showCameraFallback('no camera detected', 'please connect a camera and try again');
          return false;
        }
      } catch (e) { /* continue anyway */ }

      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = cameraStream;
        await video.play();
        return true;
      } catch (err) {
        const msg = err.name === 'NotAllowedError' ? 'camera permission denied'
                  : err.name === 'NotReadableError' ? 'camera is busy'
                  : 'camera unavailable';
        const detail = err.name === 'NotAllowedError'
          ? 'please grant camera permission in System Settings > Privacy & Security > Camera'
          : err.message || '';
        showCameraFallback(msg, detail);
        return false;
      }
    }

    function stopCamera() {
      cancelAnimationFrame(scoringRAF);
      cancelAnimationFrame(calibrationRAF);
      const calOverlay = document.getElementById('calibration-overlay');
      if (calOverlay) calOverlay.style.display = 'none';
      const video = document.getElementById('cam-video');
      if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
      }
      video.srcObject = null;
      // Pause standard video
      const stdVideo = document.getElementById('std-video');
      if (stdVideo) stdVideo.pause();
    }

    function showCameraFallback(title, detail) {
      const fb = document.getElementById('cam-fallback');
      document.getElementById('cam-fallback-title').textContent = title;
      document.getElementById('cam-fallback-detail').textContent = detail;
      fb.classList.add('active');
    }

    // ───────────────────────────────────────────────────
    // SCORING MODE
    // ───────────────────────────────────────────────────

    window.startScoring = async function(idx) {
      const s = standardsList[idx];
      if (!s || !s.frames || s.frames.length === 0) {
        showDebugToast('Score', 'standard has no frames data');
        return;
      }

      currentStandardName = s.name;
      currentStandard = s;

      showScreen('score-screen');
      document.getElementById('hud-score').textContent = '...';
      document.getElementById('hud-avg').textContent = '...';
      document.getElementById('hud-time').textContent = '0:00';
      await beginScoring();
    };

    async function beginScoring() {
      if (!poseLandmarkerReady) {
        showDebugToast('Score', 'ML model not ready');
        return;
      }

      await switchToVideoMode();

      // Set up standard video (left panel)
      const stdVideo = document.getElementById('std-video');
      if (currentStandard.videoPath) {
        stdVideo.src = 'file://' + currentStandard.videoPath;
        stdVideo.load();
      } else {
        stdVideo.removeAttribute('src');
      }

      const camOk = await startCamera();
      if (!camOk) return;

      // Calibration phase (adjust position first)
      await runCalibration();

      // Show countdown (3-2-1-GO!)
      await showCountdown();

      // Play standard video in sync
      if (stdVideo.src) {
        stdVideo.currentTime = 0;
        stdVideo.play().catch(() => {});
      }

      // Init DTW + filters
      onlineDTW = new OnlineDTW(currentStandard.frames, 30);
      landmarkSmoother = new LandmarkSmoother(5);
      bioValidator = new BiomechanicalValidator();
      lastValidUserFrame = null;
      visibilityWarningEl = null;
      scoreHistory = [];
      scoringStartTime = performance.now();
      appState = 'scoring';

      // Start detection loop
      scoringLoop();
    }

    function showCountdown() {
      return new Promise(resolve => {
        const overlay = document.getElementById('countdown-overlay');
        const text = document.getElementById('countdown-text');
        overlay.classList.add('active');

        let count = 3;
        text.textContent = count;

        const interval = setInterval(() => {
          count--;
          if (count > 0) {
            text.textContent = count;
            text.style.animation = 'none';
            text.offsetHeight; // reflow
            text.style.animation = 'countPulse 0.5s ease-out';
          } else {
            text.textContent = 'GO!';
            text.style.color = 'var(--lime)';
            text.style.animation = 'none';
            text.offsetHeight;
            text.style.animation = 'countPulse 0.5s ease-out';
            setTimeout(() => {
              overlay.classList.remove('active');
              text.style.color = 'var(--cyan)';
              resolve();
            }, 500);
            clearInterval(interval);
          }
        }, 800);
      });
    }

    // ───────────────────────────────────────────────────
    // CALIBRATION
    // ───────────────────────────────────────────────────

    let calibrationResolve = null;
    let calibrationRAF = null;
    let calibrationStartTime = 0;
    let calibrationIsAligned = false;
    const CALIBRATION_HOLD_TIME = 3000;
    const CALIBRATION_VISIBILITY_THRESHOLD = 0.8;

    function runCalibration() {
      // Use calibration profile from the current standard, or fall back to all 33
      const calibration = currentStandard && currentStandard.calibration;
      const requiredLandmarks = (calibration && calibration.requiredLandmarks && calibration.requiredLandmarks.length > 0)
        ? calibration.requiredLandmarks
        : Array.from({ length: 33 }, (_, i) => i);
      const requiredCount = requiredLandmarks.length;

      return new Promise((resolve) => {
        calibrationResolve = resolve;
        calibrationStartTime = 0;
        calibrationIsAligned = false;

        const overlay = document.getElementById('calibration-overlay');
        const msgEl = document.getElementById('calibration-message');
        const hintEl = document.getElementById('calibration-hint');
        const countEl = document.getElementById('calibration-landmark-count');
        const ringEl = document.getElementById('calibration-ring');
        const silhouetteEl = document.getElementById('calibration-silhouette');
        overlay.style.display = 'flex';

        const ringPerimeter = 1164;
        ringEl.style.strokeDasharray = ringPerimeter;
        ringEl.style.strokeDashoffset = ringPerimeter;
        ringEl.style.stroke = 'var(--cyan)';

        const video = document.getElementById('cam-video');

        function calibrationTick() {
          if (!poseLandmarkerReady) {
            calibrationRAF = requestAnimationFrame(calibrationTick);
            return;
          }

          try {
            const result = poseLandmarker.detectForVideo(video, performance.now());

            if (result.landmarks && result.landmarks.length > 0) {
              const nl = result.landmarks[0];

              // Only check the landmarks that were visible in the standard video
              let visibleCount = 0;
              for (const idx of requiredLandmarks) {
                if (idx < nl.length && nl[idx].visibility >= CALIBRATION_VISIBILITY_THRESHOLD) {
                  visibleCount++;
                }
              }

              countEl.textContent = 'landmarks: ' + visibleCount + '/' + requiredCount;
              const allVisible = visibleCount >= requiredCount;

              // Check bounding box
              let minX = 1, maxX = 0, minY = 1, maxY = 0;
              for (const idx of requiredLandmarks) {
                if (idx < nl.length && nl[idx].visibility >= 0.5) {
                  minX = Math.min(minX, nl[idx].x);
                  maxX = Math.max(maxX, nl[idx].x);
                  minY = Math.min(minY, nl[idx].y);
                  maxY = Math.max(maxY, nl[idx].y);
                }
              }
              const bodyHeight = maxY - minY;

              if (!allVisible) {
                if (visibleCount < requiredCount * 0.5) {
                  msgEl.textContent = 'Stand in front of the camera';
                  hintEl.textContent = 'Match the pose from the standard video';
                } else if (bodyHeight < 0.3) {
                  msgEl.textContent = 'Move closer to the camera';
                  hintEl.textContent = 'You appear too small in the frame';
                } else if (minY < 0.02 || maxY > 0.98) {
                  msgEl.textContent = 'Step back a little';
                  hintEl.textContent = 'Parts of your body are out of frame';
                } else {
                  msgEl.textContent = 'Adjust your position';
                  hintEl.textContent = visibleCount + ' of ' + requiredCount + ' required landmarks detected';
                }
                calibrationStartTime = 0;
                calibrationIsAligned = false;
                silhouetteEl.style.opacity = '0.3';
                ringEl.style.strokeDashoffset = ringPerimeter;
                ringEl.style.stroke = 'var(--cyan)';
              } else {
                silhouetteEl.style.opacity = '0.6';

                if (!calibrationIsAligned) {
                  calibrationIsAligned = true;
                  calibrationStartTime = performance.now();
                  msgEl.textContent = 'Hold still...';
                  hintEl.textContent = 'Calibrating your position';
                }

                const elapsed = performance.now() - calibrationStartTime;
                const progress = Math.min(1, elapsed / CALIBRATION_HOLD_TIME);

                ringEl.style.strokeDashoffset = ringPerimeter * (1 - progress);

                if (progress >= 1) {
                  ringEl.style.stroke = 'var(--lime)';
                  msgEl.textContent = 'Calibration complete!';
                  msgEl.style.color = 'var(--lime)';
                  hintEl.textContent = '';

                  setTimeout(() => {
                    overlay.style.display = 'none';
                    msgEl.style.color = 'var(--cyan)';
                    calibrationResolve();
                  }, 500);
                  return;
                }
              }
            } else {
              countEl.textContent = 'landmarks: 0/' + requiredCount;
              msgEl.textContent = 'No person detected';
              hintEl.textContent = 'Step in front of the camera';
              calibrationStartTime = 0;
              calibrationIsAligned = false;
              silhouetteEl.style.opacity = '0.3';
              ringEl.style.strokeDashoffset = ringPerimeter;
            }
          } catch (e) {
            // ignore detection errors during calibration
          }

          calibrationRAF = requestAnimationFrame(calibrationTick);
        }

        calibrationRAF = requestAnimationFrame(calibrationTick);
      });
    }

    window.skipCalibration = function() {
      cancelAnimationFrame(calibrationRAF);
      const overlay = document.getElementById('calibration-overlay');
      overlay.style.display = 'none';
      if (calibrationResolve) {
        calibrationResolve();
        calibrationResolve = null;
      }
    };

    let lastVideoTime = -1;

    function updateScoringHUD(dtwResult) {
      document.getElementById('hud-score').textContent = Math.round(dtwResult.score);
      document.getElementById('hud-score').parentElement.querySelector('.val').style.color = scoreToColor(dtwResult.score);
      document.getElementById('hud-avg').textContent = Math.round(onlineDTW.getAverageScore());

      const elapsed = (performance.now() - scoringStartTime) / 1000;
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      document.getElementById('hud-time').textContent = mins + ':' + String(secs).padStart(2, '0');

      document.getElementById('score-progress-fill').style.width = (dtwResult.progress * 100).toFixed(1) + '%';
      drawScoreChart('score-chart', scoreHistory, 200);
    }

    function scoringLoop() {
      if (appState !== 'scoring') return;

      const video = document.getElementById('cam-video');
      const skelCanvas = document.getElementById('skeleton-canvas');
      const container = document.getElementById('score-main');

      // Canvas size matches the visible area (video overlay)
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      skelCanvas.width = cw;
      skelCanvas.height = ch;

      const skelCtx = skelCanvas.getContext('2d');
      skelCtx.clearRect(0, 0, cw, ch);

      if (poseLandmarkerReady && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const result = poseLandmarker.detectForVideo(video, performance.now());

          if (result.worldLandmarks && result.worldLandmarks.length > 0 &&
              result.landmarks && result.landmarks.length > 0) {

            const wl = result.worldLandmarks[0];
            const nl = result.landmarks[0];

            // ───── STAGE 1: Visibility gate ─────
            const visCheck = validateFrameVisibility(nl);
            if (!visibilityWarningEl) {
              visibilityWarningEl = document.getElementById('visibility-warning');
            }

            if (!visCheck.valid) {
              visibilityWarningEl.style.display = 'flex';
              // Draw dim skeleton so user can adjust
              drawSkeleton(skelCtx, nl, cw, ch, 'rgba(255,94,169,0.3)', 2, null);
              // Don't feed DTW — keep last score on HUD
              scoringRAF = requestAnimationFrame(scoringLoop);
              return;
            }

            visibilityWarningEl.style.display = 'none';

            // ───── STAGE 2: Compute pose features ─────
            const normalizedLm = normalizeToHipCenter(wl);
            const angles = extractAllAngles(wl);

            // ───── STAGE 3: Biomechanical validation ─────
            const bioCheck = bioValidator.validate(wl, angles);
            if (!bioCheck.valid && lastValidUserFrame) {
              // Use previous valid frame — draw skeleton in amber
              drawSkeleton(skelCtx, nl, cw, ch, 'rgba(255,193,90,0.5)', 2, null);
              const dtwResult = onlineDTW.feed(lastValidUserFrame);
              scoreHistory.push(dtwResult.score);
              updateScoringHUD(dtwResult);
              if (dtwResult.isComplete) {
                setTimeout(() => finishScoring(), 500);
                return;
              }
              scoringRAF = requestAnimationFrame(scoringLoop);
              return;
            }

            // ───── STAGE 4: Temporal smoothing ─────
            const rawFrame = { normalizedLandmarks: normalizedLm, angles };
            const userFrame = landmarkSmoother.feed(rawFrame);
            lastValidUserFrame = userFrame;

            // ───── STAGE 5: DTW scoring ─────
            const dtwResult = onlineDTW.feed(userFrame);
            scoreHistory.push(dtwResult.score);

            // ───── STAGE 6: Visualization ─────
            const stdFrame = currentStandard.frames[dtwResult.stdIdx];
            const jointScores = computePerJointScores(userFrame, stdFrame);
            drawSkeleton(skelCtx, nl, cw, ch, null, 3, jointScores);

            // ───── STAGE 7: HUD update ─────
            updateScoringHUD(dtwResult);

            // Auto-complete
            if (dtwResult.isComplete) {
              setTimeout(() => finishScoring(), 500);
              return;
            }
          }
        } catch (e) {
          showDebugToast('Detect', e.message || String(e));
        }
      }

      scoringRAF = requestAnimationFrame(scoringLoop);
    }

    window.finishScoring = function() {
      appState = 'result';
      cancelAnimationFrame(scoringRAF);
      stopCamera();

      if (!onlineDTW || onlineDTW.scores.length === 0) {
        goHome();
        return;
      }

      const avgScore = onlineDTW.getAverageScore();
      const highScore = onlineDTW.getHighScore();
      const lowScore = onlineDTW.getLowScore();
      const elapsed = (performance.now() - scoringStartTime) / 1000;

      document.getElementById('result-standard-name').textContent = currentStandardName;
      document.getElementById('result-avg-score').textContent = Math.round(avgScore);
      document.getElementById('result-high').textContent = Math.round(highScore);
      document.getElementById('result-low').textContent = Math.round(lowScore);
      document.getElementById('result-duration').textContent = elapsed.toFixed(1) + 's';

      showScreen('result-screen');

      // Draw final chart
      setTimeout(() => drawScoreChart('result-chart', onlineDTW.scores, 0), 100);

      // Send results to Node.js
      window.glimpse.send({
        type: 'session_result',
        standard: currentStandardName,
        avgScore: Math.round(avgScore),
        highScore: Math.round(highScore),
        lowScore: Math.round(lowScore),
        duration: elapsed.toFixed(1),
        totalFrames: onlineDTW.scores.length,
      });
    };

    window.restartScoring = async function() {
      if (!currentStandard) { goHome(); return; }
      cancelAnimationFrame(scoringRAF);
      stopCamera();
      showScreen('score-screen');
      document.getElementById('hud-score').textContent = '...';
      document.getElementById('hud-avg').textContent = '...';
      document.getElementById('hud-time').textContent = '0:00';
      document.getElementById('score-progress-fill').style.width = '0%';
      await beginScoring();
    };

    // ───────────────────────────────────────────────────
    // INIT
    // ───────────────────────────────────────────────────

    renderStandardList();
    initPoseLandmarker().catch(() => {});

  <\/script>
</body>
</html>
`;

// ── Window management ──
function runWindow() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let summary = null;
    let win;

    try {
      win = open(html, {
        width: width ?? 9999,
        height: height ?? 9999,
        title,
        resizable: true,
      });
    } catch (error) {
      reject(error);
      return;
    }

    win.on('message', async (raw) => {
      let data;
      try {
        data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch { return; }

      if (!data || !data.type) return;

      if (data.type === 'exit') {
        summary = data;
        win.close();
      }

      if (data.type === 'save_standard') {
        try {
          const filename = data.data.name.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_') + '.json';
          await writeFile(join(STANDARDS_DIR, filename), JSON.stringify(data.data), 'utf-8');
        } catch (err) {
          console.error('Failed to save standard:', err.message);
        }
      }

      if (data.type === 'delete_standard') {
        try {
          await unlink(join(STANDARDS_DIR, data.filename));
        } catch (err) {
          console.error('Failed to delete standard:', err.message);
        }
      }

      if (data.type === 'session_result') {
        summary = data;
      }
    });

    win.once('closed', () => {
      if (settled) return;
      settled = true;
      resolve(summary ?? { status: 'closed' });
    });

    win.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

try {
  const result = await runWindow();
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Failed to launch fitness-coach');
  process.exit(1);
}
