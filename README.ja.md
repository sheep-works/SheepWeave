# SheepWeave

[English](README.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

<p align="center">
  <b>AI Translation & Post-editing Assistant for VS Code</b><br>
  機械翻訳とポストエディット（MTPE）作業を統合・高速化する VS Code 拡張機能
</p>

---

## 📖 概要

**SheepWeave** は、VS Code 上で翻訳・ポストエディット（MTPE）作業をスムーズに行うための高度な翻訳支援（CAT）ツールです。  
これまでの CAT ツールとは異なり、訳文の編集にテキストエディタを採用しているため、動作は軽快。置換や検索、縦方向のコピー＆ペーストや文字カウントなど、日々のちょっとした操作がシンプルに行えるため、他ツールとの連携も容易です。  
各種XLIFFはもちろん、翻訳メモリ（TM）、用語集（TB）も利用可能。外部ツール（Okapi Framework）も使えば、Office ファイルなどの編集もシームレスに実現できます。  
さらに、データの管理にJSON形式を採用しているため、AI（LLM）との連携にも強く、統合開発環境ならぬ「統合**翻訳**環境」の実現を目指します。

---

## ✨ 主な特徴

- 🧶 **専用翻訳 UI (WebView)**
  - セグメントごとの原文・訳文の並列表示
  - 翻訳メモリ（TM）や用語集（TB）の自動一致検索とワンタップ適用
  - セグメントの確認状態（Confirmed / Unconfirmed）や統計情報の表示
- 🤖 **AI 支援・ポストエディット**
  - AI による訳文修正候補の提案とインライン適用
  - コンコーダンス検索（原文/訳文からの類似フレーズ照会）
- 🛡️ **セグメント安全制御 (`.shwvt` / `.shwvs`)**
  - セグメント構造を保護し、誤った改行挿入やフォーマット破損を自動ガード
- 📁 **プロジェクト一括セットアップ**
  - 入力データ・作業データ・バックアップ（アーカイブ）の管理を自動化

---

## 🚀 使い方

### 1. プロジェクトの準備
1. コマンドパレット (`Ctrl+Shift+P` / `Cmd+Shift+P`) を開きます。
2. `SheepWeave: Prepare Project` を選択・実行します。
3. 必要なフォルダー構造と設定ファイルが自動セットアップされます。

### 2. 翻訳パネルを開く
1. 翻訳ファイル (`.shwvt` 等) を開くか、エディタ右上のアイコンをクリックします。
2. コマンド `SheepWeave: Open Panel` を実行すると、専用の統合翻訳パネル（WebView）が表示されます。

---

## ⌨️ 主なショートカット・コマンド

| コマンド | 説明 |
| :--- | :--- |
| `SheepWeave: Open Panel` | 統合翻訳パネルを開く |
| `SheepWeave: Prepare Project` | プロジェクト環境を初期化・整頓する |
| `SheepWeave: Confirm Line` | 現在のセグメントを確定して次へ進む |
| `SheepWeave: Go to Next Unconfirmed Segment` | 未確定のセグメントへジャンプする |
| `SheepWeave: Apply TM 1〜5` | 翻訳メモリ（TM）の提案候補を適用する |
| `SheepWeave: Apply Term` | マッチした用語（TB）を適用する |
| `SheepWeave: Concordance Search` | 選択テキストのコンコーダンス検索を実行する |

---

## 🔗 関連リンク

- **マニュアル**：[SheepWeaveマニュアル](https://lambuage.com/sheep-weave)
- **GitHub Repository**: [sheep-works/SheepWeave](https://github.com/sheep-works/SheepWeave)
- **SheepStorage (配布・ドキュメント)**: [過去バージョン (.vsix) や関連ツールの配布サイト](https://storage.lambuage.com/)

---

## 📄 ライセンス

[MIT License](LICENSE.txt)
