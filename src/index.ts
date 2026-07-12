#!/usr/bin/env node
/**
 * claude-mini-hud - 极简 Claude Code 状态栏
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 从 stdin 读 JSON (Claude Code StatusLine 契约), 默认输出 2 必显行 + 条件行:
 *   [#] 上下文  进度条 + used/total + 剩余
 *   [$] Token   总数 + in/out/cache 细分 + tok/s 速率
 *   [B] 用量/余额 (多平台自动检测)
 *   [>] 当前任务  in-progress todo + 完成度
 *   [>] 工具活动  ◐ 运行中 / ✓ 已完成
 *   [>] Agent   ◐ 描述 + 耗时
 *   [>] 模型    (可选: CLAUDE_MINI_HUD_SHOW_MODEL=1)
 *
 * 零依赖, 纯 ANSI 转义
 */

// ─── 模块导入 ──────────────────────────────────────────────────────────────

import type { StdinData } from './types.js';
import { c } from './colors.js';
import { t, MINIMAL, lbl, ULTRA_MINIMAL } from './i18n.js';
import { readTranscriptData } from './transcript.js';
import { renderContextLine, renderTokenLine, renderTodoLine, renderToolActivityLines, renderAgentLines, renderModelLine, renderUsageLine, getContextPercent } from './render.js';
import { renderCostLine, renderGitLine, renderAlertLine, renderCompactLine } from './render.js';
import { getUsageData } from './usage.js';
import { claimUsageRefresh, detectPlatform, getApiKeyForPlatform, refreshUsageData, releaseUsageRefresh } from './usage.js';
import { CACHE_DIR, sessionCachePath, atomicWrite, pruneOldSessions } from './cache.js';
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// ─── 环境变量配置 ──────────────────────────────────────────────────────────

// 模型行可选显示: CLAUDE_MINI_HUD_SHOW_MODEL=1 显示, 默认隐藏
const SHOW_MODEL = process.env.CLAUDE_MINI_HUD_SHOW_MODEL === '1';

// 花费/耗时行: CLAUDE_MINI_HUD_SHOW_COST=1 显示
const SHOW_COST = process.env.CLAUDE_MINI_HUD_SHOW_COST === '1';

// Git 分支行: CLAUDE_MINI_HUD_SHOW_GIT=1 显示
const SHOW_GIT = process.env.CLAUDE_MINI_HUD_SHOW_GIT === '1';

// 阈值告警行: CLAUDE_MINI_HUD_WARN=0 关闭, 默认开启 (context>=85% / usage>=90%)
const WARN_ENABLED = process.env.CLAUDE_MINI_HUD_WARN !== '0';

// 紧凑单行模式: CLAUDE_MINI_HUD_COMPACT=1 把关键信息压成一行
const COMPACT = process.env.CLAUDE_MINI_HUD_COMPACT === '1';

// 自定义行布局: CLAUDE_MINI_HUD_LAYOUT=逗号分隔的行名, 控制显示哪些行及其顺序
// 可用行名: context, token, usage, todo, tools, agent, model, cost, git, alert
const LAYOUT_RAW = process.env.CLAUDE_MINI_HUD_LAYOUT?.trim();
const LAYOUT = LAYOUT_RAW
  ? LAYOUT_RAW.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : null;

// Token 行模式: session(默认/累计) | context(上下文快照) | both(两行都显示)
const TOKEN_MODE = (['session', 'context', 'both'] as const)
  .includes(process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  ? (process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  : 'session';

// 进度条主题: default(默认) | neon | braille | hardcore | minimal | pixel | diamond | arrow
// 标记图标:   default(默认) | neon | braille | hardcore | minimal | pixel | diamond | arrow
// (由 themes.ts 模块自行解析 CLAUDE_MINI_HUD_THEME / CLAUDE_MINI_HUD_MARKS 环境变量)
// 两者独立, 可自由组合 (如 THEME=hardcore + MARKS=diamond)

// 速度缓存目录 (= CACHE_DIR, render 函数的 cacheDir 参数)
const SPEED_CACHE_DIR = CACHE_DIR;
const USAGE_REFRESH_ARG = '--refresh-usage';
const USAGE_REFRESH_DATA_ENV = 'CLAUDE_MINI_HUD_REFRESH_DATA';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : 'unknown';
  } catch {
    return 'unknown';
  }
}

function spawnUsageRefresh(stdin: StdinData): void {
  const platform = detectPlatform(stdin);
  if (!platform || platform === 'claude' || !getApiKeyForPlatform(platform)) return;
  if (!claimUsageRefresh(platform)) return;

  const payload = JSON.stringify({ model: stdin.model });
  if (Buffer.byteLength(payload, 'utf8') > 8 * 1024) {
    releaseUsageRefresh(platform);
    return;
  }

  try {
    const child = spawn(process.execPath, [process.argv[1], USAGE_REFRESH_ARG, platform], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, [USAGE_REFRESH_DATA_ENV]: payload },
    });
    child.once('error', () => releaseUsageRefresh(platform));
    child.unref();
  } catch {
    releaseUsageRefresh(platform);
  }
}

// ─── stdin 读取 ────────────────────────────────────────────────────────────

async function readStdin(): Promise<StdinData | null> {
  // TTY 模式 (用户直接跑) → 没有 JSON 输入, 返回 null
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise((resolve) => {
    let raw = '';
    const timeout = setTimeout(() => resolve(null), 500);

    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => {
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > 256 * 1024) {
        clearTimeout(timeout);
        resolve(null);
      }
    });
    process.stdin.on('end', () => {
      clearTimeout(timeout);
      const trimmed = raw.trim();
      if (!trimmed) return resolve(null);
      try {
        resolve(JSON.parse(trimmed) as StdinData);
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

// ─── stdin 缓存 (兜底超时/空输入, 避免 Context 行闪烁消失) ────────────────
// 按 transcript_path 哈希隔离, 多窗口 (多个 Claude Code 进程) 各写各的缓存,
// 互不覆盖。读时优先读当前会话的, 无 tp 时读最近修改的 (LRU 兜底)。
// 路径构造/原子写/清理统一走 ./cache.js

function writeLastStdinCache(data: StdinData, transcriptPath?: string): void {
  atomicWrite(sessionCachePath('stdin', transcriptPath), JSON.stringify(data));
  // 1% 概率清理 30 天前的过期缓存 (防长期累积)
  pruneOldSessions();
}

function readLastStdinCache(transcriptPath?: string): StdinData | null {
  const tryRead = (path: string): StdinData | null => {
    try {
      if (!existsSync(path)) return null;
      const raw = readFileSync(path, 'utf8');
      const data = JSON.parse(raw) as StdinData;
      // 校验 context_window 类型 (防止损坏的缓存文件导致后续访问 .used_percentage 崩溃)
      if (!data.context_window || typeof data.context_window !== 'object' || data.context_window === null) return null;
      return data;
    } catch {
      return null;
    }
  };

  // 1) 优先读当前会话的缓存
  if (transcriptPath) {
    const hit = tryRead(sessionCachePath('stdin', transcriptPath));
    if (hit) return hit;
  }
  // 2) 无 tp 或当前会话缓存不存在 → 读最近修改的 (LRU 兜底, 处理窗口切换瞬间)
  try {
    if (!existsSync(CACHE_DIR)) return null;
    const files = readdirSync(CACHE_DIR)
      .filter((f) => f.startsWith('stdin-') && f.endsWith('.json'))
      .map((f) => ({ f, mt: statSync(join(CACHE_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mt - a.mt);
    if (files.length === 0) return null;
    return tryRead(join(CACHE_DIR, files[0].f));
  } catch {
    return null;
  }
}

// ─── Context 百分比缓存 (防闪烁: 当 stdin 数据退化时用上次有效值兜底) ─────
// 按 transcript_path 哈希隔离, 多窗口互不覆盖。内部仍保留 tp 校验作双保险。

/** 读取 Context 百分比缓存 (仅同一会话有效) */
function readCtxPctCache(transcriptPath?: string): number {
  try {
    const path = sessionCachePath('ctx-pct', transcriptPath);
    if (!existsSync(path)) return 0;
    const { pct, ts, tp, mtime } = JSON.parse(readFileSync(path, 'utf8'));
    // 不同会话 (transcript_path 不匹配) → 缓存无效 (双保险: 文件已按哈希隔离, 但兜底场景无 tp 时仍可能误读)
    if (!transcriptPath || !tp || transcriptPath !== tp) return 0;

    // 检测 /clear: transcript 文件被截断 → mtime 变化
    if (transcriptPath && mtime && typeof mtime === 'number') {
      try {
        const currentMtime = statSync(transcriptPath).mtimeMs;
        if (Math.abs(currentMtime - mtime) > 1000) return 0; // mtime 差距 >1s → 文件被修改
      } catch { /* file not found */ return 0; }
    }

    // 300 秒 (5分钟) 内的缓存才有效 (与文档描述一致, 平衡防闪烁 + /clear 后快速恢复)
    if (typeof pct === 'number' && pct > 0 && Date.now() - ts < 300_000) return pct;
  } catch { /* ignore */ }
  return 0;
}

function writeCtxPctCache(pct: number, transcriptPath?: string): void {
  let mtime = 0;
  if (transcriptPath) {
    try {
      mtime = statSync(transcriptPath).mtimeMs;
    } catch { /* ignore */ }
  }
  atomicWrite(sessionCachePath('ctx-pct', transcriptPath), JSON.stringify({ pct, ts: Date.now(), tp: transcriptPath ?? null, mtime }));
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(readPackageVersion());
    return;
  }

  const refreshArgIndex = process.argv.indexOf(USAGE_REFRESH_ARG);
  if (refreshArgIndex >= 0) {
    const platform = process.argv[refreshArgIndex + 1] ?? '';
    try {
      const payload = process.env[USAGE_REFRESH_DATA_ENV];
      const stdin = payload ? JSON.parse(payload) as StdinData : {};
      await refreshUsageData(platform, stdin);
    } finally {
      releaseUsageRefresh(platform);
    }
    return;
  }

  let stdin = await readStdin();

  // stdin 为 null (超时/空输入/解析失败) → 尝试用缓存的上次数据渲染
  if (!stdin) {
    const cached = readLastStdinCache();
    if (cached) {
      stdin = cached;
    } else {
      // 真的没有任何数据, 输出占位
      const label = lbl('context', t.context, '#');
      console.log(`${label} ${c.dim('—')}  ${c.dim(t.fallback)}`);
      return;
    }
  }

  // 缓存本次 stdin (供下次 stdin 为 null 时兜底), 按会话隔离
  writeLastStdinCache(stdin, stdin.transcript_path);

  // ─── Context 百分比防闪烁 ───
  // getContextPercent 内部已有 fallback 链: native > 0 → tokens/size → totalInput/size
  // 正常情况 fallback 已能防止跳 0 (current_usage 有 token 时)
  // 仅当所有 fallback 都返回 0 (数据完全退化) 时, 用缓存兜底
  const tp = stdin.transcript_path;
  const pct = getContextPercent(stdin);
  if (pct > 0) {
    writeCtxPctCache(pct, tp);
  } else {
    const cachedPct = readCtxPctCache(tp);
    if (cachedPct > 0) {
      if (!stdin.context_window) stdin.context_window = {};
      stdin.context_window.used_percentage = cachedPct;
    }
  }

  // 先读 transcript (一次 I/O, 供 todos / 工具 / Agent / Token fallback 共用)
  const tdata = stdin.transcript_path ? await readTranscriptData(stdin.transcript_path) : null;

  // 用量数据 (提前获取, 供 Context 行的限额标签 + 用量行共用)
  const usageData = getUsageData(stdin);
  if (!usageData) spawnUsageRefresh(stdin);

  const lines: string[] = [];

  // ─── 紧凑单行模式: 把关键信息压成一行, 直接输出 ──────────────────────
  if (COMPACT) {
    console.log(renderCompactLine(stdin, usageData, tdata, SPEED_CACHE_DIR));
    return;
  }

  // ─── 各行的渲染 producer (按需调用, 避免无谓计算) ──────────────────────
  const producers: Record<string, () => string | string[] | null> = {
    context: () => renderContextLine(stdin, usageData, SPEED_CACHE_DIR),
    token:   () => renderTokenLine(stdin, tdata, TOKEN_MODE, SPEED_CACHE_DIR),
    usage:   () => renderUsageLine(usageData),
    alert:   () => WARN_ENABLED ? renderAlertLine(stdin, usageData) : null,
    todo:    () => renderTodoLine(tdata),
    tools:   () => renderToolActivityLines(tdata),
    agent:   () => renderAgentLines(tdata),
    cost:    () => SHOW_COST ? renderCostLine(stdin) : null,
    git:     () => SHOW_GIT ? renderGitLine(stdin) : null,
    model:   () => SHOW_MODEL ? renderModelLine(stdin) : null,
  };

  // ─── 行布局: 自定义 LAYOUT 优先, 否则默认顺序 + 条件行 ──────────────────
  // 默认顺序: context, token, [alert], usage, todo, tools, agent, [cost], [git], [model]
  const orderedKeys: string[] = LAYOUT
    ? LAYOUT
    : ['context', 'token', 'alert', 'usage', 'todo', 'tools', 'agent', 'cost', 'git', 'model'];

  // 默认布局下 context + token 必显；LAYOUT 模式严格遵循用户配置，允许只显示指定行
  const mustHave = new Set(['context', 'token']);
  const seen = new Set<string>();
  const finalKeys: string[] = [];
  // ultra-minimal: 强制只渲染 context + token
  const allowed = ULTRA_MINIMAL ? ['context', 'token'] : orderedKeys;
  for (const k of allowed) {
    if (seen.has(k)) continue;
    seen.add(k);
    finalKeys.push(k);
  }
  // 默认布局下补齐必显行 (LAYOUT 模式下严格遵循用户配置)
  if (!LAYOUT) {
    for (const k of mustHave) {
      if (!seen.has(k)) { seen.add(k); finalKeys.unshift(k); }
    }
  }

  // 渲染并收集非空行 (alert 行默认为 null, 无触发时不占位)
  for (const key of finalKeys) {
    const fn = producers[key];
    if (!fn) continue;
    const out = fn();
    if (out === null) continue;
    if (Array.isArray(out)) {
      if (out.length > 0) lines.push(...out);
    } else {
      lines.push(out);
    }
  }

  // 兜底: 极端情况下无任何行 → 输出 context 占位
  if (lines.length === 0) {
    lines.push(renderContextLine(stdin, usageData, SPEED_CACHE_DIR));
  }

  console.log(lines.join('\n'));
}

main().catch((err) => {
  // 任何错误都不抛, 输出 fallback (statusline 崩溃会让 Claude Code 无法继续)
  process.stderr.write(`[claude-mini-hud] error: ${err instanceof Error ? err.message : String(err)}\n`);
  console.log(`${c.gray('claude-mini-hud')} ${c.dim(`— ${t.renderFailed} —`)}`);
});
