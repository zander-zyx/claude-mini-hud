#!/usr/bin/env node
/**
 * claude-mini-hud - 极简 Claude Code 状态栏
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 从 stdin 读 JSON (Claude Code StatusLine 契约), 默认输出 2 必显行 + 可选行 (最多 7 行):
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
import { t, MINIMAL, lbl } from './i18n.js';
import { readTranscriptData } from './transcript.js';
import { renderContextLine, renderTokenLine, renderTodoLine, renderToolActivityLines, renderAgentLines, renderModelLine, renderUsageLine, getContextPercent } from './render.js';
import { getUsageData } from './usage.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// ─── 环境变量配置 ──────────────────────────────────────────────────────────

// 模型行可选显示: CLAUDE_MINI_HUD_SHOW_MODEL=1 显示, 默认隐藏
const SHOW_MODEL = process.env.CLAUDE_MINI_HUD_SHOW_MODEL === '1';

// Token 行模式: session(默认/累计) | context(上下文快照) | both(两行都显示)
const TOKEN_MODE = (['session', 'context', 'both'] as const)
  .includes(process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  ? (process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  : 'session';

// 预计算速度缓存目录
const SPEED_CACHE_DIR = join(homedir(), '.claude-mini-hud');

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

const STDIN_CACHE_PATH = join(homedir(), '.claude-mini-hud', 'stdin-cache.json');

function writeLastStdinCache(data: StdinData): void {
  try {
    const dir = dirname(STDIN_CACHE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(STDIN_CACHE_PATH, JSON.stringify(data), 'utf8');
  } catch {
    // 静默
  }
}

function readLastStdinCache(): StdinData | null {
  try {
    if (!existsSync(STDIN_CACHE_PATH)) return null;
    const raw = readFileSync(STDIN_CACHE_PATH, 'utf8');
    const data = JSON.parse(raw) as StdinData;
    // 无 context_window 视为无效缓存
    if (!data.context_window) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Context 百分比缓存 (防闪烁: 当 stdin 数据退化时用上次有效值兜底) ─────

const CTX_PCT_CACHE_PATH = join(homedir(), '.claude-mini-hud', 'ctx-pct-cache.json');

/** 读取 Context 百分比缓存 (仅同一会话有效) */
function readCtxPctCache(transcriptPath?: string): number {
  try {
    const { pct, ts, tp } = JSON.parse(readFileSync(CTX_PCT_CACHE_PATH, 'utf8'));
    // 不同会话 (transcript_path 不匹配) → 缓存无效
    if (!transcriptPath || !tp || transcriptPath !== tp) return 0;
    // 5 分钟内的缓存才有效 (避免 /clear 后残留旧值)
    if (typeof pct === 'number' && pct > 0 && Date.now() - ts < 300_000) return pct;
  } catch { /* ignore */ }
  return 0;
}

function writeCtxPctCache(pct: number, transcriptPath?: string): void {
  try {
    mkdirSync(dirname(CTX_PCT_CACHE_PATH), { recursive: true });
    writeFileSync(CTX_PCT_CACHE_PATH, JSON.stringify({ pct, ts: Date.now(), tp: transcriptPath ?? null }));
  } catch { /* silent */ }
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
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

  // 缓存本次 stdin (供下次 stdin 为 null 时兜底)
  writeLastStdinCache(stdin);

  // ─── Context 百分比防闪烁 ───
  // 当前 stdin 的 context 数据可能退化 (全零/缺失), 用缓存的上次有效百分比兜底
  // 关键: 只在**同一会话**内兜底 (通过 transcript_path 匹配), 避免新会话残留旧值
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

  const lines: string[] = [];
  // 1) 上下文 (必显, 含智谱限额标签)
  lines.push(renderContextLine(stdin, usageData));
  // 2) Token 细分 (必显, 模式由 CLAUDE_MINI_HUD_TOKEN_MODE 控制)
  lines.push(...renderTokenLine(stdin, tdata, TOKEN_MODE, SPEED_CACHE_DIR));

  // 2.5) 用量/余额行
  const usageLine = renderUsageLine(usageData);
  if (usageLine) lines.push(usageLine);

  // 3) 当前任务 (必显, 放在工具活动之前——执行计划更重要)
  const todoLine = renderTodoLine(tdata);
  if (todoLine) lines.push(todoLine);

  // 4) 工具活动 (有就显, 运行中/已完成 分行展示)
  const toolLines = renderToolActivityLines(tdata);
  if (toolLines.length > 0) lines.push(...toolLines);

  // 5) Agent 追踪 (有活跃 agent 就显, 每个一行)
  const agentLines = renderAgentLines(tdata);
  if (agentLines.length > 0) lines.push(...agentLines);

  // 6) 模型 (可选: CLAUDE_MINI_HUD_SHOW_MODEL=1, 放在最后)
  if (SHOW_MODEL) {
    lines.push(renderModelLine(stdin));
  }

  console.log(lines.join('\n'));
}

main().catch((err) => {
  // 任何错误都不抛, 输出 fallback (statusline 崩溃会让 Claude Code 无法继续)
  process.stderr.write(`[claude-mini-hud] error: ${err instanceof Error ? err.message : String(err)}\n`);
  console.log(`${c.gray('claude-mini-hud')} ${c.dim(`— ${t.renderFailed} —`)}`);
});
