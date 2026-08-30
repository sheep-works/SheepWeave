# SheepWeave

[English](README.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

<p align="center">
  <b>AI Translation & Post-editing Assistant for VS Code</b><br>
  旨在集成并加速机器翻译与译后编辑 (MTPE) 工作流的 VS Code 扩展
</p>

---

## 📖 概述

**SheepWeave** 是一款专为 VS Code 设计的高级计算机辅助翻译 (CAT) 助手，旨在提供流畅的翻译与译后编辑 (MTPE) 体验。  
与传统 CAT 工具不同，它采用文本编辑器进行译文编辑，保持轻量与灵活。它将翻译记忆库 (TM)、术语库 (TB)、AI (LLM) 建议以及强大的项目管理功能整合至单个编辑器中，显著减少译员的按键次数与工作阻力。

---

## ✨ 主要特性

- 🧶 **专用翻译 UI (WebView)**
  - 句段双语对照显示 (原文与译文)
  - 翻译记忆库 (TM) 与术语库 (TB) 的自动匹配查找与一键应用
  - 句段确认状态跟踪 (已确认 / 未确认) 及进度统计
- 🤖 **AI 辅助译后编辑**
  - 基于 AI 的译文修改建议及内联应用
  - 语境检索/协同检索 (查找原文或译文中的相似短语)
- 🛡️ **句段结构保护 (`.shwvt` / `.shwvs`)**
  - 保护句段行结构，防止意外换行或格式损坏
- 📁 **自动化项目配置**
  - 自动管理输入数据、工作文件和备份 (归档)

---

## 🚀 快速入门

### 1. 准备项目
1. 打开命令面板 (`Ctrl+Shift+P` / `Cmd+Shift+P`)。
2. 运行 `SheepWeave: Prepare Project`。
3. 必要的文件夹结构与项目配置文件将自动生成。

### 2. 打开翻译面板
1. 打开翻译文件 (例如 `.shwvt`) 或点击编辑器右上角的预览图标。
2. 运行 `SheepWeave: Open Panel` 以启动专用翻译面板 (WebView)。

---

## ⌨️ 常用命令与快捷键

| 命令 | 说明 |
| :--- | :--- |
| `SheepWeave: Open Panel` | 打开主翻译面板 |
| `SheepWeave: Prepare Project` | 初始化并整理项目环境 |
| `SheepWeave: Confirm Line` | 确认当前句段并跳转至下一句 |
| `SheepWeave: Go to Next Unconfirmed Segment` | 跳转至下一个未确认的句段 |
| `SheepWeave: Apply TM 1–5` | 应用翻译记忆库 (TM) 匹配项 1–5 |
| `SheepWeave: Apply Term` | 应用匹配的术语库 (TB) 词条 |
| `SheepWeave: Concordance Search` | 对选中文本执行语境检索 |

---

## 🔗 相关链接

- **GitHub 仓库**: [sheep-works/SheepWeave](https://github.com/sheep-works/SheepWeave)
- **SheepStorage (下载与文档)**: 历史版本 (.vsix) 及相关工具的发布站点 (https://storage.lambuage.com/)

---

## 📄 开源协议

[MIT License](LICENSE.txt)
