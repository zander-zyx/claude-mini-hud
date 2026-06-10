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

// ─── i18n (★ 用户安装时选 1.中文 / 2.英文) ──────────────────────────────

type Lang = 'zh' | 'en';

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
  },
} as const;

// 默认语言 (运行时可通过 env CLAUDE_MINI_HUD_LANG=zh|en 覆盖)
const LANG: Lang = (process.env.CLAUDE_MINI_HUD_LANG === 'en' ? 'en' : 'zh');
const t = STRINGS[LANG];

// 模型行可选显示: CLAUDE_MINI_HUD_SHOW_MODEL=1 显示, 默认隐藏
const SHOW_MODEL = process.env.CLAUDE_MINI_HUD_SHOW_MODEL === '1';

// ─── 类型契约 (Claude Code StatusLine stdin JSON) ────────────────────────

interface StdinData {
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
    content?: string | Array<{ type: string; text?: string }>;
  };
  timestamp?: string;
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

function getContextPercent(stdin: StdinData): number {
  // 优先用 Claude Code v2.1.6+ 的原生百分比
  const native = stdin.context_window?.used_percentage;
  if (typeof native === 'number' && !Number.isNaN(native) && native > 0) {
    return Math.min(100, Math.max(0, Math.round(native)));
  }

  const size = stdin.context_window?.context_window_size;
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
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return v >= 10 ? `${Math.round(v)}M` : `${v.toFixed(decimals)}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return v >= 10 ? `${Math.round(v)}k` : `${v.toFixed(decimals)}k`;
  }
  return String(n);
}

function renderContextLine(stdin: StdinData): string {
  const pct = getContextPercent(stdin);
  const size = stdin.context_window?.context_window_size ?? 0;
  const tokens = getTotalTokens(stdin);
  const remaining = Math.max(0, size - tokens);
  const bar = progressBar(pct);
  const pctStr = pct >= 80 ? c.red(c.bold(`${pct}%`))
               : pct >= 60 ? c.yellow(c.bold(`${pct}%`))
               : c.green(c.bold(`${pct}%`));
  // 格式: used / total  remaining (绝对紧凑, 不用 "tokens" 后缀 — 上下文行默认就是 token)
  const detail = size > 0
    ? c.dim(`${formatTokenCount(tokens)} / ${formatTokenCount(size)}  ${c.dim(`${t.contextRemaining}`)} ${formatTokenCount(remaining)}`)
    : c.dim(`${formatTokenCount(tokens)}`);

  return `${c.gray(`📊 ${t.context}`)} ${bar} ${pctStr}  ${detail}`;
}

// ─── 当前任务行 ───────────────────────────────────────────────────────────

async function renderTodoLine(transcriptPath: string | undefined): Promise<string | null> {
  if (!transcriptPath) return null;
  const todos = await readTodos(transcriptPath);
  if (!todos || todos.length === 0) return null;

  const inProgress = todos.find((t) => t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed').length;
  const total = todos.length;
  const progress = c.dim(`(${completed}/${total})`);

  if (!inProgress) {
    if (completed === total) {
      return `${c.gray(`▶️  ${t.todo}`)} ${c.green(t.allDone)}  ${progress}`;
    }
    return `${c.gray(`▶️  ${t.todo}`)} ${c.dim(t.noInProgress)}  ${progress}`;
  }

  const content = truncate(inProgress.activeForm ?? inProgress.content, 60);
  return `${c.gray(`▶️  ${t.todo}`)} ${c.yellow('▸')} ${content}  ${progress}`;
}

async function readTodos(transcriptPath: string): Promise<TodoItem[] | null> {
  try {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    // 从后往前找最新一条含 todos 的 entry (Claude Code 把 todos 写在 entry.message 里)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as TranscriptEntry & { todos?: TodoItem[] };
        // 优先看 entry.todos (Claude Code v2 实际格式)
        if (Array.isArray(entry.todos) && entry.todos.length > 0) {
          return entry.todos;
        }
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length <= max ? s : s.slice(0, max - 3) + '...';
}

// ─── 模型行 ───────────────────────────────────────────────────────────────

function renderModelLine(stdin: StdinData): string {
  const displayName = stdin.model?.display_name?.trim();
  const modelId = stdin.model?.id?.trim();
  const name = displayName || modelId || 'Unknown';

  // 检测 provider (Bedrock / Vertex / Enterprise)
  const provider = detectProvider(stdin);
  const providerBadge = provider ? c.dim(`[${provider}]`) : '';

  return `${c.gray(`🤖 ${t.model}`)} ${c.cyan(c.bold(name))}  ${providerBadge}`;
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
      const host = new URL(process.env.ANTHROPIC_BASE_URL).hostname;
      return host.split('.')[0]; // "api" → 取 "minimaxi" 等
    } catch {
      return null;
    }
  }
  return null;
}

// ─── Token 行 (必显, in/out/cache 细分) ─────────────────────────────────

interface TokenBreakdown {
  input: number;
  output: number;
  cache: number;
  total: number;
}

async function renderTokenLine(stdin: StdinData, transcriptPath: string | undefined): Promise<string | null> {
  // 1) 优先用 stdin 实时给的 current_usage
  const usage = stdin.context_window?.current_usage;
  let breakdown: TokenBreakdown = {
    input: usage?.input_tokens ?? 0,
    output: usage?.output_tokens ?? 0,
    cache: (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0),
    total: 0,
  };
  breakdown.total = breakdown.input + breakdown.output + breakdown.cache;

  // 2) 如果 stdin 没给 output (current_usage 通常不含), 从 transcript 读
  if (breakdown.output === 0 && transcriptPath) {
    const t = await readOutputFromTranscript(transcriptPath);
    if (t) breakdown.output = t;
    breakdown.total = breakdown.input + breakdown.output + breakdown.cache;
  }

  // 完全没有 token 数据 → 跳过
  if (breakdown.total === 0) return null;

  // 格式: 🪙 Token 23k (in 22k · out 342 · cache 768)
  const totalStr = formatTokenCount(breakdown.total);
  const inStr = formatTokenCount(breakdown.input);
  const outStr = formatTokenCount(breakdown.output);
  const cacheStr = formatTokenCount(breakdown.cache);

  const parts = [
    `${c.gray(t.in)} ${inStr}`,
    `${c.gray(t.out)} ${outStr}`,
  ];
  if (breakdown.cache > 0) {
    parts.push(`${c.gray(t.cache)} ${cacheStr}`);
  }

  return `${c.gray(`🪙 ${t.token}`)} ${c.bold(totalStr)} ${c.dim('(' + parts.join(' · ') + ')')}`;
}

async function readOutputFromTranscript(transcriptPath: string): Promise<number | null> {
  try {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(transcriptPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    let totalOutput = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as TranscriptEntry & {
          message?: { usage?: { output_tokens?: number } };
        };
        const out = entry.message?.usage?.output_tokens;
        if (typeof out === 'number') totalOutput += out;
      } catch {
        continue;
      }
    }
    return totalOutput > 0 ? totalOutput : null;
  } catch {
    return null;
  }
}

// ─── 主入口 ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const stdin = await readStdin();
  if (!stdin) {
    // 测试模式或没有输入, 输出占位
    console.log(`${c.gray(`📊 ${t.context}`)} ${c.dim('—')}  ${c.dim(t.fallback)}`);
    return;
  }

  const lines: string[] = [];
  // 1) 上下文 (必显)
  lines.push(renderContextLine(stdin));
  // 2) Token 细分 (必显)
  const tokenLine = await renderTokenLine(stdin, stdin.transcript_path);
  if (tokenLine) lines.push(tokenLine);
  // 3) 模型 (可选: CLAUDE_MINI_HUD_SHOW_MODEL=1)
  if (SHOW_MODEL) {
    lines.push(renderModelLine(stdin));
  }
  // 4) 当前任务 (必显)
  const todoLine = await renderTodoLine(stdin.transcript_path);
  if (todoLine) lines.push(todoLine);

  console.log(lines.join('\n'));
}

main().catch((err) => {
  // 任何错误都不抛, 输出 fallback (statusline 崩溃会让 Claude Code 无法继续)
  process.stderr.write(`[claude-mini-hud] error: ${err instanceof Error ? err.message : String(err)}\n`);
  console.log(`${c.gray('claude-mini-hud')} ${c.dim(`— ${t.renderFailed} —`)}`);
});