# SheepWeave システム構造仕様書 (STRUCTURE.md)

SheepWeave の拡張機能コア (`src/`) および Webview (`webview/src/`) の全体構造、各モジュールの責務、登録コマンド、ショートカットキーの一覧です。

---

## 1. 全体アーキテクチャ概要

SheepWeave は **VS Code 拡張機能バックエンド (Extension)** と **Vue 3 によるリッチなサイドパネル (Webview)** の疎結合アーキテクチャを採用しています。
さらに、外部のマルチメディア再生サブ拡張（`SheepWeaveMedia`）向けに公開 API を提供しています。

```mermaid
graph TD
    subgraph VS Code Extension
        EXT[extension.ts / エントリーポイント]
        API[api.ts / 公開API]
        CMD[commands/ / 各種VS Codeコマンド]
        FEAT[features/ / エディタ保護・装飾・補完]
        HANDLERS[handlers/ / CoreHandler & AdminHandler]
        SERVICES[services/ / FileOps, Tikal, ProjectManager]
        STORE[store.ts / グローバル状態: globalShWvData, globalDirector]
    end

    subgraph Webview UI (Vue 3 + Pinia + Vite)
        PANEL[webview/panel.ts / Webviewパネル管理]
        APP[App.vue / メインルーター・メッセージ送受信]
        TABS[tabs/ / Flow, Translate, Search, Bypass, Tools, LLM, Info, Settings]
        COMP[components/ / DualCodeMirror, ConcordanceView, etc.]
        PSTORE[store/ / shwv.ts, i18n.ts]
    end

    subgraph External / Sub-Extensions
        MEDIA[SheepWeaveMedia (mpv連携)]
    end

    EXT --> API
    EXT --> CMD
    EXT --> FEAT
    CMD --> HANDLERS
    CMD --> SERVICES
    HANDLERS --> SERVICES
    SERVICES --> STORE
    PANEL <== "postMessage (JSON-RPC風)" ==> APP
    API -- "onDidChangeActiveUnit" --> MEDIA
```

---

## 2. ディレクトリ構成 (`src/`)

```
src/
├── api.ts                     # 外部サブ拡張向け公開API (SheepWeavePublicApi)
├── extension.ts               # 拡張機能アクティベーション、コマンド・キーバインド登録
├── store.ts                   # グローバルインスタンス (globalShWvData, globalDirector)
├── util.ts                    # プロジェクトルート検索等のユーティリティ
│
├── commands/                  # VS Code コマンド実装
│   ├── addTermSide.ts         # 用語追加（サイドエディタ連携）
│   ├── bypassCommands.ts      # バイパス翻訳・自由編集コマンド
│   ├── concordanceSearch.ts   # コンコーダンス検索（原文/訳文）
│   ├── confirmLine.ts         # 行確定コマンド
│   ├── diffTargetWithTm.ts    # 訳文とTMの差分表示
│   ├── gotoNextUnconfirmed.ts # 次の未確定行へジャンプ
│   ├── gotoPrevUnconfirmed.ts # 前の未確定行へジャンプ
│   ├── openSheepWeavePanel.ts # Webviewパネルの生成・表示・リスナー登録
│   ├── prepareProject.ts      # プロジェクト初期準備コマンド
│   ├── renameLikeReplace.ts   # ファイル全体の一括置換 (F2)
│   └── setupAgentRules.ts     # AIエージェント設定ファイル生成コマンド
│
├── features/                  # エディタ拡張・保護機能
│   ├── decorators.ts          # 確定行・用語ハイライト装飾 (renderConfirmedDecorations等)
│   ├── editorGuard.ts         # 行数ガード（改行追加/削除の禁止・自動Undo）
│   ├── intellisense.ts        # 用語集(TB)・フレーズ入力補完 (TbCompletionProvider, PhraseCompletionProvider)
│   └── shortcuts.ts           # ショートカットキー操作（TM候補適用、原文コピー等）
│
├── handlers/                  # Webview からの要求処理
│   ├── CoreHandler.ts         # 翻訳ワークフロー・ファイル変換・LLM連携
│   ├── AdminHandler.ts        # データ管理・分割・エクスポート (SheepShuttle連携)
│   └── sampleData.ts          # サンプルデータ生成ヘルパー
│
├── management/                # SheepShuttle連携モジュール
│   └── index.ts               # データ変換・インポート・エクスポート・ファイル分割
│
├── services/                  # ビジネスロジック・物理ファイル操作
│   ├── agentRules.ts          # AIツール (Cursor/Windsurf/Cline/Claude/Copilot) 向け設定自動生成
│   ├── fileOps.ts             # フォルダ初期化・アーカイブ・プリ/ポストプロセス・パッチ操作
│   ├── projectPrep.ts         # プロジェクト初期化
│   ├── reviewHtmlExporter.ts  # レビュー用HTML出力
│   ├── storage.ts             # ストレージ操作
│   ├── suffolk.ts             # Suffolk (Pure Rust CLI) ラッパー（Java不要の高速抽出・マージ）
│   ├── tikal.ts               # Okapi Framework (Tikal CLI) ラッパー
│   ├── converter/             # データ変換
│   │   ├── index.ts
│   │   └── shwv2xlflike.ts
│   └── core/                  # コアドメインロジック
│       ├── backupOps.ts       # プロジェクトバックアップ作成・復元
│       ├── DirHelper.ts       # フォルダパス解決 (`Working/`, `04_SHWV`, `project.json`)
│       ├── ProjectManager.ts  # project.json のCRUDおよび設定管理
│       ├── SheepDirector.ts   # 全体オーケストレーション、インデックス検索、行確定伝播
│       ├── ShuttleAdapter.ts  # SheepShuttle アダプター
│       ├── ShuttleSearch.ts   # 高速検索インデックス
│       └── ShWvData.ts        # 翻訳データモデル本体（パース、保存、分析）
│
├── types/                     # 型定義
│   ├── datatype.ts            # modules/SheepComb から型を再エクスポート
│   └── xlfSchema_ts
│
└── webview/
    └── panel.ts               # Webview パネルの生成とHTML構築
```

---

## 3. コマンド・ショートカットキー一覧

エディタ（主に `.shwvt` / `.shwvs`）および Webview で利用可能なキーバインド一覧です。

### 編集・翻訳操作

| キー | コマンドID | 機能概要 |
| :--- | :--- | :--- |
| `ctrl+enter` (Mac: `cmd+enter`) | `sheepWeave.confirmLine` | 現在行を確定して次の行へ移動 |
| `alt+down` (Mac: `alt+down`) | `sheepWeave.gotoNextUnconfirmed` | 次の未確定セグメントへジャンプ |
| `alt+up` (Mac: `alt+up`) | `sheepWeave.gotoPrevUnconfirmed` | 前の未確定セグメントへジャンプ |
| `ctrl+shift+c` | `sheepWeave.copySource` | 現在行の原文をクリップボードにコピー |
| `ctrl+shift+1` 〜 `5` | `sheepWeave.replaceWithTm1` 〜 `5` | TM（翻訳メモリ）候補1〜5を訳文に適用（テンキー対応） |
| `ctrl+shift+z` | `sheepWeave.replaceWithTb` | TB（用語集）の訳語を適用 |
| `ctrl+shift+alt+z` | `sheepWeave.replaceAllWithTb` | TB（用語集）の訳語をファイル全体に一括適用 |
| `f2` | `sheepWeave.renameLikeReplace` | 選択テキストをファイル全体で一括置換 |
| `@`, `/`, ` `（入力時） | - (IntelliSense) | 用語集(TB)および登録フレーズの自動補完候補を表示 |

### 検索・用語登録

| キー | コマンドID | 機能概要 |
| :--- | :--- | :--- |
| `ctrl+k` | `sheepWeave.concordanceSearchSource` | 選択テキストで原文コンコーダンス検索 |
| `ctrl+shift+k` | `sheepWeave.concordanceSearchTarget` | 選択テキストで訳文コンコーダンス検索 |
| `ctrl+t` | `sheepWeave.startAddTermSide` | 用語追加モード開始（原文をサイド表示） |
| `enter` / `ctrl+t` | `sheepWeave.confirmAddTermSide` | 用語追加を確定（原文選択中・追加モード時） |
| `escape` | `sheepWeave.cancelAddTermSide` | 用語追加モードをキャンセル |

### パネル・タブ切り替え・ツール

| キー | コマンドID | 機能概要 |
| :--- | :--- | :--- |
| `ctrl+alt+l` | `sheepWeave.openPanel` | SheepWeave Webview パネルを開く/表示 |
| `ctrl+q` | `sheepWeave.loadLlmSelection` | 選択範囲を LLM タブにロード |
| `alt+1` | `sheepWeave.switchTab` (`flow`) | Flow（進捗・工程）タブへ切り替え |
| `alt+2` | `sheepWeave.switchTab` (`translate`) | Translate（翻訳）タブへ切り替え |
| `alt+3` | `sheepWeave.switchTab` (`search`) | Search（検索）タブへ切り替え |
| `alt+4` | `sheepWeave.switchTab` (`bypass`) | Bypass（バイパス編集）タブへ切り替え |
| `alt+5` | `sheepWeave.switchTab` (`tools`) | Tools（データ管理・分割・エクスポート）タブへ切り替え |
| `alt+6` | `sheepWeave.switchTab` (`llm`) | LLM（AI翻訳・チャット・バッチ）タブへ切り替え |
| `alt+7` | `sheepWeave.switchTab` (`information`) | Information（プロジェクト情報・統計）タブへ切り替え |
| `alt+8` | `sheepWeave.switchTab` (`settings`) | Settings（設定）タブへ切り替え |

### パッチ・プロジェクト管理コマンド

| コマンドID | 機能概要 |
| :--- | :--- |
| `sheepWeave.openBypassTranslation` | バイパス翻訳画面を開く |
| `sheepWeave.openFreeEditor` | 自由編集画面を開く |
| `sheepWeave.diffTargetWithTm` | 訳文とTMの差分をエディタで比較表示 |
| `sheepWeave.exportScopedPatch` | 担当範囲のセグメントのみをパッチファイルに出力 |
| `sheepWeave.mergePatch` | パッチファイルを現在のプロジェクトにマージ |
| `sheepWeave.setupAgentRules` | AIエージェント設定ファイル（`.cursorrules` 等）を配置 |

---

## 4. Webview 構成 (`webview/src/`)

Vue 3 (Composition API) + Pinia + Vite で構築されたリッチな UI パネルです。

```
webview/src/
├── App.vue                         # メインフレーム、タブ制御、postMessage ルーター
├── main.ts                         # アプリケーション初期化
├── vscode.ts                       # acquireVsCodeApi() のラッパー
├── store/
│   ├── shwv.ts                     # プロジェクトデータ、セグメント、TM/TB の Pinia ストア
│   └── i18n.ts                     # 多言語リソース
├── tabs/                           # 各機能タブ
│   ├── FlowTab.vue                 # プロジェクト準備・変換・ワークフロー管理（カレント project.json 開始対応）
│   ├── TranslateTab.vue            # メイン翻訳画面（コンテキスト・用語・TM表示）
│   ├── SearchTab.vue               # コンコーダンス検索画面
│   ├── BypassTab.vue               # バイパス翻訳・一括編集画面
│   ├── ToolsTab.vue                # データ管理・分割・各種エクスポート・バックアップ
│   ├── LlmTab.vue                  # LLM翻訳・バッチ翻訳・プロンプト管理
│   ├── InfoTab.vue                 # プロジェクト情報・ボリューム統計
│   └── SettingsTab.vue             # 表示・動作設定
└── components/
    ├── common/DualCodeMirror.vue   # 2ペイン式エディタ（行数ガード付き）
    ├── subeditor/                  # 個別セグメント編集用コンポーネント
    ├── ConcordanceView.vue         # 検索結果一覧
    ├── FilterView.vue              # フィルタリング表示
    └── SegmentRow.vue              # セグメント行表示
```

---

## 5. 外部連携・公開 API (`src/api.ts`)

SheepWeave は、外部の拡張機能（例: マルチメディア追従拡張 `SheepWeaveMedia`）向けにパブリック API を提供しています。

```typescript
export interface ActiveUnitChangeEvent {
    index: number;       // 0-indexed 行番号
    source: string;      // 原文
    target: string;      // 訳文
    note?: string;       // メモ・メディアメタデータ (@md[[...]])
    status?: number;     // 確定ステータス
    unit?: ShWvUnit;     // 完全なユニットオブジェクト
}

export interface SheepWeavePublicApi {
    readonly onDidChangeActiveUnit: vscode.Event<ActiveUnitChangeEvent>;
    getActiveUnit(): ActiveUnitChangeEvent | null;
}
```

VS Code の拡張機能間連携メカニズム（`vscode.extensions.getExtension('sheep.sheep-weave')?.exports`）を通じて、リアルタイムな行変更イベントを安全に購読可能です。
