/**
 * claude-mini-hud — 缓存子系统 (统一路径/哈希/原子写/清理)
 *
 * @author  Zander
 * @since   2026-07
 * @see     https://github.com/zander-zyx/claude-mini-hud
 *
 * 收敛原本散落在 index.ts / render.ts 的 7 个 per-session 缓存的公共逻辑:
 *   - stableHash: 基于 sha1 的稳定哈希 (碰撞率 2^-48, 替代旧的 djb2 变体 simpleHash)
 *   - sessionCachePath: 统一缓存文件路径工厂
 *   - atomicWrite: tmp+rename 原子写 (避免并发读半截 JSON)
 *   - pruneOldSessions: 1% 概率清理过期缓存文件 (防长期累积)
 *
 * 零运行时依赖, 只用 node:fs / node:path / node:os / node:crypto
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, renameSync, mkdirSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';

/** 缓存根目录 (~/.claude-mini-hud) */
export const CACHE_DIR = join(homedir(), '.claude-mini-hud');

/**
 * 稳定哈希: sha1 前 12 字符 (碰撞率 2^-48, 远优于旧 simpleHash 的 2^-31)
 * 用于按 transcript_path / workspace dir 隔离缓存文件
 */
export function stableHash(s: string): string {
  return createHash('sha1').update(s, 'utf8').digest('hex').slice(0, 12);
}

/**
 * 兼容别名: 旧代码用 simpleHash 命名, 保持 re-export 不破坏现有 import
 * (render.ts 仍 export simpleHash 供 index.ts 使用, 内部转发到此)
 */
export { stableHash as simpleHash };

/**
 * 构造 per-session 缓存文件路径
 * @param prefix  缓存名前缀 (如 'stdin' / 'ctx-pct' / 'cost-speed')
 * @param key     会话键 (通常是 transcript_path 或 workspace dir; 无则 'default')
 */
export function sessionCachePath(prefix: string, key?: string): string {
  const hash = key ? stableHash(key) : 'default';
  return join(CACHE_DIR, `${prefix}-${hash}.json`);
}

/**
 * 原子写: 先写 .tmp 再 rename (避免并发进程读到写一半的 JSON)
 * 失败静默 (statusline 永不崩溃)
 */
export function atomicWrite(path: string, data: string): void {
  try {
    const dir = join(path, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmpFile = `${path}.tmp`;
    writeFileSync(tmpFile, data, 'utf8');
    renameSync(tmpFile, path);
  } catch {
    // 静默: 缓存写失败不影响主输出
  }
}

/** 受清理管理的缓存前缀 (usage-cache 子目录单独管理, 不在此列) */
const MANAGED_PREFIXES = ['stdin', 'ctx-pct', 'cost-speed', 'token-peak', 'speed', 'ctxspeed', 'git'];

/**
 * 清理过期的 per-session 缓存文件 (1% 概率触发, 避免每次刷新都扫目录)
 * @param maxAgeMs  最大年龄 (默认 30 天)
 */
export function pruneOldSessions(maxAgeMs: number = 30 * 24 * 3_600_000): void {
  // 1% 概率触发, 分散开销
  if (Math.random() > 0.01) return;
  try {
    const now = Date.now();
    const files = readdirSync(CACHE_DIR);
    for (const f of files) {
      // 只清理受管理的前缀 + .json 后缀 (.tmp 不动, 避免竞态)
      if (!f.endsWith('.json')) continue;
      const matched = MANAGED_PREFIXES.some((p) => f.startsWith(p + '-'));
      if (!matched) continue;
      try {
        const path = join(CACHE_DIR, f);
        const mt = statSync(path).mtimeMs;
        if (now - mt > maxAgeMs) unlinkSync(path);
      } catch {
        // 单文件清理失败跳过
      }
    }
  } catch {
    // 静默
  }
}
