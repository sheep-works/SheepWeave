# SheepWeave

[English](README.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

<p align="center">
  <b>AI Translation & Post-editing Assistant for VS Code</b><br>
  An extension designed to integrate and accelerate Machine Translation and Post-editing (MTPE) workflows.
</p>

---

## 📖 Overview

**SheepWeave** is an advanced Computer-Assisted Translation (CAT) assistant designed for seamless translation and post-editing (MTPE) in VS Code.  
Unlike traditional CAT tools, it adopts text editors for target editing, keeping operations lightweight and flexible. It integrates Translation Memory (TM), Termbases (TB), AI (LLM) suggestions, and robust project management into a single editor, significantly reducing keystrokes and friction for translators.

---

## ✨ Key Features

- 🧶 **Dedicated Translation UI (WebView)**
  - Side-by-side segment display (Source & Target)
  - Automatic match lookup and one-tap insertion for Translation Memory (TM) and Termbases (TB)
  - Segment status tracking (Confirmed / Unconfirmed) and progress statistics
- 🤖 **AI-Assisted Post-editing**
  - AI-driven target text suggestions and inline application
  - Concordance search (lookup similar phrases in source/target)
- 🛡️ **Segment Structure Protection (`.shwvt` / `.shwvs`)**
  - Protects segment lines to prevent accidental line breaks or format corruption
- 📁 **Automated Project Setup**
  - Automates management of input data, working files, and backups (archives)

---

## 🚀 Getting Started

### 1. Prepare Project
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
2. Run `SheepWeave: Prepare Project`.
3. The necessary folder structure and project configuration will be generated automatically.

### 2. Open Translation Panel
1. Open a translation file (e.g., `.shwvt`) or click the preview icon at the top right of the editor.
2. Run `SheepWeave: Open Panel` to launch the dedicated translation panel (WebView).

---

## ⌨️ Key Commands & Shortcuts

| Command | Description |
| :--- | :--- |
| `SheepWeave: Open Panel` | Open the main translation panel |
| `SheepWeave: Prepare Project` | Initialize and organize the project environment |
| `SheepWeave: Confirm Line` | Confirm the current segment and move to the next |
| `SheepWeave: Go to Next Unconfirmed Segment` | Jump to the next unconfirmed segment |
| `SheepWeave: Apply TM 1–5` | Apply Translation Memory (TM) match 1–5 |
| `SheepWeave: Apply Term` | Apply matched Termbase (TB) entry |
| `SheepWeave: Concordance Search` | Search concordance for selected text |

---

## 🔗 Links

- **GitHub Repository**: [sheep-works/SheepWeave](https://github.com/sheep-works/SheepWeave)
- **SheepStorage (Downloads & Docs)**: Distribution site for past `.vsix` releases and documentation

---

## 📄 License

[MIT License](LICENSE.txt)
