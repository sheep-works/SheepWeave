<template>
  <div class="bypass-tab">
    <!-- ヘッダー / モード切替バー -->
    <div class="header-section">
      <div class="header-left">
        <a-space align="center">
          <icon-code-sandbox :style="{ fontSize: '22px' }" />
          <a-typography-title :heading="4" style="margin: 0">
            {{ i18nStore.getText('bypassTab', 'title') || 'サブエディタ (Sub-Editor)' }}
          </a-typography-title>
          <a-tag color="purple" size="small" bordered>
            {{ i18nStore.getText('bypassTab', 'experimentalBadge') || '実験的機能' }}
          </a-tag>
        </a-space>

        <a-radio-group v-model="subEditorMode" type="button" size="small" style="margin-left: 16px;">
          <a-radio value="bypass">
            <template #icon><icon-branch /></template>
            {{ i18nStore.getText('bypassTab', 'modeBypass') || '🔀 バイパス翻訳 (Diff)' }}
          </a-radio>
          <a-radio value="free">
            <template #icon><icon-edit /></template>
            {{ i18nStore.getText('bypassTab', 'modeFree') || '📝 フリーエディタ' }}
          </a-radio>
        </a-radio-group>
      </div>

      <div class="header-right">
        <a-space size="small">
          <a-button
            type="primary"
            status="success"
            size="small"
            :disabled="modifiedCount === 0"
            @click="handleApplyAll"
          >
            <template #icon><icon-check-circle /></template>
            {{ i18nStore.getText('bypassTab', 'applyAllBtn', { count: modifiedCount }) || `一括反映 (${modifiedCount})` }}
          </a-button>

          <a-button
            v-if="modifiedCount > 0"
            type="outline"
            status="warning"
            size="small"
            @click="handleResetAll"
          >
            <template #icon><icon-undo /></template>
            すべて元に戻す
          </a-button>
        </a-space>
      </div>
    </div>

    <a-divider style="margin: 10px 0;" />

    <!-- 抽出・追加ツールバー -->
    <div class="toolbar-section">
      <a-space wrap size="small">
        <a-button size="small" type="primary" @click="loadCurrentCursorUnit">
          <template #icon><icon-location /></template>
          カーソル行 (#{{ shwvStore.crtPos + 1 }}) を読み込み
        </a-button>

        <a-button size="small" type="outline" @click="loadQuotedClusters">
          <template #icon><icon-copy /></template>
          類似文 (Quoted) クラスタ抽出
        </a-button>

        <a-select v-model="newlineMode" size="small" style="width: 200px;">
          <a-option value="auto">改行: 自動判定 (Auto)</a-option>
          <a-option value="escape">改行: \n 記号に変換</a-option>
          <a-option value="smart">改行: スマート連結 (CJK自動)</a-option>
          <a-option value="nospace">改行: 空白なし連結 ('')</a-option>
          <a-option value="space">改行: 半角スペース連結 (' ')</a-option>
          <a-option value="custom">改行: カスタム区切り文字...</a-option>
        </a-select>

        <a-input
          v-if="newlineMode === 'custom'"
          v-model="customDelimiter"
          placeholder="区切り文字 (例: <br/>)"
          size="small"
          style="width: 130px;"
        />

        <a-input-number
          v-model="inputTargetIdx"
          placeholder="行番号"
          size="small"
          style="width: 100px;"
          :min="1"
          :max="shwvStore.units.length || 1"
          @press-enter="addUnitByIdx"
        />

        <a-button size="small" @click="addUnitByIdx">
          追加
        </a-button>

        <a-button
          v-if="activeUnits.length > 0"
          size="small"
          type="text"
          status="danger"
          @click="clearActiveUnits"
        >
          <template #icon><icon-delete /></template>
          クリア
        </a-button>
      </a-space>
    </div>

    <!-- ユニットカード一覧エリア -->
    <div class="cards-scroll-area">
      <div v-if="activeUnits.length > 0" class="cards-container">
        <!-- バイパス翻訳時の基準ユニット情報バナー -->
        <div v-if="subEditorMode === 'bypass' && baseUnit" class="base-unit-banner">
          <span class="base-title">🎯 基準セグメント: #{{ baseUnit.idx + 1 }}</span>
          <span class="base-text">{{ baseUnit.src }}</span>
        </div>

        <UnitEditorCard
          v-for="unit in activeUnits"
          :key="unit.idx"
          :ref="(el: any) => setCardRef(unit.idx, el)"
          :unit="unit"
          :base-unit="baseUnit"
          :mode="subEditorMode"
          :model-value="editedTargets[unit.idx] ?? unit.tgt ?? ''"
          :original-text="originalTargets[unit.idx] ?? unit.tgt ?? ''"
          :source-value="editedSources[unit.idx] ?? unit.src ?? ''"
          :original-source-text="originalSources[unit.idx] ?? unit.src ?? ''"
          :match-ratio="unit.matchRatio"
          :newline-mode="newlineMode"
          :custom-delimiter="customDelimiter"
          @update:model-value="updateTarget(unit.idx, $event)"
          @update:source-value="updateSource(unit.idx, $event)"
          @apply-single="handleApplySingle"
          @reset-single="handleResetSingle"
          @navigate-next="handleNavigateNext"
          @navigate-prev="handleNavigatePrev"
        />
      </div>

      <a-empty v-else class="empty-state">
        <template #extra>
          <p>{{ i18nStore.getText('bypassTab', 'emptyPrompt') || '編集対象のセグメントが読み込まれていません' }}</p>
          <p class="subtitle">
            上部のツールバー、またはエディタで右クリックして「バイパス翻訳」「フリーエディタ」を選択してください。
          </p>
        </template>
      </a-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { 
  IconCodeSandbox, 
  IconBranch, 
  IconEdit, 
  IconCheckCircle, 
  IconUndo,
  IconLocation,
  IconCopy,
  IconDelete
} from '@arco-design/web-vue/es/icon';
import { Message } from '@arco-design/web-vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';
import type { ShWvUnit } from '../../../src/types/datatype';
import { DiffUtils } from '../utils/diffUtils';
import { smartJoinLines, type NewlineJoinMode } from '../utils/textUtils';
import UnitEditorCard from '../components/subeditor/UnitEditorCard.vue';

const shwvStore = useShWvStore();
const i18nStore = useI18nStore();
const emit = defineEmits(['BypassCommand']);

const subEditorMode = ref<'bypass' | 'free'>('bypass');
const newlineMode = ref<NewlineJoinMode>('auto');
const customDelimiter = ref('');
const activeUnits = ref<(ShWvUnit & { matchRatio?: number })[]>([]);
const editedTargets = ref<{ [idx: number]: string }>({});
const originalTargets = ref<{ [idx: number]: string }>({});
const editedSources = ref<{ [idx: number]: string }>({});
const originalSources = ref<{ [idx: number]: string }>({});
const baseUnit = ref<ShWvUnit | null>(null);
const inputTargetIdx = ref<number | undefined>(undefined);

// 改行整形関数
const formatTargetForUnit = (unit: ShWvUnit, rawTgt: string) => {
  const src = unit.src || '';
  const hasSourceNewlines = src.includes('\\n') || src.includes('\n');
  return smartJoinLines(rawTgt, newlineMode.value, customDelimiter.value, hasSourceNewlines);
};

// 変更行のリスト
const modifiedPayloads = computed(() => {
  const updates: { idx: number; tgt: string }[] = [];
  for (const unit of activeUnits.value) {
    if (unit.idx >= 0) {
      const curTgt = editedTargets.value[unit.idx];
      const origTgt = originalTargets.value[unit.idx];
      if (curTgt !== undefined && curTgt !== origTgt) {
        updates.push({
          idx: unit.idx,
          tgt: formatTargetForUnit(unit, curTgt)
        });
      }
    }
  }
  return updates;
});

const modifiedCount = computed(() => modifiedPayloads.value.length);

const updateTarget = (idx: number, text: string) => {
  editedTargets.value[idx] = text;
};

const updateSource = (idx: number, text: string) => {
  editedSources.value[idx] = text;
};

// ユニットの登録ヘルパー
const registerUnits = (units: ShWvUnit[], primaryUnit?: ShWvUnit) => {
  const newUnits: (ShWvUnit & { matchRatio?: number })[] = [];
  const base = primaryUnit || units[0] || null;
  baseUnit.value = base;

  for (const u of units) {
    let ratio: number | undefined = undefined;
    if (base && base.idx !== u.idx) {
      ratio = DiffUtils.getRatio(base.src || '', u.src || '');
    }

    newUnits.push({
      ...u,
      matchRatio: ratio
    });

    if (editedTargets.value[u.idx] === undefined) {
      editedTargets.value[u.idx] = u.tgt || '';
    }
    if (originalTargets.value[u.idx] === undefined) {
      originalTargets.value[u.idx] = u.tgt || '';
    }
    if (editedSources.value[u.idx] === undefined) {
      editedSources.value[u.idx] = u.src || '';
    }
    if (originalSources.value[u.idx] === undefined) {
      originalSources.value[u.idx] = u.src || '';
    }
  }

  activeUnits.value = newUnits;
};

// 現在カーソル行の読み込み
const loadCurrentCursorUnit = () => {
  const cur = shwvStore.currentUnit;
  if (!cur) {
    Message.warning('カーソル位置のセグメントが見つかりません');
    return;
  }

  if (subEditorMode.value === 'bypass') {
    // バイパスモード: quoted 類似セグメントがあれば一緒に読み込む
    loadQuotedForUnit(cur);
  } else {
    // フリーエディタモード: 単体ユニットを読み込む
    registerUnits([cur], cur);
    Message.success(`セグメント #${cur.idx + 1} を読み込みました`);
  }
};

// ユニットの Quoted 類似セグメント群の読み込み
const loadQuotedForUnit = (primaryUnit: ShWvUnit) => {
  const relatedUnits: ShWvUnit[] = [primaryUnit];
  
  if (primaryUnit.quoted && primaryUnit.quoted.length > 0) {
    for (const qIdx of primaryUnit.quoted) {
      const found = shwvStore.units.find(u => u.idx === qIdx);
      if (found && !relatedUnits.some(r => r.idx === found.idx)) {
        relatedUnits.push(found);
      }
    }
  } else {
    // quoted が明示されていない場合、類似度の高いセグメント（>70%）を自動探索（最大5件）
    const candidates: { unit: ShWvUnit; ratio: number }[] = [];
    for (const u of shwvStore.units) {
      if (u.idx !== primaryUnit.idx) {
        const ratio = DiffUtils.getRatio(primaryUnit.src || '', u.src || '');
        if (ratio >= 70) {
          candidates.push({ unit: u, ratio });
        }
      }
    }
    candidates.sort((a, b) => b.ratio - a.ratio);
    candidates.slice(0, 5).forEach(c => relatedUnits.push(c.unit));
  }

  registerUnits(relatedUnits, primaryUnit);
  Message.success(`セグメント #${primaryUnit.idx + 1} と類似 ${relatedUnits.length - 1} 件を読み込みました`);
};

// Quoted クラスタ全体の一括抽出
const loadQuotedClusters = () => {
  const unitsWithQuoted = shwvStore.units.filter(u => u.quoted && u.quoted.length > 0);
  if (unitsWithQuoted.length === 0) {
    Message.info('quoted（類似クラスタ）が設定されているセグメントはありません');
    return;
  }
  registerUnits(unitsWithQuoted.slice(0, 10));
  Message.success(`${Math.min(unitsWithQuoted.length, 10)} 件のクラスタセグメントを抽出しました`);
};

// 指定行番号の追加
const addUnitByIdx = () => {
  if (!inputTargetIdx.value) return;
  const idx = inputTargetIdx.value - 1;
  const unit = shwvStore.units.find(u => u.idx === idx);
  if (!unit) {
    Message.warning(`行 #${inputTargetIdx.value} は存在しません`);
    return;
  }

  if (!activeUnits.value.some(u => u.idx === unit.idx)) {
    registerUnits([...activeUnits.value, unit], baseUnit.value || unit);
  }
  inputTargetIdx.value = undefined;
};

const clearActiveUnits = () => {
  activeUnits.value = [];
  baseUnit.value = null;
};

// 単一ユニットの反映
const handleApplySingle = (payload: { idx: number; tgt: string }) => {
  emit('BypassCommand', 'update-units', [payload]);
  originalTargets.value[payload.idx] = editedTargets.value[payload.idx] || payload.tgt;
  Message.success(`セグメント #${payload.idx + 1} を反映しました`);
};

// 単一ユニットのリセット
const handleResetSingle = (idx: number) => {
  editedTargets.value[idx] = originalTargets.value[idx] || '';
};

// 全変更の一括反映
const handleApplyAll = () => {
  if (modifiedPayloads.value.length === 0) return;

  const payloads = JSON.parse(JSON.stringify(modifiedPayloads.value));
  emit('BypassCommand', 'update-units', payloads);

  for (const p of payloads) {
    originalTargets.value[p.idx] = editedTargets.value[p.idx] || p.tgt;
  }
  Message.success(`${payloads.length} 件の変更を一括反映しました`);
};

// カード参照管理
const cardRefs = ref<{ [idx: number]: any }>({});
const setCardRef = (idx: number, el: any) => {
  if (el) {
    cardRefs.value[idx] = el;
  } else {
    delete cardRefs.value[idx];
  }
};

const handleNavigateNext = (currentIdx: number) => {
  const currentIndex = activeUnits.value.findIndex(u => u.idx === currentIdx);
  if (currentIndex !== -1 && currentIndex < activeUnits.value.length - 1) {
    const nextUnit = activeUnits.value[currentIndex + 1];
    const nextCard = cardRefs.value[nextUnit.idx];
    if (nextCard) {
      nextCard.focus();
      nextCard.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};

const handleNavigatePrev = (currentIdx: number) => {
  const currentIndex = activeUnits.value.findIndex(u => u.idx === currentIdx);
  if (currentIndex > 0) {
    const prevUnit = activeUnits.value[currentIndex - 1];
    const prevCard = cardRefs.value[prevUnit.idx];
    if (prevCard) {
      prevCard.focus();
      prevCard.$el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
};

// すべて元に戻す
const handleResetAll = () => {
  for (const u of activeUnits.value) {
    editedTargets.value[u.idx] = originalTargets.value[u.idx] || '';
  }
};

// 外部メッセージ（右クリックメニューからの起動）リスナー
onMounted(() => {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'OPEN_SUB_EDITOR') {
      const mode = message.data?.mode || 'bypass';
      const line = message.data?.line ?? shwvStore.crtPos;
      subEditorMode.value = mode;

      const targetUnit = shwvStore.units.find(u => u.idx === line);
      if (targetUnit) {
        if (mode === 'bypass') {
          loadQuotedForUnit(targetUnit);
        } else {
          registerUnits([targetUnit], targetUnit);
        }
      }
    }
  });
});
</script>

<style scoped>
.bypass-tab {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.toolbar-section {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.cards-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.base-unit-banner {
  background-color: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.3);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.base-title {
  font-size: 11px;
  font-weight: 600;
  color: #38bdf8;
}

.base-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.empty-state {
  margin-top: 40px;
  text-align: center;
}

.empty-state .subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 6px;
}
</style>
