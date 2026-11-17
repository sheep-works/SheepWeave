# SheepWeave 仕様書・設計図インデックス (descriptions/)

SheepWeave プロジェクトのアーキテクチャ、通信イベント、データ構造、UI・エディタ設計、外部連携仕様をまとめた公式ドキュメントフォルダです。

---

## 📚 ドキュメント一覧

| ドキュメント | 概要 | 対象読者 |
| :--- | :--- | :--- |
| **[STRUCTURE.md](./STRUCTURE.md)** | **全体システム構造・コマンド・キーバインド一覧**<br>拡張機能バックエンド (`src/`) と Webview (`webview/src/`) のディレクトリ構造、全コマンドID、ショートカットキー対応表、公開API概要。 | 開発者・機能追加時 |
| **[EVENTS.md](./EVENTS.md)** | **イベント＆メッセージ通信仕様書**<br>Webview ⇄ Extension 間で postMessage 交換される全メッセージ型定義、ペイロード仕様、ライフサイクルシーケンス図。 | フロント/バックエンド連携時 |
| **[DATA_STRUCTURE.md](./DATA_STRUCTURE.md)** | **データ構造＆物理ディレクトリ仕様書**<br>ルートの統合 `project.json` (Ver 1.1〜1.4) の完全スキーマ、`Working/` (01〜06) のファイル遷移フロー、後方互換性仕様。 | データ処理・パーサー開発時 |
| **[EDITOR_DESIGN.md](./EDITOR_DESIGN.md)** | **エディタ保護＆バイパス編集設計書**<br>改行・行ズレ事故を100%防止する `editorGuard`、Webview CodeMirror 2ペインエディタの「3重防壁セーフティロック」。 | UI/エディタ改善時 |
| **[PLUGIN_ECOSYSTEM.md](./PLUGIN_ECOSYSTEM.md)** | **プラグイン・サブ拡張連携仕様書**<br>`SheepWeaveMedia`（mpv連携）をはじめとするサブ拡張連携仕様、`@md[[...]]` メディア記法、公開 `SheepWeavePublicApi`。 | メディア連携・外部拡張開発時 |

---

## 🗄️ アーカイブ (archive/)

過去の開発経緯、初期メモ、アップストリーム連携ログは [archive/](./archive/) に保存されています。

- [archive/SheepCombMergeChanges.md](./archive/SheepCombMergeChanges.md): SheepComb サブモジュールおよび CLI への連携事項
- [archive/improve0724.md](./archive/improve0724.md): 2026年7月24日アップデート履歴
- [archive/instruction_fileops.md](./archive/instruction_fileops.md): fileOps.ts の初期開発指示メモ
- [archive/memo.md](./archive/memo.md): 初期開発時の残作業メモ
