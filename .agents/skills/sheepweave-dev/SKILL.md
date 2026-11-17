---
name: sheepweave-dev
description: >-
  SheepWeave development guide, architecture standards, event handling, and documentation synchronization.
  Use when developing features, adding commands, creating Webview tabs, updating postMessage handlers,
  or maintaining specifications in the descriptions/ directory.
---

# SheepWeave 開発・設計ガイド (sheepweave-dev)

SheepWeave は、VS Code ネイティブのテキストエディタと Vue 3 によるリッチな Webview サイドパネルを組み合わせた高速 CAT（翻訳支援）ツールです。
本スキルは、SheepWeave の設計原則、機能追加の標準手順、および仕様書（`descriptions/`）の保守ルールを定義します。

---

## 1. 公式ドキュメント（Single Source of Truth）

SheepWeave の詳細な仕様は、すべて `descriptions/` 配下に集約されています。開発・リファクタリング時は必ず該当ドキュメントを参照してください。

- **[descriptions/STRUCTURE.md](../../descriptions/STRUCTURE.md)**: システム全体構造、ディレクトリ責務、全コマンドID、キーバインド対応表。
- **[descriptions/EVENTS.md](../../descriptions/EVENTS.md)**: Webview ⇄ Extension の `postMessage` 全メッセージ定義、シーケンス図。
- **[descriptions/DATA_STRUCTURE.md](../../descriptions/DATA_STRUCTURE.md)**: `project.json` (Ver 1.1〜1.4) スキーマ、`Working/` ディレクトリ遷移。
- **[descriptions/EDITOR_DESIGN.md](../../descriptions/EDITOR_DESIGN.md)**: 行数ガード (`editorGuard.ts`)、CodeMirror 2ペインの3重防壁セーフティロック。
- **[descriptions/PLUGIN_ECOSYSTEM.md](../../descriptions/PLUGIN_ECOSYSTEM.md)**: `SheepWeaveMedia`（mpv連携）、`@md[[...]]` メディア記法、公開 `SheepWeavePublicApi`。

---

## 2. 開発における最重要鉄則

1. **行数ズレの絶対防止（3重防壁セーフティロック）**
   - CATツールにおいて行ズレ（改行の混入・欠落）はデータ崩壊を意味します。
   - エディタ側の `editorGuard.ts`（行数変更検知による即時Undo）および Webview 側の改行ブロック（`DualCodeMirror.vue`）を迂回・無効化してはなりません。
2. **`project.json` が唯一の正本 (Single Source of Truth)**
   - 翻訳テキスト・メタデータ・Okapi抽出ステータス・ワークフローはすべてワークスペースルートの `project.json` で一元管理されます。個別の一時キャッシュファイルを作成・依存させないこと。
3. **関心事の分離（SoC）と疎結合**
   - 翻訳の入力・編集・確定は SheepWeave 本体で完結させます。
   - サブ拡張（メディア追従など）との連携は、`src/api.ts` の `onDidChangeActiveUnit`（Pub/Sub）および `project.json` の File I/O のみで行います。
4. **UTF-16LE / BOM のフォールトトレランス**
   - MemoQ等の外部CATツールが書き出す TMX / XLIFF には UTF-16LE や軽微なXML構文違反が存在します。パーサーはクラッシュせず警告で受け流す設計を維持すること。

---

## 3. 機能追加の標準手順 (Runbook)

### A. 新しいコマンド・ショートカットの追加
1. **コマンド関数の実装**: `src/commands/<commandName>.ts` を作成。
2. **拡張機能への登録**: `src/extension.ts` の `activate` 関数内で `vscode.commands.registerCommand` を追加。
3. **マニフェスト定義**: `package.json` の `contributes.commands`, `contributes.keybindings`, `contributes.menus` に登録。
4. **仕様書更新**: `descriptions/STRUCTURE.md` のコマンド・キーバインド表に追記。

### B. Webview ⇄ Extension 間の新しいイベント追加
1. **Webview ➔ Extension 送信の場合**:
   - `webview/src/App.vue` (または各タブコンポーネント) から `vscode.postMessage({ type: 'your-event', payload: ... })` を送信。
   - `src/handlers/CoreHandler.ts` (ワークフロー系) または `AdminHandler.ts` (管理系) に `case 'your-event':` を追加して処理を実装。
2. **Extension ➔ Webview 送信の場合**:
   - `panel.webview.postMessage({ type: 'YOUR_EVENT', data: ... })` で送信。
   - `webview/src/App.vue` の `window.addEventListener('message')` 内の switch 文に `case 'YOUR_EVENT':` を追加。
   - 必要に応じて `webview/src/store/shwv.ts` のアクションを呼び出して状態を更新。
3. **仕様書更新**: `descriptions/EVENTS.md` の対応表に必ず追記。

### C. 新しい Webview タブの追加
1. **タブコンポーネントの作成**: `webview/src/tabs/<Name>Tab.vue` を作成。
2. **App.vue へのマウント**: `webview/src/App.vue` でインポートし、`activeTab` の条件付きレンダリングとヘッダーメニューに追加。
3. **ショートカットの割り当て**: 必要に応じて `package.json` の `sheepWeave.switchTab` キーバインド（`alt+1` 〜 `alt+8`）を確認・更新。
4. **仕様書更新**: `descriptions/STRUCTURE.md` の Webview タブ一覧に追記。

---

## 4. ビルド・検証手順

コード変更後は、必ず以下のコマンドを実行してビルドエラーがないか確認してください。

```powershell
# Webview (Vite) と Extension (Webpack) の一括ビルド
npm run compile
```

※ エラーが出た場合は、TypeScript の型チェックや Vite のバンドル警告を確認してください。
