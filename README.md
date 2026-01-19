# Easy Mermaid - 可视化流程图编辑器

一个基于 Web 的 Mermaid 流程图可视化编辑器，支持实时预览、节点样式编辑和多种导出格式。

**在线体验**: [https://san-tian.github.io/easy-mermaid/](https://san-tian.github.io/easy-mermaid/)

## 功能特性

- **实时预览** - 左侧编辑 Mermaid 代码，中间实时渲染流程图
- **可视化编辑** - 点击节点/连线直接编辑样式、标签、形状
- **节点操作** - 添加节点、删除节点、插入连接、修改形状
- **样式自定义** - 调整填充色、边框色、边框宽度、字体颜色
- **多种方向** - 支持左右、右左、上下、下上四种布局方向
- **图表模板** - 内置流程图、时序图、类图、状态图、ER图模板
- **导出功能** - 支持导出 PNG、SVG 格式，支持复制代码
- **缩放控制** - Ctrl + 滚轮缩放预览区域
- **本地持久化** - 自动保存编辑内容到浏览器

## 技术栈

- React 19 + TypeScript
- Vite 7
- Tailwind CSS v4
- Zustand (状态管理)
- Monaco Editor (代码编辑器)
- Mermaid 11 (图表渲染)

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 部署到 GitHub Pages
npm run deploy
```

## 使用说明

1. 在左侧编辑器中编写 Mermaid 语法的流程图代码
2. 中间区域实时显示渲染结果
3. 点击图中的节点可在右侧面板编辑样式
4. 点击连线标签可编辑连线文字
5. 使用顶部工具栏切换方向、添加节点、导出图片

## 许可证

MIT
