# **WeiboChat Insight Dashboard**

## 1. 项目概述

**目标：**
构建一个基于 `data/processed/*.ndjson` 的可交互 Web 仪表盘，用于离线分析微博群聊消息。系统聚焦展示消息数量、类型分布、活跃时间段、用户行为、红包统计等。
**特性：**
纯离线运行，无数据库依赖，后端以 Flask 提供聚合数据 API，前端基于 ECharts + SnapDOM 构建可导出图表的分析页面。

---

## 2. 技术栈与架构

**后端：**

* Python 3 + Flask
* pandas 用于数据加载与聚合（读取 `processed/*.ndjson`）
* 简单 JSON 缓存机制（内存或 pickle）

**前端：**

* HTML / TailwindCSS / 原生 JS
* ECharts 负责所有图表渲染与单图导出
* SnapDOM (`https://unpkg.com/@zumer/snapdom/dist/snapdom.min.js`) 负责整块截图与下载
* 前端页面宽度 ≈ 900 px，每张图表放入一个 card 容器

**可复用导出方案：**

* 单图：ECharts `toolbox.saveAsImage`
* 整页/整区块：SnapDOM → `.toPng()` 或 `.download()`

---

## 3. 页面布局与交互设计

**整体布局：**
容器宽度约 900 px，纵向排列多张 card，每 card 一张图表或一组统计信息。
顶部保留统计信息总览，下方为图表区，最底部为表格区。

**导出按钮：**
页面右上角放置一个“下载此页面截图”按钮，绑定 SnapDOM 操作：

```js
const el = document.querySelector('#dashboard');
const result = await snapdom(el);
await result.download({ format: 'jpg', filename: 'weibochat_dashboard' });
```

---

## 4. 图表与组件定义

### 4.1 汇总指标区（顶部 Summary Cards）

以四个小 card 横排展示关键指标：

* **总消息数**
* **总用户数**
* **总红包金额**
* **平均消息长度（token）**

### 4.2 日度趋势图（折线）

* 横轴：日期
* 纵轴：消息数
* 第二纵轴：红包总额（面积堆叠）
* 支持区间缩放（dataZoom）

### 4.3 周×时段热力图

* 横轴：小时 (0–23)
* 纵轴：星期 (一到日)
* 颜色深浅表示消息数量

### 4.4 Top 用户排行条形图

* 横轴：消息数
* 纵轴：用户名
* 点击可展开个人小趋势（另绘一张折线）

### 4.5 消息类型占比分析条（“手机储存条”式）

* 横向 100% 条，按消息类型（文字、图片、红包感谢等）划分段落，不同颜色表示不同类型。
* 悬浮提示各类型数量与占比。
* 下方显示对应表格（参见 4.10）。

### 4.6 Web vs Mobile 使用占比（堆叠折线）

* 横轴：时间（日）
* 纵轴：比例
* 堆叠区域显示 Web 与 Mobile 两端发消息占比。

### 4.7 消息长度分布（直方图）

* 横轴：token 数区间
* 纵轴：消息数量
* 展示群聊中消息长度的总体分布。

### 4.8 红包统计图（散点 + 累计）

* x 轴：时间（日）
* y 轴1：红包金额（散点）
* y 轴2：累计红包金额（折线）

### 4.9 活跃时间热力矩阵

* 横轴：用户
* 纵轴：日期
* 颜色深度：该用户当日消息数

### 4.10 消息类型汇总表格

表格列示：

| 消息类型 | 数量    | 占比  | 示例          |
| ---- | ----- | --- | ----------- |
| 文本   | 12345 | 76% | “测试消息…”     |
| 图片   | 2450  | 15% | “餐桌照片…”     |
| 红包感谢 | 1350  | 9%  | “0.52元 @某人” |

表格与分析条保持同步更新。

---

## 5. 后端 API 设计

| Endpoint               | Method | 说明                           |
| ---------------------- | ------ | ---------------------------- |
| `/api/summary`         | GET    | 返回整体统计（总消息、用户、红包金额、平均 token） |
| `/api/daily`           | GET    | 返回日度趋势数据                     |
| `/api/hourly_heatmap`  | GET    | 返回周×小时热力数据                   |
| `/api/top_users`       | GET    | 返回前 N 个发言者                   |
| `/api/message_types`   | GET    | 返回各类型数量与占比                   |
| `/api/redpackets`      | GET    | 返回红包金额时序                     |
| `/api/source_ratio`    | GET    | 返回 Web/Mobile 比例时序           |
| `/api/token_histogram` | GET    | 返回 token 分布数据                |

所有接口返回 JSON 格式，后端使用 pandas 或 collections.Counter 从 `processed/*.ndjson` 聚合结果并缓存。

---

## 6. 导出功能（SnapDOM 集成）

**单图导出：**
ECharts 自带工具栏按钮。

**整页导出：**

```html
<script src="https://unpkg.com/@zumer/snapdom/dist/snapdom.min.js"></script>
<script>
async function downloadDashboard() {
  const el = document.querySelector('#dashboard');
  const result = await snapdom(el);
  await result.download({ format: 'jpg', filename: 'weibochat_dashboard' });
}
</script>
```

按钮样式：右上角固定定位，文字“📸 下载快照”。

---

## 7. 数据来源与缓存策略

* 数据文件来源：`data/processed/all.ndjson`, `data/processed/tk_all.ndjson`。
* 后端启动时一次性加载并缓存。
* 每个 API 首次请求计算并保存 JSON 缓存，后续直接读取。
* 更新机制：重新执行 `preprocess.py` 后手动重启 Flask 服务。

---

## 8. 运行方式

```bash
# 1. 预处理
python preprocess.py --tokenizer-dir ./deepseek_v3_tokenizer data/all.ndjson

# 2. 启动后端
python app.py

# 3. 访问前端
http://localhost:5000
```

---

## 9. 非功能性要求

* 浏览器兼容：Chrome/Edge 最新版本
* 响应时间：所有 API 请求 < 200 ms（缓存命中）
* 截图生成 < 2 s
* 页面宽度 900 px，自适应居中

---

## 10. 交付成果

* `preprocess.py` 数据清洗脚本（已完成）
* `app.py` 后端 Flask 服务
* `templates/index.html` 仪表盘前端
* `/static/js/dashboard.js` 前端逻辑（含 ECharts 与 SnapDOM 导出）
* `/static/css/style.css` 样式（Tailwind 或自定义）
