# HotPulse Frontend

前端基于 React 19 + TypeScript + Vite，负责热点雷达、监控词管理和系统设置界面。

## 运行方式

开发模式：

```bash
cd frontend
npm install
npm run dev
```

生产构建：

```bash
cd frontend
npm install
npm run build
```

构建产物位于 `frontend/dist`，由后端 `backend/main.py` 统一托管。

## 当前界面能力

- Dashboard 热点流：支持最新发现、热度综合、来源排序和热度筛选
- 关键词页：支持关键词与账号监控、启停、删除、查看命中记录
- 设置页：支持 OpenRouter、扫描间隔、最低入库热度、通知阈值、SMTP 配置
- 扫描状态联动：前端根据后端真实扫描状态自动刷新，而不是固定盲刷
- 时间展示统一：热点时间、关键词检查时间、顶部状态时间都采用同一套产品化时间格式

## UI 设计说明

- 默认深色科技风，品牌名为 `HotPulse`
- 使用 Tailwind CSS、Framer Motion 和定制 UI 组件
- 常驻动画已做减负，并兼容 reduced motion
- 时间文案采用双层结构：主文案显示相对时间，副文案显示绝对时间，悬停显示完整时间

## 目录说明

- `src/pages`：页面级组件
- `src/components`：布局、热点卡片和 UI 组件
- `src/api/client.ts`：接口类型与请求封装
- `src/lib/utils.ts`：样式合并和时间格式化工具
