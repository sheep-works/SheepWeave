残作業
NOTE

以下は今回のスコープ外ですが、将来的に検討する項目です。

旧クラスファイルの物理削除: ShWvBody.ts, ShWvMeta.ts, ShWvUnit.ts, ShWvRef.ts, ShWvRefTm.ts, ShWvRefTb.ts, ShWvFileInfo.ts, ShWvDiffer.ts — 現在はコード上で未参照だが、ファイルは残存中
サブモジュールの物理削除: git submodule deinit / git rm で SheepShuttle と SheepSpindle を削除
difflib-ts 依存の整理: ShuttleAdapter がローカルに difflib-ts を使っているため、トップレベル依存は引き続き必要
VSIX ビルドテスト: yarn vsix で .vsix 生成の確認
E2E テスト: F5デバッグでの動作確認