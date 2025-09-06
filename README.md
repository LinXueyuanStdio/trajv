# Trajectory Browser

> 🚀 Trajectory Browser: Visualizing and navigating agent rollout trajectory files seamlessly.

> 🚀 轨迹浏览器：浏览 agent rollout 轨迹文件

⭐ 如果这个项目对您有帮助，请给它一个星星！

## 📖 项目简介

Trajectory Browser 是一个简洁高效的在线工具，专为可视化和浏览 RL/AI agent rollout 轨迹（JSON/JSONL 文件）而设计。用户可通过拖拽或选择本地文件，快速查看、分析和导出轨迹数据，极大提升数据理解与调试效率。

## ✨ 主要特性

- 🗂️ **多文件支持**：支持批量拖拽或选择多个 JSONL 轨迹文件，自动过滤无效文件。
- 🔍 **步骤详情浏览**：分步查看每个 step 的输入、输出、工具调用、推理参数、元信息等，结构化展示。
- 🧩 **富视图与 JSON 切换**：支持富视图、原始 JSON、编辑模式自由切换，便于数据理解与修改。
- 📝 **内置编辑与对比**：可直接编辑 step 内容，支持与原始数据对比，便捷追踪修改。
- 📤 **导出功能**：支持导出当前 step 或完整轨迹为 JSON 文件。
- 🔦 **高亮与搜索**：支持高亮答案、结构展开、内容搜索、关键字段标记。
- 🧭 **多语言界面**：自动适配中英文界面。
- 💡 **响应式设计**：适配桌面与移动端，界面美观现代。

## 🛠️ 技术栈

- **前端**：原生 HTML/CSS/JavaScript
- **样式**：自定义 CSS，深色主题，响应式布局
- **无依赖**：无需安装任何依赖，开箱即用

## 🚀 快速开始

### 在线使用

直接用浏览器打开 `index.html` 文件即可，无需后端。

### 本地运行

1. 克隆项目到本地：
	```bash
	git clone https://github.com/LinXueyuanStdio/trajv.git
	cd trajv
	```
2. 用浏览器打开 `index.html`，或使用本地服务器：
	```bash
	# Python 3
	python -m http.server 8000
	# Node.js
	npx http-server
	```
3. 访问 `http://localhost:8000`

## 📝 使用说明

1. **载入轨迹文件**：
	- 拖拽 JSONL 文件到页面指定区域，或点击按钮选择文件。
	- 支持批量选择，自动跳过非 JSONL 文件。
2. **浏览与分析**：
	- 左侧选择不同 step，右侧查看详细内容（输入、输出、工具、参数、meta 等）。
	- 支持富视图、JSON、编辑三种模式切换。
	- 可高亮答案、展开结构、搜索内容。
3. **编辑与导出**：
	- 可直接编辑 step 内容，支持格式化与恢复原始。
	- 支持导出当前 step 或完整轨迹为 JSON 文件。

## 🎯 支持的数据格式

- **JSONL**：每行一个 JSON 对象，常用于 RL/AI 轨迹。
- **JSON**：支持部分 JSON 文件（需为数组或对象）。

## 🔧 高级功能

- **结构化详情面板**：分区展示 tools、inference_args、meta 等关键字段。
- **多步跳转与搜索**：快速定位目标 step，支持内容搜索与跳转。
- **自适应换行与横向滚动**：大数据结构浏览更友好。
- **全屏与还原**：编辑器支持全屏、还原视图。

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📜 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 📧 Email: linxy59@mail2.sysu.edu.cn
- 🐛 Issues: [GitHub Issues](https://github.com/LinXueyuanStdio/trajv/issues)

---

⭐ 如果这个项目对您有帮助，请给它一个星星！
