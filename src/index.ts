/**
 * claude-mini-hud - 极简 Claude Code 状态栏
 *
 * 从 stdin 读 JSON (Claude Code StatusLine 契约), 默认输出 3 必显行 + 1 可选:
 *   📊 上下文  进度条 + used/total + 剩余
 *   🪙 Token   总数 + in/out/cache 细分
 *   ▶️ 当前任务  in-progress todo + 完成度
 *   🤖 模型    (可选: CLAUDE_MINI_HUD_SHOW_MODEL=1)
 *
 * 零依赖, 纯 ANSI 转义, 编译产物单文件 ~6KB
 */

// ─── 用量查询 (独立模块) ─────────────────────────────────────────────────

import { getUsageData } from './usage.js';

// ─── i18n (★ 用户安装时选 1.中文 / 2.英文) ──────────────────────────────

type Lang = 'zh' | 'en' | 'minimal';

const STRINGS = {
  zh: {
    context: '上下文',
    contextRemaining: '剩余',
    token: 'Token',
    in: '入',
    out: '出',
    cache: '缓存',
    model: '模型',
    todo: '当前任务',
    fallback: '无 stdin 输入',
    renderFailed: '渲染失败, 已 fallback',
    noInProgress: '— 无进行中 —',
    allDone: '✓ 全部完成',
    tools: '工具',
    agent: 'Agent',
    // tool → 中文动词映射
    toolVerb: { Read: '读取', Write: '写入', Edit: '编辑', Grep: '搜索', Glob: '查找', Bash: '执行', WebFetch: '抓取', WebSearch: '搜索', Agent: '启动', Task: '任务' } as Record<string, string>,
  },
  en: {
    context: 'Context',
    contextRemaining: 'left',
    token: 'Token',
    in: 'in',
    out: 'out',
    cache: 'cache',
    model: 'Model',
    todo: 'Todos',
    fallback: 'no stdin input',
    renderFailed: 'render failed, fallback',
    noInProgress: '— none in progress —',
    allDone: '✓ all done',
    tools: 'Tools',
    agent: 'Agent',
    toolVerb: { Read: 'reading', Write: 'writing', Edit: 'editing', Grep: 'searching', Glob: 'finding', Bash: 'running', WebFetch: 'fetching', WebSearch: 'searching', Agent: 'spawning', Task: 'task' } as Record<string, string>,
  },
  minimal: {
    context: 'Context',
    contextRemaining: '剩余',
    token: 'Token',
    in: 'in',
    out: 'out',
    cache: 'cache',
    model: 'Model',
    todo: '当前任务',
    fallback: 'no stdin input',
    renderFailed: 'render failed, fallback',
    noInProgress: '— 无进行中 —',
    allDone: '✓ 全部完成',
    tools: 'Tools',
    agent: 'Agent',
    toolVerb: { Read: 'reading', Write: 'writing', Edit: 'editing', Grep: 'searching', Glob: 'finding', Bash: 'running', WebFetch: 'fetching', WebSearch: 'searching', Agent: 'spawning', Task: 'task' } as Record<string, string>,
  },
} as const;

// 默认语言 (运行时可通过 env CLAUDE_MINI_HUD_LANG=zh|en|minimal 覆盖)
const LANG: Lang = (['zh', 'en', 'minimal'] as const)
  .includes(process.env.CLAUDE_MINI_HUD_LANG as Lang)
  ? (process.env.CLAUDE_MINI_HUD_LANG as Lang)
  : 'zh';
const t = STRINGS[LANG];

// 模型行可选显示: CLAUDE_MINI_HUD_SHOW_MODEL=1 显示, 默认隐藏
const SHOW_MODEL = process.env.CLAUDE_MINI_HUD_SHOW_MODEL === '1';

// Token 行模式: session(默认/累计) | context(上下文快照) | both(两行都显示)
const TOKEN_MODE = (['session', 'context', 'both'] as const)
  .includes(process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  ? (process.env.CLAUDE_MINI_HUD_TOKEN_MODE as 'session' | 'context' | 'both')
  : 'session';

// 是否 minimal 模式 (无 emoji 前缀)
const MINIMAL = LANG === 'minimal';

// 预计算速度缓存目录 (避免每次 renderTokenLine 都 require + homedir)
const SPEED_CACHE_DIR = (() => {
  try {
    const os = require('node:os');
    const path = require('node:path');
    return path.join(os.homedir(), '.claude-mini-hud');
  } catch {
    return '';
  }
})();

// ─── 类型契约 (Claude Code StatusLine stdin JSON) ────────────────────────

export interface StdinData {
  model?: { display_name?: string; id?: string };
  context_window?: {
    current_usage?: {
      input_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      output_tokens?: number;
    };
    context_window_size?: number;
    used_percentage?: number;
    // Claude Code 上报的 session 累计 token (比 current_usage 更可靠)
    total_input_tokens?: number | null;
    total_output_tokens?: number | null;
  };
  transcript_path?: string;
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number };
    seven_day?: { used_percentage?: number; resets_at?: number };
  };
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  workspace?: { current_dir?: string; project_dir?: string };
}

interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

interface TranscriptEntry {
  type: 'user' | 'assistant' | 'system';
  message?: {
    role?: string;
    content?: string | Array<{ type: string; text?: string; name?: string; id?: string; input?: Record<string, unknown>; tool_use_id?: string }>;
  };
  timestamp?: string;
}

// 从 transcript 一次读取提取的聚合数据 (避免多次读大文件)
interface TranscriptData {
  todos: TodoItem[] | null;
  recentTools: ToolActivity[];
  activeAgents: AgentActivity[];
  sessionTokens: { input: number; output: number; cache: number } | null;
}

interface ToolActivity {
  tool: string;
  label: string;
  status: 'running' | 'completed' | 'error';
  id: string;
}

interface AgentActivity {
  description: string;
  subagentType?: string;
  startTime: number;  // Date.now() 时间戳, 用于计算耗时
}

// ─── ANSI 颜色 (零依赖) ───────────────────────────────────────────────────

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const c = {
  red:    (s: string) => `\x1b[31m${s}${RESET}`,
  green:  (s: string) => `\x1b[32m${s}${RESET}`,
  yellow: (s: string) => `\x1b[33m${s}${RESET}`,
  blue:   (s: string) => `\x1b[34m${s}${RESET}`,
  magenta:(s: string) => `\x1b[35m${s}${RESET}`,
  cyan:   (s: string) => `\x1b[36m${s}${RESET}`,
  gray:   (s: string) => `\x1b[90m${s}${RESET}`,
  bold:   (s: string) => `${BOLD}${s}${RESET}`,
  dim:    (s: string) => `${DIM}${s}${RESET}`,
};

// ─── stdin 读取 (复用 claude-hud 思路, 简化) ──────────────────────────────

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

function getContextPercent(stdin: StdinData): number {
  // 优先用 Claude Code v2.1.6+ 的原生百分比
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native) && native > 0) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }

  const size = resolveContextSize(stdin);
  if (!size || size <= 0) return 0;

  return Math.min(100, Math.round((getTotalTokens(stdin) / size) * 100));
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

function formatTokenCount(n: number, decimals: number = 1): string {
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

function renderContextLine(stdin: StdinData): string {
  const pct = getContextPercent(stdin);
  const size = resolveContextSize(stdin);
  const tokens = getTotalTokens(stdin);
  const remaining = Math.max(0, size - tokens);
  const bar = progressBar(pct);
  const pctStr = pct >= 80 ? c.red(c.bold(`${pct}%`))
               : pct >= 60 ? c.yellow(c.bold(`${pct}%`))
               : c.green(c.bold(`${pct}%`));
  // 格式: used / total  remaining (绝对紧凑, 不用 "tokens" 后缀 — 上下文行默认就是 token)
  const detail = size > 0
    ? c.dim(`${formatTokenCount(tokens)} / ${formatTokenCount(size)}  ${t.contextRemaining} ${formatTokenCount(remaining)}`)
    : c.dim(`${formatTokenCount(tokens)}`);

  const label = MINIMAL
    ? ` ${t.context}`  // minimal: 前置空格, 无 emoji
    : `${c.gray(`📊 ${t.context}`)}`;  // zh/en: 灰色 + emoji
  return `${label} ${bar} ${pctStr}  ${detail}`;
}

// ─── 当前任务行 ───────────────────────────────────────────────────────────

function renderTodoLine(tdata: TranscriptData | null): string | null {
  if (!tdata) return null;
  const todos = tdata.todos;
  if (!todos || todos.length === 0) return null;

  const inProgress = todos.find((t) => t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;
  const progress = c.dim(`(${completed}/${total})`);

  if (!inProgress) {
    if (completed === total) {
      return `${todoLabel(t)} ${c.green(t.allDone)}  ${progress}`;
    }
    return `${todoLabel(t)} ${c.dim(t.noInProgress)}  ${progress}`;
  }

  const content = truncate(inProgress.activeForm ?? inProgress.content, 60);
  return `${todoLabel(t)} ${c.yellow('▸')} ${content}  ${progress}`;
}

// 渲染 todo 行的 label, 区分 minimal 模式
function todoLabel(t: (typeof STRINGS)[Lang]): string {
  if (MINIMAL) {
    return ` ${t.todo}`;
  }
  return c.gray(`▶️  ${t.todo}`);
}

// 统一 transcript 读取器: 一次读取尾部, 提取 todos + 工具活动 + Agent 状态
async function readTranscriptData(transcriptPath: string): Promise<TranscriptData | null> {
  try {
    const fs = await import('node:fs/promises');
    // 只读文件尾部 (避免长会话全量读取数 MB)
    const TAIL_BYTES = 256 * 1024;
    const handle = await fs.open(transcriptPath, 'r');
    let content: string;
    try {
      const { size } = await handle.stat();
      const start = Math.max(0, size - TAIL_BYTES);
      const length = size - start;
      const buf = Buffer.alloc(length);
      await handle.read(buf, 0, length, start);
      content = buf.toString('utf8');
    } finally {
      await handle.close();
    }

    // 跳过首行 (尾部截断可能切在行中间, 丢弃不完整的首行)
    const rawLines = content.split('\n');
    const lines = rawLines[0] === '' || rawLines.length <= 2
      ? rawLines.filter(Boolean)
      : rawLines.slice(1).filter(Boolean);

    let todos: TodoItem[] | null = null;
    let hasToolTodos = false;                              // tool-use 修改过列表 → 后续忽略 entry.todos
    const toolMap = new Map<string, ToolActivity>();       // tool_use_id → ToolActivity
    const agentSpawns = new Map<string, AgentActivity>();  // tool_use_id → AgentActivity
    const agentResults = new Set<string>();                // completed agent tool_use_ids
    const taskIdToIndex = new Map<string, number>();       // taskId → todos[] index

    // session 累计 token (从 transcript tail 累加, 作为 stdin total_* 的 fallback)
    const sessionTokens = { input: 0, output: 0, cache: 0 };
    let lastUsageKey = '';

    // 正向遍历 (保持 TaskCreate / TaskUpdate / tool_use → tool_result 的时间顺序)
    for (let i = 0; i < lines.length; i++) {
      let entry: Record<string, unknown> | null = null;
      try { entry = JSON.parse(lines[i]); } catch { continue; }
      if (!entry) continue;

      const ts = typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : 0;
      const validTs = !Number.isNaN(ts) && ts > 0 ? ts : Date.now();

      // --- todos: entry.todos 仅在 tool-use 未修改时作种子数据 ---
      if (!hasToolTodos) {
        const td = (entry as { todos?: TodoItem[] }).todos;
        if (Array.isArray(td) && td.length > 0) {
          todos = td;
          taskIdToIndex.clear();
        }
      }

      // --- assistant entry: 累加 usage + 解析 tool_use 块 ---
      if (entry.type === 'assistant') {
        // 累加 session token (去重: Claude Code 可能连续写同一 usage 2-3次)
        const usage = (entry as { message?: { usage?: { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } } }).message?.usage;
        if (usage) {
          const key = `${usage.input_tokens}|${usage.output_tokens}|${usage.cache_creation_input_tokens}|${usage.cache_read_input_tokens}`;
          if (key !== lastUsageKey) {
            sessionTokens.input += usage.input_tokens ?? 0;
            sessionTokens.output += usage.output_tokens ?? 0;
            sessionTokens.cache += (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
            lastUsageKey = key;
          }
        }
        const msg = (entry as unknown as TranscriptEntry).message;
        const blocks = Array.isArray(msg?.content) ? msg!.content! : [];
        for (const block of blocks) {
          if (block.type === 'tool_use' && block.name && block.id) {
            // TaskCreate: 添加新 todo
            if (block.name === 'TaskCreate') {
              hasToolTodos = true;
              const input = block.input ?? {};
              const subject = typeof input.subject === 'string' ? input.subject : '';
              const desc = typeof input.description === 'string' ? input.description : '';
              const content = subject || desc || 'Untitled';
              const status = normalizeTaskStatus(input.status) ?? 'pending';
              if (!todos) todos = [];
              todos.push({ content, status });

              const rawId = input.taskId;
              const tid = typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : block.id;
              taskIdToIndex.set(tid, todos.length - 1);
              continue;
            }

            // TaskUpdate: 更新已有 todo
            if (block.name === 'TaskUpdate') {
              hasToolTodos = true;
              if (todos) {
                const input = block.input ?? {};
                const idx = resolveTaskIndex(String(input.taskId ?? ''), taskIdToIndex, todos);
                if (idx !== null) {
                  const newStatus = normalizeTaskStatus(input.status);
                  if (newStatus) todos[idx].status = newStatus;
                  const subject = typeof input.subject === 'string' ? input.subject : '';
                  if (subject) todos[idx].content = subject;
                }
              }
              continue;
            }

            // TodoWrite: 全量替换 todos
            if (block.name === 'TodoWrite') {
              hasToolTodos = true;
              const input = block.input as { todos?: TodoItem[] } | undefined;
              if (Array.isArray(input?.todos) && input.todos.length > 0) {
                todos = input.todos;
                taskIdToIndex.clear();
              }
              continue;
            }

            // Agent → 单独追踪
            if (block.name === 'Agent') {
              if (block.input) {
                agentSpawns.set(block.id, {
                  description: String(block.input.description ?? block.input.prompt ?? ''),
                  subagentType: typeof block.input.subagent_type === 'string' ? block.input.subagent_type : undefined,
                  startTime: validTs,
                });
              }
              continue;
            }

            // 其他工具: 记录运行中
            if (!toolMap.has(block.id)) {
              toolMap.set(block.id, {
                tool: block.name,
                label: shortToolLabel(block),
                status: 'running',
                id: block.id,
              });
            }
          }
        }
      }

      // --- user entry: tool_result 标记工具/Agent 完成 ---
      if (entry.type === 'user') {
        const msg = (entry as unknown as TranscriptEntry).message;
        const blocks = Array.isArray(msg?.content) ? msg!.content! : [];
        for (const block of blocks) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            agentResults.add(block.tool_use_id);
            const tool = toolMap.get(block.tool_use_id);
            if (tool) {
              tool.status = (block as { is_error?: boolean }).is_error ? 'error' : 'completed';
            }
          }
        }
      }
    }

    // 活跃 agent = spawned 但未完成
    const activeAgents: AgentActivity[] = [];
    for (const [id, info] of agentSpawns) {
      if (!agentResults.has(id)) {
        activeAgents.push(info);
      }
    }

    // 取最近 20 个工具 (含状态)
    const recentTools = Array.from(toolMap.values()).slice(-20);

    return { todos, recentTools, activeAgents, sessionTokens };
  } catch {
    return null;
  }
}

/** 规范化 task status 字符串 → TodoItem.status */
function normalizeTaskStatus(status: unknown): TodoItem['status'] | null {
  if (typeof status !== 'string') return null;
  switch (status) {
    case 'pending': case 'not_started': return 'pending';
    case 'in_progress': case 'running': return 'in_progress';
    case 'completed': case 'complete': case 'done': return 'completed';
    default: return null;
  }
}

/** 通过 taskId 或索引号在 todos 数组中定位 */
function resolveTaskIndex(
  taskId: string,
  taskIdToIndex: Map<string, number>,
  todos: TodoItem[],
): number | null {
  const mapped = taskIdToIndex.get(taskId);
  if (typeof mapped === 'number') return mapped;
  if (/^\d+$/.test(taskId)) {
    const idx = parseInt(taskId, 10) - 1;
    if (idx >= 0 && idx < todos.length) return idx;
  }
  return null;
}

/** 从 tool_use content block 提取简短显示标签 (文件名 / 搜索词 / URL) */
function shortToolLabel(block: { name?: string; input?: Record<string, unknown> }): string {
  const input = block.input ?? {};
  const name = block.name ?? '';

  // 提取最相关的标识字段
  const fp = typeof input.file_path === 'string' ? input.file_path : '';
  if (fp) {
    const base = fp.split('/').pop() ?? fp;
    return base;
  }

  if (name === 'Grep' || name === 'Glob') {
    const pattern = typeof input.pattern === 'string' ? input.pattern : '';
    return pattern ? `"${truncate(pattern, 30)}"` : '';
  }

  if (name === 'Bash') {
    const cmd = typeof input.command === 'string' ? input.command.replace(/\s+/g, ' ').trim() : '';
    return truncate(cmd, 40);
  }

  if (name === 'WebFetch' || name === 'WebSearch') {
    const url = typeof input.url === 'string' ? input.url : '';
    if (url) {
      try { return new URL(url).hostname; } catch { /* fall through */ }
    }
    const query = typeof input.query === 'string' ? input.query : '';
    if (query) return `"${truncate(query, 30)}"`;
  }

  // fallback: 用 tool name
  return name;
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

// ─── 工具活动行 ───────────────────────────────────────────────────────────

function renderToolActivityLines(tdata: TranscriptData | null): string[] {
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
  const label = MINIMAL ? ` ${t.tools}` : c.gray(`🔧 ${t.tools}`);
  lines[0] = `${label}${lines[0].slice(prefix.length)}`;
  return lines;
}

// ─── Agent 追踪行 ─────────────────────────────────────────────────────────

function renderAgentLines(tdata: TranscriptData | null): string[] {
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
  const label = MINIMAL ? ` ${t.agent}` : c.gray(`🤖 ${t.agent}`);
  lines[0] = `${label}${lines[0].slice(prefix.length)}`;
  return lines;
}

/** 将毫秒差格式化成人类可读的耗时字符串 */
function formatElapsed(ms: number): string {
  if (ms < 1000) return '<1s';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const rm = mins % 60;
  return `${hrs}h ${rm}m`;
}

// ─── 模型行 ───────────────────────────────────────────────────────────────

function renderModelLine(stdin: StdinData): string {
  const name = resolveModelName(stdin);

  // 检测 provider (Bedrock / Vertex / Enterprise)
  const provider = detectProvider(stdin);
  const providerBadge = provider ? c.dim(`[${provider}]`) : '';

  const label = MINIMAL
    ? ` ${t.model}`
    : c.gray(`🤖 ${t.model}`);
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
  // MiniMax / 第三方代理 (用户的 ANTHROPIC_BASE_URL=api.minimaxi.com)
  if (process.env.ANTHROPIC_BASE_URL && !process.env.ANTHROPIC_BASE_URL.includes('anthropic.com')) {
    try {
      const parts = new URL(process.env.ANTHROPIC_BASE_URL).hostname.split('.');
      // 跳过 api/www 等通用前缀, 取真正的主域名段 ("api.minimaxi.com" → "minimaxi")
      const generic = new Set(['api', 'www', 'gateway', 'proxy']);
      return parts.find((p) => !generic.has(p)) ?? parts[0] ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Token 行 (session 累计 / 上下文快照 / 速率) ──────────────────────

interface TokenBreakdown {
  input: number;
  output: number;
  cache: number;
  total: number;
}

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
  const parts = [
    `${c.gray(t.in)} ${formatTokenCount(b.input)}`,
    `${c.gray(t.out)} ${formatTokenCount(b.output)}`,
  ];
  if (b.cache > 0) parts.push(`${c.gray(t.cache)} ${formatTokenCount(b.cache)}`);
  if (speed) parts.push(`⚡ ${speed} tok/s`);
  return c.dim('(' + parts.join(' · ') + ')');
}

/** 获取输出速率 (tok/s), 无有效数据返回 null */
function getOutputSpeed(stdin: StdinData, cacheDir: string): number | null {
  const outputTokens = stdin.context_window?.current_usage?.output_tokens;
  if (typeof outputTokens !== 'number' || !Number.isFinite(outputTokens) || outputTokens <= 0) return null;
  const tp = stdin.transcript_path;
  if (!tp) return null;

  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const cacheFile = path.join(cacheDir, `speed-${simpleHash(tp)}.json`);
    const now = Date.now();

    let prev: { n: number; ts: number } | null = null;
    try { prev = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* first run */ }

    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({ n: outputTokens, ts: now }));

    if (!prev || outputTokens <= prev.n) return null;
    const dt = (now - prev.ts) / 1000;
    if (dt < 0.5 || dt > 5) return null;  // 太短不准, 太长说明已停止
    const speed = Math.round((outputTokens - prev.n) / dt);
    return speed > 0 ? speed : null;
  } catch {
    return null;
  }
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

function renderTokenLine(stdin: StdinData, tdata: TranscriptData | null): string[] {
  const lines: string[] = [];
  const label = MINIMAL ? ` ${t.token}` : `${c.gray(`🪙 ${t.token}`)}`;

  // 计算输出速率 (使用预计算的缓存目录)
  const speed = SPEED_CACHE_DIR ? getOutputSpeed(stdin, SPEED_CACHE_DIR) : null;

  if (TOKEN_MODE === 'session' || TOKEN_MODE === 'both') {
    const b = getSessionTokens(stdin, tdata);
    if (b.total > 0) {
      lines.push(`${label} ${c.bold(formatTokenCount(b.total))} ${formatTokenParts(b, speed)}`);
    }
  }

  if (TOKEN_MODE === 'context' || TOKEN_MODE === 'both') {
    const b = getContextTokens(stdin);
    if (b.total > 0) {
      const ctxLabel = TOKEN_MODE === 'both'
        ? c.dim(`  ${t.context} ${t.token}`)
        : label;
      lines.push(`${ctxLabel} ${c.bold(formatTokenCount(b.total))} ${formatTokenParts(b, null)}`);
    }
  }

  return lines;
}

// ─── 用量/余额行 ──────────────────────────────────────────────────────────

function renderUsageLine(usage: import('./usage.js').UsageData | null): string | null {
  if (!usage) return null;

  if (usage.claude) {
    const { fiveHour, sevenDay } = usage.claude;
    const parts: string[] = [];
    if (fiveHour !== null) {
      const color = fiveHour >= 80 ? c.red : fiveHour >= 60 ? c.yellow : c.green;
      parts.push(`5h ${color(`${fiveHour}%`)}`);
    }
    if (sevenDay !== null) {
      const color = sevenDay >= 80 ? c.red : sevenDay >= 60 ? c.yellow : c.green;
      parts.push(`7d ${color(`${sevenDay}%`)}`);
    }
    if (parts.length === 0) return null;
    return `${c.gray('🔋 API')} ${parts.join('  ')}`;
  }

  if (usage.miniMax) {
    const rem = formatTokenCount(usage.miniMax.remainingTokens);
    const total = usage.miniMax.totalTokens;
    const detail = total ? ` / ${formatTokenCount(total)}` : '';
    return `${c.gray('🔋 MiniMax')} ${c.bold(rem)}${c.dim(detail)}`;
  }

  if (usage.deepSeek) {
    const d = usage.deepSeek;
    const total = d.totalBalance.toFixed(2);
    return `${c.gray('🔋 DeepSeek')} ${c.cyan(c.bold(`¥${total}`))}${d.grantedBalance > 0 ? c.dim(` (赠送 ¥${d.grantedBalance.toFixed(2)})`) : ''}`;
  }

  if (usage.newApi) {
    const q = usage.newApi;
    const pct = q.quota + q.usedQuota > 0
      ? ` ${Math.round((q.usedQuota / (q.quota + q.usedQuota)) * 100)}%`
      : '';
    return `${c.gray('🔋 用量')} ${c.bold(formatTokenCount(q.quota))}${c.dim(` (已用 ${formatTokenCount(q.usedQuota)}${pct})`)}`;
  }

  return null;
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const stdin = await readStdin();
  if (!stdin) {
    // 测试模式或没有输入, 输出占位
    const label = MINIMAL
      ? ` ${t.context}`
      : `${c.gray(`📊 ${t.context}`)}`;
    console.log(`${label} ${c.dim('—')}  ${c.dim(t.fallback)}`);
    return;
  }

  // 先读 transcript (一次 I/O, 供 todos / 工具 / Agent / Token fallback 共用)
  const tdata = stdin.transcript_path ? await readTranscriptData(stdin.transcript_path) : null;

  const lines: string[] = [];
  // 1) 上下文 (必显)
  lines.push(renderContextLine(stdin));
  // 2) Token 细分 (必显, 模式由 CLAUDE_MINI_HUD_TOKEN_MODE 控制)
  lines.push(...renderTokenLine(stdin, tdata));

  // 2.5) 用量/余额 (有数据就显, Claude 原生 rate_limits 或第三方平台余额)
  const usageData = getUsageData(stdin);
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