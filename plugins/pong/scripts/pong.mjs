#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { open } from '@cloudgeek/glimpse';

const { values } = parseArgs({
  options: {
    width: { type: 'string' },
    height: { type: 'string' },
    title: { type: 'string', default: 'Gesture Pong' },
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
<title>Gesture Pong</title>
<style>
  :root {
    --bg-0: #04050b;
    --bg-1: #0c1022;
    --panel: rgba(8, 12, 26, 0.78);
    --panel-border: rgba(130, 180, 255, 0.2);
    --cyan: #56f0ff;
    --lime: #8dff65;
    --magenta: #ff5ea9;
    --amber: #ffc15a;
    --text: #f4f7ff;
    --muted: #94a4c8;
    --danger: #ff7a94;
    --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    color: var(--text);
    background:
      radial-gradient(circle at 20% 15%, rgba(86, 240, 255, 0.18), transparent 30%),
      radial-gradient(circle at 78% 18%, rgba(255, 94, 169, 0.14), transparent 32%),
      radial-gradient(circle at 50% 100%, rgba(141, 255, 101, 0.08), transparent 36%),
      linear-gradient(180deg, var(--bg-1), var(--bg-0));
    font-family: "Avenir Next", "Segoe UI", sans-serif;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    background:
      linear-gradient(rgba(255, 255, 255, 0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
    background-size: 100% 3px, 72px 100%;
    mix-blend-mode: screen;
    opacity: 0.16;
    pointer-events: none;
  }

  #app {
    position: relative;
    width: 100%;
    height: 100%;
  }

  #scene {
    position: absolute;
    inset: 0;
  }

  #scene canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }

  .hud {
    position: absolute;
    inset: 18px 18px auto 18px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
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
    min-width: 340px;
    max-width: 520px;
  }

  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--cyan);
    margin-bottom: 8px;
  }

  .title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .subtitle {
    font-size: 14px;
    line-height: 1.45;
    color: var(--muted);
  }

  .scoreboard {
    display: flex;
    align-items: stretch;
    padding: 10px;
    gap: 10px;
  }

  .score-box {
    min-width: 118px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.035);
    text-align: center;
  }

  .score-label {
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  .score-value {
    font-size: 44px;
    font-weight: 800;
    line-height: 1;
  }

  .score-divider {
    display: flex;
    align-items: center;
    font-size: 22px;
    color: rgba(255, 255, 255, 0.35);
    padding: 0 6px;
  }

  .footer {
    position: absolute;
    inset: auto 18px 18px 18px;
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(260px, 320px) minmax(320px, 1fr);
    gap: 16px;
    align-items: end;
    transition: transform 0.35s ease, opacity 0.35s ease;
  }

  .footer.collapsed {
    transform: translateY(calc(100% + 18px));
    opacity: 0;
    pointer-events: none;
  }

  .tracker {
    padding: 12px;
  }

  .tracker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-bottom: 10px;
    color: var(--muted);
  }

  .tracker-header strong {
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text);
  }

  .camera-shell {
    position: relative;
    height: 214px;
    overflow: hidden;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.42);
    border: 1px solid rgba(255, 255, 255, 0.08);
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

  #overlay {
    pointer-events: none;
  }

  .camera-fallback {
    position: absolute;
    inset: 0;
    display: none;
    padding: 18px;
    align-items: center;
    justify-content: center;
    text-align: center;
    background:
      radial-gradient(circle at top, rgba(255, 122, 148, 0.18), transparent 48%),
      linear-gradient(180deg, rgba(10, 13, 28, 0.88), rgba(6, 8, 18, 0.96));
  }

  .camera-fallback h3 {
    margin: 0 0 8px;
    font-size: 22px;
  }

  .camera-fallback p {
    margin: 0;
    color: var(--muted);
    line-height: 1.45;
  }

  .status-card,
  .control-card {
    padding: 14px 16px;
  }

  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .pill {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .charge-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--text);
    margin-bottom: 10px;
  }

  .charge-bar {
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .charge-fill {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    transform: scaleX(0);
    background: linear-gradient(90deg, var(--cyan), var(--lime), var(--amber));
    box-shadow: 0 0 24px rgba(86, 240, 255, 0.45);
  }

  .helper {
    margin-top: 12px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .helper strong {
    color: var(--text);
  }

  .button-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  button {
    appearance: none;
    border: 0;
    border-radius: 14px;
    padding: 13px 14px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    color: #041018;
    background: linear-gradient(135deg, #e8f7ff, #56f0ff);
    box-shadow: 0 12px 28px rgba(86, 240, 255, 0.2);
    transition: transform 0.14s ease, box-shadow 0.14s ease, opacity 0.14s ease;
  }

  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 30px rgba(86, 240, 255, 0.28);
  }

  button:active {
    transform: translateY(1px);
  }

  button.alt {
    color: var(--text);
    background: linear-gradient(135deg, rgba(255, 94, 169, 0.82), rgba(255, 122, 148, 0.72));
    box-shadow: 0 12px 28px rgba(255, 94, 169, 0.18);
  }

  button.ghost {
    color: var(--text);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 1120px) {
    .hud {
      inset: 12px 12px auto 12px;
      flex-direction: column;
      align-items: stretch;
    }

    .brand {
      min-width: 0;
      max-width: none;
    }

    .footer {
      inset: auto 12px 12px 12px;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .camera-shell {
      height: 180px;
    }
  }
</style>
</head>
<body>
  <div id="app">
    <div id="scene"></div>
    <div id="debugToasts" style="position:fixed;top:60px;right:18px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:480px;pointer-events:none;"></div>

    <div class="hud">
      <div class="panel brand">
        <div class="eyebrow">Gesture-Controlled Arcade</div>
        <div class="title">Pong / Hand Tracking</div>
        <div class="subtitle" id="subtitle">
          Move your hand left or right to steer the paddle. Open hand or OK serves. Fist pauses.
        </div>
      </div>

      <div class="panel scoreboard">
        <div class="score-box">
          <div class="score-label">Player</div>
          <div class="score-value" id="playerScore">0</div>
        </div>
        <div class="score-divider">:</div>
        <div class="score-box">
          <div class="score-label">AI</div>
          <div class="score-value" id="aiScore">0</div>
        </div>
      </div>
    </div>

    <div class="footer" id="footer">
      <div class="panel tracker">
        <div class="tracker-header">
          <strong>Hand Tracker</strong>
          <span id="trackerMeta">Camera booting</span>
        </div>
        <div class="camera-shell">
          <video id="video" autoplay playsinline muted></video>
          <canvas id="overlay"></canvas>
          <div class="camera-fallback" id="cameraFallback">
            <div>
              <h3 id="cameraFallbackTitle">Camera unavailable</h3>
              <p id="cameraFallbackText">Use the buttons or keyboard fallback to keep playing.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="panel status-card">
        <div class="pill-row">
          <div class="pill" id="trackingBadge">Camera booting</div>
          <div class="pill" id="modeBadge">Gesture control</div>
          <div class="pill" id="roundBadge">Awaiting serve</div>
        </div>
        <div class="charge-label">
          <span id="chargeTitle">Hold open hand or OK to serve</span>
          <span id="chargePercent">0%</span>
        </div>
        <div class="charge-bar">
          <div class="charge-fill" id="chargeFill"></div>
        </div>
        <div class="helper" id="helperText">
          <strong>Fallback:</strong> arrows or A/D move, Space serves, P pauses, R resets, Esc exits.
        </div>
      </div>

      <div class="panel control-card">
        <div class="button-row">
          <button id="serveBtn">Serve / Resume</button>
          <button class="alt" id="pauseBtn">Pause</button>
          <button class="ghost" id="resetBtn">Reset Match</button>
          <button class="ghost" id="exitBtn">Exit</button>
        </div>
      </div>
    </div>
  </div>

  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.183.2/build/three.module.min.js"}}<\/script>
  <script type="module">
    import * as THREE from 'three';
    window.THREE = THREE;
    window.dispatchEvent(new Event('three-ready'));
  <\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.min.js"><\/script>

  <script>
    var debugToasts = document.getElementById('debugToasts');

    function showDebugToast(tag, message) {
      var el = document.createElement('div');
      el.style.cssText = 'background:rgba(255,60,80,0.88);color:#fff;padding:10px 14px;border-radius:10px;font-size:12px;line-height:1.45;backdrop-filter:blur(8px);box-shadow:0 4px 20px rgba(0,0,0,0.4);pointer-events:auto;word-break:break-word;';
      el.innerHTML = '<strong>[' + tag + ']</strong> ' + message;
      debugToasts.appendChild(el);
    }

    function __pongBoot() {
    const sceneRoot = document.getElementById('scene');
    const subtitle = document.getElementById('subtitle');
    const playerScoreEl = document.getElementById('playerScore');
    const aiScoreEl = document.getElementById('aiScore');
    const trackingBadge = document.getElementById('trackingBadge');
    const modeBadge = document.getElementById('modeBadge');
    const roundBadge = document.getElementById('roundBadge');
    const chargeTitle = document.getElementById('chargeTitle');
    const chargePercent = document.getElementById('chargePercent');
    const chargeFill = document.getElementById('chargeFill');
    const helperText = document.getElementById('helperText');
    const trackerMeta = document.getElementById('trackerMeta');
    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');
    const overlayCtx = overlay.getContext('2d');
    const cameraFallback = document.getElementById('cameraFallback');
    const cameraFallbackTitle = document.getElementById('cameraFallbackTitle');
    const cameraFallbackText = document.getElementById('cameraFallbackText');

    const serveBtn = document.getElementById('serveBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const exitBtn = document.getElementById('exitBtn');
    const footer = document.getElementById('footer');

    const clamp = function(value, min, max) {
      return Math.max(min, Math.min(max, value));
    };

    const lerp = function(start, end, alpha) {
      return start + (end - start) * alpha;
    };

    const remap = function(value, inMin, inMax, outMin, outMax) {
      const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
      return outMin + (outMax - outMin) * t;
    };

    const ARENA_WIDTH = 11.2;
    const ARENA_DEPTH = 16.5;
    const HALF_WIDTH = ARENA_WIDTH / 2;
    const HALF_DEPTH = ARENA_DEPTH / 2;
    const PLAYER_Z = 6.75;
    const AI_Z = -6.75;
    const PADDLE_WIDTH = 2.45;
    const PADDLE_DEPTH = 0.48;
    const BALL_RADIUS = 0.26;
    const BASE_BALL_SPEED = 7.2;
    const MAX_BALL_SPEED = 15.5;
    const PADDLE_LIMIT = HALF_WIDTH - PADDLE_WIDTH / 2 - 0.22;
    const GESTURE_HOLD_MS = 600;
    const GESTURE_COOLDOWN_MS = 900;
    const HAND_MEMORY_MS = 250;
    const MATCH_POINT = 7;

    const state = {
      playerScore: 0,
      aiScore: 0,
      waitingForServe: true,
      paused: false,
      matchWinner: '',
      ballVelocity: new THREE.Vector3(0, 0, 0),
      playerTargetX: 0,
      keyboardTargetX: 0,
      trackedX: 0.5,
      smoothedTrackedX: 0.5,
      currentGesture: null,
      actionGesture: null,
      actionStart: 0,
      lastGestureTrigger: 0,
      gestureLatched: false,
      lastTrackedAt: 0,
      hasHand: false,
      cameraState: 'booting',
      cameraMessage: 'Camera booting',
      keyboardLeft: false,
      keyboardRight: false,
    };

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      showDebugToast('WebGL', 'WebGLRenderer init failed: ' + (error && error.message ? error.message : String(error)));
      throw error;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    sceneRoot.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04050b, 0.05);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 9.4, 14.8);
    camera.lookAt(0, 0.6, 0);

    const ambientLight = new THREE.AmbientLight(0xa6d2ff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x8dffea, 1.6);
    keyLight.position.set(5, 10, 4);
    scene.add(keyLight);

    const magentaLight = new THREE.PointLight(0xff5ea9, 2.4, 26, 2);
    magentaLight.position.set(0, 3.2, -8);
    scene.add(magentaLight);

    const cyanLight = new THREE.PointLight(0x56f0ff, 2.2, 26, 2);
    cyanLight.position.set(0, 3.2, 8);
    scene.add(cyanLight);

    const tableMaterial = new THREE.MeshStandardMaterial({
      color: 0x09101f,
      emissive: 0x07101b,
      metalness: 0.45,
      roughness: 0.4,
    });

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_WIDTH + 0.8, ARENA_DEPTH + 0.8),
      tableMaterial
    );
    table.rotation.x = -Math.PI / 2;
    scene.add(table);

    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(ARENA_WIDTH + 0.8, ARENA_DEPTH + 0.8)),
      new THREE.LineBasicMaterial({ color: 0x5ce9ff, transparent: true, opacity: 0.45 })
    );
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.01;
    scene.add(border);

    const laneGroup = new THREE.Group();
    for (let i = 0; i < 9; i += 1) {
      const dash = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.04, 0.82),
        new THREE.MeshBasicMaterial({ color: 0x9fcfff, transparent: true, opacity: 0.35 })
      );
      dash.position.set(0, 0.03, -HALF_DEPTH + 1.6 + i * 1.8);
      laneGroup.add(dash);
    }
    scene.add(laneGroup);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 180;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      starPositions[i * 3] = (Math.random() - 0.5) * 28;
      starPositions[i * 3 + 1] = 4 + Math.random() * 10;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x96c7ff, size: 0.06, transparent: true, opacity: 0.65 })
    );
    scene.add(stars);

    const paddleGeometry = new THREE.BoxGeometry(PADDLE_WIDTH, 0.34, PADDLE_DEPTH);

    const playerPaddle = new THREE.Mesh(
      paddleGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xcffcff,
        emissive: 0x0caac0,
        emissiveIntensity: 1.1,
        metalness: 0.2,
        roughness: 0.15,
      })
    );
    playerPaddle.position.set(0, 0.24, PLAYER_Z);
    scene.add(playerPaddle);

    const aiPaddle = new THREE.Mesh(
      paddleGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xffd7ea,
        emissive: 0xb3175d,
        emissiveIntensity: 1.15,
        metalness: 0.2,
        roughness: 0.15,
      })
    );
    aiPaddle.position.set(0, 0.24, AI_Z);
    scene.add(aiPaddle);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 24, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfff7dc,
        emissive: 0xffaa37,
        emissiveIntensity: 1.3,
        metalness: 0.15,
        roughness: 0.08,
      })
    );
    ball.position.set(0, 0.3, 0);
    scene.add(ball);

    const ballGlow = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS * 1.9, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffc15a,
        transparent: true,
        opacity: 0.16,
      })
    );
    ballGlow.position.copy(ball.position);
    scene.add(ballGlow);

    const trail = [];
    for (let i = 0; i < 6; i += 1) {
      const ghost = new THREE.Mesh(
        new THREE.SphereGeometry(BALL_RADIUS * (1.1 - i * 0.08), 16, 16),
        new THREE.MeshBasicMaterial({
          color: 0xffa445,
          transparent: true,
          opacity: 0.18 - i * 0.025,
        })
      );
      ghost.position.copy(ball.position);
      scene.add(ghost);
      trail.push(ghost);
    }

    function resizeRenderer() {
      const widthPx = window.innerWidth;
      const heightPx = window.innerHeight;
      renderer.setSize(widthPx, heightPx, false);
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
    }

    resizeRenderer();
    window.addEventListener('resize', resizeRenderer);

    function updateScoreboard() {
      playerScoreEl.textContent = String(state.playerScore);
      aiScoreEl.textContent = String(state.aiScore);
    }

    function updateStatus(forceProgress) {
      const usingGesture = state.hasHand && performance.now() - state.lastTrackedAt < HAND_MEMORY_MS;
      trackingBadge.textContent = state.cameraMessage;
      modeBadge.textContent = usingGesture ? 'Gesture control' : 'Keyboard fallback';

      if (state.matchWinner) {
        roundBadge.textContent = state.matchWinner + ' wins';
      } else if (state.paused) {
        roundBadge.textContent = 'Paused';
      } else if (state.waitingForServe) {
        roundBadge.textContent = 'Awaiting serve';
      } else {
        roundBadge.textContent = 'Ball in play';
      }

      let prompt = 'Move your hand left or right to steer the paddle.';
      if (state.matchWinner) {
        prompt = state.matchWinner + ' reached ' + MATCH_POINT + '. Press reset or show an open hand to play again.';
      } else if (state.paused) {
        prompt = 'Open hand or OK to resume. Fist also toggles pause.';
      } else if (state.waitingForServe) {
        prompt = 'Hold an open hand or OK gesture to serve. Space also works.';
      } else {
        prompt = 'Fist pauses. Keep your hand centered and steady for smoother control.';
      }

      subtitle.textContent = prompt;
      helperText.innerHTML = '<strong>Fallback:</strong> arrows or A/D move, Space serves, P pauses, R resets, Esc exits.';

      let progress = forceProgress == null ? 0 : forceProgress;
      let titleText = 'Hold open hand or OK to serve';

      if (state.matchWinner) {
        titleText = 'Hold open hand or OK to start a new match';
      } else if (state.paused) {
        titleText = 'Hold open hand or OK to resume';
      } else if (!state.waitingForServe) {
        titleText = 'Hold fist to pause';
      }

      if (state.actionGesture === 'pause') {
        titleText = 'Hold fist to toggle pause';
      }

      chargeTitle.textContent = titleText;
      chargePercent.textContent = String(Math.round(progress * 100)) + '%';
      chargeFill.style.transform = 'scaleX(' + progress + ')';
      trackerMeta.textContent = state.hasHand ? 'Landmarks live' : state.cameraMessage;

      var ballInPlay = !state.waitingForServe && !state.paused && !state.matchWinner;
      if (ballInPlay) {
        footer.classList.add('collapsed');
      } else {
        footer.classList.remove('collapsed');
      }
    }

    function setCameraFallback(titleText, detailText, stateText) {
      cameraFallback.style.display = 'flex';
      cameraFallbackTitle.textContent = titleText;
      cameraFallbackText.textContent = detailText;
      state.cameraState = stateText;
      state.cameraMessage = stateText;
      state.hasHand = false;
      trackingBadge.textContent = stateText;
      trackerMeta.textContent = stateText;
    }

    function clearCameraFallback() {
      cameraFallback.style.display = 'none';
    }

    function classifyCameraError(error, inputCount) {
      const name = error && error.name ? error.name : '';
      const message = String(error && error.message ? error.message : '');

      if (
        inputCount === 0 ||
        name === 'NotFoundError' ||
        name === 'DevicesNotFoundError' ||
        /no device|0 devices|not found amongst 0 devices/i.test(message)
      ) {
        return {
          title: 'No camera detected',
          detail: 'Plug in a camera or keep playing with the keyboard controls.',
          state: 'No camera',
        };
      }

      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError'
      ) {
        return {
          title: 'Camera permission denied',
          detail: 'Allow camera access in System Settings or use the keyboard fallback.',
          state: 'Camera denied',
        };
      }

      if (
        name === 'NotReadableError' ||
        /device in use|could not start video source|track start/i.test(message)
      ) {
        return {
          title: 'Camera busy',
          detail: 'Another app is using the camera. Keyboard controls are still available.',
          state: 'Camera busy',
        };
      }

      return {
        title: 'Camera unavailable',
        detail: 'Keyboard and on-screen controls remain active.',
        state: 'Camera unavailable',
      };
    }

    async function getVideoInputCount() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return null;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(function(device) {
          return device.kind === 'videoinput';
        }).length;
      } catch {
        return null;
      }
    }

    function isFingerExtended(landmarks, tip, pip) {
      return landmarks[tip].y < landmarks[pip].y;
    }

    function landmarkDistance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function isOkGesture(landmarks) {
      const thumbIndexDist = landmarkDistance(landmarks[4], landmarks[8]);
      const middle = isFingerExtended(landmarks, 12, 10);
      const ring = isFingerExtended(landmarks, 16, 14);
      const pinky = isFingerExtended(landmarks, 20, 18);
      return thumbIndexDist < 0.07 && middle && ring && pinky;
    }

    function isThumbExtended(landmarks, handedness) {
      const tipX = landmarks[4].x;
      const ipX = landmarks[3].x;
      if (handedness === 'Left') return tipX > ipX;
      return tipX < ipX;
    }

    function classifyGesture(landmarks, handedness) {
      const thumb = isThumbExtended(landmarks, handedness);
      const index = isFingerExtended(landmarks, 8, 6);
      const middle = isFingerExtended(landmarks, 12, 10);
      const ring = isFingerExtended(landmarks, 16, 14);
      const pinky = isFingerExtended(landmarks, 20, 18);

      if (isOkGesture(landmarks)) return 'ok';
      if (!thumb && !index && !middle && !ring && !pinky) return 'fist';
      if (thumb && index && middle && ring && pinky) return 'five';
      return null;
    }

    function getPalmCenterX(landmarks) {
      const indexes = [0, 5, 9, 13, 17];
      let sum = 0;
      for (let i = 0; i < indexes.length; i += 1) {
        sum += landmarks[indexes[i]].x;
      }
      return sum / indexes.length;
    }

    function resetRound() {
      state.waitingForServe = true;
      state.paused = false;
      state.ballVelocity.set(0, 0, 0);
      ball.position.set(playerPaddle.position.x, 0.3, PLAYER_Z - 0.92);
      ballGlow.position.copy(ball.position);
      for (let i = 0; i < trail.length; i += 1) {
        trail[i].position.copy(ball.position);
      }
      updateStatus(0);
    }

    function hardReset() {
      state.playerScore = 0;
      state.aiScore = 0;
      state.matchWinner = '';
      playerPaddle.position.x = 0;
      aiPaddle.position.x = 0;
      state.playerTargetX = 0;
      state.keyboardTargetX = 0;
      updateScoreboard();
      resetRound();
    }

    function afterPoint(winner) {
      if (winner === 'player') {
        state.playerScore += 1;
      } else {
        state.aiScore += 1;
      }

      updateScoreboard();

      if (state.playerScore >= MATCH_POINT) {
        state.matchWinner = 'Player';
      } else if (state.aiScore >= MATCH_POINT) {
        state.matchWinner = 'AI';
      }

      resetRound();
    }

    function serveOrResume() {
      if (state.matchWinner) {
        hardReset();
        return;
      }

      if (state.paused) {
        state.paused = false;
        updateStatus(0);
        return;
      }

      if (!state.waitingForServe) return;

      state.waitingForServe = false;
      const angle = (Math.random() * 0.9 - 0.45);
      const direction = new THREE.Vector3(angle, 0, -1).normalize();
      state.ballVelocity.copy(direction.multiplyScalar(BASE_BALL_SPEED));
    }

    function togglePause() {
      if (state.matchWinner) return;
      if (state.waitingForServe && !state.paused) return;
      state.paused = !state.paused;
      updateStatus(0);
    }

    function queueExit() {
      const payload = {
        type: 'exit',
        status: 'closed',
        score: {
          player: state.playerScore,
          ai: state.aiScore,
        },
      };
      if (window.glimpse && typeof window.glimpse.send === 'function') {
        window.glimpse.send(payload);
      } else {
        window.close();
      }
    }

    serveBtn.addEventListener('click', serveOrResume);
    pauseBtn.addEventListener('click', togglePause);
    resetBtn.addEventListener('click', hardReset);
    exitBtn.addEventListener('click', queueExit);

    document.addEventListener('keydown', function(event) {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        state.keyboardLeft = true;
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        state.keyboardRight = true;
      } else if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        serveOrResume();
      } else if (event.key === 'p' || event.key === 'P') {
        togglePause();
      } else if (event.key === 'r' || event.key === 'R') {
        hardReset();
      } else if (event.key === 'Escape') {
        queueExit();
      }
    });

    document.addEventListener('keyup', function(event) {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        state.keyboardLeft = false;
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        state.keyboardRight = false;
      }
    });

    function onGestureAction(gesture, now) {
      const activeAction = gesture === 'fist'
        ? 'pause'
        : (gesture === 'five' || gesture === 'ok' ? 'serve' : null);

      if (activeAction !== state.actionGesture) {
        state.actionGesture = activeAction;
        state.actionStart = now;
      }

      if (!activeAction) {
        state.gestureLatched = false;
        updateStatus(0);
        return;
      }

      if (state.gestureLatched) {
        updateStatus(0);
        return;
      }

      if (now - state.lastGestureTrigger < GESTURE_COOLDOWN_MS) {
        updateStatus(0);
        return;
      }

      if (activeAction === 'pause' && state.waitingForServe && !state.paused) {
        updateStatus(0);
        return;
      }

      const progress = clamp((now - state.actionStart) / GESTURE_HOLD_MS, 0, 1);
      updateStatus(progress);

      if (progress < 1) return;

      state.lastGestureTrigger = now;
      state.gestureLatched = true;
      state.actionGesture = null;
      state.actionStart = now;

      if (activeAction === 'pause') {
        togglePause();
      } else {
        serveOrResume();
      }

      updateStatus(0);
    }

    function updatePaddles(dt, now) {
      const handActive = state.hasHand && now - state.lastTrackedAt < HAND_MEMORY_MS;
      let inputTarget = state.playerTargetX;

      if (handActive) {
        inputTarget = remap(state.smoothedTrackedX, 0.16, 0.84, -PADDLE_LIMIT, PADDLE_LIMIT);
      } else {
        const keyboardSpeed = 11.5;
        if (state.keyboardLeft) {
          state.keyboardTargetX -= keyboardSpeed * dt;
        }
        if (state.keyboardRight) {
          state.keyboardTargetX += keyboardSpeed * dt;
        }
        state.keyboardTargetX = clamp(state.keyboardTargetX, -PADDLE_LIMIT, PADDLE_LIMIT);
        inputTarget = state.keyboardTargetX;
      }

      state.playerTargetX = inputTarget;
      playerPaddle.position.x = lerp(playerPaddle.position.x, inputTarget, Math.min(1, dt * 11));

      const aiTarget = clamp(ball.position.x * 0.88, -PADDLE_LIMIT, PADDLE_LIMIT);
      aiPaddle.position.x = lerp(aiPaddle.position.x, aiTarget, Math.min(1, dt * 4.8));
    }

    function bounceBallFromPaddle(paddle, direction) {
      const impact = clamp((ball.position.x - paddle.position.x) / (PADDLE_WIDTH * 0.5), -1, 1);
      const speed = Math.min(MAX_BALL_SPEED, state.ballVelocity.length() + 0.45);
      state.ballVelocity.z = Math.abs(state.ballVelocity.z) * direction;
      state.ballVelocity.x += impact * 4.1;
      state.ballVelocity.setLength(speed);
      ball.position.z = paddle.position.z + direction * (PADDLE_DEPTH * 0.5 + BALL_RADIUS + 0.05);
    }

    function updateBall(dt) {
      if (state.waitingForServe) {
        ball.position.x = lerp(ball.position.x, playerPaddle.position.x, Math.min(1, dt * 8));
        ball.position.z = PLAYER_Z - 0.92;
        ball.position.y = 0.3;
        ballGlow.position.copy(ball.position);
        return;
      }

      if (state.paused || state.matchWinner) {
        ballGlow.position.copy(ball.position);
        return;
      }

      ball.position.x += state.ballVelocity.x * dt;
      ball.position.z += state.ballVelocity.z * dt;

      if (ball.position.x <= -HALF_WIDTH + BALL_RADIUS) {
        ball.position.x = -HALF_WIDTH + BALL_RADIUS;
        state.ballVelocity.x *= -1;
      } else if (ball.position.x >= HALF_WIDTH - BALL_RADIUS) {
        ball.position.x = HALF_WIDTH - BALL_RADIUS;
        state.ballVelocity.x *= -1;
      }

      const playerCollision =
        state.ballVelocity.z > 0 &&
        Math.abs(ball.position.z - playerPaddle.position.z) <= PADDLE_DEPTH * 0.5 + BALL_RADIUS &&
        Math.abs(ball.position.x - playerPaddle.position.x) <= PADDLE_WIDTH * 0.5 + BALL_RADIUS;

      if (playerCollision) {
        bounceBallFromPaddle(playerPaddle, -1);
      }

      const aiCollision =
        state.ballVelocity.z < 0 &&
        Math.abs(ball.position.z - aiPaddle.position.z) <= PADDLE_DEPTH * 0.5 + BALL_RADIUS &&
        Math.abs(ball.position.x - aiPaddle.position.x) <= PADDLE_WIDTH * 0.5 + BALL_RADIUS;

      if (aiCollision) {
        bounceBallFromPaddle(aiPaddle, 1);
      }

      if (ball.position.z > HALF_DEPTH + 1.2) {
        afterPoint('ai');
      } else if (ball.position.z < -HALF_DEPTH - 1.2) {
        afterPoint('player');
      }

      ballGlow.position.copy(ball.position);
      for (let i = 0; i < trail.length; i += 1) {
        const target = i === 0 ? ball.position : trail[i - 1].position;
        trail[i].position.lerp(target, Math.min(1, dt * (8 - i)));
      }
    }

    function animateScene(time) {
      const seconds = time * 0.001;
      table.material.emissiveIntensity = 0.9 + Math.sin(seconds * 1.6) * 0.08;
      stars.rotation.y = seconds * 0.025;
      stars.rotation.x = Math.sin(seconds * 0.07) * 0.04;
      cyanLight.intensity = 2.1 + Math.sin(seconds * 3.2) * 0.2;
      magentaLight.intensity = 2.25 + Math.cos(seconds * 2.8) * 0.18;
      ballGlow.scale.setScalar(1 + Math.sin(seconds * 10) * 0.05);
    }

    let previousFrame = performance.now();
    function frame(now) {
      const dt = Math.min((now - previousFrame) / 1000, 0.033);
      previousFrame = now;

      updatePaddles(dt, now);
      updateBall(dt);
      animateScene(now);
      renderer.render(scene, camera);

      if (!state.hasHand || now - state.lastTrackedAt >= HAND_MEMORY_MS) {
        updateStatus(0);
      }

      requestAnimationFrame(frame);
    }

    async function startTracking() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraFallback(
          'Camera API unavailable',
          'This host cannot access camera APIs on this system.',
          'Camera unavailable'
        );
        showDebugToast('Camera', 'navigator.mediaDevices.getUserMedia is not available in this WebView context.');
        updateStatus(0);
        return;
      }

      const inputCount = await getVideoInputCount();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user',
          }
        });

        video.srcObject = stream;
        await video.play();
        clearCameraFallback();
        state.cameraState = 'ready';
        state.cameraMessage = 'Camera ready';
        updateStatus(0);
      } catch (error) {
        const info = classifyCameraError(error, inputCount);
        setCameraFallback(info.title, info.detail, info.state);
        showDebugToast('Camera', (error && error.name ? error.name + ': ' : '') + (error && error.message ? error.message : String(error)));
        updateStatus(0);
        return;
      }

      const hasHands = typeof Hands === 'function';
      const hasCameraHelper = typeof Camera === 'function';
      const hasDrawing =
        typeof drawConnectors === 'function' &&
        typeof drawLandmarks === 'function' &&
        typeof HAND_CONNECTIONS !== 'undefined';

      if (!hasHands) {
        state.cameraState = 'ready';
        state.cameraMessage = 'Camera live / tracking offline';
        trackingBadge.textContent = 'Tracking offline';
        trackerMeta.textContent = 'Camera live';
        helperText.innerHTML = '<strong>Camera is live.</strong> Hand tracking scripts did not load, so use keyboard or buttons.';
        showDebugToast('MediaPipe', 'Hands=' + hasHands + ' Camera=' + hasCameraHelper + ' Drawing=' + hasDrawing + '. CDN scripts may have failed to load.');
        updateStatus(0);
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
        overlay.width = video.videoWidth || 640;
        overlay.height = video.videoHeight || 480;
        overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          clearCameraFallback();

          const landmarks = results.multiHandLandmarks[0];
          const handedness = results.multiHandedness[0].label;
          if (hasDrawing) {
            drawConnectors(overlayCtx, landmarks, HAND_CONNECTIONS, { color: 'rgba(86, 240, 255, 0.42)', lineWidth: 2 });
            drawLandmarks(overlayCtx, landmarks, { color: '#cfffff', lineWidth: 1, radius: 3 });
          }

          const palmX = getPalmCenterX(landmarks);
          const mirroredX = 1 - palmX;
          state.trackedX = mirroredX;
          state.smoothedTrackedX = lerp(state.smoothedTrackedX, mirroredX, 0.26);
          state.currentGesture = classifyGesture(landmarks, handedness);
          state.lastTrackedAt = performance.now();
          state.hasHand = true;
          state.cameraState = 'live';
          state.cameraMessage = hasDrawing ? 'Tracking live' : 'Tracking live / overlay offline';

          onGestureAction(state.currentGesture, state.lastTrackedAt);
        } else {
          state.hasHand = false;
          state.currentGesture = null;
          state.actionGesture = null;
          state.cameraState = 'searching';
          state.cameraMessage = 'Show one hand to play';
          updateStatus(0);
        }
      });

      if (hasCameraHelper) {
        const cam = new Camera(video, {
          onFrame: async function() {
            await hands.send({ image: video });
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
        if (!video.srcObject) {
          trackingActive = false;
          return;
        }

        if (video.readyState >= 2) {
          await hands.send({ image: video });
        }

        requestAnimationFrame(function() {
          processFrame().catch(function(error) {
            console.error('Manual tracking loop failed:', error);
          });
        });
      };

      processFrame().catch(function(error) {
        console.error('Manual tracking bootstrap failed:', error);
      });
    }

    window.addEventListener('error', function(event) {
      showDebugToast('Error', (event.filename || '') + ':' + (event.lineno || '') + ' ' + (event.message || ''));
    });

    window.addEventListener('unhandledrejection', function(event) {
      var reason = event.reason;
      showDebugToast('Promise', reason && reason.message ? reason.message : String(reason));
    });

    updateScoreboard();
    updateStatus(0);
    hardReset();
    startTracking();
    requestAnimationFrame(frame);
    }

    if (window.THREE) {
      __pongBoot();
    } else {
      window.addEventListener('three-ready', __pongBoot, { once: true });
      setTimeout(function() {
        if (!window.THREE) {
          showDebugToast('3D', 'three.js ESM module failed to load after 10s. Check network or CSP.');
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
  console.error(error instanceof Error ? error.message : 'Failed to launch pong');
  process.exit(1);
}
