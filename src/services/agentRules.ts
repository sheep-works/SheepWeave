import * as fs from 'fs';
import * as path from 'path';

/**
 * SHEEPWEAVE_RULES.md の本体内容
 */
export const SHEEPWEAVE_RULES_CONTENT = `# SheepWeave Project Rules for AI Assistants

This workspace is managed by SheepWeave, a CAT (Computer-Assisted Translation) tool.
AI assistants, agents, and LLMs operating within this project MUST adhere strictly to the following rules.

---

## ⚠️ 1. CRITICAL SAFETY CONSTRAINTS (READ-ONLY RULES)

- **NEVER directly edit, modify, truncate, or overwrite \`Working/04_SHWV/Target.shwvt\` under any circumstances.**
- **Reason:** \`Target.shwvt\` enforces a strict 1-to-1 line-level correspondence with \`Working/04_SHWV/Source.shwvs\` and internal project metadata (\`project.json\`). Any addition or deletion of newlines/empty lines will break line-number indexing and cause irrecoverable project corruption.
- **Output Rule:** When the user requests translation, proofreading, nuance checks, or editing for segments:
  - Output the results to the **chat response window** or to a separate markdown file (e.g., \`suggestions.md\`).
  - Instruct the user to review the suggestions and manually or safely apply them within SheepWeave.

---

## 📂 2. PROJECT STRUCTURE & DATA SCHEMA

### Key Files
- \`Working/04_SHWV/Target.shwvt\`:
  - Contains translated target text. Each line \`N\` (1-indexed) corresponds to segment \`idx = N - 1\` (0-indexed).
  - **DO NOT EDIT DIRECTLY.**
- \`Working/04_SHWV/Source.shwvs\`:
  - Contains source text. Line \`N\` corresponds to line \`N\` of \`Target.shwvt\`.
- \`project.json\`:
  - The single source of truth for the project. Schema format (\`SHWV_DATA\` v1.3):
    \`\`\`json
    {
      "define": { "name": "SHWV_DATA", "version": "1.3" },
      "meta": {
        "sourceLang": "en-US",
        "targetLang": "ja-JP",
        "projectName": "..."
      },
      "body": {
        "units": [
          {
            "idx": 0,          // 0-based index (corresponds to line 1 in .shwvs / .shwvt)
            "src": "...",      // Source text
            "tgt": "...",      // Target text
            "pre": "...",      // Previous target/MT draft
            "note": "..."      // Segment notes/context
          }
        ]
      }
    }
    \`\`\`
- \`Working/01_REF/\`:
  - \`TM/\`: Translation Memory files
  - \`TB/\`: Termbase / glossary files
  - \`phrase.jsonl\`: Auto-completion and phrase snippets

---

## 📝 3. RECOMMENDED OUTPUT FORMAT

When proposing translations or corrections, present them with line numbers so the translator can easily identify and copy them:

| Line (1-based) | Source (原文) | Suggested Target (提案訳) | Notes / Rationale (備考・意図) |
| :--- | :--- | :--- | :--- |
| 12 | Example source sentence. | 例の原文です。 | カジュアルな口調に調整 |

---

## 🤖 4. NOTE TO THE AI AGENT
If the user asks you to "apply", "save", or "write" translations to the project, politely decline editing \`Target.shwvt\` directly. Instead, offer to save them into \`suggestions.md\` or present them clearly in the chat response.
`;

const AGENT_RULE_SHORTCUT = `# SheepWeave AI Assistant Instructions
Please strictly follow all instructions and safety constraints defined in \`SHEEPWEAVE_RULES.md\`.
CRITICAL: Never edit \`Working/04_SHWV/Target.shwvt\` directly to preserve line count integrity. Output all suggestions to chat or \`suggestions.md\`.
`;

const CURSOR_MDC_CONTENT = `---
description: SheepWeave project rules and Target.shwvt protection
globs: *
alwaysApply: true
---
Please strictly follow all instructions and safety constraints defined in \`SHEEPWEAVE_RULES.md\`.
CRITICAL: Never edit \`Working/04_SHWV/Target.shwvt\` directly to preserve line count integrity. Output all suggestions to chat or \`suggestions.md\`.
`;

export interface RuleFileTarget {
    relativePath: string;
    content: string;
    description: string;
}

export const AGENT_RULE_TARGETS: RuleFileTarget[] = [
    {
        relativePath: 'SHEEPWEAVE_RULES.md',
        content: SHEEPWEAVE_RULES_CONTENT,
        description: 'SheepWeave core project rules (Single Source of Truth)'
    },
    {
        relativePath: '.cursorrules',
        content: AGENT_RULE_SHORTCUT,
        description: 'Cursor rules'
    },
    {
        relativePath: '.cursor/rules/sheepweave.mdc',
        content: CURSOR_MDC_CONTENT,
        description: 'Cursor modern rule (.mdc)'
    },
    {
        relativePath: '.clinerules',
        content: AGENT_RULE_SHORTCUT,
        description: 'Cline / Roo Code rules'
    },
    {
        relativePath: '.windsurfrules',
        content: AGENT_RULE_SHORTCUT,
        description: 'Windsurf rules'
    },
    {
        relativePath: '.github/copilot-instructions.md',
        content: AGENT_RULE_SHORTCUT,
        description: 'GitHub Copilot instructions'
    },
    {
        relativePath: '.gemini/antigravity/rules/sheepweave.md',
        content: AGENT_RULE_SHORTCUT,
        description: 'Gemini Antigravity rules'
    }
];

/**
 * プロジェクトルートにエージェント用ルール設定ファイルを配置する
 * @param root プロジェクトルートパス
 * @param overwrite すでに存在する場合に上書きするかどうか (デフォルト: false)
 */
export function setupAgentRules(root: string, overwrite: boolean = false): { created: string[]; skipped: string[] } {
    const created: string[] = [];
    const skipped: string[] = [];

    for (const target of AGENT_RULE_TARGETS) {
        const fullPath = path.join(root, target.relativePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (fs.existsSync(fullPath) && !overwrite) {
            skipped.push(target.relativePath);
        } else {
            fs.writeFileSync(fullPath, target.content, 'utf-8');
            created.push(target.relativePath);
        }
    }

    return { created, skipped };
}
