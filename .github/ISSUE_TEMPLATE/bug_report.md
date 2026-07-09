---
name: Bug 报告
about: 报告 claude-mini-hud 的问题，帮助我们改进
title: "[BUG] "
labels: bug
assignees: ''
---

## 现象描述

<!-- 简洁描述发生了什么问题 -->

## 期望行为

<!-- 正常应该是什么样子 -->

## 复现步骤

1.
2.
3.

## 状态栏截图 / 终端输出

<!-- 如果是显示异常，贴一张截图或 ANSI 输出 -->

```
（在这里粘贴）
```

## 环境信息

请填写以下信息（**敏感信息打码**，但请保留关键判断字段）：

- claude-mini-hud 版本：`1.2.1`（运行 `node dist/index.js --version` 或看 package.json）
- 操作系统：[Windows / macOS / Linux]
- 终端：[Windows Terminal / iTerm2 / VS Code / ...]
- Node.js 版本：`node -v` 输出
- Claude Code 版本：
- 配置的平台（`ANTHROPIC_BASE_URL` 域名，去掉 token）：例如 `bigmodel.cn` / `minimaxi.com`
- 相关环境变量（**去掉 token**）：
  ```
  CLAUDE_MINI_HUD_LANG=
  CLAUDE_MINI_HUD_THEME=
  CLAUDE_MINI_HUD_TOKEN_MODE=
  ```

## 调试日志

打开调试模式复现一次，把 stderr 日志贴出来（**含 token 的部分务必删掉**）：

```
CLAUDE_MINI_HUD_DEBUG=1
```

## 其他

<!-- 补充说明 -->
