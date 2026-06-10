---
description: 配置 claude-mini-hud 作为 Claude Code 的状态栏 (支持中/英文选择)
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

# claude-mini-hud Setup

把 `claude-mini-hud` 配成 Claude Code 的 statusline, 让 `~/.claude/settings.json` 里的 `statusLine.command` 指向本插件的 `dist/index.js`。

## Step 1: 选择语言 / Select Language

**必须先调用 AskUserQuestion 弹出语言选择菜单**, 根据用户选择决定后续步骤里的提示文案:

```
Use AskUserQuestion:
  header: "Language"
  question: "请选择 setup 提示语言 / Select setup language"
  options:
    - label: "中文 (Chinese)"
      description: "所有提示、错误信息、README 都用中文"
    - label: "English"
      description: "All prompts, errors, and README in English"
```

把用户选择存到 `{LANG}` 变量 (zh 或 en), 后续步骤用它决定输出语言。

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
$claudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } } else { Join-Path $HOME ".claude" }
$pluginDir = Get-ChildItem (Join-Path $claudeDir "plugins\cache") -Directory | ForEach-Object {
  Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -like "*claude-mini-hud*" }
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

# 3) 写入新配置
jq --arg cmd "node '$RUNTIME_PATH'" \
   '.statusLine = {"type": "command", "command": $cmd}' \
   "$CLAUDE_DIR/settings.json" > "$CLAUDE_DIR/settings.json.tmp"
mv "$CLAUDE_DIR/settings.json.tmp" "$CLAUDE_DIR/settings.json"
```

**Windows (PowerShell)**:
```powershell
$runtimePath = Join-Path $pluginDir "dist\index.js"
$settingsPath = Join-Path $claudeDir "settings.json"
$settings = Get-Content $settingsPath -Raw | ConvertFrom-Json
$settings | Add-Member -Type NoteProperty -Name statusLine -Value @{
  type = "command"
  command = "node '$runtimePath'"
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
2. 输入框下方应显示 3 行 (默认无模型行):

📊 上下文 ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  剩余 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶️  当前任务 ▸ (进行中的 todo, 有则显示)

可选: 想显示模型行? 把 statusLine.command 改成:
  CLAUDE_MINI_HUD_SHOW_MODEL=1 node {RUNTIME_PATH}

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
2. The statusline should show 3 lines below your input (model hidden by default):

📊 Context ███░░░░░░░░░░░░░░░░░ 13%  100k / 1M  left 900k
🪙 Token 23k (in 22k · out 342 · cache 768)
▶️ Todos   ▸ (in-progress todo, if any)

Optional: Want the model line too? Change statusLine.command to:
  CLAUDE_MINI_HUD_SHOW_MODEL=1 node {RUNTIME_PATH}

If you only see "claude-mini-hud — 渲染失败":
  - Check the statusLine.command path in ~/.claude/settings.json
  - Run: node {RUNTIME_PATH} <<< '{"model":{"display_name":"test"}}'
  - Should output "🪙 Token 10B" and 1-2 more lines

Uninstall: Set the statusLine field in settings.json to null
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

如果想换语言 (中文 ↔ English), 直接重新跑 `/claude-mini-hud:setup`, 选不同语言即可。运行时显示文字来自 `src/index.ts` 里的中文常量, 改语言需要重编译: