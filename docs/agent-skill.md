# hot-monitor Agent Skill

## Skill 描述

`hot-monitor` 是一个面向 AI 编程博主的热点话题监控助手。该 Skill 可以：

- 查询当前采集到的 AI 技术热点列表（按热度排序）
- 添加/删除关键词监控
- 手动触发一次全量扫描
- 查看系统运行状态

## 调用方式（HTTP API）

服务默认运行于 `http://localhost:8000`，所有接口前缀为 `/api/v1`。

### 1. 查询热点话题

```
GET /api/v1/topics?limit=20&min_heat=5
```

参数：
| 参数 | 类型 | 说明 |
|------|------|------|
| limit | int | 返回条数，默认 50 |
| offset | int | 分页偏移 |
| min_heat | int | 最低热度过滤（1-10） |

返回示例：

```json
[
  {
    "id": 1,
    "title": "Anthropic Launches Claude Opus 4.7",
    "summary": "Anthropic releases new Claude model with safety features...",
    "source_url": "https://...",
    "source_name": "Anthropic Blog",
    "heat_score": 8,
    "tags": ["Claude", "AI Safety"],
    "is_notified": false,
    "discovered_at": "2026-04-19T09:12:52"
  }
]
```

### 2. 手动触发扫描

```
POST /api/v1/topics/scan
```

返回：

```json
{ "message": "扫描任务已触发，正在后台执行", "triggered": true }
```

### 3. 关键词管理

```
GET    /api/v1/keywords          # 列出所有关键词
POST   /api/v1/keywords          # 添加关键词 body: {"keyword": "GPT-5", "enabled": true}
PATCH  /api/v1/keywords/{id}     # 更新关键词
DELETE /api/v1/keywords/{id}     # 删除关键词
```

### 4. 系统状态

```
GET /api/v1/settings/status
```

返回：

```json
{
  "scheduler_running": true,
  "next_run": "2026-04-19T18:10:44+08:00",
  "total_topics": 67,
  "total_keywords": 5
}
```

## Agent 集成示例

在 Copilot Agent 或任何支持 HTTP Tool 的 Agent 框架中，可将以下工具注册：

```yaml
tools:
  - name: get_hot_topics
    description: 获取当前 AI 技术热点话题列表，按热度排序
    method: GET
    url: http://localhost:8000/api/v1/topics
    params:
      limit: 20
      min_heat: 5

  - name: trigger_scan
    description: 立即触发一次热点扫描采集
    method: POST
    url: http://localhost:8000/api/v1/topics/scan

  - name: add_keyword
    description: 添加新的关键词监控
    method: POST
    url: http://localhost:8000/api/v1/keywords
    body:
      keyword: "{{keyword}}"
      enabled: true

  - name: system_status
    description: 查看热点监控系统运行状态
    method: GET
    url: http://localhost:8000/api/v1/settings/status
```

## 典型对话示例

**用户**：帮我查一下今天有哪些 AI 热点，热度7分以上的  
**Agent**：`GET /api/v1/topics?min_heat=7&limit=10` → 返回列表

**用户**：帮我监控"Gemini 2.0"这个关键词  
**Agent**：`POST /api/v1/keywords {"keyword": "Gemini 2.0"}` → 已添加

**用户**：现在扫一下最新热点  
**Agent**：`POST /api/v1/topics/scan` → 触发后台任务
