# hot-monitor 技术方案文档

> 版本：v1.2  
> 日期：2026-04-20  
> 状态：Phase 1 已完成，UI 已重构为 Aceternity 风格

---

## 1. 技术选型

### 1.1 整体架构

```
┌─────────────────────────────────────────────┐
│               Browser / Agent               │
└─────────────────┬───────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────┐
│         FastAPI (Python 3.11+)              │
│  ┌─────────────┐  ┌────────────────────┐   │
│  │  REST API   │  │  Static Files      │   │
│  │  /api/v1/*  │  │  (React 前端)      │   │
│  └─────────────┘  └────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │         APScheduler (后台定时)       │   │
│  └─────────────────────────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │
      ┌───────────┼───────────┐
      ▼           ▼           ▼
  SQLite     OpenRouter    SMTP/Webhook
  (数据库)   (AI分析)      (通知)
```

### 1.2 技术栈

| 层       | 技术                          | 版本      | 理由                               |
| -------- | ----------------------------- | --------- | ---------------------------------- |
| 后端框架 | FastAPI                       | 0.115+    | 高性能异步，自动 OpenAPI 文档      |
| ORM      | SQLAlchemy + aiosqlite        | 2.x       | 异步 SQLite，零运维                |
| 定时任务 | APScheduler                   | 4.x       | 内嵌调度，支持动态添加/删除任务    |
| AI 接入  | OpenRouter (requests)         | -         | 统一 API，`deepseek/deepseek-v3.2` |
| RSS 解析 | feedparser                    | 6.x       | 成熟稳定                           |
| 通知     | aiosmtplib                    | 3.x       | 异步 SMTP                          |
| 前端     | React (Vite) + TypeScript     | 19 / 8.x  | 现代前端，Vite 8 构建              |
| 样式     | Tailwind CSS                  | 3.4       | 高效定制                           |
| UI 动效  | Aceternity UI + Framer Motion | 12.x      | 科技感组件 + 流畅动画引擎          |
| 工具库   | clsx + tailwind-merge         | 2.x / 3.x | className 合并工具                 |
| 前端状态 | TanStack Query                | 5.x       | 数据请求/缓存                      |
| 路由     | React Router                  | 7.x       | SPA 路由                           |
| 图标     | Lucide React                  | 1.x       | 轻量 SVG 图标库                    |
| 部署     | 单进程运行                    | -         | FastAPI 托管前端静态文件           |

---

## 2. 项目目录结构

```
hot-monitor/
├── docs/
│   ├── requirements.md        # 需求文档（当前文件的姐妹文档）
│   └── design.md              # 技术方案文档（本文件）
├── backend/
│   ├── main.py                # FastAPI 入口 + 静态文件托管 + lifespan
│   ├── config.py              # pydantic-settings 环境变量配置
│   ├── database.py            # SQLite 异步连接池
│   ├── models.py              # SQLAlchemy ORM 模型
│   ├── schemas.py             # Pydantic 请求/响应 Schema
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── keywords.py        # 关键词 CRUD + 命中历史
│   │   ├── topics.py          # 热点列表 + 详情
│   │   └── settings.py        # 通知/扫描配置
│   └── services/
│       ├── __init__.py
│       ├── crawler.py         # RSS + HN + DuckDuckGo 数据抓取
│       ├── ai_analyzer.py     # OpenRouter 调用封装
│       ├── notifier.py        # 邮件 + Webhook 通知
│       └── scheduler.py       # APScheduler 任务管理
├── frontend/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css           # Tailwind 入口 + 自定义深色主题
│       ├── api/               # axios 请求封装
│       ├── lib/
│       │   └── utils.ts       # cn() 工具（clsx + tailwind-merge）
│       ├── pages/
│       │   ├── Dashboard.tsx  # 热点流主页（Spotlight 背景）
│       │   ├── Keywords.tsx   # 关键词管理
│       │   └── Settings.tsx   # 通知/系统设置
│       └── components/
│           ├── HotCard.tsx    # 热点卡片（毛玻璃 + 动画展开）
│           ├── Layout.tsx     # 页面布局（SparklesCore + MovingBorder）
│           └── ui/            # Aceternity UI 组件库
│               ├── background-gradient.tsx
│               ├── moving-border.tsx
│               ├── sparkles.tsx
│               ├── spotlight.tsx
│               └── text-generate-effect.tsx
├── .env.example
├── requirements.txt
└── README.md
```

---

## 3. 数据库设计

### 3.1 表结构

#### `keywords` — 关键词监控配置

| 字段            | 类型        | 说明             |
| --------------- | ----------- | ---------------- |
| id              | INTEGER PK  | 自增主键         |
| keyword         | TEXT UNIQUE | 关键词内容       |
| enabled         | BOOLEAN     | 是否启用         |
| last_checked_at | DATETIME    | 最近一次检查时间 |
| created_at      | DATETIME    | 创建时间         |

#### `topics` — 发现的热点内容

| 字段          | 类型       | 说明                                 |
| ------------- | ---------- | ------------------------------------ |
| id            | INTEGER PK | 自增主键                             |
| title         | TEXT       | 热点标题                             |
| summary       | TEXT       | AI 生成摘要（中文，≤100字）          |
| source_url    | TEXT       | 原始链接                             |
| source_name   | TEXT       | 来源名称（HN / OpenAI Blog 等）      |
| heat_score    | INTEGER    | AI 热度评分（1-10）                  |
| tags          | TEXT       | JSON 数组，如 ["GPT-5", "OpenAI"]    |
| is_notified   | BOOLEAN    | 是否已发送通知                       |
| keyword_id    | INTEGER FK | 关联关键词（可为空，自动发现则为空） |
| raw_content   | TEXT       | 原始抓取内容快照                     |
| discovered_at | DATETIME   | 发现时间                             |

#### `settings` — 系统配置（KV表）

| 字段       | 类型     | 说明                 |
| ---------- | -------- | -------------------- |
| key        | TEXT PK  | 配置键               |
| value      | TEXT     | 配置值（JSON序列化） |
| updated_at | DATETIME | 更新时间             |

---

## 4. API 接口设计

### 4.1 RESTful API（`/api/v1/`）

#### 关键词管理

```
GET    /api/v1/keywords           # 列出所有关键词
POST   /api/v1/keywords           # 新增关键词
PATCH  /api/v1/keywords/{id}      # 更新关键词（启停/修改）
DELETE /api/v1/keywords/{id}      # 删除关键词
GET    /api/v1/keywords/{id}/hits # 查询某关键词的命中历史
```

#### 热点内容

```
GET  /api/v1/topics               # 热点列表（支持分页、排序、过滤）
GET  /api/v1/topics/{id}          # 热点详情
POST /api/v1/topics/scan          # 手动触发一次全量扫描
```

#### 系统设置

```
GET  /api/v1/settings             # 获取所有配置
PUT  /api/v1/settings             # 批量更新配置
POST /api/v1/settings/test-email  # 发送测试邮件
GET  /api/v1/settings/status      # 获取调度器状态
```

### 4.2 请求/响应示例

#### POST /api/v1/keywords

Request:

```json
{ "keyword": "GPT-5", "enabled": true }
```

Response `201`:

```json
{
  "id": 1,
  "keyword": "GPT-5",
  "enabled": true,
  "last_checked_at": null,
  "created_at": "2026-04-19T10:00:00Z"
}
```

---

## 5. OpenRouter AI 对接方案

基于官方文档（2026-04-19 最新），使用 **Python requests** 直接调用：

### 5.1 请求格式

```
POST https://openrouter.ai/api/v1/chat/completions

Headers:
  Authorization: Bearer <OPENROUTER_API_KEY>
  Content-Type: application/json
  HTTP-Referer: https://github.com/hot-monitor
  X-OpenRouter-Title: hot-monitor

Body:
{
  "model": "deepseek/deepseek-v3.2",
  "messages": [
    { "role": "system", "content": "<系统提示>" },
    { "role": "user",   "content": "<待分析内容>" }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.3,
  "max_tokens": 512
}
```

### 5.2 AI 分析 Prompt 设计

**热点分析 Prompt（系统提示）**：

```
你是一位专业的科技媒体编辑，擅长识别 AI 领域的真实热点。
分析给定的内容，返回 JSON 格式：
{
  "is_genuine": true/false,        // 是否为真实热点（非转发/广告/假冒）
  "relevance": 0-10,               // 与AI/科技领域的相关度
  "heat_score": 1-10,              // 热度评分（综合新颖度、权威来源、讨论量）
  "summary": "中文摘要，不超过100字",
  "tags": ["标签1", "标签2"]        // 2-4个关键标签
}
```

### 5.3 关键词相关性 Prompt

```
判断以下内容是否与关键词 "{keyword}" 真实相关（非关键词堆砌、非标题党）。
返回 JSON：
{
  "is_relevant": true/false,
  "relevance_score": 0-10,
  "reason": "一句话说明原因"
}
```

---

## 6. 数据抓取策略

### 6.1 RSS 源列表

```python
RSS_FEEDS = [
    {"name": "OpenAI Blog",   "url": "https://openai.com/news/rss.xml"},
    {"name": "Anthropic",     "url": "https://www.anthropic.com/rss.xml"},
    {"name": "Google DeepMind","url": "https://deepmind.google/blog/rss.xml"},
    {"name": "HuggingFace",   "url": "https://huggingface.co/blog/feed.xml"},
    {"name": "TechCrunch AI", "url": "https://techcrunch.com/category/artificial-intelligence/feed/"},
    {"name": "VentureBeat AI","url": "https://venturebeat.com/category/ai/feed/"},
]
```

### 6.2 Hacker News API

```python
# 获取 Top Stories（免费，无需 API Key）
GET https://hacker-news.firebaseio.com/v0/topstories.json
GET https://hacker-news.firebaseio.com/v0/item/{id}.json
```

每次抓取前 30 条，过滤评分 ≥ 50 的条目，再调用 AI 分析。

### 6.3 DuckDuckGo 搜索

使用 `duckduckgo_search` Python 库（无需 API Key）：

```python
from duckduckgo_search import DDGS

with DDGS() as ddgs:
    results = list(ddgs.news(keyword, max_results=10, timelimit='d'))
```

---

## 7. APScheduler 调度策略

基于 APScheduler 4.x IntervalTrigger：

```python
from apscheduler import Scheduler
from apscheduler.triggers.interval import IntervalTrigger

scheduler = Scheduler()

# 热点自动发现任务（按用户配置间隔）
scheduler.add_schedule(
    auto_discover_task,
    IntervalTrigger(minutes=scan_interval)
)

# 关键词监控任务（每次间隔检查所有启用的关键词）
scheduler.add_schedule(
    keyword_monitor_task,
    IntervalTrigger(minutes=scan_interval)
)
```

调度器在 FastAPI 的 `lifespan` 中启动/关闭：

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start_in_background()
    yield
    scheduler.stop()
```

---

## 8. 通知服务

### 8.1 邮件通知（aiosmtplib）

```python
import aiosmtplib
from email.mime.text import MIMEText

async def send_email(subject: str, body_html: str):
    msg = MIMEText(body_html, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USER
    msg["To"] = settings.NOTIFY_EMAIL

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        start_tls=True,
    )
```

---

## 9. 前端 UI 设计规格

### 9.1 设计风格：HotPulse 深空科技仪表盘

- **背景色**：`#030712`（纯黑深空），叠加 60px 网格线（`rgba(255,255,255,0.02)`）
- **品牌名**：HotPulse（顶部导航栏，渐变文字 `from-blue-400 via-cyan-400 to-blue-300`，Logo 上方叠加 SparklesCore 粒子效果）
- **卡片**：极低透明度背景 `rgba(255,255,255,0.025)` + 边框 `0.06` 不透明度 + 圆角 14px，悬停时微光效果
- **顶部导航**：`rgba(3,7,18,0.88)` + `backdrop-blur(16px) saturate(180%)`，磨砂质感
- **核心按钮**：MovingBorder 动态渐变边框动画（蓝→青色光带流动）
- **Dashboard 背景**：Spotlight 组件产生大面积柔和光晕
- **紧急热点卡片**：顶部渐变指示线 + 外发光阴影
- **统计卡片**：紧急热点使用 BackgroundGradient 组件包裹（蓝/青/紫/绿四色辐射渐变流动）
- **动画引擎**：framer-motion，所有展开/折叠/入场使用 AnimatePresence
- **尊重 `prefers-reduced-motion`**：禁用所有动画的回退方案
- **移动端**：底部 Tab 导航（热点雷达 / 监控词 / 设置），ActiveIndicator 使用 cyan-400

### 9.2 Aceternity UI 组件

| 组件               | 用途                            | 位置                   |
| ------------------ | ------------------------------- | ---------------------- |
| SparklesCore       | Logo 粒子发光效果               | Layout.tsx 顶部导航    |
| Spotlight          | Dashboard 页面大面积柔光背景    | Dashboard.tsx          |
| MovingBorder       | 立即扫描按钮流动渐变边框        | Layout.tsx             |
| BackgroundGradient | 紧急热点统计卡片流动渐变背景    | Dashboard.tsx StatCard |
| TextGenerateEffect | （预留）空状态/标题文字逐字生成 | 未来可用               |

### 9.3 徽章体系（Badge System）

| 徽章               | 触发条件        | 颜色                  |
| ------------------ | --------------- | --------------------- |
| CRITICAL           | heat_score ≥ 9  | 红 `#f87171` + 外发光 |
| HIGH               | heat_score ≥ 7  | 橙 `#fb923c`          |
| MED                | heat_score ≥ 5  | 黄 `#fbbf24`          |
| LOW                | heat_score < 5  | 灰 `#94a3b8`          |
| 标签 Tag           | tags 数组内容   | 青 `#67e8f9`          |
| 可信（关键词命中） | keyword_id 非空 | 绿 `#86efac`          |

### 9.4 响应式断点

| 断点            | 布局                                  |
| --------------- | ------------------------------------- |
| < 768px（手机） | 单列，顶部 + 底部双 Tab 导航          |
| ≥ 768px（桌面） | 单列（max-width 约束），顶部 Tab 导航 |

### 9.5 页面模块

**Dashboard（热点雷达）**

- 四张统计卡：总热点 / 今日新增 / 紧急热点（≥9分）/ 监控词数量
- 排序标签页（最新发现 / 热度综合 / 按来源）+ 筛选芯片（全部 / 高≥7 / 极热≥9）
- 热点卡片：徽章行（等级 + 来源头像 + 标签 + 可信标记 + 热分）→ 标题 → AI 摘要 → 展开原始内容

**Keywords（关键词管理）**

- 添加输入框（Enter 键提交）
- 关键词卡片：状态开关、命中数、最后检查时间
- 展开命中历史列表

**Settings（设置）**

- AI 配置：API Key（密码框）、AI 模型下拉（默认 `deepseek/deepseek-v3.2`）
- 扫描设置：间隔滑块（10m - 6h）、通知热度阈值滑块（1-10）
- 邮件通知：SMTP 快速预设（Gmail/QQ/163）、主机/端口/账号/密码、收件箱、测试按钮
- 保存按钮（蓝→青渐变主按钮）

---

## 10. 安全注意事项

- `.env` 中所有敏感信息（API Key、SMTP 密码）不硬编码，不进入 git
- SMTP 密码在前端设置页**仅展示掩码**，API 返回时不返回明文
- OpenRouter API Key 同上，后端不在日志中打印
- 所有数据库查询使用 SQLAlchemy ORM 参数绑定，不拼接 SQL
- 前端输入（关键词等）后端进行长度 + 字符白名单校验

---

## 11. 开发阶段规划

### Phase 1：Web 版（已完成 ✓）

| 步骤   | 内容                                            | 状态 |
| ------ | ----------------------------------------------- | ---- |
| Step 1 | 项目结构 + 依赖 + 环境配置                      | ✓    |
| Step 2 | 数据库模型 + SQLite 初始化                      | ✓    |
| Step 3 | RSS/HN/DDG 数据抓取服务                         | ✓    |
| Step 4 | OpenRouter AI 分析模块                          | ✓    |
| Step 5 | APScheduler 定时任务                            | ✓    |
| Step 6 | 邮件通知服务                                    | ✓    |
| Step 7 | FastAPI 完整路由                                | ✓    |
| Step 8 | React 前端 Dashboard（Aceternity UI 深色仪表盘）| ✓    |
| Step 9 | 前后端联调 + 测试                               | ✓    |

### Phase 2：Agent Skills（后续迭代）

| 步骤    | 内容                                              |
| ------- | ------------------------------------------------- |
| Step 10 | 封装 `.prompt.md` 技能文件（调用 Phase 1 的 API） |

---

## 12. 开发环境 & 运行方式

### 12.1 推荐终端

项目推荐使用 **Git Bash** 作为 VS Code 集成终端，已在用户 `settings.json` 中配置：

```json
"terminal.integrated.defaultProfile.windows": "Git Bash",
"terminal.integrated.profiles.windows": {
  "Git Bash": {
    "path": "D:\\Git\\installed\\bin\\bash.exe",
    "args": ["-i", "-l"],
    "icon": "terminal-bash"
  }
}
```

> 若 Git 安装在其他路径（如 `C:\Program Files\Git`），请修改 `path` 为对应 `bin\bash.exe`。

### 12.2 启动步骤

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 复制并填写环境变量
cp .env.example .env

# 3. 启动后端（同时托管前端）
python -m uvicorn backend.main:app --reload --port 8000

# 4. 访问
open http://localhost:8000
```

开发时前端 HMR：

```bash
cd frontend && npm install && npm run dev
```
