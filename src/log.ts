/**
 * claude-mini-hud — 调试日志 (零依赖)
 *
 * @author  Zander
 * @since   2026-07
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 默认静默。设 CLAUDE_MINI_HUD_DEBUG=1 后, 各模块的 catch 块会把错误
 * 信息写到 stderr, 供排查"用量行不显示"等问题使用。
 *
 * 只写 stderr (不污染 stdout, 不影响 statusline 渲染)。
 */

/** 是否开启调试日志 (模块级常量, 启动时解析一次) */
export const DEBUG = process.env.CLAUDE_MINI_HUD_DEBUG === '1';

/**
 * 输出调试日志到 stderr
 * 仅在 CLAUDE_MINI_HUD_DEBUG=1 时生效, 否则空操作
 */
export function debugLog(msg: string): void {
  if (DEBUG) {
    try {
      process.stderr.write(`[claude-mini-hud] ${msg}\n`);
    } catch {
      // 静默: stderr 写失败也不影响主流程
    }
  }
}
