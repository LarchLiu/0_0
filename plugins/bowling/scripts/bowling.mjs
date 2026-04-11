#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { open } from '@cloudgeek/glimpse';

const { values } = parseArgs({
  options: {
    width: { type: 'string' },
    height: { type: 'string' },
    title: { type: 'string', default: 'Bowling' },
  },
});

const width = values.width == null ? null : Number.parseInt(values.width, 10);
const height = values.height == null ? null : Number.parseInt(values.height, 10);
const title = values.title;

if (width != null && (!Number.isFinite(width) || width < 800)) {
  console.error('Invalid --width. Expected an integer >= 800.');
  process.exit(2);
}

if (height != null && (!Number.isFinite(height) || height < 600)) {
  console.error('Invalid --height. Expected an integer >= 600.');
  process.exit(2);
}

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bowling</title>
<style>
  :root {
    --bg: #121418;
    --bg-soft: #1a1f26;
    --lane: #c89b67;
    --lane-glow: #ffcc8a;
    --wood-dark: #8f6238;
    --teal: #4ed8c7;
    --cream: #f7f0df;
    --orange: #ff9f43;
    --red: #ff6b57;
    --ink: #192026;
    --panel: rgba(18, 24, 30, 0.78);
    --panel-border: rgba(255, 255, 255, 0.12);
    --muted: #b7c0ca;
    --shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  }

  * { box-sizing: border-box; }

  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    overflow: hidden;
    background:
      radial-gradient(circle at top, rgba(255, 204, 138, 0.14), transparent 30%),
      radial-gradient(circle at 15% 20%, rgba(78, 216, 199, 0.12), transparent 25%),
      linear-gradient(180deg, #232831 0%, #14181d 50%, #0d1014 100%);
    color: var(--cream);
    font-family: "Avenir Next", "Trebuchet MS", sans-serif;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    background:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
    background-size: 100% 3px, 80px 100%;
    opacity: 0.15;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  #app, #scene {
    position: absolute;
    inset: 0;
  }

  #scene canvas {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .topbar {
    position: absolute;
    inset: 18px 18px auto 18px;
    display: grid;
    grid-template-columns: minmax(260px, 380px) 1fr minmax(280px, 420px);
    gap: 16px;
    align-items: start;
    pointer-events: none;
  }

  .panel {
    background: var(--panel);
    border: 1px solid var(--panel-border);
    border-radius: 18px;
    box-shadow: var(--shadow);
    backdrop-filter: blur(20px);
  }

  .brand {
    padding: 16px 18px;
  }

  .eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.26em;
    color: var(--teal);
    margin-bottom: 8px;
  }

  .title {
    font-family: "Marker Felt", "Avenir Next Condensed", sans-serif;
    font-size: 34px;
    line-height: 1;
    margin-bottom: 10px;
    letter-spacing: 0.06em;
  }

  .subtitle {
    color: var(--muted);
    font-size: 14px;
    line-height: 1.45;
  }

  .score-strip {
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(10, minmax(56px, 1fr));
    gap: 8px;
  }

  .frame-box {
    min-height: 88px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 8px 8px 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .frame-box.active {
    border-color: rgba(78, 216, 199, 0.65);
    box-shadow: inset 0 0 0 1px rgba(78, 216, 199, 0.25);
  }

  .frame-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--muted);
  }

  .frame-rolls {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    font-size: 18px;
    font-weight: 700;
    min-height: 24px;
  }

  .frame-roll {
    min-width: 18px;
    text-align: center;
  }

  .frame-total {
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
  }

  .status-stack {
    display: grid;
    gap: 12px;
  }

  .status-card,
  .controls-card,
  .camera-card {
    padding: 14px 16px;
  }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat {
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.06);
  }

  .stat-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--muted);
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 800;
    line-height: 1;
  }

  .meter-header,
  .line-header,
  .camera-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .meter {
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 10px;
  }

  .meter-fill {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    transform: scaleX(0);
    background: linear-gradient(90deg, var(--teal), var(--orange), var(--red));
    box-shadow: 0 0 18px rgba(255, 159, 67, 0.35);
  }

  .shot-line {
    height: 14px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    position: relative;
  }

  .shot-sweet {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 42%;
    width: 16%;
    background: rgba(78, 216, 199, 0.22);
    border-inline: 1px solid rgba(78, 216, 199, 0.35);
  }

  .shot-marker {
    position: absolute;
    top: -4px;
    width: 14px;
    height: 20px;
    border-radius: 999px;
    background: linear-gradient(180deg, var(--cream), #ffd29d);
    box-shadow: 0 0 20px rgba(255, 209, 153, 0.4);
    transform: translateX(-50%);
  }

  .status-copy {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.45;
    min-height: 36px;
  }

  .camera-card {
    margin-top: 12px;
  }

  .camera-shell {
    position: relative;
    border-radius: 14px;
    overflow: hidden;
    height: 180px;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(255,255,255,0.08);
  }

  #video,
  #overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1);
  }

  #video::-webkit-media-controls { display: none !important; }
  #overlay { pointer-events: none; }

  .camera-fallback {
    position: absolute;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 16px;
    background: linear-gradient(180deg, rgba(16,22,28,0.86), rgba(6,8,10,0.94));
    color: var(--muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .controls-list {
    display: grid;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
  }

  .controls-list strong {
    color: var(--cream);
    font-weight: 700;
  }

  .control-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-top: 12px;
  }

  .control-btn {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.12);
    background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
    color: var(--cream);
    border-radius: 14px;
    padding: 12px 10px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
  }

  .control-btn:hover {
    border-color: rgba(78, 216, 199, 0.45);
    background: linear-gradient(180deg, rgba(78,216,199,0.12), rgba(255,255,255,0.04));
  }

  .control-btn:active,
  .control-btn.active {
    transform: translateY(1px) scale(0.99);
    border-color: rgba(255, 159, 67, 0.55);
    background: linear-gradient(180deg, rgba(255,159,67,0.18), rgba(255,255,255,0.05));
  }

  .control-btn.wide {
    grid-column: 1 / -1;
  }

  .footer {
    position: absolute;
    inset: auto 18px 18px 18px;
    display: grid;
    grid-template-columns: minmax(320px, 420px);
    gap: 16px;
    align-items: end;
    pointer-events: none;
  }

  .right-dock {
    position: fixed;
    right: 18px;
    bottom: 18px;
    width: min(340px, calc(100vw - 36px));
    display: grid;
    gap: 16px;
    z-index: 12;
    pointer-events: none;
  }

  .big-score,
  .frame-feed,
  .tip-card {
    padding: 14px 16px;
  }

  .frame-feed {
    pointer-events: none;
  }

  .tip-card {
    pointer-events: auto;
  }

  .big-score-value {
    font-size: 58px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .big-score-label,
  .feed-label,
  .tip-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .feed-items {
    display: grid;
    gap: 6px;
    font-size: 14px;
    color: var(--muted);
  }

  .tip-copy {
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }

  .banner {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    min-width: min(720px, calc(100vw - 80px));
    padding: 22px 28px;
    border-radius: 22px;
    background: linear-gradient(135deg, rgba(22,29,35,0.88), rgba(40,26,16,0.76));
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: var(--shadow);
    backdrop-filter: blur(20px);
    text-align: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease, transform 0.25s ease;
  }

  .banner.show {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  .banner-title {
    font-family: "Marker Felt", "Avenir Next Condensed", sans-serif;
    font-size: 42px;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
  }

  .banner-copy {
    font-size: 16px;
    line-height: 1.5;
    color: var(--muted);
  }

  .toast {
    position: absolute;
    left: 18px;
    top: 18px;
    display: grid;
    gap: 10px;
    width: min(360px, calc(100vw - 36px));
    pointer-events: none;
  }

  .toast-item {
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(18,24,30,0.88);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 14px 40px rgba(0,0,0,0.28);
    animation: fadeIn 180ms ease;
  }

  .toast-item strong {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    margin-bottom: 4px;
    color: var(--orange);
  }

  .toast-item span {
    font-size: 13px;
    line-height: 1.4;
    color: var(--muted);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 1200px) {
    .topbar,
    .footer {
      grid-template-columns: 1fr;
    }

    .right-dock {
      position: static;
      width: auto;
      z-index: auto;
      margin: 0 18px 18px;
    }

    .tip-card {
      position: static;
      width: auto;
      z-index: auto;
    }

    .score-strip {
      grid-template-columns: repeat(5, minmax(56px, 1fr));
    }

    .banner {
      min-width: calc(100vw - 36px);
    }
  }
</style>
</head>
<body>
  <div id="app">
    <div id="scene"></div>

    <div class="topbar">
      <section class="panel brand">
        <div class="eyebrow">Lane 07</div>
        <div class="title">Bowling Night</div>
        <div class="subtitle">Aim for the pocket, manage your charge, and finish a full ten-frame match. Camera controls are optional; keyboard controls always work.</div>
      </section>

      <section class="panel score-strip" id="score-strip"></section>

      <div class="status-stack">
        <section class="panel status-card">
          <div class="stat-row">
            <div class="stat">
              <div class="stat-label">Frame</div>
              <div class="stat-value" id="frame-value">1</div>
            </div>
            <div class="stat">
              <div class="stat-label">Roll</div>
              <div class="stat-value" id="roll-value">1</div>
            </div>
            <div class="stat">
              <div class="stat-label">Pins Left</div>
              <div class="stat-value" id="pins-left-value">10</div>
            </div>
          </div>

          <div class="meter-header"><span>Throw Power</span><span id="power-text">0%</span></div>
          <div class="meter"><div class="meter-fill" id="power-fill"></div></div>

          <div class="line-header"><span>Aim Line</span><span id="aim-text">Center</span></div>
          <div class="shot-line">
            <div class="shot-sweet"></div>
            <div class="shot-marker" id="aim-marker"></div>
          </div>

          <div class="status-copy" id="status-copy">Hold <strong>Space</strong> to charge, release to roll. Gesture play: open palm aims, claw charges, fist throws, OK continues.</div>
        </section>

        <section class="panel camera-card">
          <div class="camera-head"><span>Gesture Tracking</span><span id="gesture-label">Keyboard Only</span></div>
          <div class="camera-shell">
            <video id="video" playsinline muted></video>
            <canvas id="overlay"></canvas>
            <div class="camera-fallback" id="camera-fallback">Camera unavailable. You can still play the full game with keyboard controls.</div>
          </div>
        </section>
      </div>
    </div>

    <div class="right-dock">
      <section class="panel frame-feed">
        <div class="feed-label">Recent Rolls</div>
        <div class="feed-items" id="feed-items">
          <div>Frame 1 waiting for first ball.</div>
        </div>
      </section>

      <section class="panel tip-card">
        <div class="tip-label">Controls</div>
        <div class="controls-list">
          <div><strong>A / D</strong> move aim</div>
          <div><strong>Hold Space</strong> charge throw</div>
          <div><strong>Release Space</strong> roll ball</div>
          <div><strong>Enter / OK</strong> continue</div>
          <div><strong>R</strong> restart match</div>
        </div>
        <div class="control-grid">
          <button class="control-btn" id="aim-left-btn" type="button">Aim Left</button>
          <button class="control-btn" id="aim-right-btn" type="button">Aim Right</button>
          <button class="control-btn wide" id="charge-btn" type="button">Hold To Charge, Release To Roll</button>
          <button class="control-btn" id="next-btn" type="button">Next Roll / OK</button>
          <button class="control-btn" id="restart-btn" type="button">Restart</button>
        </div>
      </section>
    </div>

    <div class="banner show" id="banner">
      <div class="banner-title" id="banner-title">Ready To Bowl</div>
      <div class="banner-copy" id="banner-copy">Hold Space to charge your shot, then release to send the ball down the lane. Gesture play: open palm aims, claw charges, fist throws, and OK continues.</div>
    </div>

    <div class="toast" id="toast"></div>
    <div id="debugToasts" style="position:fixed;top:92px;left:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:480px;pointer-events:none;"></div>
  </div>

  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.min.js"}}<\/script>
  <script type="module">
    import * as THREE from 'three';
    window.THREE = THREE;
    window.dispatchEvent(new Event('three-ready'));
  <\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js"><\/script>
  <script>
    var debugToasts = document.getElementById('debugToasts');

    function showDebugToast(tag, message) {
      if (!debugToasts) {
        debugToasts = document.createElement('div');
        debugToasts.id = 'debugToasts';
        debugToasts.style.cssText = 'position:fixed;top:92px;left:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:480px;pointer-events:none;';
        document.body.appendChild(debugToasts);
      }
      var el = document.createElement('div');
      el.style.cssText = 'background:rgba(255,60,80,0.88);color:#fff;padding:10px 14px;border-radius:10px;font-size:12px;line-height:1.45;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:auto;word-break:break-word;';
      el.innerHTML = '<strong>[' + tag + ']</strong> ' + message;
      debugToasts.appendChild(el);
    }

    window.addEventListener('error', function(event) {
      showDebugToast('Error', (event.filename || '') + ':' + (event.lineno || '') + ' ' + (event.message || ''));
    });

    window.addEventListener('unhandledrejection', function(event) {
      var reason = event.reason;
      showDebugToast('Promise', reason && reason.message ? reason.message : String(reason));
    });

    function __bowlingBoot() {
    const THREE = window.THREE;
    if (!THREE) {
      showDebugToast('3D Init', 'window.THREE is missing before scene boot. Waiting for three-ready failed.');
      return;
    }
    const app = document.getElementById('app');
    const scoreStrip = document.getElementById('score-strip');
    const frameValueEl = document.getElementById('frame-value');
    const rollValueEl = document.getElementById('roll-value');
    const pinsLeftValueEl = document.getElementById('pins-left-value');
    const powerFillEl = document.getElementById('power-fill');
    const powerTextEl = document.getElementById('power-text');
    const aimTextEl = document.getElementById('aim-text');
    const aimMarkerEl = document.getElementById('aim-marker');
    const statusCopyEl = document.getElementById('status-copy');
    const feedItemsEl = document.getElementById('feed-items');
    const bannerEl = document.getElementById('banner');
    const bannerTitleEl = document.getElementById('banner-title');
    const bannerCopyEl = document.getElementById('banner-copy');
    const toastEl = document.getElementById('toast');
    const gestureLabelEl = document.getElementById('gesture-label');
    const aimLeftBtn = document.getElementById('aim-left-btn');
    const aimRightBtn = document.getElementById('aim-right-btn');
    const chargeBtn = document.getElementById('charge-btn');
    const nextBtn = document.getElementById('next-btn');
    const restartBtn = document.getElementById('restart-btn');
    const videoEl = document.getElementById('video');
    const overlayEl = document.getElementById('overlay');
    const cameraFallbackEl = document.getElementById('camera-fallback');
    const overlayCtx = overlayEl.getContext('2d');

    const laneHalfWidth = 2.45;
    const laneStartZ = 11.5;
    const pinDeckZ = -24.2;
    const gutterLimit = laneHalfWidth + 0.7;
    const pinSpacingX = 0.68;
    const pinSpacingZ = 0.82;

    const rollFeed = [];
    const keyState = {
      left: false,
      right: false,
    };

    const game = {
      currentFrame: 1,
      frameRoll: 1,
      firstRollPins: null,
      finalFrameRolls: [],
      pinsStanding: 10,
      rollStartPins: 10,
      rolls: [],
      throwPower: 0,
      chargeActive: false,
      chargeSource: null,
      aimX: 0,
      state: 'ready',
      lastOutcome: 'Opening ball',
      gameOver: false,
      totalScore: 0,
      message: 'Hold Space to charge, release to roll. Gesture play: open palm aims, claw charges, fist throws, OK continues.',
      camera: {
        enabled: false,
        aimNormalized: 0,
        gesture: 'No hand',
        isCharging: false,
        lastActionAt: 0,
      },
    };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0f1218, 0.028);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.set(0, 5.4, 14.5);
    camera.lookAt(0, 1.8, -10);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      showDebugToast('WebGL', 'WebGLRenderer init failed: ' + (error && error.message ? error.message : String(error)));
      throw error;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = 'none';
    document.getElementById('scene').appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xfff1d6, 0x243448, 1.25);
    scene.add(hemiLight);

    const spot = new THREE.SpotLight(0xffe2b8, 2.6, 90, Math.PI / 5.8, 0.45, 1.5);
    spot.position.set(0, 16, -8);
    spot.target.position.set(0, 0, -18);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 2048;
    spot.shadow.mapSize.height = 2048;
    scene.add(spot);
    scene.add(spot.target);

    const fillLight = new THREE.PointLight(0x4ed8c7, 1.2, 40, 2);
    fillLight.position.set(0, 5, 10);
    scene.add(fillLight);

    const laneGroup = new THREE.Group();
    scene.add(laneGroup);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 120),
      new THREE.MeshStandardMaterial({ color: 0x0d1014, roughness: 0.96, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 0.08, 44),
      new THREE.MeshStandardMaterial({ color: 0xc89b67, roughness: 0.38, metalness: 0.12 })
    );
    lane.position.set(0, 0.04, -6.5);
    lane.receiveShadow = true;
    lane.castShadow = false;
    laneGroup.add(lane);

    const oilStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 36),
      new THREE.MeshStandardMaterial({ color: 0xffd9a5, transparent: true, opacity: 0.14, roughness: 0.2, metalness: 0.5 })
    );
    oilStrip.rotation.x = -Math.PI / 2;
    oilStrip.position.set(0, 0.09, -9);
    laneGroup.add(oilStrip);

    const approach = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.06, 8),
      new THREE.MeshStandardMaterial({ color: 0x8f6238, roughness: 0.6, metalness: 0.05 })
    );
    approach.position.set(0, 0.03, 15.5);
    approach.receiveShadow = true;
    laneGroup.add(approach);

    const sideMat = new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.92, metalness: 0.05 });
    const railL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 44), sideMat);
    const railR = railL.clone();
    railL.position.set(-2.9, 0.2, -6.5);
    railR.position.set(2.9, 0.2, -6.5);
    laneGroup.add(railL, railR);

    const deckWall = new THREE.Mesh(
      new THREE.BoxGeometry(7, 4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1f252d, roughness: 0.88, metalness: 0.08 })
    );
    deckWall.position.set(0, 2, -28.8);
    deckWall.receiveShadow = true;
    laneGroup.add(deckWall);

    const logo = new THREE.Mesh(
      new THREE.TorusGeometry(1.2, 0.15, 18, 60),
      new THREE.MeshStandardMaterial({ color: 0x4ed8c7, emissive: 0x2e9489, roughness: 0.35 })
    );
    logo.position.set(0, 2.8, -28.4);
    logo.rotation.x = Math.PI / 2;
    laneGroup.add(logo);

    const laneMarkers = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const mark = new THREE.Mesh(
        new THREE.CircleGeometry(0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x5f4326, roughness: 0.6 })
      );
      mark.rotation.x = -Math.PI / 2;
      mark.position.set(-1.2 + (i % 3) * 1.2, 0.091, 10.8 - Math.floor(i / 3) * 1.2);
      laneMarkers.add(mark);
    }
    laneGroup.add(laneMarkers);

    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7f3f,
      roughness: 0.32,
      metalness: 0.18,
      emissive: 0x30150a,
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 40, 40), ballMaterial);
    ball.castShadow = true;
    ball.receiveShadow = true;
    scene.add(ball);

    const ballHoleMaterial = new THREE.MeshStandardMaterial({ color: 0x281b10, roughness: 0.8 });
    const ballHoles = [];
    [[0.11, 0.13, 0.26], [-0.02, 0.2, 0.21], [0.04, 0.03, 0.31]].forEach(function(pos) {
      const hole = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), ballHoleMaterial);
      hole.position.set(pos[0], pos[1], pos[2]);
      ball.add(hole);
      ballHoles.push(hole);
    });

    const arrow = new THREE.Group();
    const arrowShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 1.4, 16),
      new THREE.MeshStandardMaterial({ color: 0xf7f0df, emissive: 0x4a463a, roughness: 0.4 })
    );
    arrowShaft.rotation.z = Math.PI / 2;
    const arrowHead = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.34, 16),
      new THREE.MeshStandardMaterial({ color: 0xf7f0df, emissive: 0x4a463a, roughness: 0.4 })
    );
    arrowHead.rotation.z = -Math.PI / 2;
    arrowHead.position.x = 0.86;
    arrow.add(arrowShaft, arrowHead);
    arrow.position.set(0, 0.72, laneStartZ + 0.5);
    scene.add(arrow);

    const contactFlash = new THREE.PointLight(0xffc870, 0, 10, 2);
    contactFlash.position.set(0, 1.5, pinDeckZ);
    scene.add(contactFlash);

    const pinMaterial = new THREE.MeshStandardMaterial({ color: 0xf9f8f2, roughness: 0.42, metalness: 0.08 });
    const stripeMaterial = new THREE.MeshStandardMaterial({ color: 0xde3b36, roughness: 0.32, metalness: 0.08 });

    function createPin() {
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.82, 24), pinMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      body.position.y = 0.41;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.18, 24), pinMaterial);
      neck.position.y = 0.89;
      neck.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), pinMaterial);
      head.position.y = 1.05;
      head.castShadow = true;
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.165, 0.09, 24), stripeMaterial);
      stripe.position.y = 0.73;
      stripe.castShadow = true;
      group.add(body, neck, head, stripe);
      return group;
    }

    const pinLayout = [
      [0, 0],
      [-0.34, -pinSpacingZ], [0.34, -pinSpacingZ],
      [-pinSpacingX, -2 * pinSpacingZ], [0, -2 * pinSpacingZ], [pinSpacingX, -2 * pinSpacingZ],
      [-1.02, -3 * pinSpacingZ], [-0.34, -3 * pinSpacingZ], [0.34, -3 * pinSpacingZ], [1.02, -3 * pinSpacingZ],
    ];

    const pins = pinLayout.map(function(offset, index) {
      const mesh = createPin();
      const basePosition = new THREE.Vector3(offset[0], 0, pinDeckZ + offset[1]);
      mesh.position.copy(basePosition);
      scene.add(mesh);
      return {
        index,
        mesh,
        basePosition,
        standing: true,
        knockedAt: 0,
        velocity: new THREE.Vector3(),
        angularVelocity: new THREE.Vector3(),
      };
    });

    const ballState = {
      velocity: new THREE.Vector3(),
      rolling: false,
      settled: false,
      spin: 0,
      resultTimer: 0,
      throwResolved: false,
    };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function showBanner(title, copy) {
      bannerTitleEl.textContent = title;
      bannerCopyEl.innerHTML = copy;
      bannerEl.classList.add('show');
    }

    function hideBanner() {
      bannerEl.classList.remove('show');
    }

    function showToast(title, message) {
      const item = document.createElement('div');
      item.className = 'toast-item';
      item.innerHTML = '<strong>' + title + '</strong><span>' + message + '</span>';
      toastEl.appendChild(item);
      setTimeout(function() {
        item.remove();
      }, 2600);
    }

    function addRollFeed(text) {
      rollFeed.unshift(text);
      while (rollFeed.length > 4) rollFeed.pop();
      feedItemsEl.innerHTML = rollFeed.map(function(entry) { return '<div>' + entry + '</div>'; }).join('');
    }

    function symbolForRoll(pinsDown, isSecondBall, pinsBefore, isTenthExtra = false) {
      if (pinsDown == null) return '';
      if (pinsDown === 10 && (!isSecondBall || isTenthExtra || pinsBefore === 10)) return 'X';
      if (isSecondBall && pinsBefore != null && pinsBefore < 10 && pinsBefore + pinsDown === 10) return '/';
      if (pinsDown === 0) return '-';
      return String(pinsDown);
    }

    function calculateFrames() {
      const frames = [];
      let rollIndex = 0;
      let running = 0;

      for (let frame = 1; frame <= 10; frame += 1) {
        const first = game.rolls[rollIndex];
        if (first == null) {
          frames.push({ rolls: [], score: null });
          continue;
        }

        if (frame < 10) {
          if (first === 10) {
            const bonusA = game.rolls[rollIndex + 1];
            const bonusB = game.rolls[rollIndex + 2];
            const ready = bonusA != null && bonusB != null;
            const score = ready ? running + first + bonusA + bonusB : null;
            if (score != null) running = score;
            frames.push({
              rolls: ['X'],
              score,
            });
            rollIndex += 1;
          } else {
            const second = game.rolls[rollIndex + 1];
            const ready = second != null;
            let score = null;
            if (ready) {
              if (first + second === 10) {
                const bonus = game.rolls[rollIndex + 2];
                if (bonus != null) {
                  running += 10 + bonus;
                  score = running;
                }
              } else {
                running += first + second;
                score = running;
              }
            }
            frames.push({
              rolls: [symbolForRoll(first, false, 10), ready ? symbolForRoll(second, true, first) : ''],
              score,
            });
            rollIndex += 2;
          }
          continue;
        }

        const second = game.rolls[rollIndex + 1];
        const third = game.rolls[rollIndex + 2];
        const entries = [];
        entries.push(symbolForRoll(first, false, 10));
        if (second != null) {
          const secondPinsBefore = first === 10 ? 10 : first;
          entries.push(symbolForRoll(second, true, secondPinsBefore, first === 10));
        }
        if (third != null) {
          const secondValue = second == null ? 0 : second;
          const pinsBeforeThird = first === 10 && secondValue === 10 ? 10 : (first === 10 ? secondValue : 10);
          entries.push(symbolForRoll(third, true, pinsBeforeThird, true));
        }
        if (second != null) {
          const total = first + second + (third || 0);
          const allowThird = first === 10 || first + second === 10;
          if (!allowThird || third != null) {
            running += total;
            frames.push({ rolls: entries, score: running });
          } else {
            frames.push({ rolls: entries, score: null });
          }
        } else {
          frames.push({ rolls: entries, score: null });
        }
      }

      return frames;
    }

    function renderFrames() {
      const frames = calculateFrames();
      scoreStrip.innerHTML = '';
      frames.forEach(function(frame, index) {
        const box = document.createElement('div');
        box.className = 'frame-box' + (index + 1 === game.currentFrame && !game.gameOver ? ' active' : '');
        const rolls = frame.rolls.slice();
        while (rolls.length < (index === 9 ? 3 : 2)) rolls.push('');
        box.innerHTML =
          '<div class="frame-head"><span>F' + (index + 1) + '</span><span>' + (index === 9 ? 'Final' : '') + '</span></div>' +
          '<div class="frame-rolls">' + rolls.map(function(roll) { return '<div class="frame-roll">' + roll + '</div>'; }).join('') + '</div>' +
          '<div class="frame-total">' + (frame.score == null ? '' : frame.score) + '</div>';
        scoreStrip.appendChild(box);
      });
      const last = frames.filter(function(entry) { return entry.score != null; }).slice(-1)[0];
      game.totalScore = last ? last.score : 0;
    }

    function standingPinsCount() {
      return pins.filter(function(pin) { return pin.standing; }).length;
    }

    function resetPin(pin) {
      pin.mesh.position.copy(pin.basePosition);
      pin.mesh.rotation.set(0, 0, 0);
      pin.velocity.set(0, 0, 0);
      pin.angularVelocity.set(0, 0, 0);
      pin.standing = true;
      pin.knockedAt = 0;
      pin.mesh.visible = true;
    }

    function resetPins(fullRack) {
      pins.forEach(function(pin) {
        if (fullRack || pin.standing) {
          resetPin(pin);
        } else {
          pin.mesh.visible = false;
        }
      });
      game.pinsStanding = fullRack ? 10 : standingPinsCount();
    }

    function clearDownedPins() {
      pins.forEach(function(pin) {
        if (!pin.standing) {
          pin.mesh.visible = false;
        }
      });
    }

    function resetBall() {
      ball.position.set(game.aimX * laneHalfWidth, 0.32, laneStartZ);
      ball.rotation.set(0, 0, 0);
      ballState.velocity.set(0, 0, 0);
      ballState.rolling = false;
      ballState.settled = false;
      ballState.throwResolved = false;
      ballState.resultTimer = 0;
      ballState.spin = 0;
      arrow.visible = game.state === 'ready';
      arrow.position.set(ball.position.x, 0.72, laneStartZ + 0.55);
    }

    function resetForNewBall(fullRack) {
      if (fullRack) {
        resetPins(true);
      } else {
        clearDownedPins();
        game.pinsStanding = standingPinsCount();
      }
      resetBall();
      game.throwPower = 0;
      game.chargeActive = false;
      game.chargeSource = null;
      game.camera.isCharging = false;
      game.state = 'ready';
      game.message = 'Hold Space to charge, release to roll. Gesture play: open palm aims, claw charges, fist throws, OK continues.';
      hideBanner();
      updateHud();
    }

    function restartGame() {
      game.currentFrame = 1;
      game.frameRoll = 1;
      game.firstRollPins = null;
      game.finalFrameRolls = [];
      game.pinsStanding = 10;
      game.rollStartPins = 10;
      game.rolls = [];
      game.throwPower = 0;
      game.chargeActive = false;
      game.chargeSource = null;
      game.camera.isCharging = false;
      game.aimX = 0;
      game.state = 'ready';
      game.lastOutcome = 'Opening ball';
      game.gameOver = false;
      game.totalScore = 0;
      game.__nextSetup = null;
      game.message = 'Hold Space to charge, release to roll. Gesture play: open palm aims, claw charges, fist throws, OK continues.';
      rollFeed.length = 0;
      addRollFeed('Frame 1 waiting for first ball.');
      resetPins(true);
      resetBall();
      renderFrames();
      showBanner('Ready To Bowl', 'Hold <strong>Space</strong> to charge your shot, then release to send the ball down the lane. Gesture play: open palm aims, claw charges, fist throws, and OK continues.');
      updateHud();
    }

    function updateHud() {
      frameValueEl.textContent = String(game.currentFrame);
      rollValueEl.textContent = game.gameOver ? '-' : String(game.frameRoll);
      pinsLeftValueEl.textContent = String(game.pinsStanding);
      powerFillEl.style.transform = 'scaleX(' + clamp(game.throwPower, 0, 1) + ')';
      powerTextEl.textContent = Math.round(game.throwPower * 100) + '%';
      const aimPercent = ((game.aimX + 1) / 2) * 100;
      aimMarkerEl.style.left = aimPercent + '%';
      const label = game.aimX < -0.3 ? 'Left' : game.aimX > 0.3 ? 'Right' : 'Center';
      aimTextEl.textContent = label;
      statusCopyEl.innerHTML = game.message;
      gestureLabelEl.textContent = game.camera.enabled ? game.camera.gesture : 'Keyboard Only';
      renderFrames();
    }

    function knockPin(pin, impulse) {
      if (!pin.standing) return;
      pin.standing = false;
      pin.knockedAt = performance.now();
      pin.velocity.copy(impulse);
      pin.angularVelocity.set((Math.random() - 0.5) * 0.24, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.24);
    }

    function resolveCollisions() {
      let knockedAny = false;
      const ballRadius = 0.32;

      pins.forEach(function(pin) {
        if (!pin.standing || !pin.mesh.visible) return;
        const dx = pin.mesh.position.x - ball.position.x;
        const dz = pin.mesh.position.z - ball.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.46 + ballRadius) {
          knockedAny = true;
          const speed = ballState.velocity.length();
          const lateral = clamp(dx * 1.6 + (Math.random() - 0.5) * 0.1, -1.2, 1.2);
          const forward = clamp(-Math.abs(ballState.velocity.z) * 0.34 + dz * 0.3, -2.2, -0.3);
          knockPin(pin, new THREE.Vector3(lateral, 0.12 + speed * 0.05, forward));
          ballState.velocity.x *= 0.84;
          ballState.velocity.z *= 0.74;
          contactFlash.intensity = 2.2;
          contactFlash.position.set(pin.mesh.position.x, 1.5, pin.mesh.position.z);

          pins.forEach(function(other) {
            if (other === pin || !other.standing || !other.mesh.visible) return;
            const pd = pin.mesh.position.distanceTo(other.mesh.position);
            if (pd < 0.88) {
              knockPin(other, new THREE.Vector3((other.mesh.position.x - pin.mesh.position.x) * 0.9, 0.08, -0.6));
            }
          });
        }
      });

      if (knockedAny) {
        game.pinsStanding = standingPinsCount();
      }
    }

    function finishRoll() {
      if (ballState.throwResolved) return;
      ballState.throwResolved = true;

      const pinsAfter = standingPinsCount();
      const pinsBefore = game.rollStartPins;
      const pinsDown = Math.max(0, pinsBefore - pinsAfter);
      game.rolls.push(pinsDown);
      game.lastOutcome = pinsDown === 0 ? 'No pins' : (pinsDown === pinsBefore ? 'All clear' : pinsDown + ' pins');
      addRollFeed('Frame ' + game.currentFrame + ', roll ' + game.frameRoll + ': ' + pinsDown + ' pin' + (pinsDown === 1 ? '' : 's'));

      let advanceFrame = false;
      let fullRackNext = false;

      if (game.currentFrame < 10) {
        if (game.frameRoll === 1) {
          if (pinsDown === 10) {
            showBanner('Strike', 'You cleared the rack in one shot. Press <strong>Enter</strong> or show <strong>OK</strong> for the next frame.');
            game.message = 'Strike. Press Enter or show OK for the next frame.';
            advanceFrame = true;
            fullRackNext = true;
          } else {
            game.firstRollPins = pinsDown;
            game.frameRoll = 2;
            game.pinsStanding = pinsAfter;
            game.state = 'waiting';
            game.message = 'Press Enter or show OK for your second ball.';
            showBanner('Second Ball', 'Pins left: <strong>' + pinsAfter + '</strong>. Press <strong>Enter</strong> or show <strong>OK</strong> to reset the ball for roll two.');
            clearDownedPins();
          }
        } else {
          if (pinsAfter === 0) {
            showBanner('Spare', 'Clean finish. Press <strong>Enter</strong> or show <strong>OK</strong> for the next frame.');
            game.message = 'Spare. Press Enter or show OK for the next frame.';
          } else {
            showBanner('Frame Complete', 'You left <strong>' + pinsAfter + '</strong> pin' + (pinsAfter === 1 ? '' : 's') + '. Press <strong>Enter</strong> or show <strong>OK</strong> for the next frame.');
            game.message = 'Frame complete. Press Enter or show OK for the next frame.';
          }
          advanceFrame = true;
          fullRackNext = true;
        }
      } else {
        if (game.frameRoll === 1) {
          game.finalFrameRolls = [pinsDown];
          if (pinsDown === 10) {
            game.frameRoll = 2;
            showBanner('Strike', 'Final frame bonus ball active. Press <strong>Enter</strong> or show <strong>OK</strong> to bowl again.');
            game.message = 'Final frame strike. Press Enter or show OK for the bonus ball.';
            game.state = 'waiting';
            fullRackNext = true;
          } else {
            game.frameRoll = 2;
            game.pinsStanding = pinsAfter;
            clearDownedPins();
            showBanner('Final Frame', 'Press <strong>Enter</strong> or show <strong>OK</strong> for your second ball.');
            game.message = 'Final frame second ball ready. Press Enter or show OK.';
            game.state = 'waiting';
            fullRackNext = false;
          }
        } else if (game.frameRoll === 2) {
          const first = game.finalFrameRolls[0] == null ? 0 : game.finalFrameRolls[0];
          const second = pinsDown;
          game.finalFrameRolls[1] = second;
          if (first === 10) {
            game.frameRoll = 3;
            game.pinsStanding = pinsAfter;
            clearDownedPins();
            if (second === 10) {
              showBanner('Double Strike', 'Fresh rack for the last ball. Press <strong>Enter</strong> or show <strong>OK</strong> to continue.');
              game.message = 'Two strikes. Final bonus roll ready. Press Enter or show OK.';
              fullRackNext = true;
            } else {
              showBanner('One More Ball', 'Remaining pins stay in play. Press <strong>Enter</strong> or show <strong>OK</strong> for the last shot.');
              game.message = 'Final bonus roll uses the remaining pins. Press Enter or show OK.';
              fullRackNext = false;
            }
            game.state = 'waiting';
          } else if (first + second === 10) {
            game.frameRoll = 3;
            game.pinsStanding = pinsAfter;
            showBanner('Bonus Roll', 'You earned one more ball. Press <strong>Enter</strong> or show <strong>OK</strong> to continue.');
            game.message = 'Final bonus roll ready. Press Enter or show OK.';
            game.state = 'waiting';
            fullRackNext = true;
          } else {
            game.gameOver = true;
            game.state = 'game-over';
            showBanner('Game Over', 'Press <strong>R</strong> to start a fresh match.');
            game.message = 'Game complete. Press R to restart.';
          }
        } else {
          game.finalFrameRolls[2] = pinsDown;
          game.gameOver = true;
          game.state = 'game-over';
          showBanner('Game Over', 'Press <strong>R</strong> to start a fresh match.');
          game.message = 'Game complete. Press R to restart.';
        }
      }

      game.pinsStanding = pinsAfter;
      game.rollStartPins = game.pinsStanding;

      if (advanceFrame) {
        game.currentFrame += 1;
        game.frameRoll = 1;
        game.firstRollPins = null;
        game.pinsStanding = 10;
        game.state = 'waiting';
      }

      if (game.gameOver) {
        game.pinsStanding = 0;
      }

      updateHud();

      game.__nextSetup = { fullRack: fullRackNext || game.frameRoll === 1 };
    }

    function prepareNextRoll() {
      if (game.gameOver) return;
      const fullRack = game.__nextSetup ? !!game.__nextSetup.fullRack : game.frameRoll === 1;
      game.__nextSetup = null;
      resetForNewBall(fullRack);
    }

    function launchBall() {
      if (game.state !== 'ready' || game.gameOver) return;
      const power = clamp(game.throwPower, 0.12, 1);
      const lateral = game.aimX * 1.2;
      ballState.velocity.set(lateral, 0, -12 - power * 10.5);
      ballState.rolling = true;
      ballState.throwResolved = false;
      ballState.resultTimer = 0;
      ballState.spin = 16 + power * 24;
      game.rollStartPins = game.pinsStanding;
      game.state = 'rolling';
      game.message = 'Ball in motion. Watch the pocket.';
      arrow.visible = false;
      hideBanner();
      updateHud();
    }

    function queueExit() {
      const payload = {
        type: 'exit',
        status: 'closed',
        reason: game.gameOver ? 'game_complete' : 'user_quit',
        data: {
          score: game.totalScore || 0,
          frame: game.currentFrame,
          roll: game.frameRoll,
        },
      };
      if (typeof window.glimpse !== 'undefined' && typeof window.glimpse.send === 'function') {
        window.glimpse.send(payload);
      } else {
        window.close();
      }
    }

    function focusGameSurface() {
      if (document.body) {
        document.body.tabIndex = -1;
      }
      if (typeof window.focus === 'function') {
        window.focus();
      }
      if (renderer.domElement && typeof renderer.domElement.focus === 'function') {
        renderer.domElement.focus({ preventScroll: true });
      } else if (document.body && typeof document.body.focus === 'function') {
        document.body.focus({ preventScroll: true });
      }
    }

    function isSpaceLike(event) {
      return event.key === ' ' || event.key === 'Spacebar' || event.key === 'Space' || event.code === 'Space';
    }

    function setCharging(active, source) {
      if (game.gameOver || game.state !== 'ready') return;
      if (active) {
        if (!game.chargeActive) {
          game.chargeActive = true;
          game.chargeSource = source;
        }
        return;
      }
      if (game.chargeActive && game.chargeSource === source) {
        game.chargeActive = false;
        game.chargeSource = null;
        launchBall();
      }
    }

    function cancelCharging(source, resetPower) {
      if (!game.chargeActive || game.chargeSource !== source) return;
      game.chargeActive = false;
      game.chargeSource = null;
      if (resetPower) {
        game.throwPower = 0;
      }
    }

    function updateAim(delta, source = 'keyboard') {
      if (game.state !== 'ready') return;
      game.aimX = clamp(game.aimX + delta, -1, 1);
      if (source === 'camera') {
        arrow.rotation.y = -game.aimX * 0.22;
      }
    }

    function onKeyDown(event) {
      if (event.repeat) return;
      if (event.key === 'ArrowLeft' || event.code === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.code === 'KeyA') {
        keyState.left = true;
      } else if (event.key === 'ArrowRight' || event.code === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.code === 'KeyD') {
        keyState.right = true;
      } else if (isSpaceLike(event)) {
        event.preventDefault();
        setCharging(true, 'keyboard');
      } else if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') {
        if (game.state === 'waiting') {
          prepareNextRoll();
        }
      } else if (event.key === 'r' || event.key === 'R' || event.code === 'KeyR') {
        restartGame();
      } else if (event.key === 'Escape' || event.code === 'Escape') {
        queueExit();
      }
    }

    function onKeyUp(event) {
      if (event.key === 'ArrowLeft' || event.code === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.code === 'KeyA') {
        keyState.left = false;
      } else if (event.key === 'ArrowRight' || event.code === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.code === 'KeyD') {
        keyState.right = false;
      } else if (isSpaceLike(event)) {
        event.preventDefault();
        setCharging(false, 'keyboard');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', focusGameSurface);
    window.addEventListener('mousedown', focusGameSurface);

    function bindButtonPress(button, onPress, onRelease) {
      if (!button) return;

      const press = function(event) {
        event.preventDefault();
        focusGameSurface();
        button.classList.add('active');
        onPress();
      };

      const release = function(event) {
        event.preventDefault();
        button.classList.remove('active');
        if (onRelease) onRelease();
      };

      button.addEventListener('mousedown', press);
      button.addEventListener('mouseup', release);
      button.addEventListener('mouseleave', release);
      button.addEventListener('touchstart', press, { passive: false });
      button.addEventListener('touchend', release, { passive: false });
      button.addEventListener('touchcancel', release, { passive: false });
    }

    aimLeftBtn.addEventListener('click', function(event) {
      event.preventDefault();
      focusGameSurface();
      updateAim(-0.16, 'mouse');
      updateHud();
    });

    aimRightBtn.addEventListener('click', function(event) {
      event.preventDefault();
      focusGameSurface();
      updateAim(0.16, 'mouse');
      updateHud();
    });

    nextBtn.addEventListener('click', function(event) {
      event.preventDefault();
      focusGameSurface();
      if (game.state === 'waiting') {
        prepareNextRoll();
      }
    });

    restartBtn.addEventListener('click', function(event) {
      event.preventDefault();
      focusGameSurface();
      restartGame();
    });

    bindButtonPress(
      chargeBtn,
      function() { setCharging(true, 'mouse'); },
      function() { setCharging(false, 'mouse'); }
    );

    function resizeOverlay() {
      const rect = overlayEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      overlayEl.width = Math.max(1, Math.round(rect.width * dpr));
      overlayEl.height = Math.max(1, Math.round(rect.height * dpr));
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawLandmarks(points) {
      const rect = overlayEl.getBoundingClientRect();
      overlayCtx.clearRect(0, 0, rect.width, rect.height);
      overlayCtx.strokeStyle = 'rgba(78, 216, 199, 0.9)';
      overlayCtx.fillStyle = 'rgba(255, 240, 220, 0.92)';
      overlayCtx.lineWidth = 2;
      const connections = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [5,9],[9,10],[10,11],[11,12],
        [9,13],[13,14],[14,15],[15,16],
        [13,17],[17,18],[18,19],[19,20],
        [0,17]
      ];
      connections.forEach(function(pair) {
        var a = pair[0];
        var b = pair[1];
        const pa = points[a];
        const pb = points[b];
        overlayCtx.beginPath();
        overlayCtx.moveTo((1 - pa.x) * rect.width, pa.y * rect.height);
        overlayCtx.lineTo((1 - pb.x) * rect.width, pb.y * rect.height);
        overlayCtx.stroke();
      });
      points.forEach(function(point) {
        overlayCtx.beginPath();
        overlayCtx.arc((1 - point.x) * rect.width, point.y * rect.height, 3.2, 0, Math.PI * 2);
        overlayCtx.fill();
      });
    }

    function fingerExtended(points, tip, pip) {
      return points[tip].y < points[pip].y - 0.03;
    }

    function landmarkDistance(a, b) {
      var dx = a.x - b.x;
      var dy = a.y - b.y;
      var dz = (a.z || 0) - (b.z || 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function getPalmCenterX(points) {
      var indexes = [0, 5, 9, 13, 17];
      var sum = 0;
      var i;
      for (i = 0; i < indexes.length; i += 1) {
        sum += points[indexes[i]].x;
      }
      return sum / indexes.length;
    }

    function detectGesture(points) {
      const wrist = points[0];
      const thumbIndexDist = landmarkDistance(points[4], points[8]);
      const indexExtended = fingerExtended(points, 8, 6);
      const middleExtended = fingerExtended(points, 12, 10);
      const ringExtended = fingerExtended(points, 16, 14);
      const pinkyExtended = fingerExtended(points, 20, 18);
      const indexCurled = points[8].y > points[6].y - 0.005;
      const middleCurled = points[12].y > points[10].y - 0.005;
      const ringCurled = points[16].y > points[14].y - 0.005;
      const pinkyCurled = points[20].y > points[18].y - 0.005;
      const curledCount = [indexCurled, middleCurled, ringCurled, pinkyCurled].filter(Boolean).length;

      const fistSpread = Math.abs(points[8].x - wrist.x) + Math.abs(points[12].x - wrist.x) + Math.abs(points[16].x - wrist.x) + Math.abs(points[20].x - wrist.x);
      const fistCurl = indexCurled && middleCurled && ringCurled && pinkyCurled;
      const avgTipToMcp = (
        landmarkDistance(points[8], points[5]) +
        landmarkDistance(points[12], points[9]) +
        landmarkDistance(points[16], points[13]) +
        landmarkDistance(points[20], points[17])
      ) / 4;
      const isFist = fistCurl && fistSpread < 0.28 && avgTipToMcp < 0.16;
      const isOpen = indexExtended && middleExtended && ringExtended && pinkyExtended;
      const isOk = thumbIndexDist < 0.065 && middleExtended && ringExtended && pinkyExtended;
      const isClaw = !isOk && !isOpen && !isFist && curledCount >= 3 && avgTipToMcp >= 0.16 && avgTipToMcp <= 0.3;
      if (isOk) return 'OK';
      if (isClaw) return 'Claw';
      if (isOpen) return 'Open Palm';
      if (isFist) return 'Fist';
      return 'Tracking';
    }

    async function initMediaPipe() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        game.camera.enabled = false;
        game.camera.gesture = 'Keyboard Only';
        cameraFallbackEl.style.display = 'flex';
        showDebugToast('Camera', 'navigator.mediaDevices.getUserMedia is not available in this WebView context.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user',
          }
        });
        videoEl.srcObject = stream;
        await videoEl.play();
        cameraFallbackEl.style.display = 'none';
      } catch (error) {
        game.camera.enabled = false;
        game.camera.gesture = 'Keyboard Only';
        cameraFallbackEl.style.display = 'flex';
        showDebugToast('Camera', (error && error.name ? error.name + ': ' : '') + (error && error.message ? error.message : String(error)));
        return;
      }

      const hasHands = typeof Hands === 'function';
      const hasCameraHelper = typeof Camera === 'function';

      if (!hasHands) {
        game.camera.enabled = false;
        game.camera.gesture = 'Keyboard Only';
        showDebugToast('MediaPipe', 'Hands=' + hasHands + ' Camera=' + hasCameraHelper + '. CDN scripts may have failed to load.');
        return;
      }

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
        overlay.width = videoEl.videoWidth || 640;
        overlay.height = videoEl.videoHeight || 480;
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const points = results.multiHandLandmarks[0];
          drawLandmarks(points);

          game.camera.enabled = true;
          cameraFallbackEl.style.display = 'none';

          const gesture = detectGesture(points);
          game.camera.gesture = gesture;
          const x = clamp((1 - getPalmCenterX(points) - 0.5) / 0.28, -1, 1);
          game.camera.aimNormalized = x;
          if (game.state === 'ready' && gesture === 'Open Palm') {
            game.aimX = x;
          }

          if (game.state === 'waiting') {
            if (gesture === 'OK' && performance.now() - game.camera.lastActionAt > 900) {
              game.camera.lastActionAt = performance.now();
              prepareNextRoll();
            }
            if (game.camera.isCharging || game.chargeSource === 'camera') {
              game.camera.isCharging = false;
              cancelCharging('camera', true);
            }
          } else if (game.state === 'ready' && gesture === 'Claw') {
            game.camera.isCharging = true;
            setCharging(true, 'camera');
          } else if (game.state === 'ready' && gesture === 'Fist') {
            if (game.camera.isCharging || game.chargeSource === 'camera') {
              game.camera.isCharging = false;
              setCharging(false, 'camera');
            }
          } else if (game.camera.isCharging || game.chargeSource === 'camera') {
            game.camera.isCharging = false;
            cancelCharging('camera', true);
          }

          updateHud();
          return;
        }

        game.camera.gesture = 'No hand';
        game.camera.isCharging = false;
        cancelCharging('camera', true);
        updateHud();
      });

      showToast('Camera Ready', 'Gesture aim enabled. Open palm aims, claw charges, fist throws, OK advances to the next roll.');

      if (hasCameraHelper) {
        const cam = new Camera(videoEl, {
          onFrame: async function() {
            await hands.send({ image: videoEl });
          },
          width: 640,
          height: 480,
        });
        cam.start();
        return;
      }

      let trackingActive = true;
      const processFrame = async function() {
        if (!trackingActive) return;
        if (!videoEl.srcObject) {
          trackingActive = false;
          return;
        }
        if (videoEl.readyState >= 2) {
          await hands.send({ image: videoEl });
        }
        requestAnimationFrame(function() {
          processFrame().catch(function(error) {
            showDebugToast('Camera', error && error.message ? error.message : String(error));
          });
        });
      };

      processFrame().catch(function(error) {
        showDebugToast('Camera', error && error.message ? error.message : String(error));
      });
    }

    let lastFrameTime = performance.now();

    function tick(now) {
      const dt = Math.min(0.032, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      if (game.state === 'ready') {
        const axis = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
        if (axis !== 0) {
          game.aimX = clamp(game.aimX + axis * dt * 1.25, -1, 1);
        }
        if (game.chargeActive) {
          game.throwPower += dt * 0.62;
          if (game.throwPower >= 1) {
            game.throwPower = 0.18;
          }
        } else {
          game.throwPower = Math.max(0, game.throwPower - dt * 0.3);
        }
        ball.position.x = game.aimX * laneHalfWidth;
        arrow.position.x = ball.position.x;
        arrow.rotation.y = -game.aimX * 0.22;
        arrow.visible = true;
        logo.rotation.z += dt * 0.4;
      }

      if (ballState.rolling) {
        ball.position.addScaledVector(ballState.velocity, dt);
        ball.rotation.x -= ballState.spin * dt;
        ball.rotation.z += ballState.velocity.x * dt * 2.5;

        ballState.velocity.z += 2.4 * dt;
        ballState.velocity.x *= 1 - dt * 1.4;
        if (Math.abs(ball.position.x) > gutterLimit) {
          ballState.velocity.x *= 0.88;
          ballState.velocity.z *= 0.96;
        }

        resolveCollisions();

        if (ball.position.z < pinDeckZ - 3.8 || ballState.velocity.length() < 1.1) {
          ballState.resultTimer += dt;
          if (ballState.resultTimer > 0.7) {
            ballState.rolling = false;
            finishRoll();
          }
        }
      }

      pins.forEach(function(pin) {
        if (!pin.mesh.visible) return;
        if (!pin.standing) {
          pin.mesh.position.addScaledVector(pin.velocity, dt);
          pin.velocity.multiplyScalar(1 - dt * 2.4);
          pin.velocity.y = Math.max(pin.velocity.y - 3.2 * dt, -1.6);
          pin.mesh.rotation.x += pin.angularVelocity.x;
          pin.mesh.rotation.y += pin.angularVelocity.y;
          pin.mesh.rotation.z += pin.angularVelocity.z;
          pin.angularVelocity.multiplyScalar(1 - dt * 2.2);
          if (pin.mesh.position.y <= 0) {
            pin.mesh.position.y = 0;
            pin.velocity.y = 0;
          }
        }
      });

      contactFlash.intensity *= 0.9;
      updateHud();
      renderer.render(scene, camera);
      window.requestAnimationFrame(tick);
    }

    window.addEventListener('resize', function() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      resizeOverlay();
    });

    restartGame();
    focusGameSurface();
    initMediaPipe();
    window.requestAnimationFrame(tick);
    }

    if (window.THREE) {
      __bowlingBoot();
    } else {
      window.addEventListener('three-ready', __bowlingBoot, { once: true });
      setTimeout(function() {
        if (!window.THREE) {
          showDebugToast('3D Load', 'three.js ESM module failed to load after 10s. Check network or WebView script policy.');
        }
      }, 10000);
    }
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
  console.error(error instanceof Error ? error.message : 'Failed to launch bowling');
  process.exit(1);
}
