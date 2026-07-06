/**
 * claude-mini-hud — 多平台用量/余额查询
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 零依赖: 只用 Node.js 内置 https / fs / path / os.
 *
 * 支持平台:
 *   - Claude 原生  : 从 stdin.rate_limits 读取 (5小时 / 7天), 无需 HTTP
 *   - MiniMax      : Coding Plan 剩余 token (5h / 7d / 月)
 *   - DeepSeek      : 账户余额 (CNY)
 *   - Kimi          : Moonshot 余额 (CNY)
 *   - Kimi Coding   : Coding Plan 用量 (5h / 周限额)
 *   - 智谱          : GLM Coding Plan 用量 (5h / 7d / 月 / MCP)
 *   - 小米          : MiMo Token Plan 固定额度
 *   - 阿里          : DashScope (暂无公开 API)
 *   - 火山引擎      : Ark (暂无公开 API)
 *   - 阶跃星辰      : StepFun 账户余额 (CNY)
 *   - 硅基流动      : SiliconFlow 账户余额 (CNY)
 *   - 百度千帆      : Qianfan (暂无公开 API, 仅平台识别)
 *   - 腾讯混元      : Hunyuan (暂无公开 API, 仅平台识别)
 *   - 讯飞星辰      : Astron (包月订阅, 仅平台识别)
 */

import type { StdinData } from './types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { get as httpGetImpl } from 'node:http';
import { get as httpsGetImpl } from 'node:https';
import { createHmac } from 'node:crypto';
import { debugLog } from './log.js';

// ─── 类型 ─────────────────────────────────────────────────────────────────

export interface MiniMaxUsage {
  intervalRemainingPercent?: number;   // 当前 5小时窗口剩余百分比 (0-100)
  weeklyRemainingPercent?: number;     // 周窗口剩余百分比 (0-100)
  monthlyRemainingPercent?: number;    // 月窗口剩余百分比 (0-100)
  intervalResetAt?: number;            // 5小时窗口重置时间 (unix 秒)
  weeklyResetAt?: number;              // 周窗口重置时间 (unix 秒)
  monthlyResetAt?: number;             // 月窗口重置时间 (unix 秒)
  modelName?: string;                  // 主模型名 (如 "general")
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

export interface KimiBalance {
  totalBalance: number;     // CNY
  grantedBalance?: number;  // 赠送余额
}

/** 阶跃星辰 (StepFun) 余额 */
export interface StepFunBalance {
  totalBalance: number;     // CNY 可用余额 (balance)
  cashBalance: number;      // 充值金额 (total_cash_balance)
  voucherBalance: number;   // 代金券金额 (total_voucher_balance)
}

/** 硅基流动 (SiliconFlow) 余额 */
export interface SiliconFlowBalance {
  totalBalance: number;     // CNY 总可用余额 (totalBalance, 含赠送)
  balance: number;          // CNY 充值余额 (balance)
}

/** Kimi For Coding 用量: 5小时窗口 + 周限额 */
export interface KimiCodingUsage {
  fiveHourPercent?: number;   // 5小时窗口已用百分比 (0-100)
  weeklyPercent?: number;     // 周限额已用百分比 (0-100)
  fiveHourResetAt?: number;   // 5小时窗口重置时间 (unix 秒)
  weeklyResetAt?: number;     // 周限额重置时间 (unix 秒)
}

export interface ZhipuUsage {
  usedPercent?: number;    // 5小时窗口 Token 已用百分比 (0-100)
  weeklyPercent?: number;  // 周限额 Token 已用百分比 (0-100)
  monthlyPercent?: number; // 月限额 Token 已用百分比 (0-100)
  mcpPercent?: number;     // MCP 工具用量百分比 (0-100)
  mcpUsed?: number;        // MCP 已用次数
  mcpTotal?: number;       // MCP 总次数
  level?: string;          // 套餐等级 (如 "pro")
  resetAt?: number;        // 5小时窗口重置时间 (unix 秒)
  weeklyResetAt?: number;  // 周限额重置时间 (unix 秒)
  monthlyResetAt?: number; // 月限额重置时间 (unix 秒)
}

/** 固定额度套餐 (TOKEN PLAN) */
export interface FixedQuotaUsage {
  used: number;            // 已用 token 数 (或信用点)
  total: number;           // 总额度 token 数 (或信用点)
  plan?: string;           // 套餐名 (如 "max", "pro")
  expiresAt?: number;      // 到期时间 (unix 秒)
  monthlyPercent?: number; // 月度使用百分比 (0-100)
}

export interface UsageData {
  provider: string;
  miniMax?: MiniMaxUsage;
  deepSeek?: DeepSeekBalance;
  kimi?: KimiBalance;
  kimiCoding?: KimiCodingUsage;
  stepfun?: StepFunBalance;
  siliconflow?: SiliconFlowBalance;
  zhipu?: ZhipuUsage;
  claude?: ClaudeRateLimit;
  xiaomi?: FixedQuotaUsage;
  alibaba?: FixedQuotaUsage;
  volcengine?: FixedQuotaUsage;
  updatedAt: number;
}

// ─── 常量 ─────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;

const DEEPSEEK_API = 'https://api.deepseek.com/user/balance';
const ZHIPU_QUOTA_ENDPOINT = '/monitor/usage/quota/limit';

/** StepFun 余额 API: 国内站 api.stepfun.com, 国际站 api.stepfun.ai */
function getStepFunApiUrl(): string {
  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
  if (url.includes('stepfun.ai')) {
    return 'https://api.stepfun.ai/v1/accounts';
  }
  return 'https://api.stepfun.com/v1/accounts';
}

/** SiliconFlow 余额 API: 国内站 api.siliconflow.cn, 国际站 api.siliconflow.com */
function getSiliconFlowApiUrl(): string {
  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
  if (url.includes('siliconflow.com')) {
    return 'https://api.siliconflow.com/v1/user/info';
  }
  return 'https://api.siliconflow.cn/v1/user/info';
}

/** MiniMax 用量 API: 国内站 api.minimaxi.com, 国际站 api.minimax.io */
function getMiniMaxApiUrl(): string {
  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
  if (url.includes('minimax.io')) {
    return 'https://api.minimax.io/v1/api/openplatform/coding_plan/remains';
  }
  return 'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains';
}

/** Kimi 余额 API: 国内站 moonshot.cn, 国际站 moonshot.ai */
function getKimiApiUrl(): string {
  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
  if (url.includes('moonshot.ai')) {
    return 'https://api.moonshot.ai/v1/users/me/balance';
  }
  return 'https://api.moonshot.cn/v1/users/me/balance';
}

// ─── 平台检测 ─────────────────────────────────────────────────────────────

/** 检测当前使用的平台 */
export function detectPlatform(stdin: StdinData): string | null {
  // 1) Claude 原生: 有 rate_limits 数据
  if (stdin.rate_limits?.five_hour || stdin.rate_limits?.seven_day) {
    return 'claude';
  }

  const url = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();

  // 2) MiniMax (国内站 minimaxi.com / 国际站 minimax.io)
  if (url.includes('minimaxi.com') || url.includes('minimax.io')) return 'minimax';

  // 3) DeepSeek
  if (url.includes('deepseek.com') || url.includes('deepseek')) return 'deepseek';

  // 4) Kimi Coding (api.kimi.com/coding)
  if (url.includes('api.kimi.com/coding')) return 'kimi-coding';

  // 5) Kimi / Moonshot (余额查询)
  if (url.includes('moonshot.cn') || url.includes('moonshot.ai') || url.includes('kimi')) return 'kimi';

  // 6) 智谱 / GLM / Z.AI (国际站)
  if (url.includes('bigmodel.cn') || url.includes('zhipu') || url.includes('glm') || url.includes('z.ai')) return 'zhipu';

  // 7) 小米 / MiMo
  if (url.includes('xiaomimimo') || url.includes('xiaomi') || url.includes('mimo.xiaomi')) return 'xiaomi';

  // 8) 阿里 / DashScope / 百炼 / Qwen
  if (url.includes('dashscope') || url.includes('aliyun') || url.includes('qwen') || url.includes('bailian')) return 'alibaba';

  // 9) 火山引擎 / Ark
  if (url.includes('volces.com') || url.includes('volcengine') || url.includes('ark.cn')) return 'volcengine';

  // 10) 阶跃星辰 / StepFun (国内站 api.stepfun.com / 国际站 api.stepfun.ai)
  if (url.includes('stepfun.com') || url.includes('stepfun.ai') || url.includes('stepfun')) return 'stepfun';

  // 11) 硅基流动 / SiliconFlow (国内站 siliconflow.cn / 国际站 siliconflow.com)
  if (url.includes('siliconflow.cn') || url.includes('siliconflow.com') || url.includes('siliconflow')) return 'siliconflow';

  // 12) 百度千帆 / Qianfan (暂无公开用量 API, 仅平台识别)
  if (url.includes('qianfan.baidubce') || url.includes('baidubce') || url.includes('qianfan')) return 'qianfan';

  // 13) 腾讯混元 / Hunyuan (暂无公开用量 API, 仅平台识别)
  if (url.includes('hunyuan.cloud.tencent') || url.includes('hunyuan.tencent') || url.includes('hunyuan')) return 'hunyuan';

  // 14) 讯飞星辰 / Astron (包月订阅, 仅平台识别)
  if (url.includes('xfyun') || url.includes('spark-api') || url.includes('astron')) return 'spark';

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

// ─── 模型选择 (MiniMax) ───────────────────────────────────────────────────

/** 从 env / stdin 推断用户当前使用的模型标识 */
function resolveCurrentModelId(stdin: StdinData): string | null {
  const fromEnv =
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.ANTHROPIC_DEFAULT_OPUS_MODEL?.trim() ||
    process.env.ANTHROPIC_DEFAULT_SONNET_MODEL?.trim() ||
    process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return stdin.model?.id?.trim() || stdin.model?.display_name?.trim() || null;
}

/** 标准化模型名: 小写 + Unicode 规范化 (NFC) + 去非字母数字, 便于跨格式匹配 (MiniMax-M3 / minimax_m3 / M3 / Unicode连字符等) */
function normalizeModelKey(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * 从 MiniMax API 的 model_remains 列表里挑出用户当前用的那条
 * 优先级: 当前模型匹配 (双向子串) > "general" > 第一条
 */
export function pickMiniMaxModel(list: unknown[], currentModel: string | null): any | null {
  if (!Array.isArray(list) || list.length === 0) return null;

  // 1) 匹配当前模型: 双向子串 (兼容 "MiniMax-M3" / "M3" / "minimax_m3" 等变体)
  if (currentModel) {
    const cur = normalizeModelKey(currentModel);
    if (cur) {
      const matched = list.find((m: any) => {
        const n = normalizeModelKey(String(m?.model_name ?? ''));
        return n && (n === cur || n.includes(cur) || cur.includes(n));
      });
      if (matched) return matched;
    }
  }

  // 2) 回退到 "general" (Coding Plan 默认模型)
  const general = list.find((m: any) => m?.model_name === 'general');
  if (general) return general;

  // 3) 最后回退到第一条
  return list[0] ?? null;
}

// ─── HTTP 查询 ────────────────────────────────────────────────────────────

/** 阿里云 RPC 签名用的 RFC3986 百分号编码 */
function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

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

async function queryMiniMax(apiKey: string, stdin: StdinData): Promise<UsageData | null> {
  try {
    const body = await httpGet(getMiniMaxApiUrl(), apiKey);
    const json = JSON.parse(body);
    const list = json.model_remains;
    if (!Array.isArray(list) || list.length === 0) return null;

    // 优先匹配用户当前模型 (env / stdin), 否则回退 general → 第一条
    const currentModel = resolveCurrentModelId(stdin);
    const main = pickMiniMaxModel(list, currentModel);
    if (!main) return null;

    const intervalPct = typeof main.current_interval_remaining_percent === 'number' ? main.current_interval_remaining_percent : undefined;
    const weeklyPct = typeof main.current_weekly_remaining_percent === 'number' ? main.current_weekly_remaining_percent : undefined;
    const monthlyPct = typeof main.current_monthly_remaining_percent === 'number' ? main.current_monthly_remaining_percent : undefined;
    if (intervalPct === undefined && weeklyPct === undefined && monthlyPct === undefined) return null;

    return {
      provider: 'minimax',
      miniMax: {
        intervalRemainingPercent: intervalPct !== undefined ? Math.round(intervalPct) : undefined,
        weeklyRemainingPercent: weeklyPct !== undefined ? Math.round(weeklyPct) : undefined,
        monthlyRemainingPercent: monthlyPct !== undefined ? Math.round(monthlyPct) : undefined,
        intervalResetAt: typeof main.end_time === 'number' ? Math.round(main.end_time / 1000) : undefined,
        weeklyResetAt: typeof main.weekly_end_time === 'number' ? Math.round(main.weekly_end_time / 1000) : undefined,
        monthlyResetAt: typeof main.monthly_end_time === 'number' ? Math.round(main.monthly_end_time / 1000) : undefined,
        modelName: typeof main.model_name === 'string' ? main.model_name : undefined,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:minimax] queryMiniMax failed: ' + (e instanceof Error ? e.message : String(e)));
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
  } catch (e) {
    debugLog('[usage:deepseek] queryDeepSeek failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function queryKimi(apiKey: string): Promise<UsageData | null> {
  try {
    const body = await httpGet(getKimiApiUrl(), apiKey);
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
  } catch (e) {
    debugLog('[usage:kimi] queryKimi failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function queryStepFun(apiKey: string): Promise<UsageData | null> {
  try {
    // StepFun 响应: { "object": "account", "type": "prepaid",
    //   "balance": 42.50, "total_cash_balance": 32.50, "total_voucher_balance": 10.00 }
    const body = await httpGet(getStepFunApiUrl(), apiKey);
    const json = JSON.parse(body);
    const d = json.data ?? json;
    const balance = typeof d.balance === 'number' ? d.balance : parseFloat(String(d.balance ?? '0'));
    if (!Number.isFinite(balance)) return null;
    return {
      provider: 'stepfun',
      stepfun: {
        totalBalance: balance,
        cashBalance: typeof d.total_cash_balance === 'number'
          ? d.total_cash_balance
          : parseFloat(String(d.total_cash_balance ?? '0')) || 0,
        voucherBalance: typeof d.total_voucher_balance === 'number'
          ? d.total_voucher_balance
          : parseFloat(String(d.total_voucher_balance ?? '0')) || 0,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:stepfun] queryStepFun failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function querySiliconFlow(apiKey: string): Promise<UsageData | null> {
  try {
    // SiliconFlow 响应: { "code": 20000, "message": "OK", "status": true,
    //   "data": { "id":"...", "balance":"32.50", "totalBalance":"42.50" } }
    // 注意: balance/totalBalance 可能是字符串 (文档示例返回字符串)
    // 用 totalBalance 作主显示 (balance 字段有负值 bug, 见 cc-switch#3160)
    const body = await httpGet(getSiliconFlowApiUrl(), apiKey);
    const json = JSON.parse(body);
    const d = json.data ?? json;
    const total = typeof d.totalBalance === 'number' ? d.totalBalance : parseFloat(String(d.totalBalance ?? '0'));
    if (!Number.isFinite(total)) return null;
    const balanceNum = typeof d.balance === 'number' ? d.balance : parseFloat(String(d.balance ?? '0'));
    return {
      provider: 'siliconflow',
      siliconflow: {
        totalBalance: total,
        balance: Number.isFinite(balanceNum) ? balanceNum : total,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:siliconflow] querySiliconFlow failed: ' + (e instanceof Error ? e.message : String(e)));
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

    // unit=3 → 5小时窗口 Token 限额; unit=6 → 周限额; TIME_LIMIT → MCP; 其他 unit → 月限额
    let usedPercent: number | undefined;
    let weeklyPercent: number | undefined;
    let monthlyPercent: number | undefined;
    let mcpPercent: number | undefined;
    let mcpUsed: number | undefined;
    let mcpTotal: number | undefined;
    let resetAt: number | undefined;
    let weeklyResetAt: number | undefined;
    let monthlyResetAt: number | undefined;

    for (const item of limits) {
      if (item.type === 'TOKENS_LIMIT' && item.unit === 3) {
        usedPercent = item.percentage;
        resetAt = item.nextResetTime ? Math.round(item.nextResetTime / 1000) : undefined;
      } else if (item.type === 'TOKENS_LIMIT' && item.unit === 6) {
        weeklyPercent = item.percentage;
        weeklyResetAt = item.nextResetTime ? Math.round(item.nextResetTime / 1000) : undefined;
      } else if (item.type === 'TIME_LIMIT') {
        mcpPercent = item.percentage;
        mcpUsed = item.currentValue;
        mcpTotal = item.usage;
      } else if (item.type === 'TOKENS_LIMIT' && item.unit !== 3 && item.unit !== 6) {
        // 其他 unit 值视为月限额 (仅取第一个)
        if (monthlyPercent === undefined) {
          monthlyPercent = item.percentage;
          monthlyResetAt = item.nextResetTime ? Math.round(item.nextResetTime / 1000) : undefined;
        }
      }
    }

    if (usedPercent === undefined && weeklyPercent === undefined && monthlyPercent === undefined && mcpPercent === undefined) {
      return null;
    }

    return {
      provider: 'zhipu',
      zhipu: {
        usedPercent: typeof usedPercent === 'number' ? Math.round(usedPercent) : undefined,
        weeklyPercent: typeof weeklyPercent === 'number' ? Math.round(weeklyPercent) : undefined,
        monthlyPercent: typeof monthlyPercent === 'number' ? Math.round(monthlyPercent) : undefined,
        mcpPercent: typeof mcpPercent === 'number' ? Math.round(mcpPercent) : undefined,
        mcpUsed,
        mcpTotal,
        level: json.data.level ?? undefined,
        resetAt,
        weeklyResetAt,
        monthlyResetAt,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:zhipu] queryZhipu failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

async function queryXiaomi(apiKey: string): Promise<UsageData | null> {
  try {
    // 小米 MiMo Token Plan 用量 API
    // 需要通过 Cookie 认证 (从浏览器 DevTools 获取, 设置 XIAOMI_COOKIE 环境变量)
    // Bearer token 也尝试 (部分端点可能支持)
    const cookie = process.env.XIAOMI_COOKIE?.trim();
    if (!cookie && !apiKey) return null;

    const apiUrl = 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage';

    let body: string;
    if (cookie) {
      // Cookie 认证模式
      body = await new Promise<string>((resolve, reject) => {
        const lib = apiUrl.startsWith('https') ? httpsGetImpl : httpGetImpl;
        const req = lib(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'Cookie': cookie,
          },
          timeout: HTTP_TIMEOUT_MS,
        }, (res: any) => {
          let data = '';
          res.on('data', (chunk: string) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) resolve(data);
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
    } else {
      body = await httpGet(apiUrl, apiKey);
    }

    const json = JSON.parse(body);
    if (json.code !== 0 || !json.data) return null;

    const usage = json.data.monthUsage;
    if (!usage) return null;

    // percent 是 0.0-1.0, 转为 0-100
    const monthlyPercent = typeof usage.percent === 'number'
      ? Math.round(usage.percent * 100) : undefined;

    // 从 items 汇总 used/total
    let used = 0;
    let total = 0;
    if (Array.isArray(usage.items)) {
      for (const item of usage.items) {
        used += item.used ?? 0;
        total += item.limit ?? 0;
      }
    }

    return {
      provider: 'xiaomi',
      xiaomi: {
        used,
        total,
        monthlyPercent,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:xiaomi] queryXiaomi failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

// 阿里 DashScope 无公开的余额 API; 账户余额需走阿里云 BSS OpenAPI (RPC 签名)
// 需要 ALIYUN_AK_ID + ALIYUN_AK_SECRET (主账号 RAM 密钥, 非 DASHSCOPE_API_KEY)
async function queryAlibaba(): Promise<UsageData | null> {
  try {
    const akId = process.env.ALIYUN_AK_ID?.trim();
    const akSecret = process.env.ALIYUN_AK_SECRET?.trim();
    if (!akId || !akSecret) return null;

    // 阿里云 BSS OpenAPI: QueryAccountBalance (RPC 风格, GET)
    // https://business.aliyuncs.com?Action=QueryAccountBalance&...
    const params: Record<string, string> = {
      Action: 'QueryAccountBalance',
      Format: 'JSON',
      Version: '2017-12-14',
      AccessKeyId: akId,
      SignatureMethod: 'HMAC-SHA1',
      SignatureVersion: '1.0',
      SignatureNonce: String(Date.now()) + Math.floor(Math.random() * 1000),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };

    // RPC v1.0 签名: 对 canonicalized query string 做 HMAC-SHA1, base64
    const sortedKeys = Object.keys(params).sort();
    const canonicalQuery = sortedKeys
      .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
      .join('&');
    const stringToSign = `GET&${percentEncode('/')}&${percentEncode(canonicalQuery)}`;
    const signature = createHmac('sha1', akSecret + '&')
      .update(stringToSign, 'utf8')
      .digest('base64');
    params.Signature = signature;

    const url = 'https://business.aliyuncs.com/?' + Object.keys(params)
      .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
      .join('&');

    const body = await httpGet(url, '');
    const json = JSON.parse(body);
    if (json.Code) return null;  // 错误响应带 Code 字段

    const bal = json.Data;
    if (!bal) return null;

    // Balances 可能为字符串; AccountID/Currency 等字段
    const available = parseFloat(String(bal.AvailableAmount ?? bal.availableAmount ?? '0'));
    const cash = parseFloat(String(bal.AvailableCashAmount ?? bal.cashAmount ?? '0'));
    if (!Number.isFinite(available)) return null;

    // 转为 token-like 用量: 用余额填充 used/total (余额型, total=available, used=0)
    return {
      provider: 'alibaba',
      alibaba: {
        used: 0,
        total: Math.round(available * 100),  // 用"分"作单位, 避免小数显示
        plan: cash > 0 ? `¥${available.toFixed(2)}` : undefined,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:alibaba] queryAlibaba failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

// 火山引擎 Ark — 管控面 API 需要 HMAC-SHA256 签名, 零依赖实现暂不支持
async function queryVolcengine(): Promise<UsageData | null> {
  return null;
}

// ─── Kimi For Coding 用量查询 ──────────────────────────────────────────────

const KIMI_CODING_API = 'https://api.kimi.com/coding/v1/usages';

async function queryKimiCoding(apiKey: string): Promise<UsageData | null> {
  try {
    const body = await httpGet(KIMI_CODING_API, apiKey);
    const json = JSON.parse(body);

    let fiveHourPercent: number | undefined;
    let weeklyPercent: number | undefined;
    let fiveHourResetAt: number | undefined;
    let weeklyResetAt: number | undefined;

    // 5 小时窗口限额（优先显示）
    const limits = json.limits;
    if (Array.isArray(limits)) {
      for (const limitItem of limits) {
        const detail = limitItem?.detail;
        if (!detail) continue;
        const limit = parseFloat(String(detail.limit ?? '1'));
        const remaining = parseFloat(String(detail.remaining ?? '0'));
        const resetTime = detail.resetTime;

        const used = Math.max(0, limit - remaining);
        const utilization = limit > 0 ? (used / limit) * 100 : 0;
        fiveHourPercent = Math.round(utilization);
        if (resetTime) {
          fiveHourResetAt = Math.round(parseFloat(String(resetTime)) / 1000);
        }
      }
    }

    // 总体用量（周限额）
    const usage = json.usage;
    if (usage && typeof usage === 'object') {
      const limit = parseFloat(String(usage.limit ?? '1'));
      const remaining = parseFloat(String(usage.remaining ?? '0'));
      const resetTime = usage.resetTime;

      const used = Math.max(0, limit - remaining);
      const utilization = limit > 0 ? (used / limit) * 100 : 0;
      weeklyPercent = Math.round(utilization);
      if (resetTime) {
        weeklyResetAt = Math.round(parseFloat(String(resetTime)) / 1000);
      }
    }

    if (fiveHourPercent === undefined && weeklyPercent === undefined) return null;

    return {
      provider: 'kimi-coding',
      kimiCoding: {
        fiveHourPercent,
        weeklyPercent,
        fiveHourResetAt,
        weeklyResetAt,
      },
      updatedAt: Date.now(),
    };
  } catch (e) {
    debugLog('[usage:kimi-coding] queryKimiCoding failed: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

/**
 * 获取当前平台的 API key
 * 优先级: 平台专用 env (直连) → ANTHROPIC_AUTH_TOKEN (代理)
 *   - DeepSeek: DEEPSEEK_API_KEY
 *   - Kimi:     MOONSHOT_API_KEY
 *   - 智谱:      ZHIPUAI_API_KEY / GLM_API_KEY
 *   - 小米:      XIAOMI_API_KEY / MIMO_API_KEY
 *   - 阿里:      DASHSCOPE_API_KEY
 *   - 火山引擎:  ARK_API_KEY / VOLC_API_KEY
 *   - 阶跃星辰:  STEPFUN_API_KEY
 *   - 硅基流动:  SILICONFLOW_API_KEY
 *   - 第三方代理: ANTHROPIC_AUTH_TOKEN (代理转发)
 */
function getApiKeyForPlatform(platform: string): string | null {
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  switch (platform) {
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY?.trim() || authToken || null;
    case 'kimi-coding':
      return authToken || null;
    case 'stepfun':
      return process.env.STEPFUN_API_KEY?.trim() || authToken || null;
    case 'siliconflow':
      return process.env.SILICONFLOW_API_KEY?.trim() || authToken || null;
    case 'zhipu':
      return process.env.ZHIPUAI_API_KEY?.trim()
        || process.env.GLM_API_KEY?.trim()
        || authToken
        || null;
    case 'xiaomi':
      return process.env.XIAOMI_API_KEY?.trim()
        || process.env.MIMO_API_KEY?.trim()
        || authToken
        || null;
    case 'alibaba':
      return process.env.DASHSCOPE_API_KEY?.trim()
        || authToken
        || null;
    case 'volcengine':
      return process.env.ARK_API_KEY?.trim()
        || process.env.VOLC_API_KEY?.trim()
        || authToken
        || null;
    default:
      // minimax 走代理模式, 统一用 ANTHROPIC_AUTH_TOKEN
      return authToken || null;
  }
}

/** 异步刷新缓存 (不阻塞) */
async function refreshCache(platform: string, apiKey: string, stdin: StdinData): Promise<void> {
  let data: UsageData | null = null;

  switch (platform) {
    case 'claude':
      data = getClaudeRateLimit(stdin);
      break;
    case 'minimax':
      data = await queryMiniMax(apiKey, stdin);
      break;
    case 'deepseek':
      data = await queryDeepSeek(apiKey);
      break;
    case 'kimi':
      data = await queryKimi(apiKey);
      break;
    case 'stepfun':
      data = await queryStepFun(apiKey);
      break;
    case 'siliconflow':
      data = await querySiliconFlow(apiKey);
      break;
    case 'kimi-coding':
      data = await queryKimiCoding(apiKey);
      break;
    case 'zhipu':
      data = await queryZhipu(apiKey);
      break;
    case 'xiaomi':
      data = await queryXiaomi(apiKey);
      break;
    case 'alibaba':
      data = await queryAlibaba();
      break;
    case 'volcengine':
      data = await queryVolcengine();
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

  // 无缓存 → 异步刷新 (fire-and-forget)
  const apiKey = getApiKeyForPlatform(platform);
  if (apiKey) {
    refreshCache(platform, apiKey, stdin).catch((e) => {
      debugLog(`[usage:${platform}] refreshCache 失败: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  return null;
}
