# SheepWeave についてよくある質問

## ファイル関連の質問

### Q. Office ファイルの翻訳はできますか？

### A. はい、可能です

ただし、Office ファイルを直接翻訳するのではなく、一度 XLIFF または JSON 形式に変換し、翻訳後に戻すというフローが必要となります（通常の CAT ツールと同様）。

ファイルの変換には Ver 0.2 以前は Okapi Framework の Tikal を使用していましたが、Ver 0.3 以降は Tikal の一部の機能を Rust に移植したライブラリ「Suffolk」を使用しています。ただし、Suffolk はまだ検証段階のため、Tikal や同じく Okapi Framework の GUI である Rainbow を使うことも可能です。

### Q. 対応しているファイル形式は？

### A. 読み込み方に応じて変わります

- 直接読み込み
    - xliff / sdlxliff / mxliff / mqxliff
    - JSON
- 変換して読み込み
    - Suffolk：docx / xlsx / pptx / html / md / txt / idml
    - Tikal：docx / xlsx / pptx / html / md / txt
    - Rainbow： Okapi Framework の公式サイトにてご確認ください。XLIFFに変換できれば基本的には読み込み可能です

### Q. 対訳形式の Excel にも対応できますか？

### A. はい、可能です

Tikal / Rainbow / Suffolk での変換時に多言語フィルタを指定してください

## 作業開始までの流れに関する質問

### Q. 「初期化」と「準備」の違いは何ですか？

### A. 

### Q. ファイルの配置方法が分かりません

### A.

### Q. 過去の翻訳ファイル資産を活用したい

### A. 

## 翻訳作業に関する質問



