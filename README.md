# 电池化学料供需管理系统 Demo

面向电池正极 / 负极 / 电解液主材扩产业务的全栈 Demo。后端 FastAPI + SQLAlchemy + SQLite，前端 React 19 + Vite 8 + TypeScript。四大板块：扩产跟踪、风险、任务、通知。

---

## 近期更新（2026-07）

| 模块 | 变更 |
|---|---|
| 扩产计划 CRUD | 时间轴页面支持「新增 / 归档」扩产计划；新建可一键按模板自动生成 8 阀点 + 6 审批 + 6 试车 + 4 爬坡共 24 个子节点；删除改为软删除（打 `archived_at` 时间戳，列表自动过滤，数据不丢） |
| 编辑计划 · 子节点计划时间 | 新增「子节点计划时间」编辑面板，4 个 L2 模块（阀点 / 审批 / 试车 / 爬坡）共 24 个计划日期可一次性手动微调，底部「保存全部」按钮按 dirty 标记批量 PATCH |
| 佐证预览内联认证 | 在佐证预览模态框中为「供应商上传 + 待认证」佐证直接提供「通过认证 / 退回供应商」按钮，覆盖全部 4 个 L2 模块，避免来回跳转 |
| 里程碑跨度 KPI | 「里程碑跨度」hint 改为「最远至 YYYY年QX · YYYY/MM」格式（季度 + 月份），原显示停留在「YYYY-Q」半截 |
| 新增表单布局 | 「新增扩产计划」表单调整：计划名称独占一行，物料 / 供应商并排，移除「当前阶段」字段（统一为「立项」自动推断） |
| 关键审批事项 | 新增 `approval` 表 + 6 项标准审批（环评/安评/排污/节能/危化品/建设用地），状态由后端按日期推算（已完成/进行中/未开始/已逾期） |
| 证据再认证 | 上传证据支持「待认证 / 已认证 / 已退回」三态，采购/质控可在线驳回并要求重新上传 |
| 证据预览 | 关键审批 / 试车验证 / 量产爬坡 / 证据档案四处的佐证 chip 改为可点击，直接内嵌预览图片 / PDF |
| 风险自动重算 | 取消计划级风险的手动覆盖入口，扩产风险由 8 个阀点状态自动计算（已完成/总数 × 100%） |
| 阀点字段改名 | 阀点明细内的「计划到货日期 / 实际到货日期」改名为「计划完成日期 / 实际完成日期」 |
| 日期选择器 | 移除「今天 / 本月 / 按月 / 按日」按钮组，回到原生 `<input type="date">`；保留一个轻量的「×」清除按钮，并在清除瞬间给出 1.2s 的「✓ 已清除」反馈 |

---

## 目录

- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [快速启动](#快速启动)
- [公司环境离线安装](#公司环境离线安装)
- [默认账号](#默认账号)
- [常用命令](#常用命令)
- [模块功能说明](#模块功能说明)
- [页面路由](#页面路由)
- [数据模型](#数据模型)
- [API 概览](#api-概览)
- [里程碑 8 阶段模板](#里程碑-8-阶段模板)
- [试车验证 6 项标准](#试车验证-6-项标准)
- [量产爬坡 4 阶段模板](#量产爬坡-4-阶段模板)
- [常见问题](#常见问题)

---

## 技术栈

**后端**
- Python 3.9+ / FastAPI 0.115+ / Uvicorn
- SQLAlchemy 2.x（`Mapped[T]` 风格）
- SQLite 单文件数据库（`backend/data/app.db`）
- PBKDF2-SHA256 密码哈希 + HttpOnly Cookie 会话

**前端**
- React 19 + React Router 7 + Vite 8
- TypeScript + Lucide-React 图标
- 原生 CSS（`src/styles/globals.css`），无 UI 框架

---

## 目录结构

```
supplier_ramp/
├── backend/                       # FastAPI 后端
│   ├── app/
│   │   ├── api/                   # 路由：auth / expansion / risks / tasks / notifications
│   │   ├── models/                # SQLAlchemy 模型
│   │   ├── services/              # 风险引擎、里程碑模板、审批/验证/爬坡常量
│   │   ├── schemas/               # Pydantic 模型
│   │   ├── config.py              # 配置（默认账号、数据库路径等）
│   │   ├── db.py                  # SQLAlchemy 引擎 + init_db
│   │   ├── main.py                # FastAPI 入口
│   │   └── security.py            # 密码哈希 + 会话
│   ├── data/                      # SQLite 文件 + 上传目录（首次启动后生成）
│   ├── seed.py                    # 种子数据
│   └── requirements.txt
├── src/                           # React 前端
│   ├── pages/                     # 三大板块页面（expansion / risks / tasks）
│   ├── components/                # 通用组件
│   │   ├── ui/                    # DatePickerField / Modal / KpiCard / StatusBadge …
│   │   └── expansion/             # PlanEditModal / MilestoneEditModal / ApprovalEditModal
│   │                             # CommissioningEditModal / RampEditModal
│   │                             # EvidenceChipList / EvidencePreviewModal / EvidenceUploadModal / EvidenceVerifyModal
│   ├── lib/                       # api、里程碑/审批/验证/爬坡常量与状态映射、editOptions
│   ├── styles/globals.css         # 全局样式
│   ├── App.tsx                    # 路由
│   └── types.ts                   # 前端类型
├── scripts/                       # 验证/截图脚本（playwright-core）
├── package.json
└── vite.config.ts
```

---

## 环境要求

| 工具 | 版本 |
|---|---|
| Node.js | ≥ 18 |
| Python | ≥ 3.9 |
| npm | ≥ 9 |

后端虚拟环境 `backend/.venv` 在首次启动脚本中自动创建（如已存在则跳过）。

---

## 快速启动

> 一条命令同时拉起后端 API（8000）和前端 dev server（5173）。

```bash
# 1. 安装前端依赖
npm install

# 2. 重建数据库 + 灌入种子数据（首次或想重置时执行）
npm run db:reset

# 3. 启动前后端
npm run dev
```

启动成功后：

- 前端页面：http://localhost:5173
- 后端 API：http://localhost:8000
- API 文档（Swagger）：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

---

## 公司环境离线安装

> 公司网络下 `npm install` 经常超时（卡在 esbuild / prisma 二进制下载）。
> 解决思路：把已经在本地下载好的依赖打成压缩包推到 git，公司 clone 后解压 + `npm rebuild` 即可（只下载约 50MB Windows 原生二进制，秒级完成）。

### 一次性维护（在 Mac 上）

当 `package.json` / `package-lock.json` 有变更，或想刷新依赖时：

```bash
# 1. 重新安装
npm install

# 2. 重新打包（排除 darwin 原生二进制）
tar -czf frontend-deps-$(date +%F).tar.gz \
  --exclude='*darwin-arm64*' \
  --exclude='node_modules/fsevents' \
  --exclude='node_modules/.prisma' \
  --exclude='node_modules/.cache' \
  node_modules

# 3. 提交
git add frontend-deps-*.tar.gz setup-windows.bat
git commit -m "chore: 更新离线依赖压缩包"
git push
```

### 公司电脑安装（Windows）

**方式 A：一键脚本（推荐）**

```cmd
git pull
setup-windows.bat
```

脚本会自动：定位压缩包 → 备份旧 `node_modules` → 解压 → `npm rebuild` 拉 Windows 原生二进制 → 清理备份。

**方式 B：手动执行**

```powershell
# PowerShell（Windows 10 1809+ 自带 tar）
tar -xzf frontend-deps-2026-07-16.tar.gz
npm rebuild
```

### 体积说明

| 文件 | 大小 | 内容 |
|---|---|---|
| `frontend-deps-2026-07-16.tar.gz` | ~75MB | 27,624 项跨平台 JS 包（不含 darwin 原生二进制） |

公司 `npm rebuild` 只需下载 esbuild / rolldown / prisma / lightningcss / typescript 的 Windows 版原生包（约 50MB），建议配置镜像加速：

```bash
npm config set registry https://registry.npmmirror.com
```

---

## 默认账号

| 用户名 | 密码 |
|---|---|
| `admin` | `admin123456` |

可在 `backend/app/config.py` 中修改 `admin_username` / `admin_password`，或通过环境变量 `APP_ADMIN_USERNAME` / `APP_ADMIN_PASSWORD` 覆盖。

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 同时启动后端 + 前端（推荐开发时使用） |
| `npm run dev:api` | 只启动后端（端口 8000） |
| `npm run dev:web` | 只启动前端（端口 5173） |
| `npm run db:seed` | 仅灌入种子数据（不删表） |
| `npm run db:reset` | **删除 SQLite 文件后重新建表 + 灌种子** |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run build` | 前端生产构建 |

---

## 模块功能说明

### 扩产跟踪（4 个视图）

#### ① 进度总览 `/board/expansion/view/overview`
按品类（正极 / 负极 / 电解液）分组展示扩产卡片。每张卡片包含供应商、物料、所处阶段、进度条、风险等级标签、关联风险类型、最近更新时间。用于**业务全景一屏看清**。

#### ② 里程碑时间轴 `/board/expansion/view/timeline`
**本系统的核心视图**，整合甘特图 + 4 大 L2 子模块。

**顶部甘特图（横向对比）**：
- 5 个扩产计划横向铺开，统一时间轴
- 每行 8 个**阀点圆点**，按 `expectedArrival` 实际日期在轨道上分布（不是按模板顺序等分）
- 圆点颜色 + 图标 = 状态：✓ 已完成（绿）/ ◐ 进行中（橙）/ ○ 待开始（白虚线）/ ! 已逾期（红，脉冲）
- 圆点序号 1-8 = 阀点编号
- 蓝色「今」标记 = 今日位置
- **点击项目名可跳转**到下方对应的计划组（平滑滚动到 L2 模块）

**底部每个计划的 L2 平行四模块**：

| L2 模块 | 数据来源 | 关键字段 | 业务价值 |
|---|---|---|---|
| **全部阀点明细** | `expansion_item`（每计划 8 张卡片） | 阀点序号 / 名称 / 状态 / 计划&实际日期 / 供应商&采购侧 | 一张卡片看清一个阀点的双方责任与时间偏差 |
| **关键审批事项进度** | `approval`（6 项标准审批） | 审批类型 / 审批机构 / 提交/预计批复/实际批复日期 / 状态 / 备注 | 监控政府批文进度，悬浮查看准备周期（环评 6-18 个月等） |
| **试车验证记录** | `commissioning_item`（6 项验证） | 目标值 / 实测值 / 合格判定 / 验证日期 / 备注 | 设备调试到量产前的质量关卡，留痕可追溯 |
| **量产爬坡计划跟踪** | `ramp_item`（4 阶段爬坡） | 阶段 / 负荷率 / 目标产能 / 计划周期 / 实际达成 / 达标状态 | 监控从 40% 负荷到 100% 全产能的爬坡节奏 |

L2 模块中所有日期字段都使用统一的 `DatePickerField`（原生 `<input type="date">` + 右侧 × 清除按钮），清除瞬间会闪现 1.2s 的绿色「✓ 已清除」反馈，避免和未填状态混淆。

#### ③ 证据档案 `/board/expansion/view/evidence`
按计划分组的时间线，展示每个阀点上传的设备到货照、合同、付款凭证等。每个佐证文件支持三种状态：

- **待认证**（橙色 chip）— 上传后等待采购/质控审核
- **已认证**（绿色 chip）— 审核通过，作为该阀点完成的依据
- **已退回**（红色 chip + 退回原因）— 审核驳回，需重新上传

点击任何佐证 chip 会打开内嵌预览（图片直接显示、PDF 用 iframe 渲染），不需要下载到本地。

### 风险（4 个视图）

#### ① 风险总览 `/board/risks/view/overview`
表格形式列出所有风险，含类型、等级、状态、描述、影响范围、关联物料/供应商、措施数。用于**风险清单一览**。

#### ② 风险按类型分布 `/board/risks/view/by-type`
按风险类型（质量 / 供应 / 合规 / 物流 等）分组，每个分组内按严重度倒排。用于**按主题归口**。

#### ③ 风险升级路径 `/board/risks/view/escalation`
三栏对照：待升级 / 升级中 / 已升级。每个风险展示其下挂措施、措施对应的任务、任务当前进度。用于**风险升级流转追溯**。

#### ④ 风险闭环统计 `/board/risks/view/closure`
已关闭风险列表 + 平均闭环天数 + 按类型分布。用于**回顾风险处置效率**。

### 任务（4 个视图）

#### ① 我的待办 `/board/tasks/view/my-todo`
当前登录人负责的所有进行中任务，按截止日期排序，逾期标红。**日常工作入口**。

#### ② 逾期仪表盘 `/board/tasks/view/overdue`
所有逾期任务聚焦，含逾期天数、风险等级、关联物料/供应商、附件数。用于**催办与升级**。

#### ③ 任务升级路径 `/board/tasks/view/escalation`
提醒 / 逾期 / 已升级 三栏对照。展示任务状态流转与负责人变更。

#### ④ 措施闭环统计 `/board/tasks/view/closure`
已关闭任务列表 + 平均处理时长 + 按优先级分布。

---

## 页面路由

### 扩产跟踪（`/board/expansion`）

| 路径 | 视图 |
|---|---|
| `/board/expansion/view/overview` | 进度总览（按品类分组） |
| `/board/expansion/view/timeline` | 里程碑时间轴（8 阀点 + 政府批文 + 试车 + 爬坡） |
| `/board/expansion/view/evidence` | 证据档案 |

### 风险（`/board/risks`）

| 路径 | 视图 |
|---|---|
| `/board/risks/view/overview` | 风险总览 |
| `/board/risks/view/by-type` | 风险按类型分布 |
| `/board/risks/view/escalation` | 风险升级路径 |
| `/board/risks/view/closure` | 风险闭环统计 |

### 任务（`/board/tasks`）

| 路径 | 视图 |
|---|---|
| `/board/tasks/view/my-todo` | 我的待办 |
| `/board/tasks/view/overdue` | 逾期仪表盘 |
| `/board/tasks/view/escalation` | 任务升级路径 |
| `/board/tasks/view/closure` | 措施闭环统计 |

---

## 数据模型

### 核心实体

- **Supplier**（供应商）：代码、名称、简称、品类、联系方式、所在地、合作年限
- **Material**（物料）：名称、类型（CATHODE / ANODE / ELECTROLYTE / BINDER / ADDITIVE）、月供需、库存、安全库存月数、是否单点
- **ExpansionPlan**（扩产计划）：物料、供应商、起止日期、目标产能、已投/总 CAPEX、阶段、进度、状态、`archived_at`（软删除时间戳，列表默认过滤为 NULL）
- **ExpansionItem**（阀点）：计划 id、类型、名称、供应商、采购方、状态、计划/实际到货日期、所属里程碑 key/order
- **Approval**（审批）：计划 id、审批类型 key、提交/预计批复/实际批复日期、备注；状态由后端按日期推算（已完成 / 进行中 / 未开始 / 已逾期）
- **CommissioningItem**（试车验证项）：计划 id、验证类型、目标值、实测值、合格判定（PASS/FAIL/IN_PROGRESS/PENDING）、验证日期、备注
- **RampItem**（量产爬坡项）：计划 id、阶段、目标负荷率、目标产能、计划周期、实际确认时间、实际达成产能、达标状态、备注
- **EvidenceChain**（证据档案）：计划 id、分类、文件名、上传者、上传时间、URL
- **Risk / Action / FollowTask / TaskUpdate / Attachment**：风险与任务相关

### 6 项标准审批事项

| 类型 Key | 名称 | 审批机构 |
|---|---|---|
| `EIA` | 环境影响评价（环评） | 生态环境局 |
| `SAFETY_PRE` | 安全预评价（安评） | 应急管理局 |
| `EMISSION_PERMIT` | 排污许可证 | 生态环境局 |
| `ENERGY_REVIEW` | 节能审查 | 发改委 |
| `HAZMAT_PRODUCTION` | 危险化学品生产许可 | 应急管理局 |
| `LAND_USE` | 建设用地规划许可 | 自然资源局 |

---

## API 概览

所有接口需要登录后的 Cookie 会话（除 `/api/auth/login` 和 `/api/health`）。

| 模块 | 接口 |
|---|---|
| 认证 | `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me` |
| 扩产 | `GET /api/boards/expansion/views/{overview\|timeline\|evidence}` |
| 扩产 CRUD | `GET /api/expansion-plans`、`POST /api/expansion-plans`（可一并生成 4 个 L2 模块子节点）、`DELETE /api/expansion-plans/{id}`（软删除，打 `archived_at`）、`GET /api/expansion-meta`（供前端表单使用） |
| 扩产编辑 | `PATCH /api/expansion-plans/{id}`、`PATCH /api/expansion-items/{id}`、`PATCH /api/approvals/{id}`、`PATCH /api/commissionings/{id}`、`PATCH /api/ramps/{id}`、`POST /api/evidence` |
| 风险 | `GET /api/boards/risks/views/{overview\|by-type\|escalation\|closure}` |
| 任务 | `GET /api/boards/tasks/views/{my-todo\|overdue\|escalation\|closure}` |
| 通知 | `/api/notifications/*` |

完整 Swagger 文档见 `http://localhost:8000/docs`。

`/api/boards/expansion/views/timeline` 一次返回所有 4 个 L2 模块的数据（approvals / commissionings / ramps / items），前端在 Timeline.tsx 内统一渲染。

---

## 里程碑 8 阶段模板

每个扩产计划都走完以下 8 个标准阶段：

| # | Key | 名称 |
|---|---|---|
| 1 | `FEASIBILITY` | 需求确认与可行性研究 |
| 2 | `EIA` | 项目立项与审批 |
| 3 | `EQUIPMENT_ORDER` | 工艺设计与工程 |
| 4 | `CIVIL` | 政府审批与许可 |
| 5 | `EQUIPMENT_DELIVERY` | 施工建设与安装 |
| 6 | `INSTALLATION` | 试车验证与考核 |
| 7 | `TRIAL_PRODUCTION` | 客户认证与审核 |
| 8 | `FULL_PRODUCTION` | 量产爬坡与优化 |

状态色：🟢 已完成 / 🟠 进行中 / ⚪ 待开始 / 🔴 已逾期

---

## 试车验证 6 项标准

设备调试到量产前的 6 个必过关卡，每项含目标值、实测值、合格判定（PASS/FAIL/IN_PROGRESS/PENDING）、验证日期：

| # | Key | 名称 | 验证标准 |
|---|---|---|---|
| 1 | `SINGLE_TRIAL` | 单机试车 | 设备空载运行2h无异常 |
| 2 | `INTEGRATED_TRIAL` | 联动试车 | 全流程联动运行8h无异常 |
| 3 | `FEED_TRIAL` | 投料试车 | 按配方投料，产出合格产品 |
| 4 | `LOAD_TEST_72H` | 72h满负荷考核 | 连续72h达到设计产能的90%以上 |
| 5 | `PRODUCT_QUALITY` | 产品质量验证 | 产品检测指标全部符合规格 |
| 6 | `OEE_VERIFICATION` | OEE达标验证 | OEE≧75%（爬坡期基准） |

---

## 量产爬坡 4 阶段模板

从 40% 负荷爬到 100% 全产能的标准 4 阶段：

| # | 阶段 | 目标负荷率 | 计划周期 |
|---|---|---|---|
| 1 | `Phase1` | 40% | 第1-2个月 |
| 2 | `Phase2` | 60% | 第3-4个月 |
| 3 | `Phase3` | 80% | 第5-6个月 |
| 4 | `Phase4` | 100% | 第7-8个月 |

每阶段记录：目标产能（吨/月）、实际确认时间、实际达成产能（自动显示达成率）、达标状态（已达标 / 未达标 / 进行中 / 待开始）。

---

## 常见问题

**Q: 改了后端模型但报 `no such column`？**
A: `init_db` 走的是 `create_all`，不会给已存在的表加列。需要新增字段时执行 `npm run db:reset` 重建库（会清掉数据）。

**Q: uvicorn 没热加载到最新代码？**
A: 手动重启：`pkill -f uvicorn && npm run dev:api`，或彻底 `pkill -f "uvicorn|vite"` 后 `npm run dev`。

**Q: 前端看不到登录后的 Cookie？**
A: 后端 CORS 已限制为 `localhost:5173` / `127.0.0.1:5173`，不要换端口或换 host。

**Q: 想重置全部数据？**
A: `npm run db:reset` 会删除 `backend/data/app.db` 并重新灌入种子数据。

**Q: 上传文件保存在哪？**
A: `backend/data/uploads/`，前端通过 `/uploads/{文件名}` 直链访问。

**Q: 甘特图上的圆点是怎么定位的？**
A: 每个圆点按该阀点在该计划下的 `expectedArrival` 实际日期，在全局时间轴（最早计划开始 → 最晚计划结束）上定位；不是按模板顺序等分。所以同一阀点（如阀点 3）在不同计划的位置可能差很远。

**Q: 为什么 Timeline 页面的 L2 模块有 4 个？**
A: 扩产管理的核心闭环是：里程碑节点 → 政府批文 → 试车验证 → 量产爬坡。4 个模块串起来覆盖从立项到达产的全过程。