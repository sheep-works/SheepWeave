# src/services/fileOps.ts の最適化

src/services/fileOps.ts を以下のとおり最適化する。

- initDirs 関数
    - 以下の関数を順次実行する
    - createDir：現在のディレクトリにArchive、Data、Data/Ref、Workingディレクトリを生成する。すでに存在している場合はスキップする。
    - moveToArchive：Workingディレクトリにファイルが存在している場合は、Archiveディレクトリに新規ディレクトリをつくって移動する。Workingディレクトリは複数のディレクトリから構成されているので再帰的に移動することに留意する。Archiveディレクトリにつくる新規ディレクトリ名はYYYYMMDDとし、すでに同名ディレクトリが存在している場合は枝番をつくる。この処理が終わったとき、Workingディレクトリは空になる。


- prepareWorking 関数
    - 以下の関数を順次実行する
    - createWorking：Workingディレクトリに以下のディレクトリを生成する。
        - 01_REF
        - 02_SOURCE
        - 03_XLF_JSON
        - 04_LMLG
        - 05_COMPLETED
        - 06_PACKAGE
    - copyDataToWorking：Dataディレクトリの内容を以下のルールでWorkingディレクトリにコピーする。
        - Data/Ref -> Working/01_REF へ
        - Data -> Working/02_SOURCE へ
   
- preprocessor 関数
    - 以下の関数を順次実行する
    - setXlf：Working/02_SOURCEに拡張子がxlf、xliff、mxliffのファイルがあれば、Working/03_XLF_JSON へコピーする。存在しない場合は、callTikal関数を実行する（この関数はローカルにあるCLI Tikalを呼び出すもの。現時点ではダミー処理を実装）
    - convXlf2Json：Working/03_XLF_JSONにコピーされた拡張子がxlf、xliff、mxliffのファイルをClass LmLgDataにパースし、Working/03_XLF_JSON/<file_name>.jsonとして出力しておく。LmLgData Classについては、sample/LmLgData.tsを参考にして実装する。xlfファイルの構造とパース案については、sample/xlfSchema.tsとxlfreader.tsを参考にすること。
    - convJson2Lmlg：LmLgDataから原文ファイル（lmlgs）と訳文ファイル（lmlgt）を生成し、Working/04_LMLG へ出力する。

- postprocessor 関数
    - 以下の関数を順次実行する
    - convLmlg2Json：Working/04_LMLGにコピーされたlmlgtファイルを使って、Class LmLgDataおよびWorking/03_XLF_JSON/<file_name>.jsonを更新する。
    - convJson2Xlf：Working/03_XLF_JSON/<file_name>.xlf/xliff/mxliffをxml2jsでパースし、LmLgDataの内容で更新したものを、再度XML形式に戻してWorking/05_COMPLETED/<file_name>-done.xlf/xliff/mxliffとして出力する。