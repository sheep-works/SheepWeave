<script setup lang="ts">
import { IconFilter, IconCheckCircle, IconSync, IconLoop } from '@arco-design/web-vue/es/icon';
import { useShWvStore } from '../store/shwv';
import type { ShWvUnit } from '../../../src/types/datatype'
import { ref, watch } from 'vue';

const shwvStore = useShWvStore();
const emit = defineEmits(['FilterCommand']);

const srcFilter = ref('');
const tgtFilter = ref('');
const filteredUnits = ref<(ShWvUnit & { ori: string })[]>([]);

const isPropagating = ref(false);

const handleFilter = () => {
    isPropagating.value = true;
    emit('FilterCommand', 'save-and-propagate');
    
    // Auto-fallback in case backend response takes too long or fails
    setTimeout(() => {
        if (isPropagating.value) {
            isPropagating.value = false;
            applyFilterLogic();
        }
    }, 1000);
};

// Listen for updated units from backend save-and-propagate
watch(() => shwvStore.units, () => {
    if (isPropagating.value) {
        isPropagating.value = false;
        applyFilterLogic();
    }
});

const applyFilterLogic = () => {
    try {
        const rawUnits = shwvStore.getFilteredUnits(srcFilter.value, tgtFilter.value);

        // Sort: idx !== -1 first, then idx === -1 at the bottom
        const sorted = [...rawUnits].sort((a, b) => {
            if (a.idx === -1 && b.idx !== -1) return 1;
            if (a.idx !== -1 && b.idx === -1) return -1;
            return (a.idx ?? 0) - (b.idx ?? 0);
        });

        // Safe deep copy to break reactivity for local editing
        filteredUnits.value = JSON.parse(JSON.stringify(sorted));
    } catch (err: any) {
        console.error('[FilterTab] Filter logic error:', err);
    }
};

const handleApply = () => {
    // 実際に変更があったもの（tgt !== ori）かつ有効なidx（>= 0）のみを抽出
    const updates = filteredUnits.value.filter(u => u.tgt !== u.ori && u.idx >= 0);

    if (updates.length === 0) {
        return;
    }

    // Proxyオブジェクトを剥がして通信エラーを回避
    const safePayload = JSON.parse(JSON.stringify(updates));
    emit('FilterCommand', 'update-units', safePayload);
};

const clearFilter = () => {
    srcFilter.value = '';
    tgtFilter.value = '';
    handleFilter();
};

const resetUnit = (unit: ShWvUnit & { ori: string }) => {
    unit.tgt = unit.ori;
};

</script>

<template>
    <div id="filter-tab">
        <div class="header">
            <a-space>
                <icon-filter :style="{ fontSize: '24px', marginRight: '8px' }" />
                <a-typography-title :heading="4" style="margin: 0">Filter & Edit</a-typography-title>
            </a-space>
        </div>

        <a-divider />

        <!-- Input Area -->
        <a-row :gutter="24" align="center">
            <a-col :span="9">
                <a-input v-model="srcFilter" placeholder="Source Filter" allow-clear @press-enter="handleFilter">
                    <template #prefix>SRC</template>
                </a-input>
            </a-col>
            <a-col :span="9">
                <a-input v-model="tgtFilter" placeholder="Target Filter" allow-clear @press-enter="handleFilter">
                    <template #prefix>TGT</template>
                </a-input>
            </a-col>
            <a-col :span="6">
                <a-space>
                    <a-button type="primary" @click="handleFilter" :loading="isPropagating">
                        <template #icon><icon-filter /></template>
                        Filter
                    </a-button>
                    <a-button type="outline" status="success" :disabled="filteredUnits.length === 0"
                        @click="handleApply">
                        <template #icon><icon-check-circle /></template>
                        Apply ({{filteredUnits.filter(u => u.tgt !== u.ori && u.idx >= 0).length}})
                    </a-button>
                </a-space>
            </a-col>
        </a-row>

        <a-divider />

        <!-- Results Area -->
        <div class="list-container">
            <a-list v-if="filteredUnits.length > 0" :bordered="false">
                <template #header>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <a-typography-text type="secondary">
                            Found {{ filteredUnits.length }} segments
                        </a-typography-text>
                        <a-button size="mini" type="text" @click="clearFilter">
                            <template #icon><icon-sync /></template> Reset
                        </a-button>
                    </div>
                </template>
                <a-list-item v-for="unit in filteredUnits" :key="unit.idx" :class="{ 'tm-item': unit.idx === -1 }">
                    <a-row :gutter="16" align="center">
                        <a-col :span="3">
                            <a-tag :color="unit.idx === -1 ? 'orange' : 'blue'">
                                {{ unit.idx === -1 ? 'TM' : '#' + (unit.idx + 1) }}
                            </a-tag>
                        </a-col>
                        <a-col :span="10">
                            <div class="src-text">{{ unit.src }}</div>
                        </a-col>
                        <a-col :span="11">
                            <a-space fill>
                                <a-textarea v-model="unit.tgt"
                                    :placeholder="unit.idx === -1 ? '(Read-only TM)' : 'Enter translation...'"
                                    :readonly="unit.idx === -1" :status="unit.tgt !== unit.ori ? 'warning' : ''"
                                    :style="unit.idx === -1 ? { opacity: 0.6 } : {}" />
                                <a-button v-if="unit.idx !== -1" type="text" size="small" @click="resetUnit(unit)"
                                    :disabled="unit.tgt === unit.ori">
                                    <template #icon><icon-loop /></template>
                                </a-button>
                            </a-space>
                        </a-col>
                    </a-row>
                </a-list-item>
            </a-list>
            <a-empty v-else>
                <template #extra>
                    <a-typography-text v-if="srcFilter || tgtFilter">No units match "{{ srcFilter || tgtFilter
                        }}"</a-typography-text>
                    <a-typography-text v-else type="secondary">Enter keywords to filter and bulk-edit
                        segments</a-typography-text>
                </template>
            </a-empty>
        </div>
    </div>
</template>

<style scoped>
#filter-tab {
    width: 100%;
    height: 100%;
    padding: 10px;
    display: flex;
    flex-direction: column;
}

.list-container {
    flex: 1;
    overflow-y: auto;
}

.src-text {
    font-size: 0.9em;
    color: var(--color-text-2);
    word-break: break-all;
}

.tm-item {
    background-color: var(--color-fill-1);
}

:deep(.arco-list-item) {
    padding: 8px 12px !important;
}

.header {
    display: flex;
    align-items: center;
}
</style>