#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? join(__dirname, '..', '..');
const scriptsDir = join(pluginRoot, 'scripts');
const gestureScript = join(scriptsDir, 'gesture-confirm.mjs');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readStdin() {
  return readFileSync(0, 'utf8');
}

function parseInput(raw) {
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function truncate(value, max = 120) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function runDialog(message, choices) {
  const result = spawnSync(
    process.execPath,
    [
      gestureScript,
      '--message',
      message,
      '--choices-json',
      JSON.stringify(choices),
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }
  );

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
  };
}

function parseDialogResult(result) {
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PreToolUse handler (Bash, Write, Edit, etc.)
// ---------------------------------------------------------------------------

function buildMessage(payload) {
  const toolName = payload.tool_name ?? 'Tool';
  const input = payload.tool_input ?? {};

  if (toolName === 'Bash') {
    const command = truncate(input.command ?? input.cmd);
    return command ? `Bash: ${command}` : 'Approve Bash command?';
  }

  if (toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit') {
    const filePath = truncate(input.file_path ?? input.path);
    return filePath ? `${toolName}: ${filePath}` : `Approve ${toolName}?`;
  }

  return `Approve ${toolName}?`;
}

function normalizeChoice(choice) {
  if (typeof choice === 'string') {
    return { label: choice, value: choice };
  }

  if (!choice || typeof choice !== 'object') {
    return null;
  }

  const label = choice.label ?? choice.title ?? choice.name ?? choice.text;
  if (typeof label !== 'string' || !label.trim()) {
    return null;
  }

  const value = Object.hasOwn(choice, 'value')
    ? choice.value
    : Object.hasOwn(choice, 'id')
      ? choice.id
      : label;

  return { label: label.trim(), value };
}

function extractChoices(payload) {
  const candidates = [
    payload.options,
    payload.choices,
    payload.tool_input?.options,
    payload.tool_input?.choices,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length === 0) continue;

    const choices = candidate
      .map(normalizeChoice)
      .filter(Boolean)
      .slice(0, 5);

    if (choices.length > 0) {
      return choices;
    }
  }

  return [
    { label: 'Allow', value: 'allow' },
    { label: 'Deny', value: 'deny' },
  ];
}

function preToolUseDecision(decision, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
}

function handlePreToolUse(payload) {
  const choices = extractChoices(payload);
  const result = runDialog(buildMessage(payload), choices);
  const parsed = parseDialogResult(result);

  if (!parsed) {
    return preToolUseDecision('deny', 'Gesture confirmation failed');
  }

  const selectedValue = parsed.value ?? parsed.decision;
  const decision = selectedValue === 'allow' || selectedValue === 'deny' || selectedValue === 'ask'
    ? selectedValue
    : 'deny';
  const label = parsed.label ? String(parsed.label) : decision;
  return preToolUseDecision(decision, `Gesture selection: ${label}`);
}

// ---------------------------------------------------------------------------
// PermissionRequest handler (ExitPlanMode, AskUserQuestion)
// ---------------------------------------------------------------------------

function permissionRequestAllow(updatedInput, updatedPermissions) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'allow',
        ...(updatedInput !== undefined && { updatedInput }),
        ...(updatedPermissions !== undefined && { updatedPermissions }),
      },
    },
  };
}

function permissionRequestDeny(message) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PermissionRequest',
      decision: {
        behavior: 'deny',
        ...(message && { message }),
      },
    },
  };
}

function handleExitPlanMode(payload) {
  // Labels must NOT match allow/deny keywords in gesture-confirm.mjs
  // (allow/approve/accept/yes → allowChoice, deny/reject/cancel/no → denyChoice)
  // so all 3 options are classified as numberedChoices (1-3 fingers).
  const choices = [
    { label: 'Auto-edit mode', value: 'acceptEdits' },
    { label: 'Manual mode', value: 'default' },
    { label: 'Keep planning', value: 'deny' },
  ];

  const result = runDialog('Approve plan?', choices);
  const parsed = parseDialogResult(result);

  if (!parsed) {
    return permissionRequestDeny('Gesture confirmation failed');
  }

  const selected = parsed.value ?? parsed.decision;

  if (selected === 'deny') {
    return permissionRequestDeny('Gesture: keep planning');
  }

  // Map gesture selection to permission mode
  const mode = selected === 'acceptEdits' ? 'acceptEdits' : 'default';
  const label = parsed.label ? String(parsed.label) : mode;

  return permissionRequestAllow(
    {},
    [{ type: 'setMode', mode, destination: 'session' }],
  );
}

function handleAskUserQuestion(payload) {
  const input = payload.tool_input ?? {};
  const questions = input.questions;

  if (!Array.isArray(questions) || questions.length === 0) {
    return permissionRequestDeny('No questions found');
  }

  const answers = {};

  for (const q of questions) {
    const questionText = q.question ?? '';
    const options = Array.isArray(q.options) ? q.options : [];

    if (options.length === 0) {
      // No options to select from — skip this question
      continue;
    }

    // Build gesture choices from question options (max 5)
    const choices = options.slice(0, 5).map((opt, i) => ({
      label: opt.label ?? `Option ${i + 1}`,
      value: opt.label ?? `Option ${i + 1}`,
    }));

    // Add deny/cancel as fist gesture
    choices.push({ label: 'Skip', value: '__skip__' });

    const message = truncate(questionText, 200);
    const result = runDialog(message, choices);
    const parsed = parseDialogResult(result);

    if (!parsed || parsed.value === '__skip__') {
      return permissionRequestDeny('Gesture: skipped question');
    }

    answers[questionText] = String(parsed.value ?? parsed.label ?? '');
  }

  // Return answers injected into updatedInput
  return permissionRequestAllow(
    { questions, answers },
    undefined,
  );
}

function handlePermissionRequest(payload) {
  const toolName = payload.tool_name ?? '';

  if (toolName === 'ExitPlanMode') {
    return handleExitPlanMode(payload);
  }

  if (toolName === 'AskUserQuestion') {
    return handleAskUserQuestion(payload);
  }

  // Fallback: generic allow/deny
  const choices = [
    { label: 'Allow', value: 'allow' },
    { label: 'Deny', value: 'deny' },
  ];

  const result = runDialog(`Approve ${toolName}?`, choices);
  const parsed = parseDialogResult(result);

  if (!parsed || parsed.value === 'deny') {
    return permissionRequestDeny('Gesture: denied');
  }

  return permissionRequestAllow({}, undefined);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  const payload = parseInput(readStdin());
  const hookEvent = payload.hook_event_name ?? 'PreToolUse';

  let output;
  if (hookEvent === 'PermissionRequest') {
    output = handlePermissionRequest(payload);
  } else {
    output = handlePreToolUse(payload);
  }

  process.stdout.write(JSON.stringify(output));
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Gesture confirmation failed';
  // Fall back to PreToolUse deny format (compatible with both event types)
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}
