#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? join(__dirname, '..', '..');
const scriptsDir = join(pluginRoot, 'scripts');
const gestureScript = join(scriptsDir, 'gesture-confirm.mjs');

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

function hookDecision(decision, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
}

function buildHookDecision(result) {
  const parsed = result.stdout ? JSON.parse(result.stdout) : null;
  const selectedValue = parsed?.value;
  const decision = selectedValue === 'allow' || selectedValue === 'deny' || selectedValue === 'ask'
    ? selectedValue
    : 'deny';
  const label = parsed?.label ? String(parsed.label) : decision;
  return hookDecision(decision, `Gesture selection: ${label}`);
}

try {
  const payload = parseInput(readStdin());
  const result = runDialog(buildMessage(payload), extractChoices(payload));

  if (result.status !== 0) {
    process.stdout.write(JSON.stringify(hookDecision('deny', 'Gesture confirmation failed')));
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(buildHookDecision(result)));
} catch (error) {
  const reason = error instanceof Error ? error.message : 'Gesture confirmation failed';
  process.stdout.write(JSON.stringify(hookDecision('deny', reason)));
}
