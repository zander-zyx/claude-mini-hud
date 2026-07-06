/**
 * claude-mini-hud — ANSI 颜色 (零依赖, 亮/暗主题自适应)
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 亮/暗背景适配:
 *   - 暗背景 (默认): 用基础色码 31/32/33/... (在黑色背景上对比度好)
 *   - 亮背景: 用高亮色码 91/92/93/... (90 系列, 在白色背景上对比度更好)
 *   检测源: COLORFGBG 环境变量 / CLAUDE_MINI_HUD_BG 手动指定
 */

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

/**
 * 检测终端背景色是否为亮色 (本地实现, 避免与 i18n.ts 循环依赖)
 * 优先级: CLAUDE_MINI_HUD_BG > COLORFGBG > TERM_BACKGROUND_COLOR > 默认暗
 */
function detectLightBackground(): boolean {
  const manual = (process.env.CLAUDE_MINI_HUD_BG ?? '').toLowerCase().trim();
  if (manual === 'light') return true;
  if (manual === 'dark') return false;

  // COLORFGBG: "fg;bg" 格式 (0-15 调色板), bg=7/8/>=15 视为亮背景
  const parts = (process.env.COLORFGBG ?? '').split(';');
  if (parts.length >= 2) {
    const bg = parseInt(parts[1], 10);
    if (Number.isFinite(bg)) return bg === 7 || bg === 8 || bg >= 15;
  }

  const tbc = (process.env.TERM_BACKGROUND_COLOR ?? '').toLowerCase().trim();
  if (tbc === 'light' || tbc === 'white') return true;
  if (tbc === 'dark' || tbc === 'black') return false;

  return false;  // 默认暗背景 (终端最常见)
}

const IS_LIGHT_BG = detectLightBackground();

// 根据终端背景色选择颜色码: 亮背景用 90 系列 (高亮色), 暗背景用基础色
const R = IS_LIGHT_BG ? 91 : 31;  // red
const G = IS_LIGHT_BG ? 92 : 32;  // green
const Y = IS_LIGHT_BG ? 93 : 33;  // yellow
const B = IS_LIGHT_BG ? 94 : 34;  // blue
const M = IS_LIGHT_BG ? 95 : 35;  // magenta
const C = IS_LIGHT_BG ? 96 : 36;  // cyan

export const c = {
  red:    (s: string) => `\x1b[${R}m${s}${RESET}`,
  green:  (s: string) => `\x1b[${G}m${s}${RESET}`,
  yellow: (s: string) => `\x1b[${Y}m${s}${RESET}`,
  blue:   (s: string) => `\x1b[${B}m${s}${RESET}`,
  magenta:(s: string) => `\x1b[${M}m${s}${RESET}`,
  cyan:   (s: string) => `\x1b[${C}m${s}${RESET}`,
  gray:   (s: string) => `${DIM}${s}${RESET}`,  // 只用 dim, 作用于终端默认前景色 → 亮/暗主题都可读
  bold:   (s: string) => `${BOLD}${s}${RESET}`,
  dim:    (s: string) => `${DIM}${s}${RESET}`,  // 不能加 \x1b[37m 白色: 白底终端上 白+dim 几乎不可见
  // OSC 8 超链接 (仅在支持的现代终端生效, 不支持的终端显示纯文本无副作用)
  link:   (s: string, uri: string) => `\x1b]8;;${uri}\x1b\\${s}\x1b]8;;\x1b\\`,
};
