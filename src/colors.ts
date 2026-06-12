/**
 * claude-mini-hud — ANSI 颜色 (零依赖)
 *
 * @author  Zander
 * @since   2025-06
 * @see     https://github.com/zander-zyx/claude-mini-hud
 */

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

export const c = {
  red:    (s: string) => `\x1b[31m${s}${RESET}`,
  green:  (s: string) => `\x1b[32m${s}${RESET}`,
  yellow: (s: string) => `\x1b[33m${s}${RESET}`,
  blue:   (s: string) => `\x1b[34m${s}${RESET}`,
  magenta:(s: string) => `\x1b[35m${s}${RESET}`,
  cyan:   (s: string) => `\x1b[36m${s}${RESET}`,
  gray:   (s: string) => `${DIM}${s}${RESET}`,  // 只用 dim, 作用于终端默认前景色 → 亮/暗主题都可读
  bold:   (s: string) => `${BOLD}${s}${RESET}`,
  dim:    (s: string) => `${DIM}${s}${RESET}`,  // 不能加 \x1b[37m 白色: 白底终端上 白+dim 几乎不可见
};
