# SheepWeave プラグイン・サブ拡張連携仕様書 (PLUGIN_ECOSYSTEM.md)

SheepWeave 本体を軽量・堅牢に保ちつつ、画像・漫画・動画・字幕・音声といった多様なマルチメディア翻訳に対応するためのプラグイン・サブ拡張連携仕様書です。

---

## 1. 基本方針：究極のシンプルさと関心事の分離（SoC）

### 重要な割り切り
1. **双方向リアルタイム同期や外部からのユニット直接書き換えは行わない**
   - 翻訳の入力・編集・確定はすべて SheepWeave 本体（`.shwvt` エディタおよび Webview）で完結させます。
   - サブ拡張は **「現在行（アクティブセグメント）に応じたメディア追従（Pub/Sub）」** または **「データフォーマットの相互変換（File I/O）」** に特化します。
2. **全体情報は File I/O、現在行だけ Event Pub**
   - プロジェクト全体のファイル構成やメタデータは、サブ拡張がワークスペース内の `project.json` を直接読み取ります。
   - SheepWeave 本体が提供する拡張間 API は **「行移動イベントの通知」1つだけ** で成立します。
3. **メディア表示・再生は mpv に統一**
   - 画像、動画、音声のすべてを mpv の JSON-IPC 経由で制御。
   - `--ontop` による最前面ピクチャー・イン・ピクチャー表示。
   - サブ拡張側で個別の Webview を管理する必要がなく、極めて軽量かつ堅牢に動作します。

---

## 2. メディアメタデータ仕様（`@md[[...]]` 記法）

各セグメントの `Unit.note` 内にメディア連携用の JSON データを埋め込みます。人間の指示コメントと安全に共存可能です。
SheepWeave 本体の Webview（Translate タブ）では、`@md[[...]]` を自動認識してスマートな **紫（画像）/ 青（タイムコード）のバッジ** としてレンダリングします。

### 記法例
- **漫画・画像**: `ここは主人公のモノローグ @md[[{"img":"imgs/p03.png"}]]`
- **字幕・動画**: `セリフの尺に注意 @md[[{"time":"00:01:23.400"}]]`
- **音声・文字起こし**: `聞き取り注意 @md[[{"time":"00:00:12.500"}]]`
- **複合メディア**: `@md[[{"img":"slides/s05.png", "time":"00:03:45.000"}]]`

### メディアメタデータ型定義（サブ拡張側）
```typescript
export interface MediaMetadata {
  /** 画像ファイルパス（相対または絶対） */
  img?: string;
  /** タイムコード文字列（例: "00:01:23.400"） */
  time?: string;
  /** 再生時間・尺（秒） */
  duration?: number;
  /** 再生速度倍率 */
  speed?: number;
  [key: string]: any;
}
```

---

## 3. SheepWeave 公開 API 仕様 (`src/api.ts`)

外部の VS Code 拡張機能（例: `SheepWeaveMedia`）から利用可能な TypeScript 型定義および API です。

```typescript
import * as vscode from 'vscode';
import type { ShWvUnit } from './types/datatype';

export interface ActiveUnitChangeEvent {
  /** 0始まりの行番号 / Unitインデックス */
  index: number;
  /** 原文テキスト */
  source: string;
  /** 現在の訳文テキスト（エディタの入力内容） */
  target: string;
  /** メタデータ・コメント（@md[[...]] を含むnote） */
  note?: string;
  /** 確定ステータス (0: 未確定, 1以上: 確定済み) */
  status?: number;
  /** 完全な ShWvUnit データ（必要な場合） */
  unit?: ShWvUnit;
}

export interface SheepWeavePublicApi {
  /** アクティブ行が変更されたときのイベント（デバウンス処理済み） */
  readonly onDidChangeActiveUnit: vscode.Event<ActiveUnitChangeEvent>;

  /** 現在アクティブな行の情報を同期的に取得 */
  getActiveUnit(): ActiveUnitChangeEvent | null;
}
```

### 外部拡張からの呼び出し例
```typescript
const sheepWeave = vscode.extensions.getExtension<SheepWeavePublicApi>('sheep.sheep-weave');
if (sheepWeave) {
  const api = await sheepWeave.activate();
  api.onDidChangeActiveUnit((event) => {
    console.log(`Active unit changed: line ${event.index}, text: ${event.source}`);
    // mpv へシークまたは画像切り替えコマンドを送信
  });
}
```

---

## 4. サブ拡張（`SheepWeaveMedia`）の実装構成

`d:\Code\SheepFamily\SheepWeaveMedia` に実装されています。

- **明示的な起動**: ステータスバー（`$(play) Start mpv Preview`）またはコマンドパレットから起動。
- **設定画面への直行**: 未設定時や起動エラー時に `Open Settings` トーストを表示し、一発で設定画面へ誘導。
- **自動 subprocess 起動**: 拡張機能が `--ontop` `--geometry=450x350-20-40` で最前面に自動起動。
- **設定カスタマイズ**: `mpvPath`, `alwaysOnTop`, `geometry`, `noBorder` を VS Code 設定から変更可能。
