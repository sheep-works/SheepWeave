# 構造の概要

src の内容と関数の流れを整理する

# commands

## addTermSide.ts
- activeLineDecoration: ハイライト用のデコレーション型（薄い黄色）
- startAddTermSide(): Promise<void>
    - ステップ1: .shwvt で訳文を選択し、原文をサイドカラムで開く。
    - logic:
        - DirHelper.getShwvsPath
        - vscode.workspace.openTextDocument / showTextDocument
        - shwvsEditor.setDecorations(activeLineDecoration) // ハイライト適用
        - notifyWebview({ type: 'SELECT_TAB', data: 'translate' }) // Webview タブ切り替え
        - vscode.commands.executeCommand('setContext', 'sheepWeave.addTermSideMode', true)
- confirmAddTermSide(): Promise<void>
    - ステップ2: .shwvs で原文を選択し、登録を確定する。
    - logic:
        - globalShWvData.body.addTerm() // 用語登録 & 影響範囲取得
        - globalShWvData.save()
        - notifyWebview({ type: 'UNITS_UPDATED', ... }) // Webview 同期
        - cleanupAddTermSide()
- cancelAddTermSide(): Promise<void>
    - ステップ3: キャンセル処理
    - logic: cleanupAddTermSide()
- cleanupAddTermSide(): Promise<void>
    - logic: ハイライト消去、statusBarItem 破棄、Context 解除

## concordanceSearch.ts
- concordanceSearchCommand(mode: 'source' | 'target')
    - エディタ上の選択範囲からコンコーダンス検索を開始する。
    - logic: doConcordanceSearch()
- doConcordanceSearch(query: string, mode: 'source' | 'target')
    - 用語集(TB)、翻訳メモリ(TM)、現在のドキュメントから検索を実行し、結果を Webview に通知する。
    - logic: notifyWebview({ type: 'CONCORDANCE_SEARCH_RES', ... })

## confirmLine.ts
- confirmLineCommand()
    - 現在の行を確定（Confirm）状態にし、次の行へ移動する。
    - logic:
        - globalDirector.confirmLine() // 内部状態更新 & メモリ伝播
        - renderConfirmedDecorations() // エディタ装飾更新

## openSheepWeavePanel.ts
- notifyWebview(message: any)
    - Webview へメッセージを送信する共通関数。
- openSheepWeavePanel(context, preserveFocus)
    - Webview パネルの生成・表示およびイベントリスナーの登録。
    - logic:
        - onDidChangeTextEditorSelection: カーソル移動を監視し Webview へ CURSOR_MOVED を通知。
        - onDidChangeTextDocument: 編集を監視し、確定済みの行が編集されたら UNCONFIRMED を通知。
        - onDidSaveTextDocument: 保存時に globalShWvData.save() を実行。
        - onDidReceiveMessage: Webview からの受信メッセージを AdminHandler / CoreHandler に振り分け。

## prepareProject.ts
- prepareProjectCommand()
    - プロジェクトの初期準備（フォルダ作成・データ配置）を開始する。
    - logic: prepareProject() (services/projectPrep.ts)

## renameLikeReplace.ts
- renameLikeReplaceCommand()
    - 現在の選択テキストをファイル全体で一括置換する。
    - logic: vscode.workspace.applyEdit()

# shortcuts

エディタ（主に .shwvt / .shwvs）で利用可能なショートカットキー。

| キー | コマンド名 | 呼び出し関数 | 概要 |
| :--- | :--- | :--- | :--- |
| `ctrl+alt+l` | `sheepWeave.openPanel` | `openSheepWeavePanel()` | Webview パネルを開く/表示する |
| `ctrl+shift+1~5` | `sheepWeave.replaceWithTm1~5` | `replaceWithTm(i)` | 翻訳メモリ(TM)の候補を適用 |
| `ctrl+shift+z` | `sheepWeave.replaceWithTb` | `replaceWithTb()` | 用語集(TB)の訳語を適用 |
| `ctrl+shift+alt+z` | `sheepWeave.replaceAllWithTb` | `replaceAllWithTb()` | 用語集(TB)の訳語をファイル全体に適用 |
| `f2` | `sheepWeave.renameLikeReplace` | `renameLikeReplaceCommand()` | 選択テキストを一括置換 |
| `ctrl+enter` | `sheepWeave.confirmLine` | `confirmLineCommand()` | 現在の行を確定して次へ |
| `ctrl+shift+c` | `sheepWeave.copySource` | `copySource()` | 原文をクリップボードにコピー |
| `ctrl+t` | `sheepWeave.startAddTermSide` | `startAddTermSide()` | 用語追加モード（サイド表示）を開始 |
| `enter` / `ctrl+t` | `sheepWeave.confirmAddTermSide` | `confirmAddTermSide()` | 用語追加を確定（原文選択中・モード時のみ） |
| `escape` | `sheepWeave.cancelAddTermSide` | `cancelAddTermSide()` | 用語追加モードをキャンセル |
| `ctrl+k` | `sheepWeave.concordanceSearchSource` | `concordanceSearchCommand('source')` | 原文をコンコーダンス検索 |
| `ctrl+shift+k` | `sheepWeave.concordanceSearchTarget` | `concordanceSearchCommand('target')` | 訳文をコンコーダンス検索 |

# features

## decorators.ts
- initDecorators(context)
- renderConfirmedDecorations(editor)
    - 確定（Status=1）および校閲済み（Status=2）の行に背景色を適用する。

## editorGuard.ts
- initEditorGuard(context)
    - .shwv ファイルの行数変更（改行の追加/削除）を禁止し、誤った編集を自動で Undo する。

## intellisense.ts
- TbCompletionProvider / PhraseCompletionProvider
    - 用語集およびフレーズ集に基づいた入力補換（CompletionItem）を提供。

## shortcuts.ts
- initShortcuts(context)
- replaceWithTm(index) / replaceWithTb()
    - ショートカットキー（Ctrl+1~5等）による翻訳メモリ/用語集の適用。
- copySource()
    - 原文をクリップボードにコピー。

# handlers

## CoreHandler.ts
- handle(message, globalShWvData, rootPath, panel)
    - Webview からの主要な翻訳操作リクエストを処理する。
    - logic:
        - extract-source: `prepareWorking` -> `runTikalExtraction` (Okapi抽出)
        - convert-to-shwv: `preprocessor` (XLIFFパース -> .shwv生成)
        - load: 既存の data.json をロード
        - reanalyze: `syncRefDir` -> `globalShWvData.analyze` (TM/TB再検索)
        - export-xliff: `postprocessor` (XLIFF書き出し)
        - merge-to-final: `runPackage` (Okapiマージ)
        - update-units: 訳文の更新 -> エディタ(.shwvt)への差分書き込み -> `UNITS_UPDATED` 通知

## AdminHandler.ts
- handle(message, globalShWvData, rootPath, panel)
    - プロジェクト管理（インポート/エクスポート/分割）を処理する。
    - logic:
        - shuttle-export-json/csv: `SheepShuttle.exportToJson/Csv`
        - shuttle-import-jsonl: `SheepShuttle.updateFromJsonl` -> `globalShWvData.writeShwv`

# management
- SheepShuttle (External Library / modules): データ形式の変換、インポート/エクスポート、ファイル分割を担当。

# services

## core/SheepDirector.ts
- プロジェクト全体の「監督」役。状態管理と外部データのインデックスを保持。
- properties:
    - state: ShWvData インスタンス
    - tmIndex: FlexSearch による翻訳メモリの全文検索インデックス
- functions:
    - confirmLine(lineIdx, text): 行の確定、メモリ伝播のトリガー
    - loadRefData(rootPath): TM/TB ファイルを読み込み、検索インデックスを構築

## core/ShWvData.ts
- 翻訳データの本体（data.json 構造）を管理するクラス。
- functions:
    - parse(xlfFiles): XLIFF ファイル群をパースし内部モデルを構築
    - analyze(root): 翻訳メモリ(TM)や用語集(TB)との自動マッチングを実行
    - updateUnitTarget(idx, text): 訳文を更新し、参照元（メモリセグメント）へ変更を波及させる
    - writeShwv(root): モデルからエディタ用ファイル(.shwvs / .shwvt)を生成・更新

## core/DirHelper.ts
- フォルダ構造の定義とパス解決。
- `Working/01_REF`, `02_SOURCE`, `03_XLF_JSON`, `04_SHWV` 等のパスを一元管理。

## converter/
- 各種ファイル形式のパースを担当（XLF, TMX, TBX, JSONL, Spreadsheet等）。

## fileOps.ts
- フォルダの初期化（initDirs）、アーカイブ、 Okapiツールの呼び出し（runTikalExtraction / runPackage）など、物理的なファイル操作のオーケストレーション。

## tikal.ts
- Okapi Framework (Tikal) の実行ラッパー。

# types
- datatype.ts: `ShWvData`, `ShWvUnit`, `ShWvMeta` 等の型定義。

# webview

## panel.ts
- VS Code Webview パネルの HTML 生成。

## webview/src/store/shwv.ts (Pinia)
- Webview 側の状態管理。
- actions:
    - loadData: 拡張機能から送られた初期データをロード
    - updateUnits: 差分更新（UNITS_UPDATED）を適用
    - moveCursor: カーソル位置の同期（CURSOR_MOVED）

---

# イベントバスの概要

Extension と Webview の間の通信フロー。

## Webview -> Extension
1. Webview (Vue Component/Store) が `vscode.postMessage({ type, payload })` を実行。
2. Extension (openSheepWeavePanel.ts) の `onDidReceiveMessage` が受信。
3. `CoreHandler` または `AdminHandler` が `message.type` に応じて処理を実行。

## Extension -> Webview
1. Extension (openSheepWeavePanel.ts 等) が `notifyWebview({ type, data })` を実行。
2. Webview (App.vue 等) の `window.addEventListener('message')` が受信。
3. 受信したデータに基づき Pinia ストア（shwv.ts）や画面表示を更新。

主なメッセージタイプ:
- `SHWV_DATA_LOADED`: データの初期ロード
- `UNITS_UPDATED`: 翻訳の差分更新・伝播
- `CURSOR_MOVED`: エディタのカーソル位置同期
- `CONCORDANCE_DATA`: コンコーダンス検索結果の通知

---

# GUIの概要
Vite + Vue 3 (Composition API) + Pinia で構成。

- TranslateTab: メインの翻訳エディタ画面
- ConcordanceTab: コンコーダンス検索画面
- InfoTab: プロジェクト情報・設定画面
- AdminTab: インポート・エクスポート・ツール画面

---

# modules
- SheepShuttle: データ管理・変換モジュール
- FlexSearch: 高速な全文検索インデックス
- Tikal: Okapi Framework によるファイル変換