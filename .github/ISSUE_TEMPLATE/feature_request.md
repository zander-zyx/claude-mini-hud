---
name: 功能建议
about: 提一个新平台适配或新功能
title: "[FEATURE] "
labels: enhancement
assignees: ''
---

## 想要什么

<!-- 简洁描述你想要的功能 -->

## 解决什么问题

<!-- 现状有什么不方便 -->

## 你的方案（可选）

<!-- 如果有想法，写下来 -->

## 适配新平台（如果是要加用量查询）

请尽量提供以下信息，能大幅加快适配速度：

- 平台名称 + 官网
- `ANTHROPIC_BASE_URL` 域名是什么（去 token）
- 是否有公开的用量/余额查询 API？文档链接：
- API 鉴权方式（Bearer / HMAC / Cookie / ...）
- 返回示例 JSON（**删掉 token 和敏感字段**）：

```json
{
  "example": "..."
}
```

如果你能提供一个 curl 调用样例就更好了：

```bash
curl -X GET 'https://...' \
  -H 'Authorization: Bearer xxx'
```

## 其他

<!-- 截图、参考实现、相关 issue 链接 -->
