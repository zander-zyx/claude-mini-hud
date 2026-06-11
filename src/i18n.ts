/**
 * claude-mini-hud — i18n 国际化
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 */

export type Lang = 'zh' | 'en' | 'minimal';

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
  usage: string;
  used: string;
  toolVerb: Record<string, string>;
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
    usage: '用量',
    used: '已用',
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
    usage: 'Usage',
    used: 'used',
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
    usage: 'Usage',
    used: 'used',
    toolVerb: {
      Read: 'R',
      Write: 'W',
      Edit: 'E',
      Glob: 'G',
      Grep: 'g',
      Bash: '$',
      WebFetch: 'F',
      WebSearch: 'S',
      Agent: 'A',
      TaskCreate: '+',
      TaskUpdate: '~',
      TodoWrite: 'T',
    },
  },
};

// 语言选择: 环境变量控制, 默认中文
export const LANG: Lang = (['zh', 'en', 'minimal'] as const).includes(
  process.env.CLAUDE_MINI_HUD_LANG as Lang,
)
  ? (process.env.CLAUDE_MINI_HUD_LANG as Lang)
  : 'zh';

// 是否 minimal 模式 (无 emoji 前缀)
export const MINIMAL = LANG === 'minimal';

/** 当前语言的字符串集合 */
export const t: I18nStrings = STRINGS[LANG];
