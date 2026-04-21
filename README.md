# hot-monitor / HotPulse 快速启动

> AI 编程博主专属热点监控工具，自动发现 AI 领域热点并推送通知。
> 默认 AI 模型：`deepseek/deepseek-v3.2`（via OpenRouter）

## 当前版本亮点

- 指挥台式首页重构：顶部升级为“热点情报台”，把调度器、扫描状态、监控规模和主操作集中到同一视区
- 页面层级重做：热点雷达、监控词和设置页统一为更克制的深色科技风信息台，减少传统后台式堆叠感
- 热点详情增强：卡片新增来源类型、已推送状态、发布时间回退、互动指标与 AI 相关性分数
- 更少跳转判断：展开区可直接查看原始描述、AI 相关性理由、来源专属指标与原始链接
- 批量展开详情：Dashboard 和关键词命中记录都支持一键展开/收起全部详情
- 统一扫描状态：手动扫描与定时扫描共用一套状态机，避免重复触发
- 更顺滑的前端刷新：扫描中短轮询，空闲时长轮询，减少页面卡顿
- 关键词与账号监控：支持普通关键词，也支持平台账号追踪
- 热点与监控词增强筛选：支持服务端排序、组合筛选和 URL 状态持久化
- 来源与标签折叠：默认只展示部分筛选项，按需展开全部来源或标签
- 热点时间展示优化：优先显示真实发布时间，拿不到时明确回退到抓取时间；后端统一输出 UTC
- 动效降噪：保留科技感，但对常驻动画做了减负并兼容 reduced motion
- SQLite 索引优化：热点、关键词、命中记录查询更稳定

## 前置要求

- Python 3.11+
- Node.js 18+（仅首次构建前端需要）
- Git Bash（推荐，VS Code 默认终端已配置）

## 开发环境要求

| 工具           | 版本要求 | 说明                                        |
| -------------- | -------- | ------------------------------------------- |
| Python         | 3.11+    | 后端运行时                                  |
| Node.js        | 18+      | 前端构建（首次）                            |
| Git / Git Bash | 任意     | 推荐作为 VS Code 终端，Shell 脚本兼容性更好 |

> **VS Code 终端配置**：项目使用 Git Bash 作为默认终端。安装 Git 后，VS Code `settings.json` 中已写入：
>
> ```json
> "terminal.integrated.defaultProfile.windows": "Git Bash",
> "terminal.integrated.profiles.windows": {
>   "Git Bash": { "path": "D:\\Git\\installed\\bin\\bash.exe", "args": ["-i", "-l"] }
> }
> ```
>
> 若 Git 安装在其他路径，请相应修改 `path`。

## 一键启动

```bash
# 1. 进入目录（Git Bash 或 PowerShell 均可）
cd /d/AI/AI-code/hot-monitor

# 2. 复制配置文件
cp .env.example .env
# 编辑 .env，填入 OPENROUTER_API_KEY

# 3. 安装 Python 依赖
pip install -r requirements.txt

# 4. 启动服务（前端已预编译在 frontend/dist）
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000 即可使用。

如果 `8000` 端口已被其他进程占用，可临时改用：

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

然后访问 http://localhost:8001 。

## 配置说明（.env）

| 变量                               | 必填 | 说明                                                          |
| ---------------------------------- | ---- | ------------------------------------------------------------- |
| OPENROUTER_API_KEY                 | 推荐 | 填入后 AI 自动评估热度分数，默认模型 `deepseek/deepseek-v3.2` |
| AI_MODEL                           | 可选 | AI 模型，默认 `deepseek/deepseek-v3.2`                        |
| NOTIFY_EMAIL                       | 可选 | 高热话题邮件通知收件地址                                      |
| SMTP_HOST / PORT / USER / PASSWORD | 可选 | SMTP 邮件配置                                                 |
| WEBHOOK_URL                        | 可选 | Webhook 通知（飞书/钉钉等）                                   |
| SCAN_INTERVAL_MINUTES              | 可选 | 扫描间隔，默认 60 分钟                                        |
| NOTIFY_HEAT_THRESHOLD              | 可选 | 通知热度阈值，默认 7                                          |
| MIN_HEAT_SCORE                     | 可选 | 最低入库热度，默认 7，低于该值的内容不会进入数据库            |

## 主要功能

- 热点雷达：查看 AI 热点流，支持最新/热度/命中优先/未通知优先排序，以及热度、来源、命中模式、时间范围、标签、关键词搜索等组合筛选；首页顶部主操作按钮为“刷新热点”
- 热点详情卡片：展示来源类型、是否已推送、发布时间/抓取时间、互动指标、AI 相关性分数；展开后可查看原始描述、AI 相关性理由、来源专属指标与原始链接
- 监控词：管理关键词与平台账号，支持状态、类型、平台、创建时间、搜索等列表筛选，查看命中历史与最近检查时间；页面以“监控词编排台”形式组织录入与筛选
- 命中记录详情：关键词命中列表与热点页共享同一套详情卡片，也支持批量展开/收起
- 设置页：配置 OpenRouter、扫描频率、最低入库热度、通知阈值、SMTP 邮件；首页上方增加控制室概览卡片
- 刷新热点：触发一次后台全量扫描，页面会根据真实扫描状态自动刷新
- 状态提示：顶部显示调度器状态、扫描结果提示、最近扫描时间和下次调度时间

### 筛选体验说明

- 热点页和监控词页的筛选状态会同步到 URL，刷新页面后可保留当前视图
- 热点页的来源和标签筛选默认折叠，点击“更多来源”或“更多标签”后再展开完整列表
- 热点页“总热点”统计使用状态接口的真实总数，不再受前端列表 `limit=100` 截断影响
- 当数据源无法提供真实发布时间时，卡片会明确显示“未获取真实发布时间”，避免把抓取时间误当发布时间

## 重新构建前端

```bash
cd frontend
npm install
npm run build
```

## 数据源

默认从以下地址抓取：

- **RSS 聚合**：OpenAI Blog、Google DeepMind、HuggingFace、TechCrunch AI、VentureBeat AI、机器之心、量子位
- **X/Twitter AI 热点**：通过 Nitter 实例抓取 AI 领域关键账号动态；当 Nitter 不可用时自动回退到 Google News 搜索 AI+Twitter 相关内容
- **Hacker News** Top Stories（按评分过滤）
- **Reddit**：r/MachineLearning、r/artificial（JSON API）
- **GitHub Trending**：每日热门仓库
- **搜索引擎**：DuckDuckGo + Bing News（按关键词）

### 内容质量保障

- **48 小时时效性过滤**：发布时间超过 48 小时的内容在 AI 分析前自动丢弃
- **AI 时效性评分**：AI 分析提示词明确要求区分时效性，旧闻/科普/广告类内容评分 1-3 分，不会入库
- **时间输出统一为 UTC**：后端 API 统一返回带 `Z` 的时间字符串，避免前端显示慢 8 小时等时区偏差
- **发布时间保守回退**：只有抓取源明确给出发布时间时才保存 `published_at`，否则保持为空并在前端回退展示抓取时间
