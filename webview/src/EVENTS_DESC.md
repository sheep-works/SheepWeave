# SheepWeave イベント＆メッセージ記述子 (EVENTS_DESC.md)

このドキュメントは、SheepWeave の Webview と VS Code 拡張機能（Extension）の間でやり取りされるイベントとメッセージの仕様をまとめたものです。

---

## 1. Webview ➔ Extension (送信メッセージ)

Webview から `vscode.postMessage()` を通じて送信されるメッセージです。
主に `App.vue` の `handleCommand` や `updateConfig` を通じて送信されます。

| メッセージ型 (type/command) | 送信元モジュール | 処理担当 (Extension側) | 内容・簡単な説明 |
| :--- | :--- | :--- | :--- |
| `READY` | `App.vue` (onMounted) | `CoreHandler` | Webviewの準備が完了したことを通知。設定のリロードとデータ同期を要求。 |
| `update-config` | `SettingsTab.vue` | `CoreHandler` | フォントサイズなどのユーザー設定を VS Code の `Configuration` に保存。 |
| `update-units` | `FilterTab.vue` | `CoreHandler` | 翻訳ユニットの更新。一括編集した内容を `.shwvt` エディタと内部データに反映し、他ユニットへの伝搬（Propagate）を行う。 |
| **FlowCommand系** | **`FlowTab.vue`** | **`CoreHandler`** | **プロジェクトのメインワークフロー制御** |
| └ `open-current` | | | プロジェクトのルートフォルダを OS のファイラーで開く。 |
| └ `archive-previous` | | | 現在の `Working` フォルダを `Archive` に退避し、環境を初期化する。 |
| └ `extract-source` | | | プロジェクト設定 (`project.json`) の作成と、Tikal による原文からの XLIFF 抽出を実行。 |
| └ `convert-to-shwv` | | | 抽出された XLIFF を解析し、`.shwvs` (原文) および `.shwvt` (訳文) エディタ用ファイルを生成。 |
| └ `load` | | | 既存の `.shwvs` / `.shwvt` データを読み込み、Webview に同期する。 |
| └ `reanalyze` | | | 参考資料 (`Ref`) の同期、TM/TB との再照合、類似度の再計算を実行。 |
| └ `export-xliff` | | | `.shwvt` の内容を XLIFF 形式 (`03_XLF_JSON` から `05_COMPLETED`) へ書き出す。 |
| └ `merge-to-final` | | | XLIFF の内容を元のファイル形式（Office等）に埋め戻し、最終成果物を生成。 |
| **ManageCommand系** | **`ManagementTab.vue`** | **`AdminHandler`** | **外部連携・データ管理 (SheepShuttle)** |
| └ `shuttle-export-json` | | | 翻訳データを JSON 形式でエクスポート。 |
| └ `shuttle-export-csv` | | | 翻訳データを CSV 形式でエクスポート。 |
| └ `shuttle-export-jsonl` | | | AI (SheepLint) 連携用の JSONL 形式でエクスポート。 |
| └ `shuttle-chunk-jsonl` | | | 字数制限に合わせて JSONL を分割 (Chunking) してエクスポート。 |
| └ `shuttle-import-jsonl` | | | JSONL から翻訳結果をインポートし、プロジェクトデータと同期する。 |
| └ `shuttle-split-file` | | | 元のファイルごとにデータを分割して保存。 |
| └ `shuttle-split-length` | | | 指定したセグメント数ごとにデータを分割。 |

---

## 2. Extension ➔ Webview (受信メッセージ)

VS Code 拡張機能から `webview.postMessage()` を通じて送られ、Webview 側の `App.vue` で受信されるメッセージです。

| メッセージ型 (type) | 送信元 (Extension側) | 受信先 (Webview側) | 内容・簡単な説明 |
| :--- | :--- | :--- | :--- |
| `CONFIG_LOADED` | `CoreHandler` (READY時) | `App.vue` (config ref) | VS Code の設定（言語、フォントサイズ等）を Webview に反映する。 |
| `SHWV_DATA_LOADED` | `CoreHandler` / `AdminHandler` | `shwvStore` | 全翻訳データ（メタデータとユニットリスト）をロードまたは一括更新する。 |
| `UNITS_UPDATED` | `CoreHandler` | `shwvStore` | 特定のユニット（行）が更新された際の差分更新通知。インクリメンタルな更新に使用。 |
| `CURSOR_MOVED` | `openSheepWeavePanel.ts` | `shwvStore` | エディタ上のカーソル移動に同期して、Webview 側の表示をフォーカスさせる。 |
| `SET_LOADING` | `CoreHandler` (各処理中) | `App.vue` (loading ref) | Webview 全体のローディング（スピン）表示の ON/OFF 制御。 |
| `SELECT_TAB` | `addTermSide.ts` | `App.vue` (activeTab) | Extension側からの要求で Webview のタブを切り替える（例：用語登録開始時に翻訳タブへ移動）。 |
| `UNCONFIRMED` | `openSheepWeavePanel.ts` | (App.vue listener) | エディタで保存済み/確定済みの行が編集され、未確定状態になったことを通知。 |

---

## 3. 重要ワークフローまとめ

### プロジェクト作成・初期化の流れ (FlowTab)
1.  `extract-source` ➔ フォルダ準備、`project.json` 生成、Tikal 抽出
2.  `convert-to-shwv` ➔ XLIFF 解析、`.shwvs`/`.shwvt` 生成、データロード
3.  エディタでの翻訳開始

### エディタ同期 (Real-time Sync)
-   **VS Code ➔ Webview**: `CURSOR_MOVED` により、エディタで選択中の行が Webview でも強調される。
-   **Webview ➔ VS Code**: `update-units` (FilterTab等) により、Webview での変更が即座に `.shwvt` エディタに書き込まれる。

### 用語・翻訳メモリ連携 (Re-analyze)
-   `reanalyze` 実行時、`Ref/` フォルダ内のファイルを再スキャンし、最新の TM/TB 情報を全セグメントに再適用する。
