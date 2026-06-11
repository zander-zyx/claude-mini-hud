/**
 * claude-mini-hud 用量查询 smoke tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CACHE_DIR = join(homedir(), '.claude-mini-hud', 'usage-cache');

test('detectPlatform: claude 原生 (有 rate_limits)', async () => {
  // 动态 import ESM 模块
  const { detectPlatform } = await import('../src/usage.js');
  const stdin = {
    model: { display_name: 'Claude-Sonnet' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
    rate_limits: {
      five_hour: { used_percentage: 45 },
      seven_day: { used_percentage: 12 },
    },
  };
  const result = detectPlatform(stdin);
  assert.equal(result, 'claude');
});

test('detectPlatform: deepseek (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic';
  process.env.ANTHROPIC_MODEL = 'deepseek-v4-pro';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'deepseek');
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_MODEL;
});

test('detectPlatform: minimax (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.minimaxi.com/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'minimax');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: null (unknown provider)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, null);
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: kimi (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.cn/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'kimi');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: zhipu (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://open.bigmodel.cn/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'zhipu');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('readCache: 无缓存返回 null', async () => {
  const { readCache } = await import('../src/usage.js');
  const result = readCache('nonexistent-platform-xyz');
  assert.equal(result, null);
});

test('writeCache + readCache 读写', async () => {
  // 直接用 fs 验证缓存文件的写入和读取路径一致
  const { readCache } = await import('../src/usage.js');
  const { writeFileSync, mkdirSync: mkdir, existsSync } = await import('node:fs');

  const testDir = join(homedir(), '.claude-mini-hud', 'usage-cache');
  mkdir(testDir, { recursive: true });
  const cacheFile = join(testDir, 'test-platform.json');

  // 写入有效缓存
  const data = {
    provider: 'test-platform',
    miniMax: { remainingTokens: 850000, totalTokens: 1000000 },
    updatedAt: Date.now(),
  };
  writeFileSync(cacheFile, JSON.stringify(data));
  assert.ok(existsSync(cacheFile), '缓存文件应存在');

  // 验证 readCache 能读到
  const cached = readCache('test-platform');
  assert.ok(cached !== null, `应成功读取缓存, 文件路径: ${cacheFile}`);
  assert.equal(cached!.provider, 'test-platform');
  assert.equal(cached!.miniMax!.remainingTokens, 850000);

  // 清理
  rmSync(cacheFile, { force: true });
});

test('readCache: 过期缓存返回 null', async () => {
  const { readCache } = await import('../src/usage.js');
  const { mkdirSync: mkdir } = await import('node:fs');

  mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, 'expired-platform.json');
  const data = {
    provider: 'expired-platform',
    deepSeek: { totalBalance: 100, toppedUpBalance: 50, grantedBalance: 50 },
    updatedAt: Date.now() - 10 * 60 * 1000,  // 10 分钟前
  };
  writeFileSync(cacheFile, JSON.stringify(data));

  const cached = readCache('expired-platform');
  assert.equal(cached, null, '过期缓存应返回 null');

  rmSync(cacheFile, { force: true });
});

test('getUsageData: 无平台返回 null', async () => {
  const { getUsageData } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = getUsageData(stdin);
  assert.equal(result, null);
  delete process.env.ANTHROPIC_BASE_URL;
});

test('端到端: Claude rate_limits 从 stdin 直接输出', async () => {
  const { getUsageData } = await import('../src/usage.js');
  const stdin = {
    model: { display_name: 'Claude' },
    context_window: { current_usage: { input_tokens: 1000 }, context_window_size: 200000 },
    rate_limits: {
      five_hour: { used_percentage: 45, resets_at: 1718123456 },
      seven_day: { used_percentage: 80, resets_at: 1718467200 },
    },
  };
  const result = getUsageData(stdin);
  assert.ok(result !== null, 'Claude 原生应有 rate_limits');
  assert.equal(result!.provider, 'claude');
  assert.equal(result!.claude!.fiveHour, 45);
  assert.equal(result!.claude!.sevenDay, 80);
  assert.equal(result!.claude!.fiveHourResetAt, 1718123456);
});
