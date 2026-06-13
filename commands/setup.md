---
description: 配置 claude-mini-hud 作为 Claude Code 的状态栏 (支持中/英文选择)
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

# claude-mini-hud Setup

把 `claude-mini-hud` 配成 Claude Code 的 statusline, 让 `~/.claude/settings.json` 里的 `statusLine.command` 指向本插件的 `dist/index.js`。

## Step 1: 选择语言 / Select Language

**必须先调用 AskUserQuestion 弹出语言选择菜单**, 根据用户选择决定后续步骤里的提示文案 + 写入 settings.json 的环境变量:

```
Use AskUserQuestion:
  header: "Language"
  question: "请选择显示模式 / Select display mode"
  options:
    - label: "中文 (Chinese)"
      description: "上下文 + Token + 当前任务 全部中文"
    - label: "English"
      description: "Context + Token + Todos 全部英文"
    - label: "简约 (Minimal)"
      description: "英中混搭, 无前缀符号, 最紧凑布局"
    - label: "极简 (Ultra-Minimal)"
      description: "只显示 Context + Token 两行, 其余全部隐藏"
```

把用户选择存到 `{LANG}` 变量 (zh / en / minimal / ultra-minimal), 后续步骤用它:
1. 决定 Step 6 输出提示的语种
2. 写入 `statusLine.command` 的 `CLAUDE_MINI_HUD_LANG={LANG}` 环境变量

**4 种模式输出示例** (支持 emoji 的终端会自动显示 emoji 图标, 不支持的终端显示 ASCII 符号):

```
# 中文 (zh) — emoji 终端
📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶ 当前任务 调研充电行业政策  (2/5)

# 中文 (zh) — 无 emoji 终端
# 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
$ Token 23k (in 22k · out 342 · cache 768)
> 当前任务 调研充电行业政策  (2/5)

# English (en) — emoji 终端
📊 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  left 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶ Todos Research charging industry policy  (2/5)

# 简约 (minimal) — 无 emoji, 无前缀
 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
 Token 23k (in 22k · out 342 · cache 768)
 当前任务 调研充电行业政策  (2/5)

# 极简 (ultra-minimal) — 只显示两行
 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
 Token 23k (in 22k · out 342 · cache 768)
```

## Step 1.5: 选择主题风格 (可选)

**调用 AskUserQuestion 弹出主题选择菜单**:

```
Use AskUserQuestion:
  header: "Theme"
  question: "选择进度条风格 / Select progress bar theme"
  options:
    - label: "经典 Classic (默认)"
      description: "███░░░░░░░░  经典实心方块"
    - label: "霓虹 Neon"
      description: "⟦ CTX: ▓▓▓▓░░░░ ⟧  霓虹矩阵风"
    - label: "点阵 Braille"
      description: "⣿⣷⣯⣟░░░░  Braille 点阵"
    - label: "硬核 Hardcore"
      description: "[■■■□□□□□] CTX │  硬核风"
```

**再调用 AskUserQuestion 弹出标记选择菜单**:

```
Use AskUserQuestion:
  header: "Marks"
  question: "选择工具标记风格 / Select tool indicator marks"
  options:
    - label: "经典 Classic (默认)"
      description: "◐ 运行中  ✓ 已完成"
    - label: "硬核 Hardcore"
      description: "● 运行中  ■ 已完成"
    - label: "钻石 Diamond"
      description: "◈ 运行中  ◆ 已完成"
    - label: "心形 Heart"
      description: "🖤🖤🤍🤍  心形风 (💗 🖤)"
    - label: "爱心 Love"
      description: "❤️❤️🤍🤍  爱心风 (💗 ❤️)"
```

把选择存到 `{THEME}` 和 `{MARKS}` 变量 (默认都是 `default`)。

**主题风格预览**:

| 主题 | THEME 值 | 进度条 | MARKS 值 | 运行/完成 |
|------|---------|--------|---------|----------|
| 经典 | `default` | `██████░░░░` | `default` | `◐ ✓` |
| 霓虹 | `neon` | `⟦▓▓▓▓░░⟧` | `neon` | `◈ ✦` |
| 点阵 | `braille` | `⣿⣷⣯░░` | `braille` | `⣷ ⣿` |
| 硬核 | `hardcore` | `[■■□□] CTX │` | `hardcore` | `● ■` |
| 简约 | `minimal` | `◈ % ┃` | `minimal` | `· •` |
| 像素 | `pixel` | `⣿⣿⣀⣀` | `pixel` | `▣ ■` |
| 钻石 | `diamond` | `◆◆◇◇` | `diamond` | `◈ ◆` |
| 箭头 | `arrow` | `▸▸▹▹` | `arrow` | `▸ ✓` |
| 波浪 | `wave` | `≋≋∿∿` | `wave` | `≋ ≈` |
| 潮汐 | `tide` | `∿∿╌╌` | `tide` | `∿ ≈` |
| 圆点 | `dot` | `●●○○` | `dot` | `◉ ●` |
| 靶心 | `target` | `◎◎⊙⊙` | `target` | `◎ ⊙` |
| 渐变 | `gradient` | `▓▓▒▒░░` | `gradient` | `▒ ▓` |
| 阴影 | `shades` | `█▓▒░` | `shades` | `▒ █` |
| 复古 | `retro` | `══▸──` | `retro` | `► ■` |
| ASCII | `ascii` | `##..` | `ascii` | `@ #` |
| 铁轨 | `rail` | `══╌╌` | `rail` | `╌ ═` |
| 星光 | `star` | `★★☆☆` | `star` | `☆ ★` |
| 火花 | `spark` | `✦✦✧✧` | `spark` | `✦ ✧` |
| 心形 | `heart` | `🖤🖤🤍🤍` | `heart` | `💗 🖤` |
| 爱心 | `love` | `❤️❤️🤍🤍` | `love` | `💗 ❤️` |

## Step 2: 检测环境

**macOS/Linux**:

```bash
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
# 找插件目录
PLUGIN_DIR=$(ls -d "$CLAUDE_DIR/plugins/cache"/*/claude-mini-hud/*/ 2>/dev/null | sort -V | tail -1)
echo "PLUGIN_DIR=$PLUGIN_DIR"
echo "EXISTS_DIST=$([ -f "$PLUGIN_DIR/dist/index.js" ] && echo YES || echo NO)"
```

**Windows (PowerShell)**:

```powershell
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }
$pluginDir = Get-ChildItem (Join-Path $claudeDir "plugins\cache") -Directory | ForEach-Object {
  Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -like "*claude-mini-hud*" } | Get-ChildItem -Directory | Sort-Object Name -Descending | Select-Object -First 1
} | Select-Object -First 1 -ExpandProperty FullName
Write-Host "PLUGIN_DIR=$pluginDir"
```

## Step 3: 编译插件 (如果 dist 不存在)

**macOS/Linux**:
```bash
cd "$PLUGIN_DIR"
npm install
npm run build
```

**Windows (PowerShell)**:
```powershell
Set-Location $pluginDir
npm install
npm run build
```

## Step 4: 检查现有 statusLine 配置

读取 `~/.claude/settings.json`:

**macOS/Linux**:
```bash
EXISTING=$(jq -r '.statusLine // empty' "$CLAUDE_DIR/settings.json" 2>/dev/null)
```

**Windows (PowerShell)**:
```powershell
$existing = (Get-Content (Join-Path $claudeDir "settings.json") -Raw | ConvertFrom-Json).statusLine
```

### 如果已有 statusLine

弹 AskUserQuestion 询问:

```
Use AskUserQuestion:
  header: "Existing statusline"
  question: "Found an existing statusLine in settings.json: {EXISTING_PREVIEW}. What would you like to do?"
  options:
    - label: "替换为 claude-mini-hud (会备份原配置)"
      description: "原 statusLine 会被改名为 statusLine.bak.YYYYMMDD-HHMMSS"
    - label: "保留原 statusLine, 退出 setup"
      description: "不改 settings.json, 仅完成编译步骤"
    - label: "取消 setup"
      description: "不做任何更改"
```

如果用户选"保留"或"取消" → 跳到 Step 6 (提示重启 + 验证)。

## Step 5: 写入 statusLine 配置

**macOS/Linux**:
```bash
# 1) 找编译产物路径
RUNTIME_PATH="$PLUGIN_DIR/dist/index.js"

# 2) 备份原配置
if [ -n "$EXISTING" ]; then
  TS=$(date +%Y%m%d-%H%M%S)
  jq '.statusLine' "$CLAUDE_DIR/settings.json" > "$CLAUDE_DIR/statusLine.bak.$TS.json"
fi

# 3) 拼接环境变量
ENV_VARS="CLAUDE_MINI_HUD_LANG=$LANG"
if [ "$THEME" != "default" ]; then ENV_VARS="$ENV_VARS CLAUDE_MINI_HUD_THEME=$THEME"; fi
if [ "$MARKS" != "default" ]; then ENV_VARS="$ENV_VARS CLAUDE_MINI_HUD_MARKS=$MARKS"; fi

# 4) 写入新配置
jq --arg cmd "$ENV_VARS node '$RUNTIME_PATH'" \
   '.statusLine = {"type": "command", "command": $cmd}' \
   "$CLAUDE_DIR/settings.json" > "$CLAUDE_DIR/settings.json.tmp"
mv "$CLAUDE_DIR/settings.json.tmp" "$CLAUDE_DIR/settings.json"
```

**Windows (PowerShell)**:
```powershell
$runtimePath = Join-Path $pluginDir "dist\index.js"
$settingsPath = Join-Path $claudeDir "settings.json"
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json

# 备份原配置
if ($settings.statusLine) {
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  $backupPath = Join-Path $claudeDir "statusLine.bak.$ts.json"
  $settings.statusLine | ConvertTo-Json -Depth 10 | Set-Content $backupPath
}

# Windows 需要 PowerShell 包装环境变量 (cmd/PowerShell 不支持 POSIX VAR=value 语法)
$envSetup = "`$env:CLAUDE_MINI_HUD_LANG='$lang';"
if ($theme -ne "default") { $envSetup += " `$env:CLAUDE_MINI_HUD_THEME='$theme';" }
if ($marks -ne "default") { $envSetup += " `$env:CLAUDE_MINI_HUD_MARKS='$marks';" }

$settings | Add-Member -Type NoteProperty -Name statusLine -Value @{
  type = "command"
  command = "powershell -NoProfile -Command `"$envSetup node '$runtimePath'`""
} -Force
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath
```

## Step 6: 提示重启 + 验证

根据 `{LANG}` 选择输出:

### 中文 (LANG=zh)

```
✅ claude-mini-hud 配置完成!

下一步:
1. 重启 Claude Code (Ctrl+C 退出后重新打开)
2. 输入框下方应显示 2-3 行 (默认无模型行):

📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶ 当前任务 (进行中的 todo, 有则显示)

(不支持 emoji 的终端会显示 # $ > 等 ASCII 符号)

可选配置:
  显示模型行:   CLAUDE_MINI_HUD_SHOW_MODEL=1
  强制关闭 emoji: CLAUDE_MINI_HUD_NO_EMOJI=1
  切换进度条:   CLAUDE_MINI_HUD_THEME=neon|braille|hardcore|pixel|diamond|arrow
  切换标记:     CLAUDE_MINI_HUD_MARKS=hardcore|diamond|arrow|...

如果只看到 1 行 "claude-mini-hud — 渲染失败":
  - 检查 ~/.claude/settings.json 里的 statusLine.command 路径
  - 跑: node {RUNTIME_PATH} <<< '{"model":{"display_name":"test"}}'
  - 应该输出 "🪙 Token 10B" 等 2-3 行

卸载: 把 settings.json 的 statusLine 字段改为 null
```

### English (LANG=en)

```
✅ claude-mini-hud setup complete!

Next steps:
1. Restart Claude Code (Ctrl+C, then reopen)
2. The statusline should show 2-3 lines below your input (model hidden by default):

📊 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  left 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶ Todos (in-progress todo, if any)

(Terminals without emoji support will show # $ > ASCII symbols instead)

Optional settings:
  Show model:     CLAUDE_MINI_HUD_SHOW_MODEL=1
  Disable emoji:  CLAUDE_MINI_HUD_NO_EMOJI=1
  Change bar:     CLAUDE_MINI_HUD_THEME=neon|braille|hardcore|pixel|diamond|arrow
  Change marks:   CLAUDE_MINI_HUD_MARKS=hardcore|diamond|arrow|...

If you only see "claude-mini-hud — render failed":
  - Check the statusLine.command path in ~/.claude/settings.json
  - Run: node {RUNTIME_PATH} <<< '{"model":{"display_name":"test"}}'
  - Should output "🪙 Token 10B" and 1-2 more lines

Uninstall: Set the statusLine field in settings.json to null
```

### 简约 (LANG=minimal)

```
✅ claude-mini-hud 配置完成! (minimal 模式)

 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
 Token 23k (in 22k · out 342 · cache 768)

可选: THEME=neon MARKS=hardcore 等, 同上
```

## 卸载 / Uninstall

**macOS/Linux**:
```bash
jq '.statusLine = null' "$CLAUDE_DIR/settings.json" > "$CLAUDE_DIR/settings.json.tmp"
mv "$CLAUDE_DIR/settings.json.tmp" "$CLAUDE_DIR/settings.json"
```

**Windows (PowerShell)**:
```powershell
$settings.statusLine = $null
$settings | ConvertTo-Json -Depth 10 | Set-Content $settingsPath
```

## 切换语言 / Change Language

如果想换语言 (中文 ↔ English), 有两种方式:

1. **重新跑 setup** (推荐): `/claude-mini-hud:setup`, 选不同语言, 自动更新 `settings.json`
2. **手动改环境变量**: 直接修改 `~/.claude/settings.json` 里的 `CLAUDE_MINI_HUD_LANG=zh|en|minimal`, 重启 Claude Code 即可

**无需重新编译** — 语言切换是运行时通过环境变量选择的, 只有修改 `src/i18n.ts` 里的字符串常量才需要重编译。
