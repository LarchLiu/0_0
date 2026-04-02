#!/usr/bin/env node

import { prompt } from './native/glimpse.mjs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    message: { type: 'string', default: 'Confirm this action?' },
    mode:    { type: 'string', default: 'confirm' },  // confirm | select
    options: { type: 'string', default: '' },          // comma-separated options for select mode
    'choices-json': { type: 'string', default: '' },   // JSON array of { label, value }
    timeout: { type: 'string', default: '60000' },
  },
});

const confirmMessage = values.message;
const mode = values.mode;
const choiceMatches = (choice, keywords) => {
  const valuesToCheck = [choice?.value, choice?.label]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim().toLowerCase());
  return keywords.some((keyword) => valuesToCheck.includes(keyword));
};
function parseStructuredChoices(rawChoicesJson) {
  if (!rawChoicesJson) {
    return { choices: [], error: null };
  }

  try {
    const parsed = JSON.parse(rawChoicesJson);
    if (!Array.isArray(parsed)) {
      return { choices: [], error: '--choices-json must be a JSON array' };
    }

    const choices = parsed
      .map((choice) => {
        if (!choice || typeof choice !== 'object') return null;
        const label = typeof choice.label === 'string' ? choice.label.trim() : '';
        if (!label) return null;
        return {
          label,
          value: Object.hasOwn(choice, 'value') ? choice.value : label,
        };
      })
      .filter(Boolean)
      .slice(0, 5);

    return { choices, error: null };
  } catch (error) {
    return {
      choices: [],
      error: error instanceof Error ? error.message : 'Invalid JSON',
    };
  }
}

const { choices: structuredChoices, error: structuredChoicesError } = parseStructuredChoices(values['choices-json']);
if (structuredChoicesError) {
  console.error(`Invalid --choices-json: ${structuredChoicesError}`);
  process.exit(2);
}
const allowChoiceIndex = structuredChoices.findIndex((choice) => choiceMatches(choice, ['allow', 'approve', 'accept', 'yes', 'continue', '允许', '同意']));
const denyChoiceIndex = structuredChoices.findIndex((choice) => choiceMatches(choice, ['deny', 'reject', 'decline', 'no', 'cancel', '拒绝', '否决', '取消']));
const numberedChoices = structuredChoices.length > 0
  ? structuredChoices.filter((_, index) => index !== allowChoiceIndex && index !== denyChoiceIndex).slice(0, 5)
  : [];
const selectOptions = numberedChoices.length > 0
  ? numberedChoices.map((choice) => choice.label)
  : structuredChoices.length === 0 && values.options
    ? values.options.split(',').map(s => s.trim()).slice(0, 5)
    : [];
const hasNumberSelections = selectOptions.length > 0;
const isConfirmOnly = !hasNumberSelections && mode === 'confirm';
const hasAllowAction = allowChoiceIndex !== -1 || isConfirmOnly;
const hasDenyAction = denyChoiceIndex !== -1 || isConfirmOnly || hasNumberSelections;
const denyActionLabel = denyChoiceIndex !== -1 || isConfirmOnly ? 'Deny' : 'Cancel';
const initialHint = [
  allowChoiceIndex !== -1 || isConfirmOnly ? 'OK gesture = allow' : null,
  denyChoiceIndex !== -1 || isConfirmOnly ? 'Fist = deny' : hasNumberSelections ? 'Fist = cancel' : null,
  hasNumberSelections ? '1-' + selectOptions.length + ' fingers = select option' : null,
].filter(Boolean).join(' • ');
const timeoutMs = parseInt(values.timeout, 10);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Build options list HTML for select mode
const optionsHtml = selectOptions.map((opt, i) =>
  `<div class="option" id="opt${i+1}"><span class="option-num">${i + 1}</span> ${escapeHtml(opt)}</div>`
).join('');

const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    background: #1a1a2e; color: #fff; overflow: hidden;
  }
  .header {
    padding: 12px 16px;
    background: rgba(255,255,255,0.05);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    font-size: 14px; color: #ccc;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .camera-container {
    position: relative; width: 100%; height: 320px;
  }
  video {
    width: 100%; height: 100%; object-fit: cover;
    transform: scaleX(-1);
  }
  canvas {
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    transform: scaleX(-1);
  }
  .status-bar {
    padding: 10px 16px; display: flex;
    justify-content: space-between; align-items: center;
    background: rgba(255,255,255,0.05);
    border-top: 1px solid rgba(255,255,255,0.1);
  }
  .gesture-label { font-size: 18px; font-weight: 600; }
  .progress-ring { width: 36px; height: 36px; }
  .progress-ring circle {
    fill: none; stroke-width: 3; stroke-linecap: round;
    transform: rotate(-90deg); transform-origin: 50% 50%;
  }
  .progress-bg { stroke: rgba(255,255,255,0.1); }
  .progress-fg {
    stroke: #4ade80; stroke-dasharray: 94.25; stroke-dashoffset: 94.25;
    transition: stroke-dashoffset 0.1s;
  }
  .progress-fg.deny { stroke: #f87171; }
  .progress-fg.select { stroke: #60a5fa; }
  .hint { font-size: 12px; color: #888; }
  .buttons { display: flex; gap: 8px; padding: 8px 16px; }
  .buttons:last-of-type { padding-bottom: 16px; }
  .buttons button {
    flex: 1; padding: 8px; border: none; border-radius: 6px;
    font-size: 13px; cursor: pointer;
  }
  .buttons + .buttons { padding-top: 0; }
  .btn-deny { background: #dc2626; color: white; }
  .btn-allow { background: #16a34a; color: white; }
  .btn-select { background: #2563eb; color: white; font-size: 12px; }
  .btn-select.active { background: #60a5fa; }
  .no-camera {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%; color: #888; font-size: 14px;
    flex-direction: column; gap: 8px;
  }
</style>
</head>
<body>
  <div class="header">${escapeHtml(confirmMessage)}</div>
  <div class="camera-container">
    <video id="video" autoplay playsinline></video>
    <canvas id="canvas"></canvas>
    <div id="noCam" class="no-camera" style="display:none;">
      <div id="noCamTitle">Camera unavailable</div>
      <div id="noCamDetail" style="font-size:12px;">Use buttons below</div>
    </div>
  </div>
  <div class="status-bar">
    <div>
      <div class="gesture-label" id="gestureLabel">Waiting...</div>
      <div class="hint" id="hintText">${initialHint}</div>
    </div>
    <svg class="progress-ring" viewBox="0 0 36 36">
      <circle class="progress-bg" cx="18" cy="18" r="15"/>
      <circle class="progress-fg" id="progressCircle" cx="18" cy="18" r="15"/>
    </svg>
  </div>
  ${hasAllowAction || hasDenyAction ? `
    <div class="buttons" id="actionButtons">
      ${hasDenyAction ? `<button class="btn-deny" onclick="sendDenyOrCancel()">✊ ${denyActionLabel}</button>` : ''}
      ${hasAllowAction ? `<button class="btn-allow" onclick="sendAllow()">👌 Allow</button>` : ''}
    </div>
  ` : ''}
  ${hasNumberSelections ? `
    <div class="buttons" id="buttonsBar">
      ${selectOptions.map((opt, i) =>
        `<button class="btn-select" onclick="sendSelection(${i+1})">${i + 1}. ${escapeHtml(opt)}</button>`
      ).join('')}
    </div>
  ` : ''}

  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.min.js"><\/script>

  <script>
    const MODE = '${mode}';
    const IS_CONFIRM_ONLY = ${JSON.stringify(isConfirmOnly)};
    const OPTIONS = ${JSON.stringify(selectOptions)};
    const NUMBERED_CHOICES = ${JSON.stringify(numberedChoices)};
    const STRUCTURED_CHOICES = ${JSON.stringify(structuredChoices)};
    const ALLOW_CHOICE_INDEX = ${allowChoiceIndex};
    const DENY_CHOICE_INDEX = ${denyChoiceIndex};
    const DEFAULT_HINT = ${JSON.stringify(initialHint)};
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const gestureLabel = document.getElementById('gestureLabel');
    const hintText = document.getElementById('hintText');
    const progressCircle = document.getElementById('progressCircle');
    const noCam = document.getElementById('noCam');
    const noCamTitle = document.getElementById('noCamTitle');
    const noCamDetail = document.getElementById('noCamDetail');
    const circumference = 2 * Math.PI * 15;

    let currentGesture = null;
    let gestureStart = 0;
    let lastGestureTime = 0;
    const HOLD_MS = 800;
    const GRACE_MS = 300;
    let decided = false;

    function sendResult(data) {
      if (decided) return;
      decided = true;
      // Defer to escape MediaPipe onResults callback — postMessage
      // can be dropped if fired synchronously during frame processing.
      setTimeout(() => window.glimpse.send(data), 0);
    }

    function sendSelection(num) {
      if (num < 1 || num > OPTIONS.length) return;
      const choice = NUMBERED_CHOICES[num - 1];
      if (choice) {
        sendResult({ selection: num, label: choice.label, value: choice.value });
      } else {
        sendResult({ selection: num, label: OPTIONS[num - 1] });
      }
    }

    function sendAllow() {
      if (ALLOW_CHOICE_INDEX >= 0) {
        const c = STRUCTURED_CHOICES[ALLOW_CHOICE_INDEX];
        sendResult({ label: c.label, value: c.value });
      } else {
        sendResult({ decision: 'allow' });
      }
    }

    function sendDenyOrCancel() {
      if (DENY_CHOICE_INDEX >= 0) {
        const c = STRUCTURED_CHOICES[DENY_CHOICE_INDEX];
        sendResult({ label: c.label, value: c.value });
      } else if (IS_CONFIRM_ONLY) {
        sendResult({ decision: 'deny' });
      } else {
        sendResult({ selection: 0, label: '' });
      }
    }

    function showCameraFallback(title, detail, color = '#f59e0b') {
      noCamTitle.textContent = title;
      noCamDetail.textContent = detail;
      noCam.style.display = 'flex';
      video.style.display = 'none';
      canvas.style.display = 'none';
      gestureLabel.textContent = title;
      gestureLabel.style.color = color;
      progressCircle.style.strokeDashoffset = circumference;
      progressCircle.classList.remove('deny', 'select');
      hintText.textContent = detail;
    }

    async function getVideoInputCount() {
      if (!navigator.mediaDevices?.enumerateDevices) return null;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter((device) => device.kind === 'videoinput').length;
      } catch {
        return null;
      }
    }

    function classifyCameraError(err, videoInputCount) {
      const name = err?.name || '';
      const message = String(err?.message || '');

      if (
        videoInputCount === 0 ||
        name === 'NotFoundError' ||
        name === 'DevicesNotFoundError' ||
        /no device|0 devices|not found amongst 0 devices/i.test(message)
      ) {
        return {
          title: 'No camera detected',
          detail: 'Connect a camera or use the buttons below.',
          color: '#f59e0b',
        };
      }

      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError'
      ) {
        return {
          title: 'Camera permission denied',
          detail: 'Allow camera access in System Settings, or use the buttons below.',
          color: '#f87171',
        };
      }

      if (
        name === 'NotReadableError' ||
        /device in use|could not start video source|track start/i.test(message)
      ) {
        return {
          title: 'Camera busy or unavailable',
          detail: 'Close other camera apps, or use the buttons below.',
          color: '#f59e0b',
        };
      }

      if (name === 'OverconstrainedError') {
        return {
          title: 'Camera settings unsupported',
          detail: 'Requested video settings are not available on this device.',
          color: '#f59e0b',
        };
      }

      return {
        title: 'Camera unavailable',
        detail: 'Use the buttons below.',
        color: '#f59e0b',
      };
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendAllow();
      if (e.key === 'Escape') sendDenyOrCancel();

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= OPTIONS.length) {
        sendSelection(num);
      }
    });

    // Finger detection
    function isFingerExtended(landmarks, tip, pip) {
      return landmarks[tip].y < landmarks[pip].y;
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function isOkGesture(landmarks) {
      // Thumb tip (4) and index tip (8) touching
      const thumbIndexDist = distance(landmarks[4], landmarks[8]);
      // Middle, ring, pinky extended
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

      // OK gesture: thumb+index touching, other fingers extended
      if (isOkGesture(landmarks)) return 'ok';
      // Fist: all fingers curled
      if (!thumb && !index && !middle && !ring && !pinky) return 'fist';
      // 5: all fingers extended
      if (thumb && index && middle && ring && pinky) return 'five';
      // 4: four fingers (no thumb)
      if (!thumb && index && middle && ring && pinky) return 'four';
      // 3: thumb + index + middle
      if (thumb && index && middle && !ring && !pinky) return 'three';
      // 2: index + middle
      if (index && middle && !ring && !pinky) return 'two';
      // 1: index only
      if (index && !middle && !ring && !pinky) return 'one';
      return null;
    }

    function highlightOption(num) {
      document.querySelectorAll('.option').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.btn-select').forEach(el => el.classList.remove('active'));
      if (num >= 1 && num <= OPTIONS.length) {
        const opt = document.getElementById('opt' + num);
        if (opt) opt.classList.add('active');
        const btns = document.querySelectorAll('.btn-select');
        if (btns[num - 1]) btns[num - 1].classList.add('active');
      }
    }

    const fingerNames = { one: 1, two: 2, three: 3, four: 4, five: 5 };

    function updateProgress(gesture) {
      const now = Date.now();

      if (gesture === currentGesture) {
        lastGestureTime = now;
      } else if (gesture !== currentGesture) {
        if (now - lastGestureTime < GRACE_MS && currentGesture !== null) {
          // Brief flicker — keep current gesture, don't reset
        } else {
          currentGesture = gesture;
          gestureStart = now;
          lastGestureTime = now;
        }
      }

      const elapsed = now - gestureStart;
      const progress = Math.min(elapsed / HOLD_MS, 1);

      if (gesture === 'ok' && (ALLOW_CHOICE_INDEX >= 0 || IS_CONFIRM_ONLY)) {
        highlightOption(ALLOW_CHOICE_INDEX >= 0 ? ALLOW_CHOICE_INDEX + 1 : 0);
        gestureLabel.textContent = '\\u{1f44c} OK \\u2014 Allow';
        gestureLabel.style.color = '#4ade80';
        progressCircle.classList.remove('deny', 'select');
        progressCircle.style.strokeDashoffset = circumference * (1 - progress);
        hintText.textContent = progress < 1 ? 'Hold steady...' : 'Allowed!';
        if (progress >= 1) sendAllow();
      } else if (gesture === 'fist') {
        highlightOption(DENY_CHOICE_INDEX >= 0 ? DENY_CHOICE_INDEX + 1 : 0);
        gestureLabel.textContent = DENY_CHOICE_INDEX >= 0 || IS_CONFIRM_ONLY
          ? '\\u{270a} Fist \\u2014 Deny'
          : '\\u{270a} Fist \\u2014 Cancel';
        gestureLabel.style.color = '#f87171';
        progressCircle.classList.add('deny');
        progressCircle.classList.remove('select');
        progressCircle.style.strokeDashoffset = circumference * (1 - progress);
        hintText.textContent = progress < 1 ? 'Hold steady...' : (DENY_CHOICE_INDEX >= 0 || IS_CONFIRM_ONLY ? 'Denied!' : 'Cancelled!');
        if (progress >= 1) sendDenyOrCancel();
      } else {
        const num = fingerNames[gesture];
        if (num && num <= OPTIONS.length) {
          highlightOption(num);
          gestureLabel.textContent = num + ' \\u2014 ' + OPTIONS[num - 1];
          gestureLabel.style.color = '#60a5fa';
          progressCircle.classList.remove('deny');
          progressCircle.classList.add('select');
          progressCircle.style.strokeDashoffset = circumference * (1 - progress);
          hintText.textContent = progress < 1 ? 'Hold steady...' : 'Selected!';
          if (progress >= 1) sendSelection(num);
        } else {
          highlightOption(0);
          resetProgress(gesture);
        }
      }
    }

    function resetProgress(gesture) {
      currentGesture = null;
      gestureLabel.textContent = 'Waiting...';
      gestureLabel.style.color = '#fff';
      progressCircle.style.strokeDashoffset = circumference;
      progressCircle.classList.remove('deny', 'select');
      hintText.textContent = DEFAULT_HINT;
    }

    // MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) => 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/' + file
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    hands.onResults((results) => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness[0].label;

        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: 'rgba(0,255,200,0.4)', lineWidth: 2 });
        drawLandmarks(ctx, landmarks, { color: '#0ff', lineWidth: 1, radius: 3 });

        const gesture = classifyGesture(landmarks, handedness);
        updateProgress(gesture);
      } else {
        updateProgress(null);
      }
    });

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        showCameraFallback(
          'Camera API unavailable',
          'This host cannot access camera APIs on this system.'
        );
        return;
      }

      const videoInputCount = await getVideoInputCount();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();

        const cam = new Camera(video, {
          onFrame: async () => { await hands.send({ image: video }); },
          width: 640, height: 480,
        });
        cam.start();
      } catch (err) {
        console.error('Camera error:', err);
        const cameraError = classifyCameraError(err, videoInputCount);
        showCameraFallback(cameraError.title, cameraError.detail, cameraError.color);
      }
    }

    startCamera();
  <\/script>
</body>
</html>
`;

const windowHeight = hasNumberSelections ? 520 + selectOptions.length * 36 : 520;

const result = await prompt(html, {
  width: 640,
  height: windowHeight,
  title: hasNumberSelections ? 'Gesture Select' : 'Gesture Confirm',
  timeout: timeoutMs,
});

if (result) {
  if (result.decision) {
    console.log(JSON.stringify({ permissionDecision: result.decision }));
  } else if (result.value) {
    console.log(JSON.stringify(result));
  } else {
    console.log(JSON.stringify({ permissionDecision: 'deny' }));
  }
} else {
  console.log(JSON.stringify({ permissionDecision: 'deny' }));
}
