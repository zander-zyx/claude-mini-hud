/**
 * claude-mini-hud — 多平台用量/余额查询
 *
 * 零依赖: 只用 Node.js 内置 https / fs / path / os.
 *
 * 支持平台:
 *   - Claude 原生  : 从 stdin.rate_limits 读取 (5小时 / 7天), 无需 HTTP
 *   - MiniMax      : Coding Plan 剩余 token
 *   - DeepSeek      : 账户余额 (CNY)
 *   - Kimi          : Moonshot 余额 (CNY)
 *   - 智谱          : GLM Coding Plan 用量
 *   - New API      : 开源网关, /api/user/self (含 OpenAI / Claude / 自建代理)
 */

import type { StdinData } from './index.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { get as httpGetImpl } from 'node:http';
import { get as httpsGetImpl } from 'node:https';

// ─── 类型 ─────────────────────────────────────────────────────────────────

export interface MiniMaxUsage {
  remainingTokens: number;
  totalTokens?: number;
}

export interface DeepSeekBalance {
  totalBalance: number;     // CNY
  toppedUpBalance: number;
  grantedBalance: number;
}

export interface ClaudeRateLimit {
  fiveHour: number | null;      // 0-100 百分比
  sevenDay: number | null;
  fiveHourResetAt?: number;     // unix 时间戳 (秒)
  sevenDayResetAt?: number;
}

export interface NewApiQuota {
  quota: number;
  usedQuota: number;
  quotaDisplay?: string;
}

export interface KimiBalance {
  totalBalance: number;     // CNY
  grantedBalance?: number;  // 赠送余额
}

export interface ZhipuUsage {
  usedPercent?: number;    // 5小时窗口 Token 已用百分比 (0-100)
  weeklyPercent?: number;  // 周限额 Token 已用百分比 (0-100)
  mcpPercent?: number;     // MCP 工具用量百分比 (0-100)
  mcpUsed?: number;        // MCP 已用次数
  mcpTotal?: number;       // MCP 总次数
  level?: string;          // 套餐等级 (如 "pro")
  resetAt?: number;        // 5小时窗口重置时间 (unix 秒)
}

export interface UsageData {
  provider: string;
  miniMax?: MiniMaxUsage;
  deepSeek?: DeepSeekBalance;
  kimi?: KimiBalance;
  zhipu?: ZhipuUsage;
  claude?: ClaudeRateLimit;
  newApi?: NewApiQuota;
  updatedAt: number;
}

// ─── 常量 ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;

const MINIMAX_API = 'https://www.minimaxi.com/v1/api/openplatform/coding_plan/remains';
const DEEPSEEK_API = 'https://api.deepseek.com/user/balance';
const KIMI_API = 'https://api.moonshot.cn/v1/users/me/balance';
const ZHIPU_QUOTA_ENDPOINT = '/monitor/usage/quota/limit';

// ─── 平台检测 ─────────────────────────────────────────────────────────────

/** 检测当前使用的平台 */
export function detectPlatform(stdin: StdinData): string | null {
  // 1) Claude 原生: 有 rate_limits 数据
  if (stdin.rate_limits?.five_hour || stdin.rate_limits?.seven_day) {
    return 'claude';
  }

  // 2) New API 特征: base URL 含特定路径 或 模型名含 "new-api"
  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
  const model = (
    process.env.ANTHROPIC_MODEL ??
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL ??
    ''
  ).toLowerCase();

  if (url.includes('new-api') || model.includes('new-api')) return 'new-api';

  // 3) MiniMax
  if (url.includes('minimaxi.com') || url.includes('minimax')) return 'minimax';

  // 4) DeepSeek
  if (url.includes('deepseek.com') || url.includes('deepseek')) return 'deepseek';

  // 5) Kimi / Moonshot
  if (url.includes('moonshot.cn') || url.includes('moonshot.ai') || url.includes('kimi')) return 'kimi';

  // 6) 智谱 / GLM
  if (url.includes('bigmodel.cn') || url.includes('zhipu') || url.includes('glm')) return 'zhipu';

  // 7) 通用 New API 检测: base URL 非标准 Anthropic/OpenAI
  if (url && !url.includes('anthropic.com') && !url.includes('openai.com')) {
    // 尝试通过 /api/user/self 判断是否为 New API (在异步查询中验证)
    return 'new-api';
  }

  return null;
}

// ─── 缓存 ─────────────────────────────────────────────────────────────────

function getCachePath(platform: string): string {
  return join(homedir(), '.claude-mini-hud', 'usage-cache', `${platform}.json`);
}

export function readCache(platform: string): UsageData | null {
  try {
    const file = getCachePath(platform);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, 'utf8')) as UsageData;
    if (!data.provider || !data.updatedAt) return null;
    if (Date.now() - data.updatedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(platform: string, data: UsageData): void {
  try {
    const file = getCachePath(platform);
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // 静默
  }
}

// ─── Claude 原生: 从 stdin 读取 rate_limits (无需 HTTP) ─────────────────

function getClaudeRateLimit(stdin: StdinData): UsageData | null {
  const rl = stdin.rate_limits;
  if (!rl) return null;

  const fiveHour = rl.five_hour?.used_percentage;
  const sevenDay = rl.seven_day?.used_percentage;

  if (typeof fiveHour !== 'number' && typeof sevenDay !== 'number') return null;

  return {
    provider: 'claude',
    claude: {
      fiveHour: typeof fiveHour === 'number' ? Math.round(fiveHour) : null,
      sevenDay: typeof sevenDay === 'number' ? Math.round(sevenDay) : null,
      fiveHourResetAt: rl.five_hour?.resets_at,
      sevenDayResetAt: rl.seven_day?.resets_at,
    },
    updatedAt: Date.now(),
  };
}

// ─── HTTP 查询 ────────────────────────────────────────────────────────────

function httpGet(url: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? httpsGetImpl : httpGetImpl;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const req = lib(url, { headers, timeout: HTTP_TIMEOUT_MS }, (res: any) => {
      let body = '';
      res.on('data', (chunk: string) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(body);
        else reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function queryMiniMax(apiKey: string): Promise<UsageData | null> {
  try {
    const body = await httpGet(MINIMAX_API, apiKey);
    const json = JSON.parse(body);
    const remaining = json.remaining_tokens ?? json.remainingTokens ?? json.remain;
    if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null;
    return {
      provider: 'minimax',
      miniMax: {
        remainingTokens: Math.round(remaining),
        totalTokens: typeof json.total_tokens === 'number' ? Math.round(json.total_tokens) : undefined,
      },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function queryDeepSeek(apiKey: string): Promise<UsageData | null> {
  try {
    const body = await httpGet(DEEPSEEK_API, apiKey);
    const json = JSON.parse(body);
    const info = json.balance_infos?.[0];
    if (!info) return null;
    return {
      provider: 'deepseek',
      deepSeek: {
        totalBalance: parseFloat(info.total_balance ?? '0'),
        toppedUpBalance: parseFloat(info.topped_up_balance ?? '0'),
        grantedBalance: parseFloat(info.granted_balance ?? '0'),
      },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function queryNewApi(apiKey: string): Promise<UsageData | null> {
  try {
    // 从 ANTHROPIC_BASE_URL 提取 New API 实例地址
    const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? '').replace(/\/anthropic\/?$/, '').replace(/\/$/, '');
    if (!baseUrl) return null;

    const apiUrl = `${baseUrl}/api/user/self`;
    const body = await httpGet(apiUrl, apiKey);
    const json = JSON.parse(body);

    // New API 响应: { "success": true, "data": { "quota": 500000, "used_quota": 123456 } }
    const data = json.data ?? json;
    const quota = data.quota;
    const usedQuota = data.used_quota ?? data.used ?? 0;

    if (typeof quota !== 'number' || !Number.isFinite(quota)) return null;

    return {
      provider: 'new-api',
      newApi: {
        quota: Math.round(quota),
        usedQuota: Math.round(usedQuota),
        quotaDisplay: data.quota_display ?? undefined,
      },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function queryKimi(apiKey: string): Promise<UsageData | null> {
  try {
    const body = await httpGet(KIMI_API, apiKey);
    const json = JSON.parse(body);
    // Kimi 响应: { "data": { "available_balance": 42.50, "granted_balance": 10.00 } }
    const d = json.data ?? json;
    const balance = d.available_balance ?? d.balance ?? d.total_balance;
    if (typeof balance !== 'number' && typeof balance !== 'string') return null;
    return {
      provider: 'kimi',
      kimi: {
        totalBalance: parseFloat(String(balance)),
        grantedBalance: typeof d.granted_balance === 'number' ? d.granted_balance : undefined,
      },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function queryZhipu(apiKey: string): Promise<UsageData | null> {
  try {
    // 从 ANTHROPIC_BASE_URL 构建 API 地址: 去掉 /anthropic 后缀, 拼接监控端点
    const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? '')
      .replace(/\/anthropic\/?$/, '')
      .replace(/\/$/, '');
    if (!baseUrl) return null;

    const apiUrl = `${baseUrl}${ZHIPU_QUOTA_ENDPOINT}`;
    const body = await httpGet(apiUrl, apiKey);
    const json = JSON.parse(body);

    if (!json.success || !json.data?.limits) return null;

    const limits = json.data.limits as Array<{
      type: string;
      unit: number;
      usage?: number;
      currentValue?: number;
      percentage: number;
      nextResetTime?: number;
    }>;

    // unit=3 → 5小时窗口 Token 限额; unit=6 → 周限额; TIME_LIMIT → MCP
    let usedPercent: number | undefined;
    let weeklyPercent: number | undefined;
    let mcpPercent: number | undefined;
    let mcpUsed: number | undefined;
    let mcpTotal: number | undefined;
    let resetAt: number | undefined;

    for (const item of limits) {
      if (item.type === 'TOKENS_LIMIT' && item.unit === 3) {
        usedPercent = item.percentage;
        resetAt = item.nextResetTime ? Math.round(item.nextResetTime / 1000) : undefined;
      } else if (item.type === 'TOKENS_LIMIT' && item.unit === 6) {
        weeklyPercent = item.percentage;
      } else if (item.type === 'TIME_LIMIT') {
        mcpPercent = item.percentage;
        mcpUsed = item.currentValue;
        mcpTotal = item.usage;
      }
    }

    if (usedPercent === undefined && weeklyPercent === undefined && mcpPercent === undefined) {
      return null;
    }

    return {
      provider: 'zhipu',
      zhipu: {
        usedPercent: typeof usedPercent === 'number' ? Math.round(usedPercent) : undefined,
        weeklyPercent: typeof weeklyPercent === 'number' ? Math.round(weeklyPercent) : undefined,
        mcpPercent: typeof mcpPercent === 'number' ? Math.round(mcpPercent) : undefined,
        mcpUsed,
        mcpTotal,
        level: json.data.level ?? undefined,
        resetAt,
      },
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

/** 异步刷新缓存 (不阻塞) */
async function refreshCache(platform: string, apiKey: string, stdin: StdinData): Promise<void> {
  let data: UsageData | null = null;

  switch (platform) {
    case 'claude':
      data = getClaudeRateLimit(stdin);
      break;
    case 'minimax':
      data = await queryMiniMax(apiKey);
      break;
    case 'deepseek':
      data = await queryDeepSeek(apiKey);
      break;
    case 'new-api':
      data = await queryNewApi(apiKey);
      break;
    case 'kimi':
      data = await queryKimi(apiKey);
      break;
    case 'zhipu':
      data = await queryZhipu(apiKey);
      break;
  }

  if (data) writeCache(platform, data);
}

/** 获取用量数据: Claude 原生直接用 stdin, 其他平台走缓存 + 异步刷新 */
export function getUsageData(stdin: StdinData): UsageData | null {
  const platform = detectPlatform(stdin);
  if (!platform) return null;

  // Claude 原生: 直接从 stdin 读取 rate_limits (最快)
  if (platform === 'claude') {
    const data = getClaudeRateLimit(stdin);
    // 也写缓存 (供无 rate_limits 的 tick 使用)
    if (data) writeCache('claude', data);
    return data;
  }

  // 其他平台: 缓存优先
  const cached = readCache(platform);
  if (cached) return cached;

  // 无缓存 → 异步刷新
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (apiKey) {
    refreshCache(platform, apiKey, stdin).catch(() => {});
  }

  return null;
}
