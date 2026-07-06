/**
 * claude-mini-hud — 渲染函数 + 格式化工具
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 所有 UI 输出的渲染逻辑
 */

import type { StdinData, TranscriptData, TodoItem, ToolActivity, AgentActivity, TokenBreakdown } from './types.js';
import type { GitInfo } from './types.js';
import type { UsageData } from './usage.js';
import { c } from './colors.js';
import { t, MINIMAL, LANG, lbl } from './i18n.js';
import { THEME, THEME_NAME, MARKS } from './themes.js';
import { truncate } from './transcript.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

// ─── 颜色阈值 (集中管理, 支持环境变量覆盖) ─────────────────────────────────
// 默认: >=80 红, >=60 黄, <60 绿。用户可通过环境变量自定义:
//   CLAUDE_MINI_HUD_RED_PCT / CLAUDE_MINI_HUD_YELLOW_PCT (取值 0-100)
function clampPctEnv(key: string, def: number): number {
  const v = parseInt(process.env[key] ?? '', 10);
  if (Number.isFinite(v) && v >= 0 && v <= 100) return v;
  return def;
}
export const RED_PCT = clampPctEnv('CLAUDE_MINI_HUD_RED_PCT', 80);
export const YELLOW_PCT = clampPctEnv('CLAUDE_MINI_HUD_YELLOW_PCT', 60);

/** 按百分比返回着色函数 (统一 >= 语义, 用于 Context/用量窗口/月度百分比) */
type ColorFn = (s: string) => string;
export function pctColor(pct: number): ColorFn {
  if (THEME.monochrome) return (s: string) => s;
  return pct >= RED_PCT ? c.red : pct >= YELLOW_PCT ? c.yellow : c.green;
}

// ─── 格式化工具 ───────────────────────────────────────────────────────────

export function formatTokenCount(n: number, decimals: number = 1): string {
  // 整数值去掉多余的 ".0" (如 "1.0M" → "1M"), 非整数保留小数
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(decimals));
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v >= 10 ? `${Math.round(v)}M` : `${fmt(v)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v >= 10 ? `${Math.round(v)}k` : `${fmt(v)}k`;
  }
  return String(n);
}

/** 将 unix 秒时间戳转为倒计时字符串 (如 "1h14m", "4d19h", 月度 "26d") */
export function formatCountdown(resetAtSec: number, daysOnly: boolean = false): string | null {
  const nowSec = Math.floor(Date.now() / 1000);
  let diff = resetAtSec - nowSec;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400);
  diff %= 86400;
  const hours = Math.floor(diff / 3600);
  diff %= 3600;
  const mins = Math.floor(diff / 60);

  if (daysOnly) {
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }

  if (days > 0) return `${days}d${hours}h`;
  if (hours > 0) return `${hours}h${mins}m`;
  return `${mins}m`;
}

/** 将毫秒差格式化成人类可读的耗时字符串 */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  return `${hrs}h ${rm}m`;
}

// ─── 终端宽度自适应 ────────────────────────────────────────────────────────

/** 估算可用终端列数 (StatusLine 渲染宽度, 保守取值) */
function getTerminalWidth(): number {
  const fromEnv = parseInt(process.env.COLUMNS ?? '', 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 40) return fromEnv;
  const cols = process.stdout.columns;
  if (typeof cols === 'number' && cols >= 40) return cols;
  return 80;  // 默认回退
}

/** 根据终端宽度计算进度条宽度 (占比约 1/5, 限制 6-30) */
function adaptiveBarWidth(): number {
  const term = getTerminalWidth();
  const w = Math.round(term / 6);
  return Math.max(6, Math.min(30, w));
}

/** 格式化 ETA (按秒数): 90s → "1m", 3600 → "1h", 5400 → "1h30m" */
function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const rm = mins % 60;
    return rm > 0 ? `${hrs}h${rm}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

/** 根据当前主题渲染进度条 */
function progressBar(percent: number, _width?: number): string {
  const theme = THEME;

  // 超简约模式: 不画进度条, 由 renderContextLine 用图标+百分比
  if (theme.isMinimal) return '';

  const width = _width ?? theme.width;
  const totalSlots = _width ?? adaptiveBarWidth();
  const fillCount = Math.round((percent / 100) * totalSlots);
  const emptyCount = totalSlots - fillCount;

  // emoji 双宽字符 (heart/love/star) 占 2 列, slot 数减半以保持视觉等长
  const isWide = THEME.filled.length > 0 && [...THEME.filled[0]].length > 1;
  const effWidth = isWide ? Math.max(4, Math.floor(totalSlots / 2)) : totalSlots;
  const effFill = Math.round((percent / 100) * effWidth);
  const effEmpty = effWidth - effFill;

  // 颜色按百分比: 绿 < YELLOW, 黄 YELLOW-RED, 红 >= RED (阈值可由环境变量配置)
  const color = pctColor(percent);

  // 边框 (所有主题共用, 包括 gradient/retro)
  const left = theme.leftBorder ? c.dim(theme.leftBorder) : '';
  const right = theme.rightBorder ? c.dim(theme.rightBorder) : '';

  // ─── 渐变主题 (已删除) ────────────────────────────────────────────────────
  // gradient 主题已在 v1.0.5 移除，此处保留注释作为历史记录
  // 如需渐变效果，请使用 shades 主题

  // ─── 复古终端主题: 末位用 ▸ 箭头指示器 ────────────────────────────
  if (THEME_NAME === 'retro') {
    let filledStr = '';
    for (let i = 0; i < effFill; i++) {
      filledStr += (i === effFill - 1) ? '▸' : '═';
    }
    const emptyStr = theme.empty.repeat(effEmpty);
    const bar = color(filledStr) + c.dim(emptyStr);
    return `${left}${bar}${right}`;
  }

  // ─── 通用渲染: 单字符重复 / 多字符循环 ──────────────────────────────
  let filledStr = '';
  if (theme.filled.length === 0) {
    // 防御: filled 为空时不渲染进度条内容 (仅 minimal 主题会走到这里, 但已提前返回)
    return '';
  } else if (theme.filled.length === 1) {
    filledStr = theme.filled[0].repeat(effFill);
  } else {
    // 多字符循环填充 (如 braille / shades 风格)
    for (let i = 0; i < effFill; i++) {
      filledStr += theme.filled[i % theme.filled.length];
    }
  }

  const emptyStr = theme.empty.repeat(effEmpty);
  const bar = color(filledStr + emptyStr);

  return `${left}${bar}${right}`;
}

export function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

// ─── 上下文行 ─────────────────────────────────────────────────────────────

function getTotalTokens(stdin: StdinData): number {
  const usage = stdin.context_window?.current_usage;
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}

// 上下文窗口大小: 直接信任 Claude Code 上报值 (与 claude-hud 一致)
// 校验范围: 负数或超大值会导致除法异常, 限制在 0-10M
function resolveContextSize(stdin: StdinData): number {
  const size = stdin.context_window?.context_window_size ?? 0;
  return Math.max(0, Math.min(size, 10_000_000));
}

export function getContextPercent(stdin: StdinData): number {
  // 优先用 Claude Code v2.1.6+ 的原生百分比
  // 注意: native=0 时不直接返回, 而是走 fallback (用 current_usage token 算)
  // 这样即使 Claude Code 临时发 used_percentage=0, 也能通过 token 数据防闪烁
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && Number.isFinite(native) && native > 0) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }

  const size = resolveContextSize(stdin);
  if (!size || size <= 0) return 0;

  const tokens = getTotalTokens(stdin);
  // current_usage 快照合理 (0 < tokens <= size): 直接用
  if (tokens > 0 && tokens <= size) {
    return Math.min(100, Math.round((tokens / size) * 100));
  }

  // current_usage 不准 (全零或超出 size): 用 session 累计 input 估算
  const totalInput = stdin.context_window?.total_input_tokens;
  if (typeof totalInput === 'number' && totalInput > 0) {
    return Math.min(100, Math.round((Math.min(totalInput, size) / size) * 100));
  }

  // tokens > size 但没有 totalInput → 大概率上下文已满
  if (tokens > size) return 100;
  return 0;
}

export function renderContextLine(stdin: StdinData, usage: UsageData | null, cacheDir?: string): string {
  const pct = getContextPercent(stdin);
  const size = resolveContextSize(stdin);
  const rawTokens = getTotalTokens(stdin);

  // 显示用 token 数: 不超过 context window size (避免 "562k / 200k" 误导)
  // 当 rawTokens 不合理时 (0 或 >size), 用百分比反推
  let displayTokens: number;
  if (rawTokens > 0 && rawTokens <= size) {
    displayTokens = rawTokens;
  } else if (pct > 0 && size > 0) {
    displayTokens = Math.round((pct / 100) * size);
  } else {
    displayTokens = rawTokens;
  }
  const remaining = Math.max(0, size - displayTokens);

  // ─── 公共逻辑 (所有主题共用) ────────────────────────────────────────────

  // 百分比着色 (阈值集中管理, 支持环境变量)
  const pctColorFn = pctColor(pct);

  // 详情文本 (token 数 / 剩余 / 余额)
  // 若有 transcript_path, 把详情包裹成 OSC 8 链接 (支持的终端 Cmd/Ctrl+click 可打开 transcript 文件)
  let detail = '';
  if (size > 0) {
    detail = `${formatTokenCount(displayTokens)} / ${formatTokenCount(size)}  ${t.contextRemaining} ${formatTokenCount(remaining)}`;
  } else {
    detail = `${formatTokenCount(displayTokens)}`;
  }
  // transcript_path 转 file:// URI (Windows 路径需正斜杠 + encodeURI)
  const tp = stdin.transcript_path;
  if (tp) {
    try {
      const uri = `file://${tp.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '/$1:').split('/').map(encodeURIComponent).join('/')}`;
      detail = c.dim(c.link(detail, uri));
    } catch {
      detail = c.dim(detail);  // URI 构造失败, 回退纯文本
    }
  } else {
    detail = c.dim(detail);
  }

  // ETA: 按当前上下文填充速率预测填满耗时 (仅 cacheDir 提供且速率有效时显示)
  if (cacheDir && remaining > 0) {
    const eta = getContextEta(stdin, cacheDir);
    if (eta && eta > 0) detail += c.dim(`  ~${formatEta(eta)} ${t.etaFull}`);
  }

  const theme = THEME;

  // ─── 超简约主题: ◈ 42% ┃ 12.4K/200K ┃ ...
  if (theme.isMinimal) {
    const icon = theme.minimalIcon;
    const pctStr = pctColorFn(c.bold(`${icon} ${pct}%`));
    return `${pctStr}${theme.separator}${detail}`;
  }

  // 通用进度条 + 百分比 (非 minimal 主题共用)
  const bar = progressBar(pct);
  const pctStr = pctColorFn(c.bold(`${pct}%`));

  // ─── 霓虹矩阵主题: ⟦ CTX: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ 42% ⟧
  if (THEME_NAME === 'neon') {
    const neonPrefix = c.cyan('⟦');
    const neonSuffix = c.cyan('⟧');
    const ctxTag = c.magenta('CTX:');
    return `${neonPrefix} ${ctxTag} ${bar} ${pctStr} ${neonSuffix}  ${detail}`;
  }

  // ─── 硬核主题: [■■■■■■■□□□□□□□□□□□□□] 42% CTX │ ...
  if (THEME_NAME === 'hardcore') {
    const sep = c.dim('│');
    return `${bar} ${pctStr} ${c.cyan('CTX')} ${sep} ${detail}`;
  }

  // ─── 经典 / Braille / Pixel / Diamond / Arrow 默认布局
  const label = lbl('context', t.context, '#');
  return `${label} ${bar} ${pctStr}  ${detail}`;
}

// ─── 花费/耗时行 (stdin.cost + $/h 增速缓存) ──────────────────────────────

const COST_CACHE_PATH = join(homedir(), '.claude-mini-hud', 'cost-speed-cache.json');

/** 计算花费增速 ($/h): 基于累计 cost 的时间变化, 用文件缓存 */
function getCostRate(costUsd: number): number | null {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return null;
  try {
    const now = Date.now();
    let prev: { c: number; ts: number } | null = null;
    try { prev = JSON.parse(readFileSync(COST_CACHE_PATH, 'utf8')); } catch { /* first */ }

    const writeBaseline = () => {
      try {
        mkdirSync(join(homedir(), '.claude-mini-hud'), { recursive: true });
        writeFileSync(COST_CACHE_PATH, JSON.stringify({ c: costUsd, ts: now }));
      } catch { /* silent */ }
    };

    if (!prev || costUsd < prev.c) { writeBaseline(); return null; }
    const dtH = (now - prev.ts) / 3_600_000;
    if (dtH < 0.02 || dtH > 6) { if (dtH > 6) writeBaseline(); return null; }
    const delta = costUsd - prev.c;
    if (delta === 0) return null;
    writeBaseline();
    return delta / dtH;
  } catch {
    return null;
  }
}

export function renderCostLine(stdin: StdinData): string | null {
  const cost = stdin.cost;
  const totalCost = typeof cost?.total_cost_usd === 'number' ? cost.total_cost_usd : undefined;
  const durationMs = typeof cost?.total_duration_ms === 'number' ? cost.total_duration_ms : undefined;

  if (totalCost === undefined && durationMs === undefined) return null;

  const parts: string[] = [];
  if (totalCost !== undefined && Number.isFinite(totalCost) && totalCost > 0) {
    parts.push(c.cyan(c.bold(`$${totalCost.toFixed(2)}`)));
    // 花费增速 $/h
    const rate = getCostRate(totalCost);
    if (rate && rate > 0) parts.push(c.dim(`$${rate.toFixed(2)}/h`));
  }
  if (durationMs !== undefined && Number.isFinite(durationMs) && durationMs > 0) {
    parts.push(c.dim(formatElapsed(durationMs)));
  }

  if (parts.length === 0) return null;
  const label = lbl('cost', t.cost, '$');
  return `${label} ${parts.join(' · ')}`;
}

// ─── Git 分支/脏状态行 (spawn git + 文件缓存, TTL 500ms) ──────────────────

const GIT_CACHE_PATH = join(homedir(), '.claude-mini-hud', 'git-cache.json');

/** 读取 Git 缓存 (500ms TTL, 同一会话内复用) */
function readGitCache(dir: string): GitInfo | null {
  try {
    const data = JSON.parse(readFileSync(GIT_CACHE_PATH, 'utf8'));
    if (data.dir !== dir) return null;
    if (Date.now() - data.ts > 500) return null;
    return data.info as GitInfo;
  } catch { return null; }
}

function writeGitCache(dir: string, info: GitInfo): void {
  try {
    mkdirSync(join(homedir(), '.claude-mini-hud'), { recursive: true });
    writeFileSync(GIT_CACHE_PATH, JSON.stringify({ dir, ts: Date.now(), info }));
  } catch { /* silent */ }
}

/** 查询 Git 信息: branch + dirty + ahead/behind */
export function getGitInfo(stdin: StdinData): GitInfo | null {
  const dir = stdin.workspace?.current_dir ?? stdin.workspace?.project_dir;
  if (!dir) return null;

  const cached = readGitCache(dir);
  if (cached) return cached;

  try {
    // branch
    const branch = execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!branch) return null;

    // ahead/behind
    let ahead = 0, behind = 0;
    try {
      const counts = execFileSync('git', ['-C', dir, 'rev-list', '--left-right', '--count', '@{u}...HEAD'], {
        encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim().split(/\s+/);
      if (counts.length === 2) { behind = parseInt(counts[0], 10) || 0; ahead = parseInt(counts[1], 10) || 0; }
    } catch { /* no upstream */ }

    // dirty
    let dirty = false;
    try {
      const status = execFileSync('git', ['-C', dir, 'status', '--porcelain'], {
        encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      dirty = status.length > 0;
    } catch { /* ignore */ }

    const info: GitInfo = { branch, dirty, ahead, behind };
    writeGitCache(dir, info);
    return info;
  } catch {
    return null;  // 非 git 仓库 / git 未安装
  }
}

export function renderGitLine(stdin: StdinData): string | null {
  const info = getGitInfo(stdin);
  if (!info) return null;

  const branchColor = info.dirty ? c.yellow : c.green;
  const dirtyTag = info.dirty ? c.yellow('●') : c.green('✓');
  const abParts: string[] = [];
  if (info.ahead > 0) abParts.push(c.cyan(`↑${info.ahead}`));
  if (info.behind > 0) abParts.push(c.red(`↓${info.behind}`));
  const abStr = abParts.length > 0 ? ` ${abParts.join(' ')}` : '';

  const label = lbl('git', t.git, '⎇');
  return `${label} ${branchColor(info.branch)} ${dirtyTag}${abStr}`;
}

// ─── 阈值告警行 (context>=85% 或 任一用量窗口>=90%) ───────────────────────

export interface AlertThresholds {
  contextPct?: number;   // 0-100
  usagePct?: number;     // 任一用量窗口最大值
}

/** 检测是否需要告警, 返回告警文本 (无则 null). threshold: context/usage 百分比上限 */
export function renderAlertLine(stdin: StdinData, usage: UsageData | null, ctxThreshold = 85, usageThreshold = 90): string | null {
  const ctxPct = getContextPercent(stdin);
  const ctxAlert = ctxPct >= ctxThreshold;

  // 取所有用量窗口最大百分比
  let usageMax = 0;
  if (usage) {
    const u = usage.claude;
    if (u) {
      if (typeof u.fiveHour === 'number') usageMax = Math.max(usageMax, u.fiveHour);
      if (typeof u.sevenDay === 'number') usageMax = Math.max(usageMax, u.sevenDay);
    }
    const m = usage.miniMax;
    if (m) {
      if (m.intervalRemainingPercent !== undefined) usageMax = Math.max(usageMax, 100 - m.intervalRemainingPercent);
      if (m.weeklyRemainingPercent !== undefined) usageMax = Math.max(usageMax, 100 - m.weeklyRemainingPercent);
    }
    const kc = usage.kimiCoding;
    if (kc) {
      if (kc.fiveHourPercent !== undefined) usageMax = Math.max(usageMax, kc.fiveHourPercent);
      if (kc.weeklyPercent !== undefined) usageMax = Math.max(usageMax, kc.weeklyPercent);
    }
    const z = usage.zhipu;
    if (z) {
      if (z.usedPercent !== undefined) usageMax = Math.max(usageMax, z.usedPercent);
      if (z.weeklyPercent !== undefined) usageMax = Math.max(usageMax, z.weeklyPercent);
      if (z.monthlyPercent !== undefined) usageMax = Math.max(usageMax, z.monthlyPercent);
    }
  }
  const usageAlert = usageMax >= usageThreshold;

  if (!ctxAlert && !usageAlert) return null;

  const msgs: string[] = [];
  if (ctxAlert) msgs.push(`${t.ctxWarn} ${ctxPct}%`);
  if (usageAlert) msgs.push(`${t.alert} ${usageMax}%`);

  const prefix = c.bold(c.red('⚠'));
  return `${prefix} ${c.red(msgs.join(' · '))}`;
}

// ─── 紧凑单行模式: 把关键信息压成一行 (用 │ 分隔) ────────────────────────

/** 剥离 ANSI 的纯文本长度 (用于紧凑模式的可见性判断) */
function visibleLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

export function renderCompactLine(
  stdin: StdinData,
  usage: UsageData | null,
  tdata: TranscriptData | null,
  cacheDir?: string,
): string {
  const segs: string[] = [];
  const sep = c.dim(' │ ');

  // 1) 上下文百分比 (核心)
  const pct = getContextPercent(stdin);
  const pctColorFn = pctColor(pct);
  segs.push(pctColorFn(c.bold(`${pct}%`)));

  // 2) 用量窗口 (短)
  if (usage) {
    let usageStr: string | null = null;
    if (usage.claude?.fiveHour !== null && usage.claude?.fiveHour !== undefined) {
      usageStr = `API ${usage.claude.fiveHour}%`;
    } else if (usage.miniMax?.intervalRemainingPercent !== undefined) {
      usageStr = `5h ${100 - usage.miniMax.intervalRemainingPercent}%`;
    } else if (usage.deepSeek) {
      usageStr = `¥${usage.deepSeek.totalBalance.toFixed(2)}`;
    } else if (usage.kimi) {
      usageStr = `¥${usage.kimi.totalBalance.toFixed(2)}`;
    } else if (usage.stepfun) {
      usageStr = `¥${usage.stepfun.totalBalance.toFixed(2)}`;
    } else if (usage.siliconflow) {
      usageStr = `¥${usage.siliconflow.totalBalance.toFixed(2)}`;
    }
    if (usageStr) segs.push(c.cyan(usageStr));
  }

  // 3) 花费 (有则显示)
  const costUsd = stdin.cost?.total_cost_usd;
  if (typeof costUsd === 'number' && Number.isFinite(costUsd) && costUsd > 0) {
    segs.push(c.cyan(`$${costUsd.toFixed(2)}`));
  }

  // 4) 当前任务 (截断)
  if (tdata?.todos && tdata.todos.length > 0) {
    const active = tdata.todos.find((td) => td.status === 'in_progress')
      ?? tdata.todos.find((td) => td.status === 'pending');
    if (active) {
      const completed = tdata.todos.filter((td) => td.status === 'completed').length;
      const total = tdata.todos.length;
      const todoText = truncate(active.activeForm || active.content, 30);
      segs.push(`${c.dim(`(${completed}/${total})`)} ${todoText}`);
    }
  }

  // 5) ETA (仅紧凑模式额外显示, 视终端宽度)
  if (cacheDir && pct < 95) {
    const eta = getContextEta(stdin, cacheDir);
    if (eta && eta > 0) segs.push(c.dim(`~${formatEta(eta)}`));
  }

  void visibleLen;  // 保留供未来按宽度截断
  return segs.join(sep);
}

// ─── 当前任务行 ───────────────────────────────────────────────────────────

export function renderTodoLine(tdata: TranscriptData | null): string | null {
  if (!tdata?.todos || tdata.todos.length === 0) return null;

  // 优先显示 in_progress 的任务
  const active = tdata.todos.find((td) => td.status === 'in_progress')
    ?? tdata.todos.find((td) => td.status === 'pending');
  if (!active) return null;

  const completed = tdata.todos.filter((td) => td.status === 'completed').length;
  const total = tdata.todos.length;
  const label = lbl('todo', t.todo, '>');
  const display = active.activeForm || active.content;
  const progress = c.dim(`(${completed}/${total})`);

  return `${label} ${display}  ${progress}`;
}

// ─── 工具活动行 ───────────────────────────────────────────────────────────

export function renderToolActivityLines(tdata: TranscriptData | null): string[] {
  if (!tdata || tdata.recentTools.length === 0) return [];

  // Agent 工具由专属的 [&] Agent 行展示, 不在 Tools 行重复显示 (避免 "◐ Agent Agent" 这种无意义输出)
  const tools = tdata.recentTools.filter((a) => a.tool !== 'Agent');
  const running = tools.filter((a) => a.status === 'running');
  const completed = tools.filter((a) => a.status === 'completed' || a.status === 'error');
  const lines: string[] = [];
  const prefix = MINIMAL ? ' ' : '  ';  // 子行缩进

  // 运行中的工具: 每个一行, 使用主题标记
  for (const act of running.slice(-3)) {
    const verb = t.toolVerb[act.tool] ?? act.tool;
    const detail = act.label ? ` ${act.label}` : '';
    lines.push(`${prefix}${c.yellow(MARKS.runningMark)} ${verb}${c.dim(detail)}`);
  }

  // 已完成的工具: 按名称聚合, 一行展示计数
  const counts = new Map<string, number>();
  for (const act of completed) {
    counts.set(act.tool, (counts.get(act.tool) ?? 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    const items = sorted.slice(0, 5).map(([name, count]) => {
      const verb = t.toolVerb[name] ?? name;
      return `${c.green(MARKS.completedMark)} ${verb} ${c.dim(`×${count}`)}`;
    });
    lines.push(`${prefix}${items.join('  ')}`);
  }

  // 没有内容时返回空, 有内容时在首行前加标签
  if (lines.length === 0) return [];
  const label = lbl('tools', t.tools, '[*]');
  lines[0] = `${label} ${lines[0].slice(prefix.length)}`;
  return lines;
}

// ─── Agent 追踪行 ─────────────────────────────────────────────────────────

export function renderAgentLines(tdata: TranscriptData | null): string[] {
  if (!tdata || tdata.activeAgents.length === 0) return [];

  const now = Date.now();
  const prefix = MINIMAL ? ' ' : '  ';
  const lines: string[] = [];

  for (const a of tdata.activeAgents) {
    const desc = truncate(a.description || 'agent', 50);
    const typeTag = a.subagentType ? c.dim(`[${a.subagentType}] `) : '';
    const elapsed = a.startTime > 0 ? ` ${c.dim(formatElapsed(now - a.startTime))}` : '';
    lines.push(`${prefix}${typeTag}${c.yellow(MARKS.runningMark)} ${desc}${elapsed}`);
  }

  if (lines.length === 0) return [];
  const label = lbl('agent', t.agent, '&');
  lines[0] = `${label} ${lines[0].slice(prefix.length)}`;
  return lines;
}

// ─── 模型行 ───────────────────────────────────────────────────────────────

export function renderModelLine(stdin: StdinData): string {
  const name = resolveModelName(stdin);

  // 检测 provider (Bedrock / Vertex / Enterprise)
  const provider = detectProvider(stdin);
  const providerBadge = provider ? c.dim(`[${provider}]`) : '';

  const label = lbl('model', t.model, '>');
  return `${label} ${c.cyan(c.bold(name))}  ${providerBadge}`;
}

// 解析模型名: 优先用 env 显式配置 (第三方代理常用), 再回退到 stdin
function resolveModelName(stdin: StdinData): string {
  // 1) 优先用 stdin.model — 反映实际运行时模型 (支持 /model 切换 + 正确 tier)
  const stdinId = stdin.model?.id?.trim();
  const stdinName = stdin.model?.display_name?.trim();

  // stdin 有明确的非 Claude 泛化名 (第三方模型, 如 glm-5.2 / MiniMax-M3) → 直接用
  if (stdinAnyLooksCustom(stdinId, stdinName)) {
    return stripContextTag(stdinName || stdinId!);
  }

  // 2) stdin 为空 或 stdin 是 Claude 原生模型名 → 回退到 env 显式配置 (第三方代理常用)
  const envKeys = [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  ];
  for (const key of envKeys) {
    const v = process.env[key]?.trim();
    if (v) return stripContextTag(v);
  }

  // 3) env 也没配 → 用 stdin (哪怕是 Claude 原生名) 或 Unknown
  const name = stdinName || stdinId || 'Unknown';
  return stripContextTag(name);
}

/** 判断 stdin 的模型名是否为"明确的自定义模型" (第三方模型, 非泛化 Claude 名) */
function stdinAnyLooksCustom(id?: string, name?: string): boolean {
  const cand = name || id;
  if (!cand) return false;
  const lower = cand.toLowerCase();
  // 泛化 Claude 名 (含 claude/sonnet/opus/haiku) 且不含明确版本 → 不算自定义
  const isClaudish = /claude|sonnet|opus|haiku/.test(lower);
  // 但如果 id 里有明确的后缀 (如 [1M] 上下文标记) → 说明经过 env 配置, 算自定义
  const hasContextTag = /\[\d+[km]/i.test(id ?? '');
  // 有 context tag 说明是第三方代理配置的模型 (Claude 原生名不带 [1M])
  if (hasContextTag) return true;
  return !isClaudish;
}

/** 去掉模型名里的 [200k] / [1M] 上下文标记 (与 claude-hud 的 stripContextSuffix 一致) */
function stripContextTag(name: string): string {
  return name.replace(/\s*\[\d+[kKmM]\]/gi, '').trim();
}

function detectProvider(stdin: StdinData): string | null {
  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') return 'Bedrock';
  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') return 'Vertex';
  const id = stdin.model?.id?.toLowerCase();
  if (id && (id.includes('opusplan') || id.includes('sonnetplan') || id.includes('haikuplan'))) {
    return 'Enterprise';
  }
  // 第三方代理 (ANTHROPIC_BASE_URL 指向非 anthropic.com)
  if (process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_BASE_URL.includes('anthropic.com')) {
    try {
      const hostname = new URL(process.env.ANTHROPIC_BASE_URL).hostname.toLowerCase();
      // 显式品牌映射 (避免域名段无法表达正确品牌名, 如 baidubce → 千帆)
      const brandMap: Record<string, string> = {
        'siliconflow.cn': 'SiliconFlow',
        'siliconflow.com': 'SiliconFlow',
        'stepfun.com': 'StepFun',
        'stepfun.ai': 'StepFun',
        'baidubce.com': '千帆',
        'hunyuan.cloud.tencent.com': 'Hunyuan',
        'tencent.com': 'Hunyuan',
        'xfyun.cn': 'Astron',
        'xf-yun.com': 'Astron',
      };
      for (const [host, brand] of Object.entries(brandMap)) {
        if (hostname.includes(host)) return brand;
      }

      const parts = hostname.split('.');
      // 跳过通用前缀 (api/www/open/gateway/proxy/app/console)
      const generic = new Set(['api', 'www', 'open', 'gateway', 'proxy', 'app', 'console']);
      // 优先取真正的品牌段: 跳过 generic 后, 取中间或倒数第二段
      // "api.minimaxi.com" → ["api","minimaxi","com"] → "minimaxi"
      // "open.bigmodel.cn" → ["open","bigmodel","cn"] → "bigmodel"
      // "api.deepseek.com" → ["api","deepseek","com"] → "deepseek"
      const brand = parts.filter((p) => !generic.has(p));
      // 特殊映射: api.z.ai → "Z.AI" (单字母品牌名 + ai 域名)
      if (brand.length === 2 && brand[0] === 'z' && brand[1] === 'ai') return 'Z.AI';
      // 取最后两段中的第一段 (品牌名, 排除顶级域)
      return brand.length >= 2 ? brand[brand.length - 2] : (brand[0] ?? parts[0] ?? null);
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Token 峰值缓存 (/compact 后 Claude Code 重置 session token 计数, 用峰值兜底) ──
// 缓存键包含 transcript_path + mtime, 避免跨会话泄漏

const TOKEN_PEAK_CACHE_PATH = join(homedir(), '.claude-mini-hud', 'token-peak-cache.json');

function readTokenPeakCache(transcriptPath?: string): TokenBreakdown | null {
  try {
    const raw = readFileSync(TOKEN_PEAK_CACHE_PATH, 'utf8');
    const data = JSON.parse(raw) as { tp: string; mtime: number; input: number; output: number; cache: number; total: number };
    if (!transcriptPath || !data.tp || transcriptPath !== data.tp) return null;

    // 校验 mtime: 如果 transcript 文件被修改 (如新会话), 缓存失效
    if (data.mtime && transcriptPath) {
      try {
        const currentMtime = statSync(transcriptPath).mtimeMs;
        if (Math.abs(currentMtime - data.mtime) > 1000) return null; // mtime 差距 >1s → 新会话
      } catch { return null; }
    }

    return { input: data.input, output: data.output, cache: data.cache, total: data.total };
  } catch { return null; }
}

function writeTokenPeakCache(b: TokenBreakdown, transcriptPath?: string): void {
  try {
    mkdirSync(join(homedir(), '.claude-mini-hud'), { recursive: true });
    let mtime = 0;
    if (transcriptPath) {
      try {
        mtime = statSync(transcriptPath).mtimeMs;
      } catch { /* ignore */ }
    }
    writeFileSync(TOKEN_PEAK_CACHE_PATH, JSON.stringify({
      tp: transcriptPath ?? null, mtime, input: b.input, output: b.output, cache: b.cache, total: b.total,
    }));
  } catch { /* silent */ }
}

// ─── Token 行 (session 累计 / 上下文快照 / 速率) ──────────────────────

/** 从 stdin + transcript 提取 session 累计 token (含峰值缓存, /compact 后不缩减) */
function getSessionTokens(stdin: StdinData, tdata: TranscriptData | null): TokenBreakdown {
  const cw = stdin.context_window;
  const usage = cw?.current_usage;

  // input: 优先 stdin.total_input_tokens → transcript 累加 → current_usage
  let input = typeof cw?.total_input_tokens === 'number' && cw.total_input_tokens > 0
    ? cw.total_input_tokens
    : (tdata?.sessionTokens?.input ?? 0);
  if (input === 0) input = usage?.input_tokens ?? 0;

  // output: 优先 stdin.total_output_tokens → transcript 累加 → current_usage
  let output = typeof cw?.total_output_tokens === 'number' && cw.total_output_tokens > 0
    ? cw.total_output_tokens
    : (tdata?.sessionTokens?.output ?? 0);
  if (output === 0) output = usage?.output_tokens ?? 0;

  // cache: transcript 累加 (更全面) → current_usage 快照
  const txCache = tdata?.sessionTokens?.cache ?? 0;
  const cuCache = (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
  const cache = txCache > 0 ? txCache : cuCache;

  const current: TokenBreakdown = { input, output, cache, total: input + output + cache };

  // 峰值缓存: /compact 后 session token 计数会缩减, 用峰值保持累计值
  const tp = stdin.transcript_path;
  const peak = readTokenPeakCache(tp);
  if (peak && peak.total > current.total) {
    // 当前值比峰值低 → 用峰值 (说明发生了 /compact)
    return peak;
  }
  // 当前值 >= 峰值 → 更新缓存
  if (current.total > 0) {
    writeTokenPeakCache(current, tp);
  }

  return current;
}

/** 从 stdin 提取上下文快照 token (仅当前窗口内) */
function getContextTokens(stdin: StdinData): TokenBreakdown {
  const usage = stdin.context_window?.current_usage;
  const input = usage?.input_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const cache = (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0);
  return { input, output, cache, total: input + output + cache };
}

function formatTokenParts(b: TokenBreakdown, speed: number | null): string {
  // 括号内: in · out · cache (cache 条件隐藏)
  const parts = [
    `${c.gray(t.in)} ${formatTokenCount(b.input)}`,
    `${c.gray(t.out)} ${formatTokenCount(b.output)}`,
  ];
  if (b.cache > 0) parts.push(`${c.gray(t.cache)} ${formatTokenCount(b.cache)}`);
  const inner = c.dim('(' + parts.join(' · ') + ')');
  // speed 放括号外, 条件隐藏; >=1000 自动换 k/M 单位 (如 4.8k tok/s)
  if (speed) return `${inner} ${formatTokenCount(speed)} tok/s`;
  return inner;
}

/** 获取输出速率 (tok/s), 无有效数据返回 null */
function getOutputSpeed(stdin: StdinData, cacheDir: string): number | null {
  // 优先用 session 累计 output (单调递增, 比 current_usage 快照更可靠)
  let outputTokens = stdin.context_window?.total_output_tokens;
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens) || outputTokens <= 0) {
    outputTokens = stdin.context_window?.current_usage?.output_tokens;
  }
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens) || outputTokens <= 0) return null;
  const tp = stdin.transcript_path;
  if (!tp) return null;

  try {
    const cacheFile = join(cacheDir, `speed-${simpleHash(tp)}.json`);
    const now = Date.now();

    let prev: { n: number; ts: number } | null = null;
    try { prev = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* first run */ }

    const writeBaseline = () => {
      try {
        mkdirSync(cacheDir, { recursive: true });
        // 原子写入: 先写临时文件, 再 rename (避免并发竞态)
        const tmpFile = `${cacheFile}.tmp`;
        writeFileSync(tmpFile, JSON.stringify({ n: outputTokens, ts: now }));
        renameSync(tmpFile, cacheFile);
      } catch { /* silent on write failure */ }
    };

    // 无基线 / token 回退 (新会话) / 无新输出 / 基线过旧 → 重建基线
    if (!prev || outputTokens <= prev.n) { writeBaseline(); return null; }
    const dt = (now - prev.ts) / 1000;
    if (dt > 300) { writeBaseline(); return null; }
    // 间隔太短 (StatusLine 刷新可达 300ms): 保留旧基线, 等累计到足够窗口再算
    // 降低下限到 1.0 秒 (避免极小 dt 导致虚高速率)
    if (dt < 1.0) return null;

    writeBaseline();
    const speed = Math.round((outputTokens - prev.n) / dt);
    return speed > 0 ? speed : null;
  } catch {
    return null;
  }
}

/** 获取上下文填充速率 (token/s): 基于当前窗口用量的增长, 用于 ETA 预测 */
export function getContextFillSpeed(stdin: StdinData, cacheDir: string): number | null {
  const ctxTokens = getTotalTokens(stdin);
  if (ctxTokens <= 0) return null;
  const tp = stdin.transcript_path;
  if (!tp) return null;

  try {
    const cacheFile = join(cacheDir, `ctxspeed-${simpleHash(tp)}.json`);
    const now = Date.now();

    let prev: { n: number; ts: number } | null = null;
    try { prev = JSON.parse(readFileSync(cacheFile, 'utf8')); } catch { /* first run */ }

    const writeBaseline = () => {
      try {
        mkdirSync(cacheDir, { recursive: true });
        const tmpFile = `${cacheFile}.tmp`;
        writeFileSync(tmpFile, JSON.stringify({ n: ctxTokens, ts: now }));
        renameSync(tmpFile, cacheFile);
      } catch { /* silent */ }
    };

    // 无基线 / token 回退 (新会话/compact) / 无增长 / 基线过旧 → 重建基线
    if (!prev || ctxTokens < prev.n) { writeBaseline(); return null; }
    const dt = (now - prev.ts) / 1000;
    if (dt > 300 || dt < 1.0) { if (dt > 300) writeBaseline(); return null; }

    const delta = ctxTokens - prev.n;
    if (delta === 0) return null;  // 无新增长, 不更新基线
    writeBaseline();
    const speed = Math.round(delta / dt);
    return speed > 0 ? speed : null;
  } catch {
    return null;
  }
}

/** 计算上下文填满 ETA (秒), 无法计算返回 null */
export function getContextEta(stdin: StdinData, cacheDir: string): number | null {
  const speed = getContextFillSpeed(stdin, cacheDir);
  if (!speed || speed <= 0) return null;
  const size = resolveContextSize(stdin);
  if (size <= 0) return null;
  const remaining = Math.max(0, size - getTotalTokens(stdin));
  if (remaining <= 0) return null;
  return remaining / speed;
}

export function renderTokenLine(stdin: StdinData, tdata: TranscriptData | null, tokenMode: string, cacheDir: string): string[] {
  const lines: string[] = [];
  const label = lbl('token', t.token, '$');

  // 计算输出速率
  const speed = cacheDir ? getOutputSpeed(stdin, cacheDir) : null;

  if (tokenMode === 'session' || tokenMode === 'both') {
    const b = getSessionTokens(stdin, tdata);
    if (b.total > 0) {
      lines.push(`${label} ${c.bold(formatTokenCount(b.total))} ${formatTokenParts(b, speed)}`);
    }
  }

  if (tokenMode === 'context' || tokenMode === 'both') {
    const b = getContextTokens(stdin);
    if (b.total > 0) {
      const ctxLabel = tokenMode === 'both'
        ? c.dim(`  ${t.context} ${t.token}`)
        : label;
      lines.push(`${ctxLabel} ${c.bold(formatTokenCount(b.total))} ${formatTokenParts(b, null)}`);
    }
  }

  return lines;
}

// ─── 用量/余额行 ──────────────────────────────────────────────────────────

export function renderUsageLine(usage: UsageData | null): string | null {
  if (!usage) return null;

  if (usage.claude) {
    const { fiveHour, sevenDay, fiveHourResetAt, sevenDayResetAt } = usage.claude;
    const parts: string[] = [];
    if (fiveHour !== null) {
      const color = pctColor(fiveHour);
      let seg = `5h:${color(`${fiveHour}%`)}`;
      if (fiveHourResetAt) {
        const countdown = formatCountdown(fiveHourResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    if (sevenDay !== null) {
      const color = pctColor(sevenDay);
      let seg = `7d:${color(`${sevenDay}%`)}`;
      if (sevenDayResetAt) {
        const countdown = formatCountdown(sevenDayResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    if (parts.length === 0) return null;
    return `${lbl('usage', 'API', '[B]')} ${parts.join(' ')}`;
  }

  if (usage.miniMax) {
    const m = usage.miniMax;
    const parts: string[] = [];
    // 5小时窗口剩余百分比 (仅存在时显示)
    if (m.intervalRemainingPercent !== undefined) {
      const used = 100 - m.intervalRemainingPercent;
      const color = pctColor(used);
      let seg = `5h:${color(`${used}%`)}`;
      if (m.intervalResetAt) {
        const countdown = formatCountdown(m.intervalResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    // 周窗口剩余百分比
    if (m.weeklyRemainingPercent !== undefined) {
      const used = 100 - m.weeklyRemainingPercent;
      const color = pctColor(used);
      let seg = `7d:${color(`${used}%`)}`;
      if (m.weeklyResetAt) {
        const countdown = formatCountdown(m.weeklyResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    // 月窗口
    if (m.monthlyRemainingPercent !== undefined) {
      const used = 100 - m.monthlyRemainingPercent;
      const color = pctColor(used);
      let seg = `m:${color(`${used}%`)}`;
      if (m.monthlyResetAt) {
        const countdown = formatCountdown(m.monthlyResetAt, true);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    if (parts.length === 0) return null;
    const modelTag = m.modelName ? c.dim(` [${m.modelName}]`) : '';
    const prefix = lbl('usage', 'MiniMax', '[B]');
    return `${prefix}${modelTag} ${parts.join(' ')}`;
  }

  if (usage.deepSeek) {
    const d = usage.deepSeek;
    const total = d.totalBalance.toFixed(2);
    return `${lbl('usage', 'DeepSeek', '[B]')} ${c.cyan(c.bold(`¥${total}`))}${d.grantedBalance > 0 ? c.dim(` (赠送 ¥${d.grantedBalance.toFixed(2)})`) : ''}`;
  }

  if (usage.kimi) {
    const total = usage.kimi.totalBalance.toFixed(2);
    const grant = usage.kimi.grantedBalance && usage.kimi.grantedBalance > 0
      ? c.dim(` (赠送 ¥${usage.kimi.grantedBalance.toFixed(2)})`)
      : '';
    return `${lbl('usage', 'Kimi', '[B]')} ${c.cyan(c.bold(`¥${total}`))}${grant}`;
  }

  if (usage.stepfun) {
    const s = usage.stepfun;
    const total = s.totalBalance.toFixed(2);
    const voucher = s.voucherBalance > 0
      ? c.dim(` (代金券 ¥${s.voucherBalance.toFixed(2)})`)
      : '';
    return `${lbl('usage', 'StepFun', '[B]')} ${c.cyan(c.bold(`¥${total}`))}${voucher}`;
  }

  if (usage.siliconflow) {
    const sf = usage.siliconflow;
    const total = sf.totalBalance.toFixed(2);
    // totalBalance - balance = 赠送额度 (totalBalance 含赠送, balance 为充值)
    const granted = sf.totalBalance - sf.balance;
    const grant = granted > 0.001
      ? c.dim(` (赠送 ¥${granted.toFixed(2)})`)
      : '';
    return `${lbl('usage', '硅基流动', '[B]')} ${c.cyan(c.bold(`¥${total}`))}${grant}`;
  }

  // ─── Kimi For Coding ────────────────────────────────────────────────────────
  if (usage.kimiCoding) {
    const kc = usage.kimiCoding;
    const parts: string[] = [];

    // 5小时窗口已用百分比
    if (kc.fiveHourPercent !== undefined) {
      const color = pctColor(kc.fiveHourPercent);
      let seg = `5h:${color(`${kc.fiveHourPercent}%`)}`;
      if (kc.fiveHourResetAt) {
        const countdown = formatCountdown(kc.fiveHourResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // 周限额已用百分比
    if (kc.weeklyPercent !== undefined) {
      const color = pctColor(kc.weeklyPercent);
      let seg = `7d:${color(`${kc.weeklyPercent}%`)}`;
      if (kc.weeklyResetAt) {
        const countdown = formatCountdown(kc.weeklyResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    if (parts.length === 0) return null;
    const prefix = lbl('usage', 'Kimi Coding', '[B]');
    return `${prefix} ${parts.join(' ')}`;
  }

  if (usage.zhipu) {
    const z = usage.zhipu;
    const parts: string[] = [];

    // 5小时窗口 Token 用量 + 刷新倒计时 (仅存在时显示)
    if (z.usedPercent !== undefined) {
      const color = pctColor(z.usedPercent);
      let seg = `5h:${color(`${z.usedPercent}%`)}`;
      if (z.resetAt) {
        const countdown = formatCountdown(z.resetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // 周限额
    if (z.weeklyPercent !== undefined) {
      const color = pctColor(z.weeklyPercent);
      let seg = `7d:${color(`${z.weeklyPercent}%`)}`;
      if (z.weeklyResetAt) {
        const countdown = formatCountdown(z.weeklyResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // 月限额
    if (z.monthlyPercent !== undefined) {
      const color = pctColor(z.monthlyPercent);
      let seg = `m:${color(`${z.monthlyPercent}%`)}`;
      if (z.monthlyResetAt) {
        const countdown = formatCountdown(z.monthlyResetAt, true);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // MCP 工具用量 — 简短格式: mcp 已用/总数 (数值按阈值着色)
    if (z.mcpPercent !== undefined) {
      const color = pctColor(z.mcpPercent);
      const detail = (z.mcpUsed !== undefined && z.mcpTotal !== undefined)
        ? `mcp:${color(`${z.mcpUsed}/${z.mcpTotal}`)}`
        : `mcp:${color(`${z.mcpPercent}%`)}`;
      parts.push(detail);
    }

    if (parts.length === 0) return null;

    const levelTag = z.level ? c.dim(` [${z.level}]`) : '';
    const baseUrl = (process.env.ANTHROPIC_BASE_URL ?? '').toLowerCase();
    const zhipuName = baseUrl.includes('z.ai') ? 'GLM' : (LANG === 'en' ? 'Zhipu' : '智谱');
    const prefix = lbl('usage', zhipuName, '[B]');
    return `${prefix}${levelTag} ${parts.join(' ')}`;
  }

  // ─── 固定额度平台 (小米 / 阿里 / 火山引擎) ────────────────────────────

  const fixedQuota = usage.xiaomi || usage.alibaba || usage.volcengine;
  if (fixedQuota) {
    const parts: string[] = [];

    // 已用/总额度 (智能单位: 大数 M, 小数实际)
    if (fixedQuota.total > 0) {
      const usedStr = formatTokenCount(fixedQuota.used);
      const totalStr = formatTokenCount(fixedQuota.total);
      const pct = Math.round((fixedQuota.used / fixedQuota.total) * 100);
      const color = pctColor(pct);
      parts.push(`${color(`${usedStr}/${totalStr}`)}`);
    }

    // 月度百分比
    if (fixedQuota.monthlyPercent !== undefined) {
      const color = pctColor(fixedQuota.monthlyPercent);
      let seg = `m:${color(`${fixedQuota.monthlyPercent}%`)}`;
      if (fixedQuota.expiresAt) {
        const countdown = formatCountdown(fixedQuota.expiresAt, true);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    if (parts.length === 0) return null;

    // 确定平台名
    let platformName = '';
    let levelTag = '';
    if (usage.xiaomi) {
      platformName = lbl('usage', '小米', '[B]');
      levelTag = fixedQuota.plan ? c.dim(` [${fixedQuota.plan}]`) : '';
    } else if (usage.alibaba) {
      platformName = lbl('usage', '阿里', '[B]');
      levelTag = fixedQuota.plan ? c.dim(` [${fixedQuota.plan}]`) : '';
    } else if (usage.volcengine) {
      platformName = lbl('usage', '火山', '[B]');
      levelTag = fixedQuota.plan ? c.dim(` [${fixedQuota.plan}]`) : '';
    }

    return `${platformName}${levelTag} ${parts.join(' ')}`;
  }

  return null;
}
