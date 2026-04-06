# SheepWeave ロードマップ

## 最終ゴール

AI エディタのパワーを翻訳に注入！

## 連携するツール

- SheepLint： Vertex AI を用いた校正ツール
- SheepSpindle：Rust & WASM PACK を用いた高速差分・テキスト処理ツール。QA機能も実装予定

## 機能と流れ

### 1. 翻訳前

ディレクトリ構造とファイルを準備し、ユーザーが配置したファイルを作業用に再配置。
さらに 原文ファイルを XLIFF に変換し、さらに JSON へとパースすることで、拡張で使いやすくする。
同時にproject.json（現状はmanifest.jsonも）を作成し、プロジェクト管理の準備を行なう。

- [x] フォルダを開く（open）
    - [ ] 現状はシステムエクスプローラーではなく、VS Codeのツリーが強調表示されるだけなので、要改善
- [x] フォルダの準備（init）
    - [x] Archiveフォルダの作成
    - [x] Workingフォルダの退避
- [x] ファイルの準備（Prepare）
    - [x] Workingフォルダ内にプロジェクトフォルダを作成
        - [x] 01_REF, 02_SOURCE, 03_XLF_JSON, 04_TRANSLATE, 05_COMPLETED フォルダを作成
    - [x] project.json を作成
        - [x] プロジェクト名、言語設定、対象ファイルリスト
        - [x] 以下のmanifest.jsonも組み込む
    - [x] runTikalExtraction を実行：
        - [x] Tikal CLI を使用して原文ファイルを XLIFF に抽出。
        - [x] manifest.json を作成（抽出ファイルのステータス、フィルタ設定、元のパス）。
            - [x] manifest と project.json の統合
        - [x] 生成された .xlf を 03_XLF_JSON フォルダへ移動。

### 2. 翻訳中

翻訳中の支援表示および入力支援を実装する。

- [x] 翻訳開始（create）
    - [x] 03_XLF_JSON フォルダから XLIFF を取得。
        - [x] 複数ファイル対応 
    - [x] XLF を解析し `globalShWvData` に格納。
    - [x] `globalShWvData` を `data.json` に保存。
        - [x] data.jsonではなく<プロジェクト名>.json となるように調整したい 
        - [x] webview / pinia に送信
    - [x] TM/TB との照合、類似度算出。
        - [ ] SheepSpindle (wasm) で高速化
    - [x] .shwvs/.shwvt: エディタで編集可能な中間ファイルを作成。
- [x] .shwvt 上でカーソル移動 （CURSOR_MOVED）時の動作
    - [x] onDidChangeTextEditorSelection で現在行を取得
        - [x] `TranslateTab` のアクティブ行をフォーカス。
        - [x]  tgt のアップデート
            - [x] 編集意思確認のため、0.5秒の遅延実行としたい
        - [ ] 入力補完にTM/TBの候補を表示
            - [ ] 編集意思確認のため、0.5秒の遅延実行としたい
        - [ ] AI が処理しやすいよう、ゴーストテキストを挿入
            - [ ] 編集意思確認のため、さらに遅く5秒の遅延実行としたい
- [x] 保存時同期
    - [x] .shwvt 保存時に、Extension から Webview へ最新状態をリロード。
    - [ ] 要否は実践後に
- [x] TM/TB の適用
    - [x] Ctrl + Shift + 1~5 で TM の内容をtgtに適用
    - [x] Ctrl + Shift + z で 現在の選択内容が TB にあれば置き換え
    - [x] Alt + Ctrl + Shift + z で 現在の選択内容が TB にあればドキュメント全体で置き換え
- [ ] シンタックスハイライト
    - [ ] 数字
    - [ ] 所定のタグ
    - [ ] 所定の用語
- [ ] リネーム型置換
    - [ ] テキスト選択 + F2 で変数リネームのような置換を実現する
- [ ] 予測語の登録
    - [ ] TBをインテリセンスで使えるようにする
- [ ] スニペットの登録
    - [ ] プロジェクト全体で`phrase.json`を共有し、スニペット的に使えるようにする
- [ ] AI 予測の使用
    - [ ] ゴーストテキストで `// IMPORTANT! DO NOT CHANGE LINE NUMBERS OR LINE BREAKS` を入れて、AI 補完による行破壊を予防
    - [ ] さらに補完適用時の行破壊を検知した際に、現在行以外への波及を防ぐ
- [ ] フィルタ機能
    - [ ] WebView にフィルタ機能を実装。所定の条件にあった行のみを抜き出して、エディタ外で編集。適用時は data とエディタ両方に反映する。

### 3. AI 翻訳・校正

AI を用いた翻訳・校正機能を実装する

- [ ] AI 翻訳の実行
    - [ ] 選択中の行のデータを tm/tbなどとともに JSONL でリクエストし、行数を保ったまま適用するバックグラウンド処理を作成する
    - [ ] 最初はOllama
    - [ ] 将来的には CloudRun + VertexAI
    - [ ] AI 校正も実装したいが、いったんは SheepLint で事足りるか？
- [] QA 機能の実装
    - [ ] SheepSpindle による QA を実行
    - [ ] 結果を Webview に表示

### 4. 翻訳後

翻訳結果を元のバイナリ形式に書き出す。

- [x] 完了 (Complete) クリック＆発火で`.shwvt` の変更内容を `globalShWvData` に同期。
- [x] `saveXlf`: 翻訳済みの最新 XLIFF を `05_COMPLETED` に保存。
- [x] `runTikalMerge` を実行：
    - [x] `manifest.json` から原文と XLF の対応を特定。
    - [x] Tikal CLI を使用してマージ（原文の埋め戻し）。
    - [x] 成果物を `05_COMPLETED` へ集約。

### 5. 管理

ShWvData をより管理に向いた形式に変換する機能群として、ShWvShaver クラスを実装する。
基本的には ShWvData のデータ（または`data.json`）を読み込み、必要最小限に抽出したファイルを生成する。

- [ ] 対訳化
    - [ ] src, tgt のみを持つ json を生成
    - [ ] src, tgt からなる csv（またはexcel）を生成
- [ ] 用語の抽出
- [ ] Manticore Search への投入

## 優先順位

1. [x] 複数ファイル対応
2. [x] manifest.json と project.json の統合
3. [ ] 完了までの実践＆検証
4. [ ] エディタの機能拡張
    4.1 [ ] シンタックスハイライト
    4.2 [ ] リネーム型置換
    4.3 [ ] 予測語の登録
    4.4 [ ] スニペットの登録
    4.5 [ ] フィルタ機能
    4.6 [ ] AI 予測の使用
5. [ ] 外部連携
    5.1 [ ] SheepSpindle による QA
    5.2 [ ] SheepLint とのシームレス連携
6. [ ] データ管理
    6.1 [ ] ShWvShaver の実装
    6.2 [ ] Manticore Search への投入