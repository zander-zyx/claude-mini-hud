/**
 * claude-mini-hud — 进度条主题系统
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 通过 CLAUDE_MINI_HUD_THEME 环境变量切换:
 *   default  — 经典 █░ 风格 (默认)
 *   neon     — 霓虹矩阵 ⟦▓░⟧
 *   braille  — 点阵 ⣿⣷⣯⣟⡿⣯⣟░ 风格
 *   hardcore — 硬核 [■□] 带竖线分隔
 *   minimal  — 超级简约 ◈ 百分比 + 颜色渐变
 *   pixel    — 像素风 ⣿⣀
 *   diamond  — 钻石风 ◆◇
 *   arrow    — 箭头风 ▸▹
 */

// ─── 主题类型 ─────────────────────────────────────────────────────────────

export type ThemeName = 'default' | 'neon' | 'braille' | 'hardcore' | 'minimal' | 'pixel' | 'diamond' | 'arrow';

export interface ThemeConfig {
  /** 进度条填充字符 (从满到空排列) */
  filled: string[];
  /** 进度条空白字符 */
  empty: string;
  /** 左边框 (空字符串表示无边框) */
  leftBorder: string;
  /** 右边框 (空字符串表示无边框) */
  rightBorder: string;
  /** 进度条默认宽度 */
  width: number;
  /** 是否是极简模式 (不显示条形, 只用图标+百分比) */
  isMinimal: boolean;
  /** 极简模式的图标字符 */
  minimalIcon: string;
  /** 分隔符 (超简约主题用于分隔百分比和详情) */
  separator: string;
  /** 运行中标记 (工具/Agent 行前缀) */
  runningMark: string;
  /** 已完成标记 (工具行前缀) */
  completedMark: string;
}

// ─── 主题定义 ─────────────────────────────────────────────────────────────

const THEMES: Record<ThemeName, ThemeConfig> = {
  /**
   * 经典风格 (默认)
   * Context ██████────────────── 30%
   */
  default: {
    filled: ['█'],
    empty: '─',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '◐',
    completedMark: '✓',
  },

  /**
   * 霓虹矩阵风
   * ⟦ CTX: ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░ 42% ⟧
   */
  neon: {
    filled: ['▓'],
    empty: '─',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '◈',
    completedMark: '✦',
  },

  /**
   * Braille 点阵风
   * ⡿⣷⣯⣟⡿⣷⣯⣟░░░░░░░░ 42%
   */
  braille: {
    filled: ['⣿', '⣷', '⣯', '⣟', '⡿', '⣯', '⣟'],
    empty: '─',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '⣷',
    completedMark: '⣿',
  },

  /**
   * 硬核风
   * [■■■■■■■□□□□□□□□□□□□□] 42% CTX │
   */
  hardcore: {
    filled: ['■'],
    empty: '□',
    leftBorder: '[',
    rightBorder: ']',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' │ ',
    runningMark: '●',
    completedMark: '■',
  },

  /**
   * 超级简约风
   * ◈ 42% ┃ 12.4K/200K ┃
   */
  minimal: {
    filled: [],
    empty: '',
    leftBorder: '',
    rightBorder: '',
    width: 0,
    isMinimal: true,
    minimalIcon: '◈',
    separator: ' ┃ ',
    runningMark: '·',
    completedMark: '·',
  },

  /**
   * 像素风
   * ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣀⣀⣀⣀⣀⣀ 72%
   */
  pixel: {
    filled: ['⣿'],
    empty: '⣀',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '▣',
    completedMark: '■',
  },

  /**
   * 钻石风
   * ◆◆◆◆◆◆◆◆◆◆◆◆◆◇◇◇◇◇◇ 72%
   */
  diamond: {
    filled: ['◆'],
    empty: '◇',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '◈',
    completedMark: '◆',
  },

  /**
   * 箭头风
   * ▸▸▸▸▸▸▸▸▸▸▸▸▸▹▹▹▹▹▹ 72%
   */
  arrow: {
    filled: ['▸'],
    empty: '▹',
    leftBorder: '',
    rightBorder: '',
    width: 20,
    isMinimal: false,
    minimalIcon: '',
    separator: ' ',
    runningMark: '▸',
    completedMark: '✓',
  },
};

// ─── 主题选择 ─────────────────────────────────────────────────────────────

/** 有效的主题名列表 */
export const THEME_NAMES: ThemeName[] = ['default', 'neon', 'braille', 'hardcore', 'minimal', 'pixel', 'diamond', 'arrow'];

/** 从环境变量解析主题名 (无效值回退到 default) */
function resolveName(envKey: string): ThemeName {
  const env = process.env[envKey]?.trim().toLowerCase();
  if (env && (THEME_NAMES as readonly string[]).includes(env)) {
    return env as ThemeName;
  }
  return 'default';
}

// ─── 进度条主题 (CLAUDE_MINI_HUD_THEME) ────────────────────────────────────

/** 当前生效的进度条主题名 */
export const THEME_NAME: ThemeName = resolveName('CLAUDE_MINI_HUD_THEME');

/** 当前生效的进度条主题配置 */
export const THEME: ThemeConfig = THEMES[THEME_NAME];

// ─── 标记图标主题 (CLAUDE_MINI_HUD_MARKS) ─────────────────────────────────
//
// 独立于进度条主题, 控制 Tools / Agent 行的运行中/已完成图标
// 不设则跟随 CLAUDE_MINI_HUD_THEME, 都不设则默认经典 (◐ ✓)
//

/** 当前生效的标记主题名 */
export const MARKS_NAME: ThemeName = resolveName('CLAUDE_MINI_HUD_MARKS');

/** 当前生效的标记主题配置 (runningMark / completedMark) */
export const MARKS: ThemeConfig = THEMES[MARKS_NAME];
