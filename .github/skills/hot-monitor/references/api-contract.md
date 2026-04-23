# Hot Monitor API Contract

本文件记录真实代码实现对应的接口约束，供 Skill 在执行时按接口落地。

## Base URL

- 首选 http://localhost:8000
- 备用 http://localhost:8001

探活接口：

- GET /api/v1/settings/status

## 建议请求方式

### Bash

```bash
curl -fsS http://localhost:8000/api/v1/settings/status
```

### PowerShell

```powershell
Invoke-RestMethod -Method Get -Uri http://localhost:8000/api/v1/settings/status
```

### 发送 JSON

```bash
curl -fsS \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"keyword":"GPT-5","type":"keyword","enabled":true}' \
  http://localhost:8000/api/v1/keywords
```

## 关键词管理

### GET /api/v1/keywords

Query 参数：

- enabled: all | enabled | disabled
- type: all | keyword | account
- platform: 字符串，可空
- search: 字符串，可空
- sort: created_desc | created_asc

关键响应字段：

- id
- keyword
- enabled
- type
- platform
- account_id
- last_checked_at
- created_at

### POST /api/v1/keywords

请求体字段：

- keyword: 必填，1-200 字符
- enabled: 可选，默认 true
- type: keyword | account
- platform: 可选
- account_id: 可选

关键词示例：

```json
{
  "keyword": "GPT-5",
  "type": "keyword",
  "enabled": true
}
```

账号示例：

```json
{
  "keyword": "OpenAI 官方",
  "type": "account",
  "platform": "twitter",
  "account_id": "openai",
  "enabled": true
}
```

错误：

- 409: 关键词已存在

### PATCH /api/v1/keywords/{id}

可更新字段：

- keyword
- enabled
- type
- platform
- account_id

示例：

```json
{
  "enabled": false
}
```

### DELETE /api/v1/keywords/{id}

成功时返回 204，无响应体。

### GET /api/v1/keywords/{id}/hits

Query 参数：

- limit: 默认 50

返回 TopicOut 数组，按 discovered_at 倒序。

## 热点查询

### GET /api/v1/topics

Query 参数：

- limit: 默认 50
- offset: 默认 0
- min_heat: 默认 1
- sort: newest | heat | matched | unnotified
- source_names: 逗号分隔字符串
- keyword_mode: all | matched | unmatched
- time_range: all | 6h | 24h | 48h | 7d
- tag: 单标签过滤
- q: 标题和摘要搜索

关键响应字段：

- id
- title
- summary
- raw_content
- source_url
- source_name
- source_type
- heat_score
- tags
- is_notified
- keyword_id
- published_at
- relevance_score
- relevance_reason
- engagement
- source_metrics
- discovered_at

示例：

```bash
curl -fsS "http://localhost:8000/api/v1/topics?limit=10&sort=heat&time_range=24h"
```

### GET /api/v1/topics/{id}

返回单条 TopicOut。

## 扫描控制

### POST /api/v1/topics/scan

无请求体。

响应：

```json
{
  "message": "扫描任务已触发，正在后台执行",
  "triggered": true
}
```

或：

```json
{
  "message": "已有扫描任务正在执行，请稍后查看结果",
  "triggered": false
}
```

## 系统设置

### GET /api/v1/settings

返回这些非敏感字段：

- scan_interval
- notify_email
- smtp_host
- smtp_port
- smtp_user
- ai_model
- notify_heat_threshold
- min_heat_score

不会返回：

- smtp_password
- openrouter_api_key

### PUT /api/v1/settings

可提交字段：

- scan_interval: 10-1440
- notify_email
- smtp_host
- smtp_port
- smtp_user
- smtp_password
- openrouter_api_key
- ai_model
- notify_heat_threshold: 1-10
- min_heat_score: 1-10

只提交用户明确给出的字段。

### POST /api/v1/settings/test-email

响应：

```json
{
  "message": "测试邮件已发送，请检查收件箱"
}
```

或：

```json
{
  "message": "发送失败，请检查 SMTP 配置"
}
```

### GET /api/v1/settings/status

关键字段：

- scheduler_running
- next_run
- total_topics
- total_keywords
- scan_running
- scan_started_at
- scan_finished_at
- last_scan_success_at
- last_scan_duration_seconds
- last_scan_error

适用场景：

- 端口探活
- 当前扫描状态判断
- 扫描完成轮询
- 顶层运行状态查看

## 推荐输出约定

### 热点列表

默认返回 5 到 10 条，每条包含：

- 标题
- 来源
- 热度
- 时间
- 摘要
- 命中/通知状态
- 链接

### 候选监控项

当用户要启停、删除、查看命中时，候选项至少给出：

- id
- keyword
- type
- platform
- account_id
- enabled

### 配置更新结果

更新完成后只回显：

- 成功与否
- 生效的非敏感字段
- 测试邮件 message 或接口错误信息
