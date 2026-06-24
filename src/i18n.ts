/**
 * claude-mini-hud — i18n 国际化
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 */

import { c } from './colors.js';

export type Lang = 'zh' | 'en' | 'minimal' | 'ultra-minimal';

/** i18n 字符串结构 */
export interface I18nStrings {
  context: string;
  contextRemaining: string;
  token: string;
  in: string;
  out: string;
  cache: string;
  todo: string;
  model: string;
  tools: string;
  agent: string;
  fallback: string;
  renderFailed: string;
  toolVerb: Record<string, string>;
  cost: string;
  git: string;
  alert: string;
  etaFull: string;
  ctxWarn: string;
}

const STRINGS: Record<Lang, I18nStrings> = {
  zh: {
    context: '上下文',
    contextRemaining: '剩余',
    token: 'Token',
    in: '入',
    out: '出',
    cache: '缓存',
    todo: '当前任务',
    model: '模型',
    tools: '工具',
    agent: 'Agent',
    fallback: '等待数据',
    renderFailed: '渲染失败',
    toolVerb: {
      Read: '读',
      Write: '写',
      Edit: '改',
      Glob: '搜索',
      Grep: '查找',
      Bash: '执行',
      WebFetch: '抓取',
      WebSearch: '搜索',
      Agent: 'Agent',
      TaskCreate: '建任务',
      TaskUpdate: '改任务',
      TodoWrite: '写待办',
    },
    cost: '花费',
    git: '分支',
    alert: '告警',
    etaFull: '填满',
    ctxWarn: '上下文即将耗尽',
  },
  en: {
    context: 'Context',
    contextRemaining: 'left',
    token: 'Token',
    in: 'in',
    out: 'out',
    cache: 'cache',
    todo: 'Todo',
    model: 'Model',
    tools: 'Tools',
    agent: 'Agent',
    fallback: 'waiting',
    renderFailed: 'render failed',
    toolVerb: {
      Read: 'read',
      Write: 'write',
      Edit: 'edit',
      Glob: 'glob',
      Grep: 'grep',
      Bash: 'run',
      WebFetch: 'fetch',
      WebSearch: 'search',
      Agent: 'agent',
      TaskCreate: 'task+',
      TaskUpdate: 'task~',
      TodoWrite: 'todo',
    },
    cost: 'Cost',
    git: 'Git',
    alert: 'Warn',
    etaFull: 'full',
    ctxWarn: 'Context almost full',
  },
  minimal: {
    context: 'Context',
    contextRemaining: '剩余',
    token: 'Token',
    in: 'in',
    out: 'out',
    cache: 'cache',
    todo: '当前任务',
    model: 'Model',
    tools: 'Tools',
    agent: 'Agent',
    fallback: '—',
    renderFailed: 'err',
    toolVerb: {
      Read: 'read',
      Write: 'write',
      Edit: 'edit',
      Glob: 'glob',
      Grep: 'grep',
      Bash: 'run',
      WebFetch: 'fetch',
      WebSearch: 'search',
      Agent: 'agent',
      TaskCreate: '+',
      TaskUpdate: '~',
      TodoWrite: 'todo',
    },
    cost: 'Cost',
    git: 'Git',
    alert: '!',
    etaFull: 'full',
    ctxWarn: 'CTX full',
  },
  'ultra-minimal': {
    context: 'Context',
    contextRemaining: '剩余',
    token: 'Token',
    in: 'in',
    out: 'out',
    cache: 'cache',
    todo: '当前任务',
    model: 'Model',
    tools: 'Tools',
    agent: 'Agent',
    fallback: '—',
    renderFailed: 'err',
    toolVerb: {},
    cost: 'Cost',
    git: 'Git',
    alert: '!',
    etaFull: 'full',
    ctxWarn: 'CTX full',
  },
};

// 语言选择: 环境变量控制, 默认中文
export const LANG: Lang = (['zh', 'en', 'minimal', 'ultra-minimal'] as const).includes(
  process.env.CLAUDE_MINI_HUD_LANG as Lang,
)
  ? (process.env.CLAUDE_MINI_HUD_LANG as Lang)
  : 'zh';

// 是否 minimal 模式 (无 emoji 前缀)
export const MINIMAL = LANG === 'minimal' || LANG === 'ultra-minimal';

// 是否 ultra-minimal 模式 (只显示 Context + Token 两行)
export const ULTRA_MINIMAL = LANG === 'ultra-minimal';

// ─── Emoji 能力检测 ────────────────────────────────────────────────────────

/** 检测终端是否支持 emoji 显示 */
function detectEmojiSupport(): boolean {
  // 1) 环境变量强制关闭
  if (process.env.CLAUDE_MINI_HUD_NO_EMOJI === '1') return false;
  // 2) minimal 模式永远不用 emoji
  if (MINIMAL) return false;
  // 3) Windows 默认不支持 (emoji 宽度重叠)
  if (process.platform === 'win32') return false;
  // 4) 已知支持 emoji 的终端
  const tp = process.env.TERM_PROGRAM ?? '';
  const lc = process.env.LC_TERMINAL ?? '';
  const knownEmoji = ['iTerm.app', 'Apple_Terminal', 'WarpTerminal', 'vscode', 'Hyper'];
  if (knownEmoji.some(k => tp.includes(k)) || lc.includes('iTerm2')) return true;
  // 5) 明确不支持的环境
  const term = (process.env.TERM ?? '').toLowerCase();
  if (['dumb', 'emacs', 'eterm'].includes(term)) return false;
  // 6) macOS 默认终端都支持 (非 screen/tmux)
  if (process.platform === 'darwin' && !term.includes('screen') && !term.includes('tmux')) return true;
  // 7) 其余保守回退 ASCII
  return false;
}

/** 当前环境是否支持 emoji (模块级常量, 只算一次) */
export const EMOJI = detectEmojiSupport();

/** 各行的 emoji 前缀 (与语言无关, 仅由终端能力决定) */
const EMOJI_PREFIX: Record<string, string> = {
  context: '📊',
  token:   '🪙',
  todo:    '▶',
  tools:   '🔧',
  agent:   '🤖',
  model:   '🧠',
  usage:   '💳',
};

/**
 * 统一标签生成器
 * @param key        EMOJI_PREFIX 中的键名
 * @param text       i18n 标签文字
 * @param asciiPref  ASCII 模式的前缀字符
 */
export function lbl(key: string, text: string, asciiPref: string): string {
  if (MINIMAL) return ` ${text}`;
  if (EMOJI) return `${EMOJI_PREFIX[key] ?? asciiPref} ${text}`;
  return c.gray(`${asciiPref} ${text}`);
}

/** 当前语言的字符串集合 */
export const t: I18nStrings = STRINGS[LANG];
