<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { 
  IconFilter, 
  IconCheckCircle, 
  IconSync, 
  IconUndo, 
  IconLeft, 
  IconRight,
  IconUnorderedList,
  IconFile,
  IconCheck
} from '@arco-design/web-vue/es/icon';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import type { ShWvUnit } from '../../../src/types/datatype';
import DualCodeMirror from './common/DualCodeMirror.vue';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();
const emit = defineEmits(['FilterCommand']);

const srcFilter = ref('');
const tgtFilter = ref('');
const filteredUnits = ref<(ShWvUnit & { ori?: string })[]>([]);

// ページネーション設定
const displayMode = ref<'paged' | 'all'>('paged');
const pageSize = ref(20);
const currentPage = ref(1);

// 全体の訳文バッファと初期状態
const allTargetLines = ref<string[]>([]);
const originalTargetLines = ref<string[]>([]);

// 現在のページのテキスト
const targetText = ref('');
const isLineCountMatching = ref(true);
const isPropagating = ref(false);

const totalUnits = computed(() => filteredUnits.value.length);
const totalPages = computed(() => Math.ceil(totalUnits.value / pageSize.value) || 1);

const startIndex = computed(() => {
  if (displayMode.value === 'all') return 0;
  return (currentPage.value - 1) * pageSize.value;
});

const endIndex = computed(() => {
  if (displayMode.value === 'all') return totalUnits.value;
  return Math.min(currentPage.value * pageSize.value, totalUnits.value);
});

// 現在表示中のセグメント群
const currentPageUnits = computed(() => {
  return filteredUnits.value.slice(startIndex.value, endIndex.value);
});

// 原文テキスト（表示中のセグメントのみ）
const sourceText = computed(() => {
  return currentPageUnits.value.map(u => u.src || '').join('\n');
});

// ページ変更時に targetText を更新
const syncTargetTextFromBuffer = () => {
  const slice = allTargetLines.value.slice(startIndex.value, endIndex.value);
  targetText.value = slice.join('\n');
};

const handleFilter = () => {
  isPropagating.value = true;
  emit('FilterCommand', 'save-and-propagate');
  
  setTimeout(() => {
    if (isPropagating.value) {
      isPropagating.value = false;
      applyFilterLogic();
    }
  }, 1000);
};

watch(() => shwvStore.units, () => {
  if (isPropagating.value) {
    isPropagating.value = false;
    applyFilterLogic();
  }
});

const applyFilterLogic = () => {
  try {
    const rawUnits = shwvStore.getFilteredUnits(srcFilter.value, tgtFilter.value);

    const sorted = [...rawUnits].sort((a, b) => {
      if (a.idx === -1 && b.idx !== -1) return 1;
      if (a.idx !== -1 && b.idx === -1) return -1;
      return (a.idx ?? 0) - (b.idx ?? 0);
    });

    filteredUnits.value = JSON.parse(JSON.stringify(sorted));
    currentPage.value = 1;
    
    // 全体バッファの初期化
    const initialTgtLines = filteredUnits.value.map(u => u.tgt || '');
    allTargetLines.value = [...initialTgtLines];
    originalTargetLines.value = [...initialTgtLines];

    syncTargetTextFromBuffer();
  } catch (err: any) {
    console.error('[FilterView] Filter logic error:', err);
  }
};

// ページ切り替え or 表示モード変更時の監視
watch([currentPage, displayMode], () => {
  syncTargetTextFromBuffer();
});

// エディタ側での訳文編集を全体バッファへ反映
const handleTargetUpdate = (newText: string) => {
  targetText.value = newText;
  const newLines = newText.split('\n');

  // 表示中のスライス範囲を更新
  for (let i = 0; i < newLines.length; i++) {
    const bufferIdx = startIndex.value + i;
    if (bufferIdx < allTargetLines.value.length) {
      allTargetLines.value[bufferIdx] = newLines[i];
    }
  }
};

// 全体を通した変更箇所の算出
const modifiedUpdates = computed(() => {
  if (filteredUnits.value.length === 0) return [];
  
  const updates: { idx: number; tgt: string }[] = [];

  for (let i = 0; i < filteredUnits.value.length; i++) {
    const unit = filteredUnits.value[i];
    const currentLine = allTargetLines.value[i] ?? '';
    const origLine = originalTargetLines.value[i] ?? '';

    // TM行（idx === -1）は除外、変更があるプロジェクト行のみ
    if (unit.idx >= 0 && currentLine !== origLine) {
      updates.push({
        idx: unit.idx,
        tgt: currentLine
      });
    }
  }

  return updates;
});

const modifiedCount = computed(() => modifiedUpdates.value.length);

// 現在の表示ページ内での変更箇所の算出
const currentPageModifiedUpdates = computed(() => {
  if (currentPageUnits.value.length === 0) return [];

  const updates: { idx: number; tgt: string }[] = [];

  for (let i = 0; i < currentPageUnits.value.length; i++) {
    const bufferIdx = startIndex.value + i;
    const unit = filteredUnits.value[bufferIdx];
    const currentLine = allTargetLines.value[bufferIdx] ?? '';
    const origLine = originalTargetLines.value[bufferIdx] ?? '';

    if (unit && unit.idx >= 0 && currentLine !== origLine) {
      updates.push({
        idx: unit.idx,
        tgt: currentLine
      });
    }
  }

  return updates;
});

const currentPageModifiedCount = computed(() => currentPageModifiedUpdates.value.length);

// 全体の変更を一括適用
const handleApplyAll = () => {
  if (!isLineCountMatching.value || modifiedUpdates.value.length === 0) {
    return;
  }

  const safePayload = JSON.parse(JSON.stringify(modifiedUpdates.value));
  emit('FilterCommand', 'update-units', safePayload);

  // 適用した内容を基準状態として同期
  originalTargetLines.value = [...allTargetLines.value];
};

// 現在表示中のページの内容のみを反映
const handleApplyCurrentPage = () => {
  if (!isLineCountMatching.value || currentPageModifiedUpdates.value.length === 0) {
    return;
  }

  const safePayload = JSON.parse(JSON.stringify(currentPageModifiedUpdates.value));
  emit('FilterCommand', 'update-units', safePayload);

  // 現在ページの範囲のみ基準状態を更新
  for (let i = 0; i < currentPageUnits.value.length; i++) {
    const bufferIdx = startIndex.value + i;
    originalTargetLines.value[bufferIdx] = allTargetLines.value[bufferIdx];
  }
};

const handleResetTarget = () => {
  allTargetLines.value = [...originalTargetLines.value];
  syncTargetTextFromBuffer();
};

const clearFilter = () => {
  srcFilter.value = '';
  tgtFilter.value = '';
  handleFilter();
};

const handleLineMismatch = (matching: boolean) => {
  isLineCountMatching.value = matching;
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};
</script>

<template>
  <div class="filter-view">
    <!-- Input Toolbar Area -->
    <a-row :gutter="10" align="center" class="toolbar-row">
      <a-col :span="6">
        <a-input
          v-model="srcFilter"
          :placeholder="i18nStore.getText('searchTab', 'srcFilterPlaceholder') || '原文フィルタ (Source Filter)'"
          allow-clear
          size="small"
          @press-enter="handleFilter"
        >
          <template #prefix>SRC</template>
        </a-input>
      </a-col>
      <a-col :span="6">
        <a-input
          v-model="tgtFilter"
          :placeholder="i18nStore.getText('searchTab', 'tgtFilterPlaceholder') || '訳文フィルタ (Target Filter)'"
          allow-clear
          size="small"
          @press-enter="handleFilter"
        >
          <template #prefix>TGT</template>
        </a-input>
      </a-col>
      <a-col :span="12">
        <a-space size="small" wrap>
          <a-button type="primary" size="small" @click="handleFilter" :loading="isPropagating">
            <template #icon><icon-filter /></template>
            {{ i18nStore.getText('searchTab', 'filterBtn') || '抽出' }}
          </a-button>
          
          <!-- 表示中のみ反映ボタン (分割表示時) -->
          <a-button
            v-if="displayMode === 'paged' && totalPages > 1"
            type="primary"
            status="success"
            size="small"
            :disabled="!isLineCountMatching || currentPageModifiedCount === 0"
            @click="handleApplyCurrentPage"
            title="現在表示されている20行の中の変更分のみを反映します"
          >
            <template #icon><icon-check /></template>
            {{ i18nStore.getText('searchTab', 'applyCurrentBtn', { count: currentPageModifiedCount }) || `表示中を反映 (${currentPageModifiedCount})` }}
          </a-button>

          <!-- すべて反映ボタン -->
          <a-button
            type="primary"
            :status="displayMode === 'paged' && totalPages > 1 ? 'warning' : 'success'"
            size="small"
            :disabled="!isLineCountMatching || modifiedCount === 0"
            @click="handleApplyAll"
            :title="displayMode === 'paged' && totalPages > 1 ? '他ページを含むすべての変更分を一括反映します' : 'すべての変更分を反映します'"
          >
            <template #icon><icon-check-circle /></template>
            <template v-if="displayMode === 'paged' && totalPages > 1">
              {{ i18nStore.getText('searchTab', 'applyAllBtn', { count: modifiedCount }) || `すべて反映 (${modifiedCount})` }}
            </template>
            <template v-else>
              {{ i18nStore.getText('searchTab', 'applyBtn', { count: modifiedCount }) || `反映 (${modifiedCount})` }}
            </template>
          </a-button>

          <a-button
            v-if="modifiedCount > 0"
            type="outline"
            status="danger"
            size="small"
            @click="handleResetTarget"
            title="すべての編集内容を元に戻す"
          >
            <template #icon><icon-undo /></template>
          </a-button>
        </a-space>
      </a-col>
    </a-row>

    <!-- Pagination & View Mode Bar (セグメントが存在する場合に表示) -->
    <div v-if="totalUnits > 0" class="pagination-bar">
      <div class="pagination-left">
        <a-radio-group v-model="displayMode" type="button" size="mini">
          <a-radio value="paged">
            <template #icon><icon-file /></template>
            20行分割
          </a-radio>
          <a-radio value="all">
            <template #icon><icon-unordered-list /></template>
            すべて表示 ({{ totalUnits }}件)
          </a-radio>
        </a-radio-group>
      </div>

      <div v-if="displayMode === 'paged' && totalPages > 1" class="pagination-controls">
        <a-button size="mini" :disabled="currentPage <= 1" @click="prevPage">
          <template #icon><icon-left /></template>
          前へ
        </a-button>

        <span class="page-indicator">
          {{ startIndex + 1 }} - {{ endIndex }} / <b>{{ totalUnits }}</b> 件 
          <span class="page-num">({{ currentPage }} / {{ totalPages }} ページ)</span>
        </span>

        <a-button size="mini" :disabled="currentPage >= totalPages" @click="nextPage">
          次へ
          <template #icon><icon-right /></template>
        </a-button>
      </div>

      <div v-else class="pagination-info">
        <span class="page-indicator">全 <b>{{ totalUnits }}</b> 件を表示中</span>
      </div>
    </div>

    <!-- Editor / Results Area -->
    <div class="editor-wrapper">
      <div v-if="totalUnits > 0" class="editor-container">
        <DualCodeMirror
          :key="`${displayMode}-${currentPage}`"
          :source-text="sourceText"
          :target-text="targetText"
          :source-highlight="srcFilter"
          :target-highlight="tgtFilter"
          :allow-newline="false"
          @update:target-text="handleTargetUpdate"
          @line-mismatch="handleLineMismatch"
        />
      </div>
      <a-empty v-else class="empty-state">
        <template #extra>
          <a-typography-text v-if="srcFilter || tgtFilter">
            {{ i18nStore.getText('searchTab', 'noUnitsMatch', { keyword: srcFilter || tgtFilter }) || `"${srcFilter || tgtFilter}" に一致するセグメントはありません` }}
          </a-typography-text>
          <a-typography-text v-else type="secondary">
            {{ i18nStore.getText('searchTab', 'enterKeywordsPrompt') || 'キーワードを入力してセグメントを抽出し、2画面エディタで一括編集できます' }}
          </a-typography-text>
        </template>
      </a-empty>
    </div>
  </div>
</template>

<style scoped>
.filter-view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar-row {
  margin-bottom: 8px;
  flex-shrink: 0;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  margin-bottom: 8px;
  background-color: #1a1d2e;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.pagination-left {
  display: flex;
  align-items: center;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-info {
  display: flex;
  align-items: center;
}

.page-indicator {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.page-num {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin-left: 4px;
}

.editor-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.empty-state {
  margin: auto;
}
</style>
