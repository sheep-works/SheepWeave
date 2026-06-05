# データ構造アップデートログ: Ver 1.1 (ShWvData & project.json の一本化)

## 概要

本アップデート（Ver 1.1）では、これまで個別ファイルとして存在していた**翻訳テキスト・対訳データ（`ShWvData` / 旧 `<projectName>.json`）**と**プロジェクト設定・ステータスデータ（`project.json`）**を完全に一本化しました。

ワークスペースルートの `project.json` が唯一のプロジェクト状態管理ファイルとして動作し、その中に翻訳コンテンツとプロジェクト情報（メタ情報・Okapiファイルステータス・統計情報）を包含する構造へ移行しました。これにより、不要な中間キャッシュファイルが排除され、データ同期の手間やデータ不整合のリスクが最小化されています。

---

## 変更点

### 1. `ShWvDefine` バージョンの更新
`ShWvDefine` 内のバージョンを `'1.0'` から `'1.1'` へアップデートしました。
*   **Ver 1.0 (旧)**: `ShWvData` 単体の翻訳コンテンツキャッシュ形式。
*   **Ver 1.1 (新)**: `projectInfo` プロパティを内包する統合データ構造。

### 2. 型定義の移行と集約 (`modules/SheepComb`)
データ整合性を保つため、プロジェクトメタ情報に関する型定義をすべて `modules/SheepComb` 側に移行・集約しました。
*   `ProjectFileStatus`: 抽出されたソースおよび対応するXLIFFの処理ステータス。
*   `ProjectGroup`: Okapiフィルタ設定と、それに紐づくファイル群。
*   `ProjectStats`: セグメント数、未翻訳数、QA警告数、用語一致数などのプロジェクトボリューム統計。
*   `ProjectInfo`: 上記を包含する、プロジェクト固有の設定・管理オブジェクト。

---

## データ構造比較 (Before / After)

### Ver 1.0 (旧形式)
以前は、ルートに `project.json` があり、`Working/03_XLF_JSON/` 配下に翻訳データのキャッシュファイルが存在していました。

```json
/* 旧 project.json (ルート) */
{
  "version": 2,
  "projectName": "SheepWeaveProject",
  "sourceLanguage": "en-US",
  "targetLanguage": "ja-JP",
  "sourceFiles": [
    "Sample.mxliff"
  ],
  "okapi": [
    {
      "filter": "auto",
      "files": [
        {
          "source": "d:\\...\\Working\\02_SOURCE\\Sample.mxliff",
          "xliff": "d:\\...\\Working\\03_XLF_JSON\\Sample.mxliff",
          "status": "extracted"
        }
      ]
    }
  ]
}

/* 旧 ShWvData (Working) */
{
  "define": {
    "name": "SHWV_DATA",
    "version": "1.0"
  },
  "meta": {
    "bilingualPath": "Working/03_XLF_JSON/Sample.mxliff",
    "files": [{"name": "Sample.mxliff", "start": 0, "end": 10}],
    "sourceLang": "en",
    "targetLang": "ja",
    "tmFiles": [],
    "tbFiles": []
  },
  "body": {
    "units": [ /* 翻訳セグメント */ ],
    "terms": [ /* 用語集 */ ]
  }
}
```

### Ver 1.1 (新形式 - 統合 project.json)
Ver 1.1 では、ルートの `project.json` 自体が `SHWV_DATA` の定義を持ち、その中にすべてのメタ情報と翻訳コンテンツ、さらに `projectInfo` として従来のプロジェクト設定が完全統合されます。

```json
{
  "define": {
    "name": "SHWV_DATA",
    "version": "1.1"
  },
  "meta": {
    "bilingualPath": "Working/03_XLF_JSON/Sample.mxliff",
    "files": [
      {
        "name": "Sample.mxliff",
        "start": 0,
        "end": 10
      }
    ],
    "sourceLang": "en",
    "targetLang": "ja",
    "tmFiles": [],
    "tbFiles": []
  },
  "body": {
    "units": [
      {
        "idx": 0,
        "src": "Hello World",
        "pre": "",
        "tgt": "こんにちは、世界",
        "status": 1,
        "ref": { "tms": [], "tb": [], "quoted": [], "quoted100": [] },
        "placeholders": {}
      }
    ],
    "terms": []
  },
  "projectInfo": {
    "version": 2,
    "projectName": "SheepWeaveProject",
    "sourceLanguage": "en-US",
    "targetLanguage": "ja-JP",
    "sourceFiles": [
      "Sample.mxliff"
    ],
    "okapi": [
      {
        "filter": "auto",
        "files": [
          {
            "source": "d:\\...\\Working\\02_SOURCE\\Sample.mxliff",
            "xliff": "d:\\...\\Working\\03_XLF_JSON\\Sample.mxliff",
            "status": "extracted"
          }
        ]
      }
    ],
    "lastPreparedAt": "2026-05-29T02:11:22.000Z",
    "stats": {
      "segments": 10,
      "untranslated": 9,
      "qaWarnings": 0,
      "termsMatched": 0
    }
  }
}
```

---

## 互換性ハンドリング

### 後方互換性 (Backward Compatibility)
既存プロジェクトへのシームレスな移行を確実にするため、VS Code 拡張機能の `ProjectManager` および `ShWvData` ローダーは以下の順序で互換性確認を行います。

1.  **統合形式 (Ver 1.1) の確認**: 読み込んだ JSON に `define.name === 'SHWV_DATA'` かつ `define.version === '1.1'` が指定されている場合、統合データとして解釈し `projectInfo` を即座にロードします。
2.  **移行フェーズ (Ver 1.0) の確認**: `define.name === 'SHWV_DATA'` ではあるがバージョンが旧版である、あるいは `projectInfo` オブジェクトが内包されている場合、それを適切に復元します。
3.  **旧形式 (Ver 1.0 未満の純粋な設定ファイル) の確認**: `projectName` プロパティが最上位に存在する旧 `project.json` が検出された場合、レガシー設定としてロードし、保存（`save()`）実行時に自動的に最新の統合 `ShWvData` (Ver 1.1) 構造へ変換してルートに書き込みます。

この処理フローにより、ユーザーは既存の古い `project.json` を壊すことなくそのまま開いて最新形式へ透過的に移行できます。
