<script setup lang="ts">
import { ref, computed } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import { DiffUtils, type DiffResult } from '../utils/diffUtils';
import { getVsCodeApi } from '../vscode';
import {
  IconTool,
  IconPlayArrow,
  IconDelete,
  IconImport,
  IconLeft,
  IconRight,
  IconExclamationCircle,
  IconFile,
  IconFilter,
  IconSafe,
  IconCheckCircle,
  IconDownload,
  IconLocation,
  IconRefresh
} from '@arco-design/web-vue/es/icon';
import {
  checkAllUnits,
  restorePlaceholders,
} from '../../../modules/SheepComb/packages/core/src/qa/qaChecker';
import type { QaConfig, QaIssue, QaIssueType } from '../../../src/types/datatype';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();

const activeTab = ref('diff');
const diffMode = ref<'segment' | 'manual'>('segment');

function handleExportReviewHtml() {
  const vscode = getVsCodeApi();
  if (vscode) {
    vscode.postMessage({ type: 'shuttle-export-review-html' });
  }
}

// ==================== Global QA Checker Mode ====================
const qaConfig = ref<QaConfig>({
  check_numbers: true,
  check_tags: true,
  check_terms: true,
  check_consistency: true,
  check_unmodified_pe: true,
});
const qaIssues = ref<QaIssue[]>([]);
const hasRunQa = ref(false);
const selectedIssueFilter = ref<QaIssueType | 'ALL'>('ALL');

function doRunQa() {
  if (!shwvStore.units || shwvStore.units.length === 0) return;
  qaIssues.value = checkAllUnits(shwvStore.units, qaConfig.value);
  hasRunQa.value = true;
}

function escapeCsv(val: string | number | undefined | null): string {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function doExportQaReportCsv() {
  if (qaIssues.value.length === 0) return;
  const headers = ['Line', 'IssueType', 'Message', 'Source', 'Target'];
  const rows = qaIssues.value.map(issue => {
    const preview = getQaUnitPreview(issue.idx);
    return [
      escapeCsv(issue.idx + 1),
      escapeCsv(issue.issue_type),
      escapeCsv(issue.message),
      escapeCsv(preview?.src || ''),
      escapeCsv(preview?.tgt || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qa_issues.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function doExportQaReportJson() {
  if (qaIssues.value.length === 0) return;
  const jsonStr = JSON.stringify(qaIssues.value, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qa_issues.json';
  a.click();
  URL.revokeObjectURL(url);
}

const qaCounts = computed(() => {
  const counts: Record<string, number> = { Number: 0, Tag: 0, Term: 0, Consistency: 0, UnmodifiedPe: 0 };
  for (const issue of qaIssues.value) {
    counts[issue.issue_type] = (counts[issue.issue_type] || 0) + 1;
  }
  return counts;
});

const filteredQaIssues = computed(() => {
  if (selectedIssueFilter.value === 'ALL') {
    return qaIssues.value;
  }
  return qaIssues.value.filter(issue => issue.issue_type === selectedIssueFilter.value);
});

function getQaUnitPreview(idx: number) {
  const u = shwvStore.units.find(unit => unit.idx === idx);
  if (!u) return null;
  return {
    src: restorePlaceholders(u.src, u.placeholders),
    tgt: restorePlaceholders(u.tgt, u.placeholders),
  };
}

function jumpToQaSegment(idx: number) {
  const pos = shwvStore.units.findIndex(u => u.idx === idx);
  if (pos !== -1) {
    shwvStore.crtPos = pos;
  }
}

// ==================== Segment TM Target Diff Mode ====================
const currentUnitIdx = computed(() => shwvStore.crtPos);
const currentUnit = computed(() => shwvStore.units[currentUnitIdx.value] || null);

const currentTargetText = computed(() => {
  if (!currentUnit.value) return '';
  return currentUnit.value.tgt || '';
});

function prevSegment() {
  if (shwvStore.crtPos > 0) {
    shwvStore.crtPos--;
  }
}

function nextSegment() {
  if (shwvStore.crtPos < shwvStore.units.length - 1) {
    shwvStore.crtPos++;
  }
}

interface TmDiffItem {
  idx: number;
  file?: string;
  sourceRatio: number;
  sourceText: string;
  tmTarget: string;
  targetRatio: number;
  targetDiffHtml: string;
  isRatioMismatch: boolean;
}

const tmDiffList = computed<TmDiffItem[]>(() => {
  const unit = currentUnit.value;
  if (!unit || !unit.ref || !unit.ref.tms || unit.ref.tms.length === 0) {
    return [];
  }
  const curTgt = currentTargetText.value;

  return unit.ref.tms.map(tm => {
    const srcRatio = tm.ratio || 0;
    const tmTgt = tm.tgt || '';
    // 訳文同士（TM訳文 vs 現在の訳文）の類似度と差分を計算
    const tgtRatio = DiffUtils.getRatio(tmTgt, curTgt);
    const tgtDiffHtml = DiffUtils.getDiffHtml(tmTgt, curTgt);
    // 原文一致率が高率 (>=80%) なのに 訳文一致率が低い (<60%) 場合の警告判定
    const isRatioMismatch = srcRatio >= 80 && tgtRatio < 60;

    return {
      idx: tm.idx,
      file: tm.file || 'TM',
      sourceRatio: srcRatio,
      sourceText: tm.src,
      tmTarget: tmTgt,
      targetRatio: tgtRatio,
      targetDiffHtml: tgtDiffHtml,
      isRatioMismatch
    };
  });
});

// 初期訳文 (pre) と現在の訳文 (tgt) の比較 (preが原文srcと同一でない場合のみ)
const preTargetDiff = computed(() => {
  const unit = currentUnit.value;
  if (!unit || !unit.pre || unit.pre === unit.src) return null;
  const curTgt = currentTargetText.value;
  if (unit.pre === curTgt) return null;

  return {
    preText: unit.pre,
    curText: curTgt,
    targetRatio: DiffUtils.getRatio(unit.pre, curTgt),
    targetDiffHtml: DiffUtils.getDiffHtml(unit.pre, curTgt)
  };
});

function getRatioTagColor(ratio: number): string {
  if (ratio >= 90) return 'green';
  if (ratio >= 70) return 'orange';
  return 'red';
}

// ==================== Manual Target Text Diff Mode ====================
const oldText = ref('');
const newText = ref('');
const batchDiff = ref<DiffResult[]>([]);
const isChecked = ref(false);
const showOnlyDiff = ref(false);

function runLineDiff() {
  const olds = oldText.value.split('\n');
  const news = newText.value.split('\n');
  const maxLines = Math.max(olds.length, news.length);
  const results: DiffResult[] = [];

  for (let i = 0; i < maxLines; i++) {
    const s = olds[i] || '';
    const t = news[i] || '';
    const hasDiff = s !== t;
    const d = DiffUtils.getDiffHtml(s, t);
    const ratio = DiffUtils.getRatio(s, t);

    results.push({
      lineNo: i + 1,
      s,
      t,
      d,
      ratio,
      hasDiff
    });
  }
  batchDiff.value = results;
  isChecked.value = true;
}

function runBlockDiff() {
  const s = oldText.value;
  const t = newText.value;
  const hasDiff = s !== t;
  const d = DiffUtils.getDiffHtml(s, t);
  const ratio = DiffUtils.getRatio(s, t);

  batchDiff.value = [
    {
      lineNo: 1,
      s,
      t,
      d,
      ratio,
      hasDiff
    }
  ];
  isChecked.value = true;
}

function importFromDocument() {
  if (!shwvStore.units || shwvStore.units.length === 0) return;

  oldText.value = shwvStore.units.map(u => {
    const tmTgt = u.ref?.tms?.[0]?.tgt;
    if (tmTgt) return tmTgt;
    if (u.pre && u.pre !== u.src) return u.pre;
    return '';
  }).join('\n');

  newText.value = shwvStore.units.map(u => u.tgt || '').join('\n');
}

function clearManualDiff() {
  oldText.value = '';
  newText.value = '';
  batchDiff.value = [];
  isChecked.value = false;
}

const filteredBatchDiff = computed(() => {
  if (showOnlyDiff.value) {
    return batchDiff.value.filter(item => item.hasDiff);
  }
  return batchDiff.value;
});
</script>

<template>
  <div id="tools-tab">
    <div class="header">
      <a-space align="center">
        <icon-tool :style="{ fontSize: '24px', marginRight: '8px' }" />
        <a-typography-title :heading="4" style="margin: 0">
          {{ i18nStore.getText('toolsTab', 'title') || 'ツール' }}
        </a-typography-title>
      </a-space>
    </div>

    <a-divider style="margin: 16px 0;" />

    <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
      <!-- 1. Diff Subtab (訳文差分検証) -->
      <a-tab-pane key="diff" :title="i18nStore.getText('toolsTab', 'diffSubtab') || '差分'">
        <div class="pane-content">
          <div style="margin-bottom: 16px;">
            <a-radio-group v-model="diffMode" type="button" size="medium">
              <a-radio value="segment">セグメント訳文 vs TM訳文 差分検証</a-radio>
              <a-radio value="manual">手動訳文テキスト差分</a-radio>
            </a-radio-group>
          </div>

          <!-- Mode A: Segment TM Target Diff & Ratio -->
          <div v-if="diffMode === 'segment'" class="segment-diff-container">
            <a-card :bordered="false" class="tools-card" style="margin-bottom: 16px;">
              <template #title>
                <div class="segment-header-title">
                  <a-tag color="arcoblue">Segment #{{ currentUnitIdx + 1 }} / {{ shwvStore.units.length }}</a-tag>
                  <span v-if="currentUnit?.idx !== undefined" style="margin-left: 8px; font-size: 12px; color: var(--color-text-3);">
                    (ID: {{ currentUnit.idx }})
                  </span>
                </div>
              </template>
              <template #extra>
                <a-button-group size="small">
                  <a-button :disabled="shwvStore.crtPos <= 0" @click="prevSegment">
                    <template #icon><icon-left /></template> 前の行
                  </a-button>
                  <a-button :disabled="shwvStore.crtPos >= shwvStore.units.length - 1" @click="nextSegment">
                    次の行 <template #icon><icon-right /></template>
                  </a-button>
                </a-button-group>
              </template>

              <div v-if="currentUnit" class="current-segment-info">
                <div class="info-row">
                  <span class="info-label">原文 (Source):</span>
                  <span class="info-text">{{ currentUnit.src || '(なし)' }}</span>
                </div>
                <div class="info-row" style="margin-top: 8px;">
                  <span class="info-label">現在の訳文 (Target):</span>
                  <span class="info-text highlight-target">{{ currentTargetText || '(未入力)' }}</span>
                </div>
              </div>
              <a-empty v-else description="データが読み込まれていません" />
            </a-card>

            <!-- 初期訳文 (pre) との差分表示（存在する時のみ） -->
            <a-card v-if="preTargetDiff" title="初期適用訳文 (pre) と現在の訳文の差分" :bordered="false" class="tools-card" style="margin-bottom: 16px;">
              <div style="font-size: 13px; margin-bottom: 8px;">
                訳文一致率: <a-tag size="small" :color="getRatioTagColor(preTargetDiff.targetRatio)">{{ preTargetDiff.targetRatio }}%</a-tag>
              </div>
              <div class="diff-html" v-html="preTargetDiff.targetDiffHtml"></div>
            </a-card>

            <!-- 各TM訳文との訳文差分比較 (縦並びカード形式) -->
            <a-card title="TM訳文との差分・類似度比較 (TM Target Diff & Target Ratio)" :bordered="false" class="tools-card">
              <div v-if="tmDiffList.length === 0" style="padding: 16px; text-align: center;">
                <a-empty description="このセグメントに該当するTM参照データ（ref.tms）がありません" />
              </div>

              <!-- サイドバー等のナロー画面に対応した3行1セットのリスト構造 -->
              <div v-else class="tm-diff-list">
                <div v-for="(record, index) in tmDiffList" :key="index" class="tm-diff-item">
                  <!-- 行1: 参照相手のIDX/ファイル情報 & 原文一致率 vs 訳文一致率 -->
                  <div class="item-header">
                    <span class="item-title">
                      <icon-file /> <strong>{{ record.file }}</strong> (TM #{{ record.idx }})
                    </span>
                    <span class="item-ratios">
                      原文一致率: <a-tag size="small" :color="getRatioTagColor(record.sourceRatio)">{{ record.sourceRatio }}%</a-tag>
                      <span class="ratio-vs">vs</span>
                      訳文一致率: <a-tag size="small" :color="getRatioTagColor(record.targetRatio)" style="font-weight: bold;">{{ record.targetRatio }}%</a-tag>
                      <a-tag v-if="record.isRatioMismatch" color="red" size="small" style="margin-left: 4px;">
                        <template #icon><icon-exclamation-circle /></template> 要点検
                      </a-tag>
                    </span>
                  </div>

                  <!-- 行2: 参照訳 (TM Target Text) -->
                  <div class="item-row">
                    <span class="row-label">参照訳 (TM Target):</span>
                    <div class="row-value text-preview">{{ record.tmTarget }}</div>
                  </div>

                  <!-- 行3: 参照訳との差分 (Diff with TM Target Text) -->
                  <div class="item-row" style="margin-top: 6px;">
                    <span class="row-label">参照訳との差分:</span>
                    <div class="row-value diff-html" v-html="record.targetDiffHtml"></div>
                  </div>
                </div>
              </div>
            </a-card>
          </div>

          <!-- Mode B: Manual Target Text Diff -->
          <div v-else class="manual-diff-container">
            <a-card title="訳文テキスト入力差分比較" :bordered="false" class="tools-card" style="margin-bottom: 16px;">
              <a-row :gutter="[16, 16]">
                <a-col :xs="24" :sm="12">
                  <div style="font-weight: 600; margin-bottom: 8px;">比較元訳文 (旧訳文 / TM訳文):</div>
                  <a-textarea v-model="oldText" placeholder="比較元の訳文テキストを入力..." :auto-size="{ minRows: 4, maxRows: 8 }" />
                </a-col>
                <a-col :xs="24" :sm="12">
                  <div style="font-weight: 600; margin-bottom: 8px;">比較先訳文 (現在の訳文 / 修正後):</div>
                  <a-textarea v-model="newText" placeholder="比較先の訳文テキストを入力..." :auto-size="{ minRows: 4, maxRows: 8 }" />
                </a-col>
              </a-row>

              <div style="margin-top: 16px;" class="action-bar">
                <a-space wrap>
                  <a-button type="primary" @click="runLineDiff">
                    <template #icon><icon-play-arrow /></template> 行単位訳文チェック
                  </a-button>
                  <a-button type="outline" @click="runBlockDiff">
                    <template #icon><icon-play-arrow /></template> 全体ブロック訳文チェック
                  </a-button>
                  <a-button type="secondary" @click="importFromDocument">
                    <template #icon><icon-import /></template> 現在の文書から訳文を読み込み
                  </a-button>
                  <a-button type="outline" status="danger" @click="clearManualDiff">
                    <template #icon><icon-delete /></template> クリア
                  </a-button>
                </a-space>
              </div>
            </a-card>

            <a-card v-if="isChecked" title="訳文差分・類似度 (Target Ratio) 結果" :bordered="false" class="tools-card">
              <template #extra>
                <a-checkbox v-model="showOnlyDiff">
                  <template #icon><icon-filter /></template> 差分ありのみ表示 ({{ batchDiff.filter(i => i.hasDiff).length }} / {{ batchDiff.length }})
                </a-checkbox>
              </template>

              <!-- ナロー画面でも読みやすいリストカード表示 -->
              <div class="manual-diff-list">
                <div v-for="record in filteredBatchDiff" :key="record.lineNo" class="manual-diff-item">
                  <div class="item-header">
                    <span class="item-title"># 行 {{ record.lineNo }}</span>
                    <span class="item-ratios">
                      訳文一致率: <a-tag size="small" :color="getRatioTagColor(record.ratio)">{{ record.ratio }}%</a-tag>
                    </span>
                  </div>
                  <div class="item-row">
                    <span class="row-label">比較元 (旧訳文):</span>
                    <div class="row-value text-preview">{{ record.s }}</div>
                  </div>
                  <div class="item-row" style="margin-top: 4px;">
                    <span class="row-label">比較先 (新訳文):</span>
                    <div class="row-value text-preview">{{ record.t }}</div>
                  </div>
                  <div class="item-row" style="margin-top: 6px;">
                    <span class="row-label">訳文差分:</span>
                    <div class="row-value diff-html" v-html="record.d"></div>
                  </div>
                </div>
              </div>
            </a-card>
          </div>
        </div>
      </a-tab-pane>

      <!-- 2. Review HTML Export Subtab -->
      <a-tab-pane key="review" :title="i18nStore.getText('toolsTab', 'reviewSubtab') || 'レビュー'">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('toolsTab', 'exportReviewHtmlCard') || 'レビュー用HTML出力'" :bordered="false" class="tools-card">
            <a-typography-paragraph type="secondary" style="font-size: 13px; margin-bottom: 16px;">
              {{ i18nStore.getText('toolsTab', 'exportReviewHtmlHelp') || '登録用語がハイライトされ段落が再構成された静的HTML (Review_Terms.html) を出力します。ブラウザで安全に全件レビューや印刷が可能です。' }}
            </a-typography-paragraph>
            <a-button type="primary" status="success" size="large" @click="handleExportReviewHtml">
              <template #icon><icon-file /></template>
              {{ i18nStore.getText('toolsTab', 'exportReviewHtmlBtn') || 'レビュー用HTMLを出力' }}
            </a-button>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- 3. QA Subtab (QA 品質チェック) -->
      <a-tab-pane key="qa" :title="i18nStore.getText('toolsTab', 'qaSubtab') || 'QA'">
        <div class="pane-content">
          <!-- Configuration Card -->
          <a-card :bordered="false" class="tools-card" style="margin-bottom: 16px;">
            <template #title>
              <div style="display: flex; align-items: center; gap: 8px;">
                <icon-safe style="color: var(--color-primary-light-4); font-size: 18px;" />
                <span>{{ i18nStore.getText('toolsTab', 'qaTitle') || 'QA (品質チェック)' }}</span>
              </div>
            </template>

            <a-typography-paragraph type="secondary" style="font-size: 13px; margin-bottom: 16px;">
              {{ i18nStore.getText('toolsTab', 'qaHelp') || '全セグメントの品質チェック（数字、タグ、用語集、整合性、PE修正漏れ）を一括実行します。' }}
            </a-typography-paragraph>

            <div class="qa-config-grid">
              <a-checkbox v-model="qaConfig.check_numbers">
                {{ i18nStore.getText('toolsTab', 'qaCheckNumbers') || '数字不一致' }}
              </a-checkbox>
              <a-checkbox v-model="qaConfig.check_tags">
                {{ i18nStore.getText('toolsTab', 'qaCheckTags') || 'タグ / プレースホルダー' }}
              </a-checkbox>
              <a-checkbox v-model="qaConfig.check_terms">
                {{ i18nStore.getText('toolsTab', 'qaCheckTerms') || '用語集 (TB) 含有' }}
              </a-checkbox>
              <a-checkbox v-model="qaConfig.check_consistency">
                {{ i18nStore.getText('toolsTab', 'qaCheckConsistency') || '整合性 (100%一致行)' }}
              </a-checkbox>
              <a-checkbox v-model="qaConfig.check_unmodified_pe">
                {{ i18nStore.getText('toolsTab', 'qaCheckUnmodifiedPe') || 'PE修正漏れ (未編集の下訳)' }}
              </a-checkbox>
            </div>

            <div style="margin-top: 16px;">
              <a-space wrap>
                <a-button type="primary" :disabled="!shwvStore.units || shwvStore.units.length === 0" @click="doRunQa">
                  <template #icon><icon-safe /></template>
                  {{ i18nStore.getText('toolsTab', 'qaRunBtn') || 'QAチェック実行' }}
                </a-button>
                <a-button v-if="qaIssues.length > 0" type="outline" status="success" @click="doExportQaReportCsv">
                  <template #icon><icon-download /></template>
                  {{ i18nStore.getText('toolsTab', 'qaExportReportCsvBtn') || 'QAレポート (CSV)' }}
                </a-button>
                <a-button v-if="qaIssues.length > 0" type="outline" @click="doExportQaReportJson">
                  <template #icon><icon-download /></template>
                  {{ i18nStore.getText('toolsTab', 'qaExportReportJsonBtn') || 'QAレポート (JSON)' }}
                </a-button>
              </a-space>
            </div>
          </a-card>

          <!-- Results Card -->
          <a-card :bordered="false" class="tools-card">
            <template #title>
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>QA 検証結果</span>
                <a-tag v-if="hasRunQa" :color="qaIssues.length > 0 ? 'orange' : 'green'" size="small">
                  {{ qaIssues.length > 0 ? `${qaIssues.length} 件の問題` : 'パス (0 件)' }}
                </a-tag>
              </div>
            </template>

            <!-- State 1: Before Run -->
            <div v-if="!hasRunQa" style="padding: 24px 0; text-align: center;">
              <a-empty :description="i18nStore.getText('toolsTab', 'qaEmptyPrompt') || '「QAチェック実行」ボタンをクリックすると、全セグメントの検証結果がここに表示されます。'" />
            </div>

            <!-- State 2: Passed with 0 errors -->
            <div v-else-if="qaIssues.length === 0" class="qa-pass-banner">
              <icon-check-circle style="font-size: 32px; color: #52c41a; margin-right: 12px; flex-shrink: 0;" />
              <div>
                <div style="font-weight: 700; font-size: 15px; color: #52c41a;">
                  {{ i18nStore.getText('toolsTab', 'qaPassTitle') || 'すべてチェックをクリアしました！' }}
                </div>
                <div style="font-size: 13px; color: var(--color-text-3); margin-top: 4px;">
                  {{ i18nStore.getText('toolsTab', 'qaPassDesc') || '数字、タグ、用語集、100%一致行の整合性、PE修正漏れに問題は見つかりませんでした。' }}
                </div>
              </div>
            </div>

            <!-- State 3: Issues Found -->
            <div v-else class="qa-results-container">
              <!-- Summary Filter Chips -->
              <div class="qa-summary-chips">
                <div class="qa-chip" :class="{ active: selectedIssueFilter === 'ALL' }" @click="selectedIssueFilter = 'ALL'">
                  <span>合計</span>
                  <strong>{{ qaIssues.length }}</strong>
                </div>
                <div class="qa-chip chip-number" :class="{ active: selectedIssueFilter === 'Number' }" @click="selectedIssueFilter = 'Number'">
                  <span>数字</span>
                  <strong>{{ qaCounts.Number }}</strong>
                </div>
                <div class="qa-chip chip-tag" :class="{ active: selectedIssueFilter === 'Tag' }" @click="selectedIssueFilter = 'Tag'">
                  <span>タグ</span>
                  <strong>{{ qaCounts.Tag }}</strong>
                </div>
                <div class="qa-chip chip-term" :class="{ active: selectedIssueFilter === 'Term' }" @click="selectedIssueFilter = 'Term'">
                  <span>用語</span>
                  <strong>{{ qaCounts.Term }}</strong>
                </div>
                <div class="qa-chip chip-consistency" :class="{ active: selectedIssueFilter === 'Consistency' }" @click="selectedIssueFilter = 'Consistency'">
                  <span>整合性</span>
                  <strong>{{ qaCounts.Consistency }}</strong>
                </div>
                <div class="qa-chip chip-unmodifiedpe" :class="{ active: selectedIssueFilter === 'UnmodifiedPe' }" @click="selectedIssueFilter = 'UnmodifiedPe'">
                  <span>PE修正漏れ</span>
                  <strong>{{ qaCounts.UnmodifiedPe }}</strong>
                </div>
              </div>

              <!-- Issue Items List -->
              <div class="qa-issue-list">
                <div v-for="(issue, idx) in filteredQaIssues" :key="idx" class="qa-issue-item">
                  <div class="qa-item-header">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <a-tag color="gray" size="small" style="font-family: monospace; font-weight: bold;">
                        #{{ issue.idx + 1 }} (ID: {{ issue.idx }})
                      </a-tag>
                      <span :class="['qa-type-badge', issue.issue_type.toLowerCase()]">{{ issue.issue_type }}</span>
                      <span class="qa-item-msg">{{ issue.message }}</span>
                    </div>
                    <a-button size="mini" type="text" @click="jumpToQaSegment(issue.idx)">
                      <template #icon><icon-location /></template>
                      {{ i18nStore.getText('toolsTab', 'qaJumpToLine') || 'この行を表示' }}
                    </a-button>
                  </div>

                  <!-- Source & Target Segment Previews -->
                  <div v-if="getQaUnitPreview(issue.idx)" class="qa-item-preview">
                    <div class="preview-row">
                      <span class="preview-label">原文:</span>
                      <span class="preview-val">{{ getQaUnitPreview(issue.idx)?.src }}</span>
                    </div>
                    <div class="preview-row" style="margin-top: 4px;">
                      <span class="preview-label">訳文:</span>
                      <span class="preview-val preview-target">{{ getQaUnitPreview(issue.idx)?.tgt || '(未入力)' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- 4. Sub-editor Subtab (サブエディタ) -->
      <a-tab-pane key="subeditor" :title="i18nStore.getText('toolsTab', 'subeditorSubtab') || 'サブエディタ'">
        <div class="pane-content">
          <a-card :bordered="false" class="tools-card">
            <a-empty :description="i18nStore.getText('toolsTab', 'underConstruction') || '作成中'" />
          </a-card>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
#tools-tab {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.pane-content {
  padding: 0 16px;
  overflow-y: auto;
  height: 100%;
}

.tools-card {
  background-color: var(--color-bg-2);
  border-radius: 4px;
}

.segment-header-title {
  display: flex;
  align-items: center;
}

.current-segment-info {
  background-color: var(--color-fill-2);
  padding: 12px;
  border-radius: 4px;
}

.info-row {
  display: flex;
  font-size: 13px;
}

.info-label {
  width: 140px;
  font-weight: 600;
  color: var(--color-text-2);
  flex-shrink: 0;
}

.info-text {
  flex: 1;
  word-break: break-all;
}

.highlight-target {
  color: var(--color-primary-light-4);
  font-weight: 500;
}

/* TM Diff Vertical Card List Styling */
.tm-diff-list, .manual-diff-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tm-diff-item, .manual-diff-item {
  background-color: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  padding: 12px;
}

.item-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-1);
  margin-bottom: 8px;
}

.item-title {
  font-size: 13px;
  color: var(--color-text-1);
}

.item-ratios {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.ratio-vs {
  color: var(--color-text-3);
  font-weight: bold;
}

.item-row {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  gap: 2px;
}

.row-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-3);
}

.row-value {
  word-break: break-all;
  line-height: 1.5;
}

.text-preview {
  color: var(--color-text-2);
  background-color: var(--color-bg-1);
  padding: 6px 8px;
  border-radius: 4px;
}

.diff-html {
  background-color: var(--color-bg-1);
  padding: 6px 8px;
  border-radius: 4px;
}

.diff-html :deep(ins) {
  background-color: rgba(46, 160, 67, 0.25);
  color: #2da44e;
  text-decoration: none;
  padding: 2px 4px;
  border-radius: 2px;
}

.diff-html :deep(del) {
  background-color: rgba(207, 34, 46, 0.25);
  color: #cf222e;
  text-decoration: line-through;
  padding: 2px 4px;
  border-radius: 2px;
}

.action-bar {
  display: flex;
  align-items: center;
}

/* QA Subtab Styles */
.qa-config-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  background-color: var(--color-fill-2);
  padding: 12px 16px;
  border-radius: 4px;
}

.qa-pass-banner {
  display: flex;
  align-items: center;
  background-color: rgba(82, 196, 26, 0.1);
  border: 1px solid rgba(82, 196, 26, 0.3);
  padding: 16px 20px;
  border-radius: 6px;
}

.qa-results-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qa-summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border-2);
}

.qa-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background-color: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-2);
}

.qa-chip:hover {
  border-color: var(--color-primary-light-3);
}

.qa-chip.active {
  background-color: var(--color-primary-light-1);
  border-color: var(--color-primary-light-4);
  color: var(--color-primary-light-4);
}

.qa-chip strong {
  font-weight: bold;
}

.qa-chip.chip-number strong { color: #60a5fa; }
.qa-chip.chip-tag strong { color: #f59e0b; }
.qa-chip.chip-term strong { color: #a78bfa; }
.qa-chip.chip-consistency strong { color: #ec4899; }
.qa-chip.chip-unmodifiedpe strong { color: #f97316; }

.qa-issue-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qa-issue-item {
  background-color: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.qa-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.qa-type-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.qa-type-badge.number { background: rgba(96, 165, 250, 0.15); color: #60a5fa; }
.qa-type-badge.tag { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.qa-type-badge.term { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
.qa-type-badge.consistency { background: rgba(236, 72, 153, 0.15); color: #ec4899; }
.qa-type-badge.unmodifiedpe { background: rgba(249, 115, 22, 0.15); color: #f97316; }

.qa-item-msg {
  font-size: 13px;
  color: var(--color-text-1);
}

.qa-item-preview {
  background-color: var(--color-bg-1);
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-label {
  color: var(--color-text-3);
  font-weight: 600;
  min-width: 36px;
  flex-shrink: 0;
}

.preview-val {
  color: var(--color-text-2);
  word-break: break-all;
}

.preview-val.preview-target {
  color: var(--color-text-1);
  font-weight: 500;
}
</style>
