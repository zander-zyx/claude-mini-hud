/**
 * claude-mini-hud smoke tests
 *
 * 用法: npm test (= npm run build && node --test)
 *
 * 跑 stdin 冒烟测试: npm run test:stdin
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist', 'index.js');

function runCli(input: string, env: NodeJS.ProcessEnv = process.env) {
  return spawnSync('node', [DIST], {
    input,
    encoding: 'utf8',
    timeout: 3000,
    env: { ...env, NO_COLOR: '1' },  // 禁掉 NO_COLOR 让 ANSI 仍输出
  });
}

test('cli 接受 stdin JSON 并输出必显行 (context + token)', () => {
  const input = JSON.stringify({
    model: { display_name: 'MiniMax-M3' },
    context_window: {
      current_usage: {
        input_tokens: 100000,
        cache_creation_input_tokens: 1000,
      },
      context_window_size: 1000000,
    },
    transcript_path: '/tmp/nonexistent.jsonl',
  });

  const result = runCli(input);
  assert.equal(result.status, 0, `exit code 应为 0, 实际 ${result.status}: ${result.stderr}`);
  const lines = result.stdout.trim().split('\n');

  // 默认显示: context + token (无 todo / model)
  assert.ok(lines.length >= 2, `应至少 2 行, 实际 ${lines.length}: ${result.stdout}`);
  assert.ok(lines[0].includes('上下文'), `第 1 行应是上下文: ${lines[0]}`);
  assert.ok(lines.some((l: string) => l.includes('Token')), `应有 Token 行`);
});

test('默认不显示模型行 (SHOW_MODEL 未设)', () => {
  const input = JSON.stringify({
    model: { display_name: 'MiniMax-M3' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  // 默认隐藏模型行 (除非 SHOW_MODEL=1)
  assert.ok(
    !result.stdout.includes('🤖 模型'),
    `默认不应输出"🤖 模型"行, 实际: ${result.stdout}`
  );
});

test('CLAUDE_MINI_HUD_SHOW_MODEL=1 显示模型行', () => {
  const input = JSON.stringify({
    model: { display_name: 'MiniMax-M3' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
  });

  const result = runCli(input, { ...process.env, CLAUDE_MINI_HUD_SHOW_MODEL: '1' });
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('模型') && result.stdout.includes('MiniMax-M3'),
    `SHOW_MODEL=1 应输出模型行, 实际: ${result.stdout}`
  );
});

test('空 stdin 输出 fallback', () => {
  const result = runCli('');
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('上下文') || result.stdout.includes('fallback'));
});

test('进度条在 > 80% 时使用红色', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: {
      current_usage: { input_tokens: 170000 },
      context_window_size: 200000,
      used_percentage: 85,
    },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('\x1b[31m') && result.stdout.includes('85%'),
    `应输出红色 + 85%, 实际: ${result.stdout}`
  );
});

test('进度条在 < 60% 时使用绿色', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: {
      current_usage: { input_tokens: 50000 },
      context_window_size: 200000,
      used_percentage: 25,
    },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('\x1b[32m'),
    `应输出绿色 ANSI, 实际: ${result.stdout}`
  );
});

test('上下文行格式 used/total + 剩余', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: {
      current_usage: { input_tokens: 100000 },  // 100k
      context_window_size: 1000000,              // 1M
      used_percentage: 10,
    },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  // 期望: 📊 上下文 ... 100k / 1M  剩余 900k
  assert.ok(result.stdout.includes('100k / 1M'), `应输出 "100k / 1M", 实际: ${result.stdout}`);
  assert.ok(result.stdout.includes('剩余'), `应输出"剩余", 实际: ${result.stdout}`);
});

test('Token 行细分 in/out/cache', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: {
      current_usage: {
        input_tokens: 22000,
        output_tokens: 342,
        cache_creation_input_tokens: 768,
        cache_read_input_tokens: 0,
      },
      context_window_size: 200000,
    },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  // 期望: 🪙 Token 23k (in 22k · out 342 · cache 768)
  assert.ok(result.stdout.includes('Token'), `应有 Token 行: ${result.stdout}`);
  assert.ok(result.stdout.includes('23k'), `应输出总数 23k (22k+342+768≈23k), 实际: ${result.stdout}`);
  assert.ok(result.stdout.includes('in 22k'), `应有 in 22k: ${result.stdout}`);
  assert.ok(result.stdout.includes('out 342'), `应有 out 342: ${result.stdout}`);
  assert.ok(result.stdout.includes('cache 768'), `应有 cache 768: ${result.stdout}`);
});

test('从 transcript_path 读取 todos', () => {
  const tmpFile = '/tmp/claude-mini-hud-test.jsonl';
  const entry = JSON.stringify({
    type: 'user',
    todos: [
      { content: '调研充电行业', status: 'completed', activeForm: '调研充电行业' },
      { content: '写 skill', status: 'in_progress', activeForm: '正在写 skill' },
      { content: '写 cron', status: 'pending', activeForm: '写 cron' },
    ],
  });
  writeFileSync(tmpFile, entry + '\n');

  const input = JSON.stringify({
    model: { display_name: 'MiniMax-M3' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
    transcript_path: tmpFile,
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('当前任务'), `应输出"当前任务"行`);
  assert.ok(
    result.stdout.includes('写 skill') || result.stdout.includes('正在写 skill'),
    `应输出 in-progress todo: ${result.stdout}`
  );
  assert.ok(result.stdout.includes('1/3'), `应显示完成度 1/3`);
});

test('检测非 Anthropic provider (minimaxi) 仅在 SHOW_MODEL=1 时可见', () => {
  const input = JSON.stringify({
    model: { display_name: 'MiniMax-M3' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
  });

  const result = runCli(input, { ...process.env, ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic', CLAUDE_MINI_HUD_SHOW_MODEL: '1' });
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('MiniMax-M3'),
    `SHOW_MODEL + minimaxi 应输出模型名, 实际: ${result.stdout}`
  );
});

test('CLAUDE_MINI_HUD_LANG=zh 显示中文 (默认)', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
  });

  const result = runCli(input);
  assert.equal(result.status, 0);
  assert.ok(
    result.stdout.includes('上下文') || result.stdout.includes('Token'),
    `默认中文应含"上下文"或"Token": ${result.stdout}`
  );
});

test('CLAUDE_MINI_HUD_LANG=en 显示英文', () => {
  const input = JSON.stringify({
    model: { display_name: 'test' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
  });

  const result = runCli(input, { ...process.env, CLAUDE_MINI_HUD_LANG: 'en' });
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('Context'), `LANG=en 应含 "Context": ${result.stdout}`);
  assert.ok(result.stdout.includes('Token'), `LANG=en 应含 "Token": ${result.stdout}`);
  const zhMarkers = ['上下文', '当前任务', '剩余'];
  const hasZh = zhMarkers.some((m) => result.stdout.includes(m));
  assert.equal(hasZh, false, `LANG=en 不应输出中文, 实际: ${result.stdout}`);
});