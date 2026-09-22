# SheepWeave プラグイン・サブ拡張構想（設計メモ）

## 1. 基本方針：究極のシンプルさと関心事の分離（SoC）

SheepWeave 本体を肥大化させず、あらゆる特殊用途（漫画、字幕、音声文字起こし、eラーニング、UIデザイン等）に対応できるようにするためのアーキテクチャ設計メモです。

### 重要な割り切り
- **双方向リアルタイム同期や外部からのUnit書き換えは行わない**
  - 翻訳の入力・編集・確定はすべて SheepWeave 本体（Target）で完結させる。
  - サブ拡張は **「現在行（アクティブUnit）に応じたメディア追従（Pub/Sub）」** または **「データフォーマットの相互変換（FileIO）」** に特化する。
- **全体情報は FileIO、現在行だけ Event Pub**
  - プロジェクト全体のファイル構成やメタデータは、サブ拡張がワークスペース内の `project.json` やフォルダを直接読めばよい。
  - したがって、SheepWeave 本体が提供する API は **「行移動イベントの通知」1つだけ** で成立する。
- **メディア表示・再生はすべて mpv 1つに統一**
  - 画像、動画、音声のすべてを mpv の JSON-IPC 経由で制御。
  - `--ontop` による最前面ピクチャー・イン・ピクチャー表示。
  - サブ拡張側で Webview（HTML/CSS/Vite等）を管理する必要がなく、極めて軽量かつ堅牢。

---

## 2. メディアメタデータ仕様（`@md[[...]]` 記法）

`Unit.note` 内にメディア連携用の JSON データを埋め込みます。人間の指示コメントと安全に共存可能です。
SheepWeave 本体の Webview（Translate タブ）では、`@md[[...]]` を自動認識してスマートな **紫（画像）/ 青（タイムコード）のバッジ** としてレンダリングします。

### 記法例
- **漫画・画像**: `ここは主人公のモノローグ @md[[{"img":"imgs/p03.png"}]]`
- **字幕・動画**: `セリフの尺に注意 @md[[{"time":"00:01:23.400"}]]`
- **音声・文字起こし**: `聞き取り注意 @md[[{"time":"00:00:12.500"}]]`
- **複合メディア**: `@md[[{"img":"slides/s05.png", "time":"00:03:45.000"}]]`

### 型定義（サブ拡張 `SheepWeaveMedia` 側が所有）
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

## 3. SheepWeave 本体が公開している API（v0.1.6 実装済み）

### 型定義 (`src/api.ts`)

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
  /** 本体が保持する完全な ShWvUnit データ（必要な場合） */
  unit?: ShWvUnit;
}

export interface SheepWeavePublicApi {
  /** アクティブ行が変更されたときのイベント（デバウンス200ms消化後） */
  readonly onDidChangeActiveUnit: vscode.Event<ActiveUnitChangeEvent>;

  /** 現在アクティブな行の情報を同期的に取得 */
  getActiveUnit(): ActiveUnitChangeEvent | null;
}
```

---

## 4. サブ拡張（`sheepweave-media`）の実装構成

`d:\Code\SheepFamily\SheepWeaveMedia` に実装済み。

### 特徴
1. **明示的な起動**: ステータスバー（`$(play) Start mpv Preview`）またはコマンドパレットから起動。
2. **設定画面への直行**: 未設定時や起動エラー時に `Open Settings` トーストを表示し、一発で設定画面へ誘導。
3. **自動 subprocess 起動**: 拡張機能が `--ontop` `--geometry=450x350-20-40` で最前面に自動起動。
4. **設定カスタマイズ**: `mpvPath`, `alwaysOnTop`, `geometry`, `noBorder` を VSCode 設定から変更可能。
