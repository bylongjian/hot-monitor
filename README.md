# hot-monitor / HotPulse 快速启动

> AI 编程博主专属热点监控工具，自动发现 AI 领域热点并推送通知。
> 默认 AI 模型：`deepseek/deepseek-v3.2`（via OpenRouter）

## 前置要求

- Python 3.11+
- Node.js 18+（仅首次构建前端需要）
- Git Bash（推荐，VS Code 默认终端已配置）

## 开发环境要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Python | 3.11+ | 后端运行时 |
| Node.js | 18+ | 前端构建（首次） |
| Git / Git Bash | 任意 | 推荐作为 VS Code 终端，Shell 脚本兼容性更好 |

> **VS Code 终端配置**：项目使用 Git Bash 作为默认终端。安装 Git 后，VS Code `settings.json` 中已写入：
> ```json
> "terminal.integrated.defaultProfile.windows": "Git Bash",
> "terminal.integrated.profiles.windows": {
>   "Git Bash": { "path": "D:\\Git\\installed\\bin\\bash.exe", "args": ["-i", "-l"] }
> }
> ```
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

## 配置说明（.env）

| 变量 | 必填 | 说明 |
|------|------|------|
| OPENROUTER_API_KEY | 推荐 | 填入后 AI 自动评估热度分数，默认模型 `deepseek/deepseek-v3.2` |
| AI_MODEL | 可选 | AI 模型，默认 `deepseek/deepseek-v3.2` |
| NOTIFY_EMAIL | 可选 | 高热话题邮件通知收件地址 |
| SMTP_HOST / PORT / USER / PASSWORD | 可选 | SMTP 邮件配置 |
| WEBHOOK_URL | 可选 | Webhook 通知（飞书/钉钉等） |
| SCAN_INTERVAL_MINUTES | 可选 | 扫描间隔，默认 60 分钟 |
| NOTIFY_HEAT_THRESHOLD | 可选 | 通知热度阈值，默认 7 |

## 重新构建前端

```bash
cd frontend
npm install
npm run build
```

## 数据源

默认从以下地址抓取：
- OpenAI / Anthropic / HuggingFace / Google AI / DeepMind RSS
- Hacker News Top Stories
- DuckDuckGo 搜索（按关键词）
