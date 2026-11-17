# SheepComb モジュールおよびCLI側の修正・連携事項

今回 SheepWeave 拡張機能側での検証と修正を通じて、サブモジュールである SheepComb およびその CLI (`SheepCombWeb/packages/cli`) にも波及する根本的な課題および追加機能が判明しました。モジュール担当のエージェントへ引き継ぐため、課題と修正意図をまとめました。

## 1. 発生していた問題 (エンコーディングとパース例外)
MemoQなどが書き出す一部の TMX / XLIFF ファイルが UTF-16LE (BOM付き) でエンコードされている場合、パーサーに渡す前に Node.js 側で単なる `utf8` として読み込んでしまうと、文字間に `\u0000` が挟まるなどデータが激しく破損（文字化け）します。
この破損した文字列が `@xmldom/xmldom` パーサーに渡された結果、本来のタグが崩れて `Unescaped '<' not allowed in attributes values` というパース例外が発生し、プロセスごとクラッシュしていました。

## 2. SheepComb (サブモジュール) 内での修正箇所と意図
`SheepWeave/modules/SheepComb/packages/core/src/shuttle/components/subparser/` 以下の各種パーサー（`tmxParser.ts`, `xliffParser.ts`, `tbxParser.ts`, `docxParser.ts`）に対して、以下の修正を行いました。

- **変更内容**: `DOMParser` の初期化時に `onError` ハンドラーを追加し、致命的エラー時にも例外をスローしない（コンソールに警告を出すのみとする）ようにしました。また、ブラウザ標準の DOMParser 型定義とのコンパイルエラー（Expected 0 arguments）を避けるため、`new (DOMParser as any)(parserOpts)` のように型キャストを入れています。
- **修正の意図**: エンコーディングの問題以外にも、実業務のファイルには仕様違反の微妙なXMLエラー（エスケープ漏れなど）が含まれることが多々あります。これによってパース処理全体がクラッシュするのを防ぎ、強靭性（フォールトトレランス）を向上させるためです。
> 👉 **連携事項**: モジュール本体側（アップストリーム）へも同様の `onError` ハンドラーの追加を反映させる必要があります。

## 3. ワークフロー機能の追加に伴うデータ構造のアップデート (Ver 1.3)
UIのパフォーマンス最適化とワークフロー状態（翻訳、プルーフなど）の一元管理のため、`ShWvData` のメタデータに `workflow` プロパティを追加し、データ定義バージョンを `1.3` に引き上げました。

- **変更箇所**: `SheepComb/packages/types/src/index.ts`
- **変更内容**: 
  1. `ShWvMeta` インターフェースに `workflow?: { index: number; role: string; name: string }` を追加。
  2. `ShWvDefine` の `version` に `'1.3'` を追加。
- **修正の意図**: 各ユニットの `status` プロパティと現在のワークフローインデックス（`index`）を照らし合わせることで、各行が確定済み（Confirmed）かどうかをUI側で動的かつ高速に判断できるようにするためです。

## 4. SheepCombWeb CLI 側で今後必要な修正
CLI側 (`SheepCombWeb`) では、エンコーディングの問題が未修正のため現在も **全く同じエラーでクラッシュする状態** です。モジュール担当エージェントに以下の修正を依頼してください。

- **修正が必要な箇所**: `SheepCombWeb/packages/cli/src/pipeline.ts` など、ファイルをローカルから読み込んでいる箇所
- **現状のコード**: `fs.readFileSync(fullPath, 'utf8')` のようにエンコーディングが utf8 に決め打ちされています。
- **対応方針**: ファイルを一旦 Buffer として読み込み、先頭の2バイトが BOM (`0xFF 0xFE`) であるかを判定して、UTF-16LE の場合は `buf.toString('utf16le')` でデコードする処理（または `iconv-lite` や `jschardet` などを用いたより堅牢なエンコーディング推測処理）を導入する必要があります。
