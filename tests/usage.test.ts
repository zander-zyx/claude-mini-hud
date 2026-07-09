/**
 * claude-mini-hud 用量查询 smoke tests
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
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
  process.env.ANTHROPIC_MODEL = 'glm-5.2';
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

test('detectPlatform: minimax 国际站 minimax.io', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.minimax.io/anthropic';
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

test('detectPlatform: kimi 国际站 moonshot.ai', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.moonshot.ai/v1/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'kimi');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: kimi-coding (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.kimi.com/coding/v1/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'kimi-coding');
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

test('detectPlatform: zhipu 国际站 z.ai', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/paas/v4/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'zhipu');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: xiaomi (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://token-plan-cn.xiaomimimo.com/anthropic';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'xiaomi');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: alibaba (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'alibaba');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: volcengine (by base URL)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://ark.cn-beijing.volces.com/api/coding';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'volcengine');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: stepfun 国内站 api.stepfun.com', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.stepfun.com/step_plan';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'stepfun');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: stepfun 国际站 api.stepfun.ai', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.stepfun.ai/v1';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'stepfun');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: siliconflow 国内站 siliconflow.cn', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.siliconflow.cn/v1';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'siliconflow');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: siliconflow 国际站 siliconflow.com', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.siliconflow.com/v1';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'siliconflow');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: qianfan (百度千帆, 仅平台识别)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://qianfan.baidubce.com/v2/coding';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'qianfan');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: hunyuan (腾讯混元, 仅平台识别)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://api.hunyuan.cloud.tencent.com';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'hunyuan');
  delete process.env.ANTHROPIC_BASE_URL;
});

test('detectPlatform: spark (讯飞星辰, 仅平台识别)', async () => {
  const { detectPlatform } = await import('../src/usage.js');
  process.env.ANTHROPIC_BASE_URL = 'https://spark-api.xf-yun.com/v1';
  const stdin = { model: { display_name: 'test' }, context_window: {} };
  const result = detectPlatform(stdin);
  assert.equal(result, 'spark');
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
    miniMax: { intervalRemainingPercent: 85, weeklyRemainingPercent: 90, modelName: 'general' },
    updatedAt: Date.now(),
  };
  writeFileSync(cacheFile, JSON.stringify(data));
  assert.ok(existsSync(cacheFile), '缓存文件应存在');

  // 验证 readCache 能读到
  const cached = readCache('test-platform');
  assert.ok(cached !== null, `应成功读取缓存, 文件路径: ${cacheFile}`);
  assert.equal(cached!.provider, 'test-platform');
  assert.equal(cached!.miniMax!.intervalRemainingPercent, 85);
  assert.equal(cached!.miniMax!.weeklyRemainingPercent, 90);

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

test('getApiKeyForPlatform: alibaba 使用 ALIYUN_AK_ID/ALIYUN_AK_SECRET 触发刷新', async () => {
  const usage = await import('../src/usage.js') as unknown as {
    getApiKeyForPlatform: (platform: string) => string | null;
  };
  const oldAkId = process.env.ALIYUN_AK_ID;
  const oldAkSecret = process.env.ALIYUN_AK_SECRET;
  const oldDashscope = process.env.DASHSCOPE_API_KEY;
  const oldAuth = process.env.ANTHROPIC_AUTH_TOKEN;

  process.env.ALIYUN_AK_ID = 'test-ak-id';
  process.env.ALIYUN_AK_SECRET = 'test-ak-secret';
  delete process.env.DASHSCOPE_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  try {
    assert.equal(usage.getApiKeyForPlatform('alibaba'), 'aliyun-bss');
  } finally {
    if (oldAkId === undefined) delete process.env.ALIYUN_AK_ID; else process.env.ALIYUN_AK_ID = oldAkId;
    if (oldAkSecret === undefined) delete process.env.ALIYUN_AK_SECRET; else process.env.ALIYUN_AK_SECRET = oldAkSecret;
    if (oldDashscope === undefined) delete process.env.DASHSCOPE_API_KEY; else process.env.DASHSCOPE_API_KEY = oldDashscope;
    if (oldAuth === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN; else process.env.ANTHROPIC_AUTH_TOKEN = oldAuth;
  }
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

test('pickMiniMaxModel: 精确匹配当前模型 (MiniMax-M3)', async () => {
  const { pickMiniMaxModel } = await import('../src/usage.js');
  const list = [
    { model_name: 'general', current_interval_remaining_percent: 80 },
    { model_name: 'MiniMax-M3', current_interval_remaining_percent: 91 },
    { model_name: 'M1', current_interval_remaining_percent: 100 },
  ];
  const result = pickMiniMaxModel(list, 'MiniMax-M3');
  assert.equal(result.model_name, 'MiniMax-M3', '应精确匹配 MiniMax-M3');
});

test('pickMiniMaxModel: 大小写/分隔符无关匹配 (minimax-m3 vs MiniMax_M3)', async () => {
  const { pickMiniMaxModel } = await import('../src/usage.js');
  const list = [
    { model_name: 'general', current_interval_remaining_percent: 80 },
    { model_name: 'MiniMax_M3', current_interval_remaining_percent: 91 },
  ];
  // env 是 "minimax-m3", API 是 "MiniMax_M3" → 标准化后都是 "minimaxm3" → 匹配
  const result = pickMiniMaxModel(list, 'minimax-m3');
  assert.equal(result.model_name, 'MiniMax_M3');
});

test('pickMiniMaxModel: 短名匹配长名 (M3 vs MiniMax-M3)', async () => {
  const { pickMiniMaxModel } = await import('../src/usage.js');
  const list = [
    { model_name: 'MiniMax-M3', current_interval_remaining_percent: 91 },
    { model_name: 'general', current_interval_remaining_percent: 80 },
  ];
  // env 是 "M3", API 是 "MiniMax-M3" → 双向子串匹配
  const result = pickMiniMaxModel(list, 'M3');
  assert.equal(result.model_name, 'MiniMax-M3');
});

test('pickMiniMaxModel: 无当前模型时回退到 general', async () => {
  const { pickMiniMaxModel } = await import('../src/usage.js');
  const list = [
    { model_name: 'MiniMax-M3', current_interval_remaining_percent: 91 },
    { model_name: 'general', current_interval_remaining_percent: 80 },
  ];
  const result = pickMiniMaxModel(list, null);
  assert.equal(result.model_name, 'general', '无当前模型时回退到 general');
});

test('pickMiniMaxModel: 匹配失败时跳过 general, 取第一条', async () => {
  const { pickMiniMaxModel } = await import('../src/usage.js');
  const list = [
    { model_name: 'MiniMax-M3', current_interval_remaining_percent: 91 },
  ];
  // 当前模型是 unknown-xyz → 双向都不匹配 → 没有 general → 取第一条
  const result = pickMiniMaxModel(list, 'unknown-xyz');
  assert.equal(result.model_name, 'MiniMax-M3');
});
