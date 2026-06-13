/**
 * 主题预览脚本 — 展示所有 23 种进度条风格
 * 用法: node scripts/preview-themes.js
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const THEMES = [
  'default', 'neon', 'braille', 'hardcore', 'minimal',
  'pixel', 'diamond', 'arrow',
  'wave', 'tide', 'dot', 'target', 'gradient', 'shades',
  'retro', 'ascii', 'rail',
  'star', 'spark', 'heart',
];

const THEME_LABELS = {
  default: '经典',
  neon: '霓虹矩阵',
  braille: 'Braille 点阵',
  hardcore: '硬核',
  minimal: '超简约',
  pixel: '像素',
  diamond: '钻石',
  arrow: '箭头',
  wave: '波浪',
  tide: '潮汐',
  dot: '圆点',
  target: '靶心',
  gradient: '渐变',
  shades: '阴影',
  retro: '复古终端',
  ascii: '纯 ASCII',
  rail: '铁轨',
  star: '星光',
  spark: '火花',
  heart: '心形',
};

// 模拟 stdin JSON (72% 上下文使用率)
const stdinJson = JSON.stringify({
  context_window: {
    context_window_size: 200000,
    used_percentage: 72,
    current_usage: {
      input_tokens: 100000,
      output_tokens: 20000,
      cache_creation_input_tokens: 18000,
      cache_read_input_tokens: 6000,
    },
    total_input_tokens: 124000,
    total_output_tokens: 20000,
  },
  model: {
    display_name: 'Sonnet 4.6',
    id: 'claude-sonnet-4-6',
  },
  transcript_path: '',
});

// 去除 ANSI 转义码，只保留纯文本
function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

console.log('\n╔══════════════════════════════════════════════════════════════════╗');
console.log('║          claude-mini-hud 主题预览 — 20 种风格 @ 72%            ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

for (const theme of THEMES) {
  const label = THEME_LABELS[theme] || theme;
  try {
    const output = execSync(
      `node dist/index.js`,
      {
        input: stdinJson,
        encoding: 'utf8',
        cwd: projectRoot,
        env: {
          ...process.env,
          CLAUDE_MINI_HUD_THEME: theme,
          CLAUDE_MINI_HUD_LANG: 'en',
          CLAUDE_MINI_HUD_TOKEN_MODE: 'session',
        },
      }
    ).trim();
    // 去除 ANSI 转义码
    const plain = stripAnsi(output);
    const lines = plain.split('\n');
    const firstLine = `${label.padEnd(12)} │ ${lines[0]}`;
    const rest = lines.slice(1).map(l => `${''.padEnd(12)} │ ${l}`);
    console.log(firstLine);
    for (const l of rest) console.log(l);
    console.log('─────────────┼───────────────────────────────────────────────────');
  } catch (e) {
    console.log(`${label.padEnd(12)} │ [ERROR: ${e.message.split('\n')[0]}]`);
    console.log('─────────────┼───────────────────────────────────────────────────');
  }
}

console.log('\n💡 切换: CLAUDE_MINI_HUD_THEME=<主题名>');
