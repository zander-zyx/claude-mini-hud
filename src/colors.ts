/**
 * claude-mini-hud — ANSI 颜色 (零依赖)
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
  gray:   (s: string) => `\x1b[37m${DIM}${s}${RESET}`,  // 亮白+dim → 暗黑/亮色模式都可见
  bold:   (s: string) => `${BOLD}${s}${RESET}`,
  dim:    (s: string) => `\x1b[37m${DIM}${s}${RESET}`,   // 亮白+dim → 兼容暗黑模式
};
