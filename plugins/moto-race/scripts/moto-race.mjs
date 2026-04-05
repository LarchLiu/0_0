#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { open } from '@cloudgeek/glimpse';

const { values } = parseArgs({
  options: {
    width: { type: 'string' },
    height: { type: 'string' },
    title: { type: 'string', default: 'Moto Race' },
  },
});

const width = values.width == null ? null : Number.parseInt(values.width, 10);
const height = values.height == null ? null : Number.parseInt(values.height, 10);
const title = values.title;

if (width != null && (!Number.isFinite(width) || width < 640)) {
  console.error('Invalid --width. Expected an integer >= 640.');
  process.exit(2);
}

if (height != null && (!Number.isFinite(height) || height < 480)) {
  console.error('Invalid --height. Expected an integer >= 480.');
  process.exit(2);
}

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Moto Race</title>
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
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: var(--bg-0);
    color: var(--text);
    user-select: none; -webkit-user-select: none;
  }

  #game-canvas { position: fixed; inset: 0; z-index: 0; }

  /* ---------- HUD ---------- */
  .hud {
    position: fixed; z-index: 10; pointer-events: none;
  }

  .hud-top {
    top: 16px; left: 0; right: 0;
    display: flex; justify-content: center; align-items: center; gap: 40px;
    font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase;
  }

  .hud-pill {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    padding: 8px 18px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    text-shadow: 0 0 8px rgba(86, 240, 255, 0.4);
  }

  .hud-pill .val { font-size: 22px; font-weight: 700; }
  .hud-pill .lbl { font-size: 11px; color: var(--muted); margin-bottom: 2px; }

  .hud-pill.lap .val { color: var(--cyan); }
  .hud-pill.time .val { color: var(--text); }
  .hud-pill.pos .val { color: var(--lime); }

  /* ---------- Bottom-right: Speed + Boost ---------- */
  .hud-speed {
    bottom: 24px; right: 24px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    padding: 16px 22px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    min-width: 160px;
  }

  .speed-value {
    font-size: 38px; font-weight: 800;
    color: var(--cyan);
    text-shadow: 0 0 16px rgba(86, 240, 255, 0.5);
    line-height: 1;
  }
  .speed-unit { font-size: 13px; color: var(--muted); margin-left: 4px; }

  .bar-wrap {
    margin-top: 10px; height: 6px; border-radius: 3px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
  }
  .bar-fill {
    height: 100%; border-radius: 3px;
    transition: width 0.1s linear;
  }
  .speed-bar .bar-fill { background: linear-gradient(90deg, var(--cyan), var(--lime)); }
  .boost-bar .bar-fill { background: linear-gradient(90deg, var(--amber), var(--magenta)); }
  .bar-label {
    font-size: 10px; color: var(--muted); margin-top: 6px;
    text-transform: uppercase; letter-spacing: 0.1em;
  }

  /* ---------- Bottom-left: Minimap ---------- */
  .hud-minimap {
    bottom: 24px; left: 24px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 12px;
    padding: 12px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }

  #minimap-canvas {
    width: 150px; height: 150px;
    border-radius: 6px;
  }

  /* ---------- Overlays ---------- */
  .overlay {
    position: fixed; inset: 0; z-index: 20;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    pointer-events: none;
  }

  .countdown-text {
    font-size: 120px; font-weight: 900;
    color: var(--amber);
    text-shadow: 0 0 60px rgba(255, 193, 90, 0.6), 0 0 120px rgba(255, 193, 90, 0.3);
    opacity: 0;
    transform: scale(2);
    transition: all 0.3s ease-out;
  }
  .countdown-text.show {
    opacity: 1; transform: scale(1);
  }
  .countdown-text.go {
    color: var(--lime);
    text-shadow: 0 0 60px rgba(141, 255, 101, 0.6), 0 0 120px rgba(141, 255, 101, 0.3);
  }

  .results-panel {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    padding: 36px 48px;
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    text-align: center;
    pointer-events: auto;
    opacity: 0; transform: translateY(30px);
    transition: all 0.5s ease-out;
  }
  .results-panel.show { opacity: 1; transform: translateY(0); }
  .results-title {
    font-size: 32px; font-weight: 800;
    margin-bottom: 20px;
    text-shadow: 0 0 20px rgba(86, 240, 255, 0.5);
  }
  .results-row {
    display: flex; justify-content: space-between; gap: 30px;
    padding: 8px 0; font-size: 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .results-row .name { text-align: left; }
  .results-row .time { color: var(--muted); text-align: right; }
  .results-hint {
    margin-top: 22px; font-size: 13px; color: var(--muted);
  }

  .wrong-way {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 25;
    font-size: 42px; font-weight: 900;
    color: var(--danger);
    text-shadow: 0 0 30px rgba(255, 122, 148, 0.7);
    opacity: 0;
    transition: opacity 0.2s;
  }
  .wrong-way.show { opacity: 1; }

  .final-lap-flash {
    position: fixed; top: 15%; left: 50%; transform: translateX(-50%);
    z-index: 25;
    font-size: 36px; font-weight: 800;
    color: var(--amber);
    text-shadow: 0 0 30px rgba(255, 193, 90, 0.6);
    opacity: 0;
    transition: opacity 0.3s;
  }
  .final-lap-flash.show { opacity: 1; }

  /* ---------- Tracker (camera) footer ---------- */
  .tracker-footer {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    display: flex; gap: 10px; align-items: center;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    padding: 8px 14px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    font-size: 11px; color: var(--muted);
    opacity: 0.7;
    transition: opacity 0.3s;
  }
  .tracker-footer:hover { opacity: 1; }
  .tracker-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--muted);
  }
  .tracker-dot.active { background: var(--lime); box-shadow: 0 0 6px var(--lime); }

  /* ---------- Controls hint ---------- */
  .controls-hint {
    position: fixed; bottom: 80px; left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    font-size: 12px; color: var(--muted);
    text-align: center;
    opacity: 0.6;
    transition: opacity 1s;
  }
  .controls-hint.hidden { opacity: 0; pointer-events: none; }

  /* ---------- Camera preview ---------- */
  .camera-preview {
    position: fixed; top: 16px; right: 16px; z-index: 35;
    width: 180px;
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 10px;
    overflow: hidden;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .camera-preview .cam-shell {
    position: relative; width: 180px; height: 135px;
    background: #000;
  }
  .camera-preview video,
  .camera-preview .cam-overlay {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; transform: scaleX(-1);
  }
  .camera-preview video::-webkit-media-controls { display: none !important; }
  .camera-preview .cam-overlay { pointer-events: none; }
  .camera-preview .cam-status {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 10px; font-size: 10px; color: var(--muted);
  }
  .camera-preview .cam-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--muted);
  }
  .camera-preview .cam-dot.active { background: var(--lime); box-shadow: 0 0 6px var(--lime); }
  .camera-preview .gesture-label {
    margin-left: auto; font-weight: 700; color: var(--cyan);
  }

  /* ---------- Map select ---------- */
  .map-select-overlay {
    position: fixed; inset: 0; z-index: 30;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(86, 240, 255, 0.06), transparent 50%),
      radial-gradient(ellipse at 70% 60%, rgba(255, 94, 169, 0.06), transparent 50%),
      var(--bg-0);
  }
  .map-select-title {
    font-size: 36px; font-weight: 900;
    color: var(--cyan);
    text-shadow: 0 0 30px rgba(86, 240, 255, 0.5);
    margin-bottom: 12px;
    letter-spacing: 0.1em;
  }
  .map-select-subtitle {
    font-size: 14px; color: var(--muted);
    margin-bottom: 36px;
  }
  .map-cards {
    display: flex; gap: 24px;
  }
  .map-card {
    width: 220px; padding: 20px;
    background: var(--panel);
    border: 2px solid var(--panel-border);
    border-radius: 16px;
    text-align: center;
    cursor: pointer;
    transition: all 0.25s ease;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .map-card:hover, .map-card.active {
    border-color: var(--cyan);
    transform: translateY(-6px);
    box-shadow: 0 12px 40px rgba(86, 240, 255, 0.15);
  }
  .map-card .map-num {
    font-size: 48px; font-weight: 900;
    color: var(--cyan);
    text-shadow: 0 0 20px rgba(86, 240, 255, 0.4);
    line-height: 1;
  }
  .map-card .map-name {
    font-size: 18px; font-weight: 700;
    margin: 10px 0 6px;
    color: var(--text);
  }
  .map-card .map-desc {
    font-size: 12px; color: var(--muted);
    line-height: 1.4;
  }
  .map-card .map-preview {
    margin-top: 14px; height: 100px;
    border-radius: 8px; overflow: hidden;
    background: rgba(0,0,0,0.3);
  }
  .map-card .map-preview canvas {
    width: 100%; height: 100%;
  }
  .map-card:nth-child(2) .map-num { color: var(--magenta); text-shadow: 0 0 20px rgba(255, 94, 169, 0.4); }
  .map-card:nth-child(2):hover, .map-card:nth-child(2).active {
    border-color: var(--magenta); box-shadow: 0 12px 40px rgba(255, 94, 169, 0.15);
  }
  .map-card:nth-child(3) .map-num { color: var(--amber); text-shadow: 0 0 20px rgba(255, 193, 90, 0.4); }
  .map-card:nth-child(3):hover, .map-card:nth-child(3).active {
    border-color: var(--amber); box-shadow: 0 12px 40px rgba(255, 193, 90, 0.15);
  }
  .map-select-hint {
    margin-top: 30px; font-size: 13px; color: var(--muted);
  }
  .map-select-gesture-hint {
    margin-top: 8px; font-size: 12px; color: var(--muted); opacity: 0.7;
  }

</style>
</head>
<body>
  <canvas id="game-canvas"></canvas>

  <!-- HUD Top -->
  <div class="hud hud-top">
    <div class="hud-pill lap">
      <div class="lbl">Lap</div>
      <div class="val" id="hud-lap">0/3</div>
    </div>
    <div class="hud-pill time">
      <div class="lbl">Time</div>
      <div class="val" id="hud-time">0:00.000</div>
    </div>
    <div class="hud-pill pos">
      <div class="lbl">Position</div>
      <div class="val" id="hud-pos">1 / 5</div>
    </div>
  </div>

  <!-- Speed + Boost -->
  <div class="hud hud-speed">
    <div><span class="speed-value" id="hud-speed">0</span><span class="speed-unit">km/h</span></div>
    <div class="bar-wrap speed-bar"><div class="bar-fill" id="speed-fill"></div></div>
    <div class="bar-label">Boost</div>
    <div class="bar-wrap boost-bar"><div class="bar-fill" id="boost-fill"></div></div>
  </div>

  <!-- Minimap -->
  <div class="hud hud-minimap">
    <canvas id="minimap-canvas" width="300" height="300"></canvas>
  </div>

  <!-- Countdown overlay -->
  <div class="overlay" id="countdown-overlay">
    <div class="countdown-text" id="countdown-text"></div>
  </div>

  <!-- Results overlay -->
  <div class="overlay" id="results-overlay" style="display:none">
    <div class="results-panel" id="results-panel">
      <div class="results-title" id="results-title">Race Complete!</div>
      <div id="results-rows"></div>
      <div class="results-hint">Press <strong>R</strong> to race again &nbsp;|&nbsp; <strong>Esc</strong> to exit</div>
    </div>
  </div>

  <!-- Wrong way -->
  <div class="wrong-way" id="wrong-way">WRONG WAY</div>

  <!-- Final lap -->
  <div class="final-lap-flash" id="final-lap">FINAL LAP!</div>

  <!-- Controls hint -->
  <div class="controls-hint" id="controls-hint">
    WASD / Arrows to steer &nbsp;|&nbsp; SPACE for boost &nbsp;|&nbsp; R to restart
  </div>

  <!-- Camera preview (top-right) -->
  <div class="camera-preview" id="camera-preview" style="display:none">
    <div class="cam-shell">
      <video id="cam-video" autoplay playsinline muted></video>
      <canvas id="cam-overlay" class="cam-overlay"></canvas>
    </div>
    <div class="cam-status">
      <div class="cam-dot" id="cam-dot"></div>
      <span id="cam-status-text">Camera</span>
      <span class="gesture-label" id="cam-gesture"></span>
    </div>
  </div>

  <!-- Map select overlay -->
  <div class="map-select-overlay" id="map-select-overlay">
    <div class="map-select-title">SELECT TRACK</div>
    <div class="map-select-subtitle">Choose your race circuit</div>
    <div class="map-cards">
      <div class="map-card" data-map="1" onclick="selectMap(1)">
        <div class="map-num">1</div>
        <div class="map-name">Neon Circuit</div>
        <div class="map-desc">Smooth curves, balanced difficulty. Perfect for beginners.</div>
        <div class="map-desc" style="margin-top:6px; font-size:20px">☝️</div>
        <div class="map-preview"><canvas id="map-preview-1" width="200" height="100"></canvas></div>
      </div>
      <div class="map-card" data-map="2" onclick="selectMap(2)">
        <div class="map-num">2</div>
        <div class="map-name">Dragon Tail</div>
        <div class="map-desc">Tight hairpins and S-curves. Technical mastery required.</div>
        <div class="map-desc" style="margin-top:6px; font-size:20px">✌️</div>
        <div class="map-preview"><canvas id="map-preview-2" width="200" height="100"></canvas></div>
      </div>
      <div class="map-card" data-map="3" onclick="selectMap(3)">
        <div class="map-num">3</div>
        <div class="map-name">Thunder Oval</div>
        <div class="map-desc">High-speed oval with banked turns. Pure speed.</div>
        <div class="map-desc" style="margin-top:6px; font-size:20px">🤟</div>
        <div class="map-preview"><canvas id="map-preview-3" width="200" height="100"></canvas></div>
      </div>
    </div>
    <div class="map-select-hint">Press <strong>1</strong>, <strong>2</strong>, or <strong>3</strong> to select</div>
    <div class="map-select-gesture-hint" id="gesture-select-hint" style="display:none">or hold ☝️ for 1 &nbsp; ✌️ for 2 &nbsp; 🤟 for 3</div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js"><\/script>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.183.2/examples/jsm/"
    }
  }
  <\/script>

  <script type="module">
    import * as THREE from 'three';

    /* ================================================================
       CONSTANTS
       ================================================================ */
    const TOTAL_LAPS = 3;
    const NUM_AI = 4;
    const TRACK_WIDTH = 14;
    const TRACK_SAMPLES = 500;

    // Physics
    const MAX_SPEED = 50;
    const BOOST_MAX_SPEED = 70;
    const ACCELERATION = 28;
    const BRAKING = 40;
    const FRICTION = 8;
    const OFF_TRACK_FRICTION = 25;
    const TURN_RATE_LOW = 2.4;
    const TURN_RATE_HIGH = 1.0;
    const MAX_LEAN = 0.5;
    const BOOST_DRAIN = 25;
    const BOOST_REGEN = 5;
    const BOOST_MAX_FUEL = 100;
    const COLLISION_DIST = 2.4;
    const COLLISION_PUSH = 8;

    // Camera
    const CAM_OFFSET = new THREE.Vector3(0, 22, 30);
    const CAM_LOOK_AHEAD = 18;
    const CAM_SMOOTHING = 0.06;
    const CAM_FOV_MIN = 65;
    const CAM_FOV_MAX = 82;

    // Colors
    const COLORS = {
      player: 0x56f0ff,
      ai1: 0xff5ea9,
      ai2: 0x8dff65,
      ai3: 0xffc15a,
      ai4: 0xa77bff,
      road: 0x151a2e,
      roadLine: 0x2a3050,
      barrier: 0x56f0ff,
      barrierR: 0xff5ea9,
      ground: 0x04050b,
    };
    const AI_COLORS = [COLORS.ai1, COLORS.ai2, COLORS.ai3, COLORS.ai4];
    const AI_NAMES = ['NOVA', 'BLITZ', 'SPARK', 'PHANTOM'];

    /* ================================================================
       TRACK MAPS — 3 selectable circuits
       ================================================================ */
    const TRACK_MAPS = {
      1: { // Neon Circuit — smooth, balanced
        name: 'Neon Circuit',
        points: [
          [0, 0, -80], [40, 0, -70], [65, 0, -40], [70, 0, 0],
          [60, 0, 35], [30, 0, 55], [5, 0, 70], [-25, 0, 60],
          [-50, 0, 35], [-65, 0, 5], [-60, 0, -25], [-40, 0, -50], [-20, 0, -70],
        ],
      },
      2: { // Dragon Tail — tight hairpins & S-curves
        name: 'Dragon Tail',
        points: [
          [0, 0, -70], [25, 0, -65], [50, 0, -45], [55, 0, -15],
          [35, 0, 5], [10, 0, 15], [-10, 0, 30], [15, 0, 45],
          [45, 0, 55], [30, 0, 75], [0, 0, 80], [-35, 0, 70],
          [-55, 0, 45], [-40, 0, 20], [-55, 0, -5], [-45, 0, -35],
          [-25, 0, -55],
        ],
      },
      3: { // Thunder Oval — high-speed oval
        name: 'Thunder Oval',
        points: [
          [0, 0, -90], [45, 0, -80], [75, 0, -50], [80, 0, 0],
          [75, 0, 50], [45, 0, 80], [0, 0, 90],
          [-45, 0, 80], [-75, 0, 50], [-80, 0, 0],
          [-75, 0, -50], [-45, 0, -80],
        ],
      },
    };

    let selectedMap = 0; // 0 = none selected yet
    let trackCurve = null;
    let trackPoints = [];
    let trackTangents = [];
    let trackNormals = [];
    const upVec = new THREE.Vector3(0, 1, 0);
    let trackMeshGroup = null; // group to remove old track meshes
    let trackLights = [];

    function buildTrackFromMap(mapId) {
      const mapDef = TRACK_MAPS[mapId];
      const controlPoints = mapDef.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      trackCurve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.6);

      // Re-sample
      trackPoints = [];
      trackTangents = [];
      trackNormals = [];
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const t = i / TRACK_SAMPLES;
        trackPoints.push(trackCurve.getPointAt(t));
        const tan = trackCurve.getTangentAt(t).normalize();
        trackTangents.push(tan);
        trackNormals.push(new THREE.Vector3().crossVectors(upVec, tan).normalize());
      }

      // Remove old track meshes
      if (trackMeshGroup) {
        scene.remove(trackMeshGroup);
        trackMeshGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
        // Remove old track lights
        trackLights.forEach(l => scene.remove(l));
      }

      trackMeshGroup = new THREE.Group();
      scene.add(trackMeshGroup);
      trackLights = buildTrackMeshes(trackMeshGroup);
    }

    // Draw a track preview onto a small canvas
    function drawTrackPreview(canvasId, mapId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const mapDef = TRACK_MAPS[mapId];
      const pts = mapDef.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6);
      const samples = 200;
      const sampled = [];
      for (let i = 0; i < samples; i++) sampled.push(curve.getPointAt(i / samples));

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of sampled) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      const pad = 10;
      const rangeX = maxX - minX + pad * 2;
      const rangeZ = maxZ - minZ + pad * 2;
      const scale = Math.min(w / rangeX, h / rangeZ) * 0.85;
      const offX = (w - rangeX * scale) * 0.5 - (minX - pad) * scale;
      const offY = (h - rangeZ * scale) * 0.5 - (minZ - pad) * scale;

      ctx.strokeStyle = '#2a3050';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const p = sampled[i % samples];
        const x = p.x * scale + offX, y = p.z * scale + offY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();

      // Glow line on top
      const colors = { 1: '#56f0ff', 2: '#ff5ea9', 3: '#ffc15a' };
      ctx.strokeStyle = colors[mapId];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let i = 0; i <= samples; i++) {
        const p = sampled[i % samples];
        const x = p.x * scale + offX, y = p.z * scale + offY;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Start dot
      const sp = sampled[0];
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sp.x * scale + offX, sp.z * scale + offY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Track helper functions
    function getTrackProgressAt(pos) {
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const d = pos.distanceToSquared(trackPoints[i]);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best / TRACK_SAMPLES;
    }

    function getClosestTrackPoint(pos) {
      let best = 0, bestDist = Infinity;
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const d = pos.distanceToSquared(trackPoints[i]);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return { point: trackPoints[best], normal: trackNormals[best], index: best };
    }

    function isOnTrack(pos) {
      const { point } = getClosestTrackPoint(pos);
      const dx = pos.x - point.x;
      const dz = pos.z - point.z;
      return Math.sqrt(dx * dx + dz * dz) < TRACK_WIDTH * 0.5;
    }

    function getTrackCurvatureAt(t) {
      const i = Math.floor(t * TRACK_SAMPLES) % TRACK_SAMPLES;
      const j = (i + 8) % TRACK_SAMPLES;  // look 8 samples ahead for meaningful curvature
      return trackTangents[i].angleTo(trackTangents[j]);
    }

    /* ================================================================
       BUILD TRACK MESHES
       ================================================================ */
    function buildTrackMeshes(scene) {
      // Road surface
      const roadVerts = [];
      const roadIndices = [];
      const halfW = TRACK_WIDTH * 0.5;
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const p = trackPoints[i];
        const n = trackNormals[i];
        roadVerts.push(p.x + n.x * halfW, 0.01, p.z + n.z * halfW);
        roadVerts.push(p.x - n.x * halfW, 0.01, p.z - n.z * halfW);
      }
      for (let i = 0; i < TRACK_SAMPLES; i++) {
        const a = i * 2, b = a + 1;
        const c = ((i + 1) % TRACK_SAMPLES) * 2;
        const d = c + 1;
        roadIndices.push(a, c, b, b, c, d);
      }
      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
      roadGeo.setIndex(roadIndices);
      roadGeo.computeVertexNormals();
      const roadMat = new THREE.MeshStandardMaterial({
        color: COLORS.road, roughness: 0.8, metalness: 0.2,
      });
      const road = new THREE.Mesh(roadGeo, roadMat);
      scene.add(road);

      // Center dashes
      const dashGeo = new THREE.BoxGeometry(0.3, 0.05, 2);
      const dashMat = new THREE.MeshStandardMaterial({ color: COLORS.roadLine, emissive: COLORS.roadLine, emissiveIntensity: 0.3 });
      for (let i = 0; i < TRACK_SAMPLES; i += 12) {
        const p = trackPoints[i];
        const t = trackTangents[i];
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.position.set(p.x, 0.06, p.z);
        dash.rotation.y = Math.atan2(t.x, t.z);
        scene.add(dash);
      }

      // Barriers
      const barrierH = 1.2;
      const barrierGeo = new THREE.BoxGeometry(0.3, barrierH, 0.6);
      const leftMat = new THREE.MeshStandardMaterial({
        color: COLORS.barrier, emissive: COLORS.barrier, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.7,
      });
      const rightMat = new THREE.MeshStandardMaterial({
        color: COLORS.barrierR, emissive: COLORS.barrierR, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.7,
      });
      for (let i = 0; i < TRACK_SAMPLES; i += 4) {
        const p = trackPoints[i];
        const n = trackNormals[i];
        const t = trackTangents[i];
        const rotY = Math.atan2(t.x, t.z);
        // Left
        const lx = p.x + n.x * (halfW + 0.5);
        const lz = p.z + n.z * (halfW + 0.5);
        const lb = new THREE.Mesh(barrierGeo, leftMat);
        lb.position.set(lx, barrierH * 0.5, lz);
        lb.rotation.y = rotY;
        scene.add(lb);
        // Right
        const rx = p.x - n.x * (halfW + 0.5);
        const rz = p.z - n.z * (halfW + 0.5);
        const rb = new THREE.Mesh(barrierGeo, rightMat);
        rb.position.set(rx, barrierH * 0.5, rz);
        rb.rotation.y = rotY;
        scene.add(rb);
      }

      // Start/finish line
      const sfGeo = new THREE.PlaneGeometry(TRACK_WIDTH, 2);
      const sfMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: 0xffc15a, emissiveIntensity: 0.5,
        transparent: true, opacity: 0.4,
      });
      const sf = new THREE.Mesh(sfGeo, sfMat);
      sf.rotation.x = -Math.PI / 2;
      const sp = trackPoints[0];
      const st = trackTangents[0];
      sf.position.set(sp.x, 0.05, sp.z);
      sf.rotation.z = -Math.atan2(st.x, st.z);
      scene.add(sf);

      // Track-side neon lights
      const lights = [];
      for (let i = 0; i < 8; i++) {
        const idx = Math.floor((i / 8) * TRACK_SAMPLES);
        const p = trackPoints[idx];
        const n = trackNormals[idx];
        const side = i % 2 === 0 ? 1 : -1;
        const color = side > 0 ? COLORS.barrier : COLORS.barrierR;
        const light = new THREE.PointLight(color, 3, 40, 1.5);
        light.position.set(
          p.x + n.x * (halfW + 3) * side,
          3,
          p.z + n.z * (halfW + 3) * side
        );
        scene.add(light);
        lights.push(light);
      }

      return lights;
    }

    /* ================================================================
       MOTORCYCLE MODEL (primitives)
       ================================================================ */
    function createMotorcycle(color) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.35,
        metalness: 0.6, roughness: 0.3,
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x222233, metalness: 0.8, roughness: 0.2,
      });

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 2.6), mat);
      body.position.y = 0.55;
      group.add(body);

      // Fairing
      const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.0), mat);
      fairing.position.set(0, 0.75, -0.9);
      fairing.rotation.x = -0.3;
      group.add(fairing);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.25, 16);
      const fWheel = new THREE.Mesh(wheelGeo, darkMat);
      fWheel.rotation.z = Math.PI / 2;
      fWheel.position.set(0, 0.38, -1.2);
      group.add(fWheel);

      const rWheel = new THREE.Mesh(wheelGeo, darkMat);
      rWheel.rotation.z = Math.PI / 2;
      rWheel.position.set(0, 0.38, 1.0);
      group.add(rWheel);

      // Headlight
      const headlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 })
      );
      headlight.position.set(0, 0.7, -1.45);
      group.add(headlight);

      // Rider (simplified)
      const riderMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.7 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.7), riderMat);
      torso.position.set(0, 1.15, 0.1);
      torso.rotation.x = -0.35;
      group.add(torso);

      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.2 })
      );
      helmet.position.set(0, 1.55, -0.15);
      group.add(helmet);

      // Underglow
      const glow = new THREE.PointLight(color, 2, 8, 1.5);
      glow.position.set(0, 0.2, 0);
      group.add(glow);

      return group;
    }

    /* ================================================================
       PARTICLE SYSTEM
       ================================================================ */
    const MAX_PARTICLES = 250;
    const particlePositions = new Float32Array(MAX_PARTICLES * 3);
    const particleColors = new Float32Array(MAX_PARTICLES * 3);
    const particleSizes = new Float32Array(MAX_PARTICLES);
    const particleLife = new Float32Array(MAX_PARTICLES);
    const particleMaxLife = new Float32Array(MAX_PARTICLES);
    const particleVelocities = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particleVelocities.push(new THREE.Vector3());
      particleLife[i] = 0;
    }
    let nextParticle = 0;

    function emitParticle(pos, vel, color, size, life) {
      const i = nextParticle;
      nextParticle = (nextParticle + 1) % MAX_PARTICLES;
      particlePositions[i * 3] = pos.x;
      particlePositions[i * 3 + 1] = pos.y;
      particlePositions[i * 3 + 2] = pos.z;
      particleVelocities[i].copy(vel);
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
      particleSizes[i] = size;
      particleLife[i] = life;
      particleMaxLife[i] = life;
    }

    function updateParticles(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (particleLife[i] <= 0) continue;
        particleLife[i] -= dt;
        if (particleLife[i] <= 0) {
          particleSizes[i] = 0;
          continue;
        }
        particlePositions[i * 3] += particleVelocities[i].x * dt;
        particlePositions[i * 3 + 1] += particleVelocities[i].y * dt;
        particlePositions[i * 3 + 2] += particleVelocities[i].z * dt;
        particleVelocities[i].y -= 4 * dt; // gravity
        const frac = particleLife[i] / particleMaxLife[i];
        particleSizes[i] *= (0.95 + 0.05 * frac);
      }
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particleGeometry.attributes.size.needsUpdate = true;
    }

    let particleGeometry, particleSystem;
    function createParticleSystem(scene) {
      particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
      particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
      const pMat = new THREE.PointsMaterial({
        size: 0.5, vertexColors: true, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      particleSystem = new THREE.Points(particleGeometry, pMat);
      scene.add(particleSystem);
    }

    function emitExhaust(moto) {
      const pos = new THREE.Vector3(0, 0.4, 1.4).applyMatrix4(moto.mesh.matrixWorld);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2 + 1,
        Math.sin(moto.mesh.rotation.y) * moto.speed * 0.05
      );
      const c = new THREE.Color(COLORS.player === moto.color ? 0xffc15a : moto.color);
      emitParticle(pos, vel, c, 0.3 + Math.random() * 0.2, 0.4 + Math.random() * 0.3);
    }

    function emitBoostFlame(moto) {
      const pos = new THREE.Vector3(0, 0.5, 1.6).applyMatrix4(moto.mesh.matrixWorld);
      for (let j = 0; j < 3; j++) {
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 1.5,
          Math.cos(moto.mesh.rotation.y + Math.PI) * 8 + (Math.random() - 0.5) * 4
        );
        const c = new THREE.Color(Math.random() > 0.5 ? 0x56f0ff : 0x8dff65);
        emitParticle(pos, vel, c, 0.5 + Math.random() * 0.3, 0.25 + Math.random() * 0.15);
      }
    }

    function emitCollisionSparks(pos) {
      for (let j = 0; j < 15; j++) {
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          Math.random() * 10 + 3,
          (Math.random() - 0.5) * 20
        );
        const c = new THREE.Color(Math.random() > 0.3 ? 0xffc15a : 0xffffff);
        emitParticle(pos, vel, c, 0.2 + Math.random() * 0.3, 0.5 + Math.random() * 0.4);
      }
    }

    /* ================================================================
       RACER STATE
       ================================================================ */
    function createRacer(color, name, isPlayer) {
      const mesh = createMotorcycle(color);
      return {
        mesh,
        color,
        name,
        isPlayer,
        position: new THREE.Vector3(),
        rotation: 0,
        speed: 0,
        leanAngle: 0,
        steeringInput: 0,
        throttleInput: 0,
        brakeInput: 0,
        boostFuel: BOOST_MAX_FUEL,
        isBoosting: false,
        onTrack: true,
        trackProgress: 0,
        prevProgress: 0,
        lap: 0,
        lapStartTime: 0,
        bestLapTime: Infinity,
        totalProgress: 0,
        finishTime: 0,
        finished: false,
        // AI specific
        aiLookAhead: 0.03 + Math.random() * 0.02,
        aiSkill: isPlayer ? 1.0 : (0.75 + Math.random() * 0.2),
        aiRacingLine: (Math.random() - 0.5) * 0.5,
        aiBoostThreshold: 0.3 + Math.random() * 0.3,
      };
    }

    /* ================================================================
       PHYSICS
       ================================================================ */
    function updateRacerPhysics(racer, dt) {
      const maxSpd = racer.isBoosting ? BOOST_MAX_SPEED : MAX_SPEED;
      const effectiveMaxSpd = racer.isPlayer ? maxSpd : maxSpd * racer.aiSkill;

      // Throttle / brake
      if (racer.throttleInput > 0) {
        racer.speed += ACCELERATION * racer.throttleInput * dt;
      }
      if (racer.brakeInput > 0) {
        racer.speed -= BRAKING * racer.brakeInput * dt;
      }

      // Friction
      const fric = racer.onTrack ? FRICTION : OFF_TRACK_FRICTION;
      if (racer.speed > 0) {
        racer.speed = Math.max(0, racer.speed - fric * dt);
      } else {
        racer.speed = Math.min(0, racer.speed + fric * dt);
      }

      racer.speed = Math.min(racer.speed, effectiveMaxSpd);
      racer.speed = Math.max(racer.speed, -20); // reverse cap

      // Steering
      const speedFrac = Math.abs(racer.speed) / MAX_SPEED;
      const turnRate = THREE.MathUtils.lerp(TURN_RATE_LOW, TURN_RATE_HIGH, speedFrac);
      racer.rotation += racer.steeringInput * turnRate * dt * (racer.speed >= 0 ? 1 : -1);

      // Lean
      const targetLean = -racer.steeringInput * MAX_LEAN * Math.min(1, speedFrac * 2);
      racer.leanAngle = THREE.MathUtils.lerp(racer.leanAngle, targetLean, dt * 8);

      // Move
      const forward = new THREE.Vector3(-Math.sin(racer.rotation), 0, -Math.cos(racer.rotation));
      racer.position.addScaledVector(forward, racer.speed * dt);

      // Boost fuel
      if (racer.isBoosting && racer.boostFuel > 0) {
        racer.boostFuel = Math.max(0, racer.boostFuel - BOOST_DRAIN * dt);
        if (racer.boostFuel <= 0) racer.isBoosting = false;
      } else if (!racer.isBoosting) {
        racer.boostFuel = Math.min(BOOST_MAX_FUEL, racer.boostFuel + BOOST_REGEN * dt);
      }

      // Track boundary
      racer.onTrack = isOnTrack(racer.position);
      if (!racer.onTrack) {
        const { point, normal } = getClosestTrackPoint(racer.position);
        const dx = racer.position.x - point.x;
        const dz = racer.position.z - point.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const maxDist = TRACK_WIDTH * 0.5 + 3;
        if (dist > maxDist) {
          const pushBack = (dist - maxDist) * 0.5;
          racer.position.x -= (dx / dist) * pushBack;
          racer.position.z -= (dz / dist) * pushBack;
          racer.speed *= 0.95;
        }
      }

      // Sync mesh
      racer.mesh.position.copy(racer.position);
      racer.mesh.rotation.y = racer.rotation;
      racer.mesh.rotation.z = racer.leanAngle;

      // Track progress
      racer.prevProgress = racer.trackProgress;
      racer.trackProgress = getTrackProgressAt(racer.position);
    }

    function handleCollisions(racers) {
      for (let i = 0; i < racers.length; i++) {
        for (let j = i + 1; j < racers.length; j++) {
          const a = racers[i], b = racers[j];
          const dx = a.position.x - b.position.x;
          const dz = a.position.z - b.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < COLLISION_DIST && dist > 0.01) {
            const nx = dx / dist, nz = dz / dist;
            const overlap = (COLLISION_DIST - dist) * 0.5;
            a.position.x += nx * overlap;
            a.position.z += nz * overlap;
            b.position.x -= nx * overlap;
            b.position.z -= nz * overlap;
            a.speed *= 0.85;
            b.speed *= 0.85;
            const mid = new THREE.Vector3(
              (a.position.x + b.position.x) * 0.5,
              0.8,
              (a.position.z + b.position.z) * 0.5
            );
            emitCollisionSparks(mid);
          }
        }
      }
    }

    /* ================================================================
       AI LOGIC
       ================================================================ */
    function updateAI(racer, racers, dt) {
      // Use multiple look-ahead points for smoother cornering
      // Speed-based look-ahead: faster = further ahead
      const speedFactor = Math.max(0.3, racer.speed / MAX_SPEED);
      const lookAhead = racer.aiLookAhead + speedFactor * 0.04;

      // Target point on track ahead
      let targetT = (racer.trackProgress + lookAhead) % 1;
      const targetIdx = Math.floor(targetT * TRACK_SAMPLES) % TRACK_SAMPLES;
      const target = trackPoints[targetIdx].clone();

      // Racing line offset
      const normal = trackNormals[targetIdx];
      target.x += normal.x * racer.aiRacingLine * TRACK_WIDTH * 0.2;
      target.z += normal.z * racer.aiRacingLine * TRACK_WIDTH * 0.2;

      // Steer toward target using atan2 angle difference (much more stable)
      const dx = target.x - racer.position.x;
      const dz = target.z - racer.position.z;
      const desiredAngle = Math.atan2(-dx, -dz);

      // Normalize angle difference to [-PI, PI]
      let angleDiff = desiredAngle - racer.rotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      racer.steeringInput = THREE.MathUtils.clamp(angleDiff * 2.5, -1, 1);

      // Speed control based on curvature — look further ahead for braking
      const curvatureNear = getTrackCurvatureAt(racer.trackProgress);
      const curvatureAhead = getTrackCurvatureAt((racer.trackProgress + 0.05) % 1);
      const curvature = Math.max(curvatureNear, curvatureAhead);

      let targetSpeed;
      if (curvature > 0.25) {
        targetSpeed = MAX_SPEED * 0.35 * racer.aiSkill;
      } else if (curvature > 0.12) {
        targetSpeed = MAX_SPEED * 0.6 * racer.aiSkill;
      } else {
        targetSpeed = MAX_SPEED * racer.aiSkill;
      }

      if (racer.speed < targetSpeed * 0.9) {
        racer.throttleInput = 1;
        racer.brakeInput = 0;
      } else if (racer.speed > targetSpeed * 1.1) {
        racer.throttleInput = 0;
        racer.brakeInput = 0.7;
      } else {
        racer.throttleInput = 0.7;
        racer.brakeInput = 0;
      }

      // Boost on straights when going fast enough
      if (curvature < 0.05 && racer.speed > MAX_SPEED * 0.6 && racer.boostFuel > racer.aiBoostThreshold * BOOST_MAX_FUEL) {
        racer.isBoosting = true;
      } else {
        racer.isBoosting = false;
      }

      // Avoid nearby racers
      for (const other of racers) {
        if (other === racer) continue;
        const adx = racer.position.x - other.position.x;
        const adz = racer.position.z - other.position.z;
        const d = Math.sqrt(adx * adx + adz * adz);
        if (d < 5 && d > 0.1) {
          // Nudge steering away from nearby racer
          const avoidAngle = Math.atan2(-adx, -adz);
          let avoidDiff = racer.rotation - avoidAngle;
          while (avoidDiff > Math.PI) avoidDiff -= Math.PI * 2;
          while (avoidDiff < -Math.PI) avoidDiff += Math.PI * 2;
          racer.steeringInput += Math.sign(avoidDiff) * 0.3;
          racer.steeringInput = THREE.MathUtils.clamp(racer.steeringInput, -1, 1);
        }
      }

      // Rubber banding
      const playerRacer = racers.find(r => r.isPlayer);
      if (playerRacer) {
        const playerProgress = playerRacer.totalProgress;
        const aiProgress = racer.totalProgress;
        if (aiProgress > playerProgress + 0.5) {
          racer.throttleInput *= 0.85;
        } else if (aiProgress < playerProgress - 0.5) {
          racer.throttleInput = Math.min(1, racer.throttleInput * 1.15);
        }
      }
    }

    /* ================================================================
       LAP TRACKING
       ================================================================ */
    function updateLaps(racer, raceTime) {
      const prev = racer.prevProgress;
      const curr = racer.trackProgress;

      // Crossed start line forward
      if (prev > 0.9 && curr < 0.1) {
        if (racer.lap > 0) {
          const lapTime = raceTime - racer.lapStartTime;
          if (lapTime < racer.bestLapTime) racer.bestLapTime = lapTime;
        }
        racer.lap++;
        racer.lapStartTime = raceTime;
        if (racer.lap > TOTAL_LAPS && !racer.finished) {
          racer.finished = true;
          racer.finishTime = raceTime;
        }
      }

      // Update total progress for ranking
      racer.totalProgress = racer.lap + racer.trackProgress;
    }

    function detectWrongWay(racer) {
      const prev = racer.prevProgress;
      const curr = racer.trackProgress;
      if (prev < 0.1 && curr > 0.9) return true;
      const diff = curr - prev;
      if (Math.abs(diff) < 0.4 && diff < -0.01) return true;
      return false;
    }

    /* ================================================================
       INPUT
       ================================================================ */
    const input = {
      up: false, down: false, left: false, right: false, boost: false,
      // gesture
      gestureSteer: 0,
      gestureThrottle: false,
      gestureBrake: false,
      gestureBoost: false,
      hasHand: false,
      lastHandTime: 0,
    };

    // Use document-level listeners + e.key for WKWebView compatibility
    document.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { input.up = true; }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { input.down = true; }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { input.left = true; }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { input.right = true; }
      else if (k === ' ' || k === 'Spacebar') { input.boost = true; e.preventDefault(); }
      else if (k === 'r' || k === 'R') { restartRace(); }
      else if (k === 'Escape') { exitGame(); }
      else if (k === '1' && raceState === 'mapSelect') { window.selectMap(1); }
      else if (k === '2' && raceState === 'mapSelect') { window.selectMap(2); }
      else if (k === '3' && raceState === 'mapSelect') { window.selectMap(3); }
    });
    document.addEventListener('keyup', (e) => {
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') { input.up = false; }
      else if (k === 'ArrowDown' || k === 's' || k === 'S') { input.down = false; }
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { input.left = false; }
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') { input.right = false; }
      else if (k === ' ' || k === 'Spacebar') { input.boost = false; }
    });

    // Ensure the page can receive keyboard events in WKWebView
    document.body.setAttribute('tabindex', '0');
    document.body.focus();
    document.addEventListener('click', () => document.body.focus());

    function applyInput(racer) {
      const useGesture = input.hasHand && (performance.now() - input.lastHandTime < 300);

      if (useGesture) {
        racer.steeringInput = input.gestureSteer;
        racer.throttleInput = input.gestureThrottle ? 1 : 0.3;
        racer.brakeInput = input.gestureBrake ? 1 : 0;
        racer.isBoosting = input.gestureBoost && racer.boostFuel > 0;
      } else {
        racer.steeringInput = (input.left ? 1 : 0) + (input.right ? -1 : 0);
        racer.throttleInput = input.up ? 1 : 0;
        racer.brakeInput = input.down ? 1 : 0;
        racer.isBoosting = input.boost && racer.boostFuel > 0;
      }
    }

    /* ================================================================
       MEDIAPIPE (gesture control + camera preview + finger count)
       ================================================================ */
    let mediapipeLoaded = false;
    let detectedFingerCount = 0;
    let fingerCountStable = 0;
    let fingerCountStableTime = 0;
    const FINGER_HOLD_MS = 800; // hold gesture for 800ms to confirm map select

    async function initMediaPipe() {
      const camPreview = document.getElementById('camera-preview');
      const camVideo = document.getElementById('cam-video');
      const camOverlay = document.getElementById('cam-overlay');
      const camDot = document.getElementById('cam-dot');
      const camStatusText = document.getElementById('cam-status-text');
      const camGesture = document.getElementById('cam-gesture');
      const gestureHint = document.getElementById('gesture-select-hint');

      // Always show the camera preview panel
      camPreview.style.display = '';

      try {
        // 1. Check that CDN scripts loaded the globals
        if (typeof Hands !== 'function' || typeof Camera !== 'function') {
          camStatusText.textContent = 'Scripts failed';
          camDot.classList.remove('active');
          return;
        }

        // 2. Check if any video input device exists
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          if (videoInputs.length === 0) {
            camStatusText.textContent = 'No camera';
            camDot.classList.remove('active');
            return;
          }
        }

        // 3. Test camera access permission
        let testStream;
        try {
          testStream = await navigator.mediaDevices.getUserMedia({ video: true });
          testStream.getTracks().forEach(t => t.stop());
        } catch (accessErr) {
          const name = accessErr && accessErr.name ? accessErr.name : '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            camStatusText.textContent = 'Permission denied';
          } else if (name === 'NotReadableError') {
            camStatusText.textContent = 'Camera busy';
          } else {
            camStatusText.textContent = 'Unavailable';
          }
          camDot.classList.remove('active');
          return;
        }

        // 4. Camera available — init MediaPipe
        camStatusText.textContent = 'Loading...';

        const overlayCtx = camOverlay.getContext('2d');

        const hands = new Hands({
          locateFile: function(file) {
            return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' + file;
          }
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.55,
        });

        hands.onResults(function(results) {
          // Draw hand on overlay canvas
          camOverlay.width = camVideo.videoWidth || 320;
          camOverlay.height = camVideo.videoHeight || 240;
          overlayCtx.clearRect(0, 0, camOverlay.width, camOverlay.height);

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const lm = results.multiHandLandmarks[0];
            input.hasHand = true;
            input.lastHandTime = performance.now();

            // Draw hand landmarks on overlay
            drawHandLandmarks(overlayCtx, lm, camOverlay.width, camOverlay.height);

            // Steering from palm center
            const palmCenterX = (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5;
            const steer = THREE.MathUtils.clamp((palmCenterX - 0.5) * -2.5, -1, 1);
            input.gestureSteer = THREE.MathUtils.lerp(input.gestureSteer, steer, 0.3);

            // Finger classification
            const fingers = classifyFingers(lm);
            const openCount = fingers.filter(f => f).length;
            const allOpen = fingers.every(f => f);
            const allClosed = fingers.every(f => !f);
            const pinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) < 0.07;

            input.gestureThrottle = allOpen;
            input.gestureBrake = allClosed;
            input.gestureBoost = pinch && !allClosed;

            // Finger count for map selection (1-3 fingers)
            const thumbUp = fingers[0];
            const indexUp = fingers[1];
            const middleUp = fingers[2];
            const ringUp = fingers[3];
            const pinkyUp = fingers[4];
            let count = 0;
            if (indexUp && !middleUp && !ringUp && !pinkyUp) count = 1;        // ☝️ index only
            else if (indexUp && middleUp && !ringUp && !pinkyUp) count = 2;    // ✌️ index + middle
            else if (thumbUp && indexUp && !middleUp && !ringUp && pinkyUp) count = 3; // 🤟 thumb + index + pinky
            detectedFingerCount = count;

            // Stable hold detection for map select
            if (count > 0 && count === fingerCountStable) {
              const holdTime = performance.now() - fingerCountStableTime;
              if (holdTime >= FINGER_HOLD_MS && raceState === 'mapSelect') {
                selectMapFromGesture(count);
                fingerCountStable = 0; // reset
              }
            } else {
              fingerCountStable = count;
              fingerCountStableTime = performance.now();
            }

            camDot.classList.add('active');
            camStatusText.textContent = 'Tracking';
            camGesture.textContent = count > 0 ? \`\${count} finger\${count > 1 ? 's' : ''}\` : (allClosed ? 'Fist' : allOpen ? 'Open' : '');
          } else {
            input.hasHand = false;
            detectedFingerCount = 0;
            fingerCountStable = 0;
            camDot.classList.remove('active');
            camStatusText.textContent = 'No hand';
            camGesture.textContent = '';
            // Clear overlay
            overlayCtx.clearRect(0, 0, camOverlay.width, camOverlay.height);
          }
        });

        const mpCamera = new Camera(camVideo, {
          onFrame: async function() { await hands.send({ image: camVideo }); },
          width: 320, height: 240,
        });
        mpCamera.start();
        mediapipeLoaded = true;
        camStatusText.textContent = 'Ready';
        gestureHint.style.display = '';
      } catch (err) {
        console.warn('MediaPipe init failed:', err);
        camStatusText.textContent = 'Init failed';
        camDot.classList.remove('active');
      }
    }

    function drawHandLandmarks(ctx, lm, w, h) {
      // Draw connections
      const connections = [
        [0,1],[1,2],[2,3],[3,4],       // thumb
        [0,5],[5,6],[6,7],[7,8],       // index
        [5,9],[9,10],[10,11],[11,12],  // middle
        [9,13],[13,14],[14,15],[15,16],// ring
        [13,17],[17,18],[18,19],[19,20],// pinky
        [0,17],
      ];
      ctx.strokeStyle = 'rgba(86, 240, 255, 0.6)';
      ctx.lineWidth = 2;
      for (const [a, b] of connections) {
        ctx.beginPath();
        ctx.moveTo((1 - lm[a].x) * w, lm[a].y * h);
        ctx.lineTo((1 - lm[b].x) * w, lm[b].y * h);
        ctx.stroke();
      }
      // Draw points
      for (let i = 0; i < 21; i++) {
        ctx.beginPath();
        ctx.arc((1 - lm[i].x) * w, lm[i].y * h, 3, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#ffc15a' : '#56f0ff';
        ctx.fill();
      }
    }

    function classifyFingers(lm) {
      const thumbOpen = lm[4].x < lm[3].x;
      const indexOpen = lm[8].y < lm[6].y;
      const middleOpen = lm[12].y < lm[10].y;
      const ringOpen = lm[16].y < lm[14].y;
      const pinkyOpen = lm[20].y < lm[18].y;
      return [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen];
    }

    function selectMapFromGesture(mapId) {
      if (raceState !== 'mapSelect') return;
      if (mapId >= 1 && mapId <= 3) {
        // Visual feedback
        document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
        document.querySelector(\`.map-card[data-map="\${mapId}"]\`).classList.add('active');
        setTimeout(() => doSelectMap(mapId), 300);
      }
    }

    /* ================================================================
       SCENE SETUP
       ================================================================ */
    const canvas = document.getElementById('game-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04050b);
    scene.fog = new THREE.FogExp2(0x04050b, 0.004);

    // Camera
    const camera = new THREE.PerspectiveCamera(CAM_FOV_MIN, window.innerWidth / window.innerHeight, 0.5, 600);
    camera.position.set(0, 60, 100);

    // Lighting
    const ambient = new THREE.AmbientLight(0x111122, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x334466, 0.8);
    dirLight.position.set(30, 80, 40);
    scene.add(dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(2000, 2000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x04050b, roughness: 0.95, metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    // Grid for speed reference
    const grid = new THREE.GridHelper(2000, 200, 0x0a0e1a, 0x0a0e1a);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    scene.add(grid);

    // Stars
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 800;
      starPositions[i * 3 + 1] = 50 + Math.random() * 200;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x8899cc, size: 0.5, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // Build track — deferred until map selected
    // const trackLights = buildTrackMeshes(scene);

    // Particles
    createParticleSystem(scene);

    /* ================================================================
       CREATE RACERS
       ================================================================ */
    const racers = [];
    const player = createRacer(COLORS.player, 'YOU', true);
    racers.push(player);
    for (let i = 0; i < NUM_AI; i++) {
      racers.push(createRacer(AI_COLORS[i], AI_NAMES[i], false));
    }
    racers.forEach(r => scene.add(r.mesh));

    /* ================================================================
       RACE MANAGER
       ================================================================ */
    let raceState = 'mapSelect'; // 'mapSelect' | 'countdown' | 'racing' | 'finished'
    let raceTime = 0;
    let countdownTimer = 0;
    let countdownPhase = 0; // 0=waiting, 1=3, 2=2, 3=1, 4=GO
    let wrongWayTimer = 0;
    let finalLapShown = false;

    function placeRacersOnGrid() {
      // Place racers slightly behind the start line, facing forward along the track
      const startT = 0.98; // Slightly before start/finish line so first crossing triggers lap 1
      const startPoint = trackCurve.getPointAt(startT);
      const startTan = trackCurve.getTangentAt(startT).normalize();
      const startNormal = new THREE.Vector3().crossVectors(upVec, startTan).normalize();

      // Rotation: face along track tangent (forward direction)
      const startRot = Math.atan2(-startTan.x, -startTan.z);

      // Stagger positions: 2 columns, rows behind each other
      for (let i = 0; i < racers.length; i++) {
        const row = Math.floor(i / 2);
        const col = (i % 2) === 0 ? -1 : 1;
        // Place behind start, further back for later rows
        const backDist = row * 5 + 2;

        racers[i].position.set(
          startPoint.x - startTan.x * backDist + startNormal.x * col * 2.5,
          0,
          startPoint.z - startTan.z * backDist + startNormal.z * col * 2.5
        );
        racers[i].rotation = startRot;
        racers[i].speed = 0;
        racers[i].lap = 0;
        racers[i].trackProgress = getTrackProgressAt(racers[i].position);
        racers[i].prevProgress = racers[i].trackProgress;
        racers[i].totalProgress = 0;
        racers[i].finished = false;
        racers[i].finishTime = 0;
        racers[i].bestLapTime = Infinity;
        racers[i].boostFuel = BOOST_MAX_FUEL;
        racers[i].isBoosting = false;
        racers[i].leanAngle = 0;
        racers[i].steeringInput = 0;
        racers[i].throttleInput = 0;
        racers[i].brakeInput = 0;
        racers[i].mesh.position.copy(racers[i].position);
        racers[i].mesh.rotation.y = racers[i].rotation;
        racers[i].mesh.rotation.z = 0;
      }
    }

    // ---- Map selection ----
    window.selectMap = function(mapId) {
      if (raceState !== 'mapSelect') return;
      document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
      const card = document.querySelector(\`.map-card[data-map="\${mapId}"]\`);
      if (card) card.classList.add('active');
      setTimeout(() => doSelectMap(mapId), 200);
    };

    function doSelectMap(mapId) {
      if (selectedMap === mapId && trackCurve) {
        // Same map, just restart
        startCountdown();
        return;
      }
      selectedMap = mapId;
      buildTrackFromMap(mapId);
      document.getElementById('map-select-overlay').style.display = 'none';
      startCountdown();
    }

    function showMapSelect() {
      raceState = 'mapSelect';
      document.getElementById('map-select-overlay').style.display = '';
      document.getElementById('results-overlay').style.display = 'none';
      document.getElementById('countdown-overlay').style.display = 'none';
      // Draw previews
      drawTrackPreview('map-preview-1', 1);
      drawTrackPreview('map-preview-2', 2);
      drawTrackPreview('map-preview-3', 3);
    }

    function startCountdown() {
      raceState = 'countdown';
      raceTime = 0;
      countdownTimer = 0;
      countdownPhase = 0;
      finalLapShown = false;
      wrongWayTimer = 0;

      document.getElementById('map-select-overlay').style.display = 'none';
      placeRacersOnGrid();

      document.getElementById('results-overlay').style.display = 'none';
      document.getElementById('results-panel').classList.remove('show');
      document.getElementById('countdown-overlay').style.display = '';
      document.getElementById('controls-hint').classList.remove('hidden');
    }

    function updateCountdown(dt) {
      countdownTimer += dt;
      const el = document.getElementById('countdown-text');
      if (countdownTimer < 1) {
        if (countdownPhase !== 1) { countdownPhase = 1; el.textContent = '3'; el.className = 'countdown-text show'; }
      } else if (countdownTimer < 2) {
        if (countdownPhase !== 2) { countdownPhase = 2; el.textContent = '2'; el.className = 'countdown-text show'; }
      } else if (countdownTimer < 3) {
        if (countdownPhase !== 3) { countdownPhase = 3; el.textContent = '1'; el.className = 'countdown-text show'; }
      } else if (countdownTimer < 3.8) {
        if (countdownPhase !== 4) {
          countdownPhase = 4;
          el.textContent = 'GO!';
          el.className = 'countdown-text show go';
          raceState = 'racing';
          raceTime = 0;
        }
      } else {
        el.className = 'countdown-text';
        document.getElementById('countdown-overlay').style.display = 'none';
        // Hide controls hint after a few seconds
        setTimeout(() => {
          document.getElementById('controls-hint').classList.add('hidden');
        }, 5000);
      }
    }

    function checkRaceFinish() {
      if (player.finished && raceState === 'racing') {
        // Wait for all to finish or timeout
        const allDone = racers.every(r => r.finished);
        if (allDone || raceTime - player.finishTime > 15) {
          // Force-finish remaining
          racers.forEach(r => {
            if (!r.finished) { r.finished = true; r.finishTime = raceTime; }
          });
          showResults();
        }
      }
    }

    function showResults() {
      raceState = 'finished';

      const sorted = [...racers].sort((a, b) => a.finishTime - b.finishTime);
      const overlay = document.getElementById('results-overlay');
      const panel = document.getElementById('results-panel');
      const title = document.getElementById('results-title');
      const rows = document.getElementById('results-rows');

      const playerPos = sorted.findIndex(r => r.isPlayer) + 1;
      const medals = ['1st', '2nd', '3rd', '4th', '5th'];
      const titleColors = [null, 'var(--lime)', 'var(--cyan)', 'var(--amber)', 'var(--muted)', 'var(--muted)'];

      title.textContent = playerPos === 1 ? 'VICTORY!' : \`You finished \${medals[playerPos - 1]}!\`;
      title.style.color = titleColors[playerPos];

      rows.innerHTML = sorted.map((r, i) => {
        const colorHex = '#' + new THREE.Color(r.color).getHexString();
        const timeStr = formatTime(r.finishTime);
        const bestStr = r.bestLapTime < Infinity ? formatTime(r.bestLapTime) : '--';
        return \`<div class="results-row">
          <span class="name" style="color:\${colorHex}">\${medals[i]} \${r.name}</span>
          <span class="time">\${timeStr} (best: \${bestStr})</span>
        </div>\`;
      }).join('');

      overlay.style.display = '';
      requestAnimationFrame(() => panel.classList.add('show'));
    }

    function restartRace() {
      showMapSelect();
    }

    function exitGame() {
      const data = {
        type: 'exit',
        reason: raceState === 'finished' ? 'race_complete' : 'user_quit',
        data: {
          position: getRanking().findIndex(r => r.isPlayer) + 1,
          lap: player.lap,
          time: raceTime,
        },
      };
      if (typeof window.glimpse !== 'undefined' && window.glimpse.send) {
        window.glimpse.send(JSON.stringify(data));
      } else {
        window.close();
      }
    }

    /* ================================================================
       HUD UPDATES
       ================================================================ */
    function formatTime(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return \`\${m}:\${s < 10 ? '0' : ''}\${s.toFixed(3)}\`;
    }

    function getRanking() {
      return [...racers].sort((a, b) => b.totalProgress - a.totalProgress);
    }

    function updateHUD() {
      const lapDisplay = Math.min(Math.max(player.lap, 1), TOTAL_LAPS);
      document.getElementById('hud-lap').textContent = \`\${lapDisplay}/\${TOTAL_LAPS}\`;
      document.getElementById('hud-time').textContent = formatTime(raceTime);

      const ranking = getRanking();
      const pos = ranking.findIndex(r => r.isPlayer) + 1;
      document.getElementById('hud-pos').textContent = \`\${pos} / \${racers.length}\`;

      const displaySpeed = Math.abs(Math.round(player.speed * 2.2));
      document.getElementById('hud-speed').textContent = displaySpeed;
      document.getElementById('speed-fill').style.width = \`\${Math.min(100, (player.speed / MAX_SPEED) * 100)}%\`;
      document.getElementById('boost-fill').style.width = \`\${(player.boostFuel / BOOST_MAX_FUEL) * 100}%\`;

      // Wrong way
      if (raceState === 'racing' && detectWrongWay(player)) {
        wrongWayTimer = 1.5;
      }
      if (wrongWayTimer > 0) {
        document.getElementById('wrong-way').classList.add('show');
      } else {
        document.getElementById('wrong-way').classList.remove('show');
      }

      // Final lap
      if (player.lap === TOTAL_LAPS && !finalLapShown) {
        finalLapShown = true;
        const fl = document.getElementById('final-lap');
        fl.classList.add('show');
        setTimeout(() => fl.classList.remove('show'), 2500);
      }
    }

    /* ================================================================
       MINIMAP
       ================================================================ */
    const minimapCanvas = document.getElementById('minimap-canvas');
    const minimapCtx = minimapCanvas.getContext('2d');

    function drawMinimap() {
      const ctx = minimapCtx;
      const w = minimapCanvas.width;
      const h = minimapCanvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = 'rgba(4, 5, 11, 0.9)';
      ctx.fillRect(0, 0, w, h);

      // Find bounds of track
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const p of trackPoints) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      const pad = 15;
      const rangeX = maxX - minX + pad * 2;
      const rangeZ = maxZ - minZ + pad * 2;
      const scale = Math.min(w / rangeX, h / rangeZ) * 0.9;
      const offX = (w - rangeX * scale) * 0.5 - (minX - pad) * scale;
      const offY = (h - rangeZ * scale) * 0.5 - (minZ - pad) * scale;

      const tx = (x) => x * scale + offX;
      const ty = (z) => z * scale + offY;

      // Draw track line
      ctx.strokeStyle = '#2a3050';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i <= TRACK_SAMPLES; i++) {
        const p = trackPoints[i % TRACK_SAMPLES];
        if (i === 0) ctx.moveTo(tx(p.x), ty(p.z));
        else ctx.lineTo(tx(p.x), ty(p.z));
      }
      ctx.closePath();
      ctx.stroke();

      // Draw racers as dots
      for (const r of racers) {
        const colorHex = '#' + new THREE.Color(r.color).getHexString();
        const x = tx(r.position.x);
        const y = ty(r.position.z);
        const radius = r.isPlayer ? 5 : 3.5;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = colorHex;
        ctx.fill();

        if (r.isPlayer) {
          ctx.strokeStyle = colorHex;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    /* ================================================================
       CHASE CAMERA
       ================================================================ */
    const camTarget = new THREE.Vector3();
    const camLook = new THREE.Vector3();

    function updateCamera(dt) {
      const speedFrac = Math.abs(player.speed) / MAX_SPEED;

      // Desired position behind player
      const rot = player.rotation;
      const behind = new THREE.Vector3(
        Math.sin(rot) * CAM_OFFSET.z,
        CAM_OFFSET.y,
        Math.cos(rot) * CAM_OFFSET.z
      );
      const desired = player.position.clone().add(behind);

      // Smooth follow
      camTarget.lerp(desired, CAM_SMOOTHING + speedFrac * 0.02);
      camera.position.copy(camTarget);

      // Look ahead
      const forward = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
      const lookTarget = player.position.clone().addScaledVector(forward, CAM_LOOK_AHEAD);
      lookTarget.y = 2;
      camLook.lerp(lookTarget, 0.08);
      camera.lookAt(camLook);

      // Dynamic FOV
      const targetFov = THREE.MathUtils.lerp(CAM_FOV_MIN, CAM_FOV_MAX, speedFrac);
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 3);
      camera.updateProjectionMatrix();

      // Micro shake at high speed
      if (speedFrac > 0.8) {
        const intensity = (speedFrac - 0.8) * 5;
        camera.position.x += (Math.random() - 0.5) * intensity * 0.15;
        camera.position.y += (Math.random() - 0.5) * intensity * 0.08;
      }
    }

    /* ================================================================
       GAME LOOP
       ================================================================ */
    let lastTime = 0;
    let exhaustTimer = 0;

    function gameLoop(timestamp) {
      requestAnimationFrame(gameLoop);
      const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30);
      lastTime = timestamp;

      switch (raceState) {
        case 'mapSelect':
          // Just render the scene background (no track yet or existing track)
          renderer.render(scene, camera);
          break;

        case 'countdown':
          updateCountdown(dt);
          updateCamera(dt);
          // Animate track lights during countdown
          trackLights.forEach((l, i) => {
            l.intensity = 2 + Math.sin(timestamp * 0.003 + i) * 1.5;
          });
          renderer.render(scene, camera);
          break;

        case 'racing':
          raceTime += dt;
          wrongWayTimer = Math.max(0, wrongWayTimer - dt);

          // Player input
          applyInput(player);

          // AI — always give throttle, let AI logic control it
          for (const r of racers) {
            if (!r.isPlayer && !r.finished) updateAI(r, racers, dt);
          }

          // Physics for all
          for (const r of racers) {
            if (!r.finished) updateRacerPhysics(r, dt);
          }

          // Collisions
          handleCollisions(racers);

          // Laps
          for (const r of racers) {
            updateLaps(r, raceTime);
          }

          // Camera
          updateCamera(dt);

          // Particles
          exhaustTimer += dt;
          if (exhaustTimer > 0.06) {
            exhaustTimer = 0;
            for (const r of racers) {
              if (r.speed > 10) emitExhaust(r);
              if (r.isBoosting) emitBoostFlame(r);
            }
          }
          updateParticles(dt);

          // Animate track lights
          trackLights.forEach((l, i) => {
            l.intensity = 2 + Math.sin(timestamp * 0.002 + i * 0.8) * 1;
          });

          // Check finish
          checkRaceFinish();

          // HUD
          updateHUD();
          drawMinimap();
          renderer.render(scene, camera);
          break;

        case 'finished':
          updateCamera(dt);
          updateParticles(dt);
          // Slow down all racers
          for (const r of racers) {
            r.throttleInput = 0;
            r.brakeInput = 0.3;
            r.isBoosting = false;
            updateRacerPhysics(r, dt);
          }
          renderer.render(scene, camera);
          break;
      }
    }

    /* ================================================================
       RESIZE
       ================================================================ */
    window.addEventListener('resize', () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    /* ================================================================
       INIT
       ================================================================ */
    showMapSelect();
    requestAnimationFrame(gameLoop);

    // Try to init MediaPipe (non-blocking)
    initMediaPipe().catch(() => {});

  <\/script>
</body>
</html>
`;

function runWindow() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let summary = null;
    let win;

    try {
      win = open(html, {
        ...(width != null ? { width } : {}),
        ...(height != null ? { height } : {}),
        title,
        resizable: true,
      });
    } catch (error) {
      reject(error);
      return;
    }

    win.on('message', (data) => {
      if (data && data.type === 'exit') {
        summary = data;
        win.close();
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
  console.error(error instanceof Error ? error.message : 'Failed to launch moto-race');
  process.exit(1);
}
