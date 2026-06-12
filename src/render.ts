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
import type { UsageData } from './usage.js';
import { c } from './colors.js';
import { t, MINIMAL, lbl } from './i18n.js';
import { truncate } from './transcript.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

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

function progressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  const block = '█';
  const blank = '░';
  // 颜色按百分比: 绿 < 60, 黄 60-80, 红 > 80
  const color = percent > 80 ? c.red : percent > 60 ? c.yellow : c.green;
  return color(block.repeat(filled) + blank.repeat(empty));
}

function simpleHash(s: string): string {
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
function resolveContextSize(stdin: StdinData): number {
  return stdin.context_window?.context_window_size ?? 0;
}

export function getContextPercent(stdin: StdinData): number {
  // 优先用 Claude Code v2.1.6+ 的原生百分比
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native) && native > 0) {
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

export function renderContextLine(stdin: StdinData, usage: UsageData | null): string {
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

  const bar = progressBar(pct);
  const pctStr = pct >= 80 ? c.red(c.bold(`${pct}%`))
               : pct >= 60 ? c.yellow(c.bold(`${pct}%`))
               : c.green(c.bold(`${pct}%`));

  // 余额标签: 非套餐平台 (DeepSeek/Kimi 等) 在 "剩余" 后显示余额
  const balanceTag = buildBalanceTag(usage);

  let detail = '';
  if (size > 0) {
    detail = c.dim(`${formatTokenCount(displayTokens)} / ${formatTokenCount(size)}  ${t.contextRemaining} ${formatTokenCount(remaining)}`);
  } else {
    detail = c.dim(`${formatTokenCount(displayTokens)}`);
  }
  if (balanceTag) detail += `  ${balanceTag}`;

  const label = lbl('context', t.context, '#');
  return `${label} ${bar} ${pctStr}  ${detail}`;
}

/** 构建余额标签: 仅非套餐平台 (余额型) 在 Context 行显示 */
function buildBalanceTag(usage: UsageData | null): string | null {
  if (!usage) return null;
  // 所有有独立 Usage 行的平台都不在 Context 行显示余额 (避免重复)
  if (usage.deepSeek || usage.kimi || usage.zhipu || usage.xiaomi || usage.alibaba || usage.volcengine) return null;
  return null;
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

  const running = tdata.recentTools.filter((a) => a.status === 'running');
  const completed = tdata.recentTools.filter((a) => a.status === 'completed' || a.status === 'error');
  const lines: string[] = [];
  const prefix = MINIMAL ? ' ' : '  ';  // 子行缩进

  // 运行中的工具: 每个一行, ◐ 前缀
  for (const act of running.slice(-3)) {
    const verb = t.toolVerb[act.tool] ?? act.tool;
    const detail = act.label ? ` ${act.label}` : '';
    lines.push(`${prefix}${c.yellow('◐')} ${verb}${c.dim(detail)}`);
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
      return `${c.green('✓')} ${verb} ${c.dim(`×${count}`)}`;
    });
    lines.push(`${prefix}${items.join('  ')}`);
  }

  // 没有内容时返回空, 有内容时在首行前加标签
  if (lines.length === 0) return [];
  const label = lbl('tools', t.tools, '[*]');
  lines[0] = `${label}${lines[0].slice(prefix.length)}`;
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
    lines.push(`${prefix}${typeTag}${c.yellow('◐')} ${desc}${elapsed}`);
  }

  if (lines.length === 0) return [];
  const label = lbl('agent', t.agent, '&');
  lines[0] = `${label}${lines[0].slice(prefix.length)}`;
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
  // 按优先级取第一个非空 env (ANTHROPIC_MODEL → OPUS → SONNET → HAIKU)
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

  // env 都没配 → 用 Claude Code stdin 给的模型
  const name = stdin.model?.display_name?.trim() || stdin.model?.id?.trim() || 'Unknown';
  return stripContextTag(name);
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
      const parts = new URL(process.env.ANTHROPIC_BASE_URL).hostname.split('.');
      // 跳过通用前缀 (api/www/open/gateway/proxy/app/console)
      const generic = new Set(['api', 'www', 'open', 'gateway', 'proxy', 'app', 'console']);
      // 优先取真正的品牌段: 跳过 generic 后, 取中间或倒数第二段
      // "api.minimaxi.com" → ["api","minimaxi","com"] → "minimaxi"
      // "open.bigmodel.cn" → ["open","bigmodel","cn"] → "bigmodel"
      // "api.deepseek.com" → ["api","deepseek","com"] → "deepseek"
      const brand = parts.filter((p) => !generic.has(p));
      // 取最后两段中的第一段 (品牌名, 排除顶级域)
      return brand.length >= 2 ? brand[brand.length - 2] : (brand[0] ?? parts[0] ?? null);
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Token 行 (session 累计 / 上下文快照 / 速率) ──────────────────────

/** 从 stdin + transcript 提取 session 累计 token */
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

  return { input, output, cache, total: input + output + cache };
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
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({ n: outputTokens, ts: now }));
    };

    // 无基线 / token 回退 (新会话) / 无新输出 / 基线过旧 → 重建基线
    if (!prev || outputTokens <= prev.n) { writeBaseline(); return null; }
    const dt = (now - prev.ts) / 1000;
    if (dt > 300) { writeBaseline(); return null; }
    // 间隔太短 (StatusLine 刷新可达 300ms): 保留旧基线, 等累计到足够窗口再算
    if (dt < 0.5) return null;

    writeBaseline();
    const speed = Math.round((outputTokens - prev.n) / dt);
    return speed > 0 ? speed : null;
  } catch {
    return null;
  }
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
      const color = fiveHour >= 80 ? c.red : fiveHour >= 60 ? c.yellow : c.green;
      let seg = `5h:${color(`${fiveHour}%`)}`;
      if (fiveHourResetAt) {
        const countdown = formatCountdown(fiveHourResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }
    if (sevenDay !== null) {
      const color = sevenDay >= 80 ? c.red : sevenDay >= 60 ? c.yellow : c.green;
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
      const color = used >= 80 ? c.red : used >= 60 ? c.yellow : c.green;
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
      const color = used >= 80 ? c.red : used >= 60 ? c.yellow : c.green;
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
      const color = used >= 80 ? c.red : used >= 60 ? c.yellow : c.green;
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

  if (usage.zhipu) {
    const z = usage.zhipu;
    const parts: string[] = [];

    // 5小时窗口 Token 用量 + 刷新倒计时 (仅存在时显示)
    if (z.usedPercent !== undefined) {
      const color = z.usedPercent >= 80 ? c.red : z.usedPercent >= 60 ? c.yellow : c.green;
      let seg = `5h:${color(`${z.usedPercent}%`)}`;
      if (z.resetAt) {
        const countdown = formatCountdown(z.resetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // 周限额
    if (z.weeklyPercent !== undefined) {
      const color = z.weeklyPercent >= 80 ? c.red : z.weeklyPercent >= 60 ? c.yellow : c.green;
      let seg = `7d:${color(`${z.weeklyPercent}%`)}`;
      if (z.weeklyResetAt) {
        const countdown = formatCountdown(z.weeklyResetAt);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // 月限额
    if (z.monthlyPercent !== undefined) {
      const color = z.monthlyPercent >= 80 ? c.red : z.monthlyPercent >= 60 ? c.yellow : c.green;
      let seg = `m:${color(`${z.monthlyPercent}%`)}`;
      if (z.monthlyResetAt) {
        const countdown = formatCountdown(z.monthlyResetAt, true);
        if (countdown) seg += c.dim(` (${countdown})`);
      }
      parts.push(seg);
    }

    // MCP 工具用量 — 简短格式: mcp 已用/总数 (数值按阈值着色)
    if (z.mcpPercent !== undefined) {
      const color = z.mcpPercent >= 80 ? c.red : z.mcpPercent >= 60 ? c.yellow : c.green;
      const detail = (z.mcpUsed !== undefined && z.mcpTotal !== undefined)
        ? `mcp:${color(`${z.mcpUsed}/${z.mcpTotal}`)}`
        : `mcp:${color(`${z.mcpPercent}%`)}`;
      parts.push(detail);
    }

    if (parts.length === 0) return null;

    const levelTag = z.level ? c.dim(` [${z.level}]`) : '';
    const prefix = lbl('usage', '智谱', '[B]');
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
      const color = pct >= 80 ? c.red : pct >= 60 ? c.yellow : c.green;
      parts.push(`${color(`${usedStr}/${totalStr}`)}`);
    }

    // 月度百分比
    if (fixedQuota.monthlyPercent !== undefined) {
      const color = fixedQuota.monthlyPercent >= 80 ? c.red : fixedQuota.monthlyPercent >= 60 ? c.yellow : c.green;
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
