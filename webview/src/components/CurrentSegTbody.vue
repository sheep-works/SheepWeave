<script setup lang="ts">
import { computed } from 'vue';
import { useShWvStore } from '../store/shwv';

const shwvStore = useShWvStore();

const rowspan = computed(() => {
    return Math.max(1, shwvStore.crtUnit?.ref?.tb?.length || 0);
});
</script>

<template>
    <tbody v-if="shwvStore.crtUnit" class="current-segment-body">
        <!-- ref.tb がある場合 -->
        <template v-if="shwvStore.crtUnit.ref.tb.length > 0">
            <tr v-for="(tb, tbx) in shwvStore.crtUnit.ref.tb" :key="tbx">
                <td v-if="tbx === 0" :rowspan="rowspan">
                    {{ shwvStore.crtUnit.idx + 1 }}
                </td>
                <td v-if="tbx === 0" :rowspan="rowspan">
                    {{ shwvStore.crtUnit.src }}
                </td>
                <td>{{ tb.src }}</td>
                <td>{{ tb.tgts.join(' / ') }}</td>
            </tr>
        </template>

        <!-- ref.tb がない場合（1行表示） -->
        <tr v-else>
            <td>{{ shwvStore.crtUnit.idx + 1 }}</td>
            <td>{{ shwvStore.crtUnit.src }}</td>
            <td>-</td>
            <td>-</td>
        </tr>

        <!-- TMなど、次セクションとの区切りのための空白行（擬似マージン） -->
        <tr class="tbody-spacer">
            <td colspan="4"></td>
        </tr>
    </tbody>
</template>

<style scoped>
td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--vscode-sideBar-border, rgba(255,255,255,0.1));
    text-align: left;
    vertical-align: top;
}

.tbody-spacer td {
    height: 20px; /* マージンの代わり */
    padding: 0;
    border-bottom: none;
    background: transparent;
}
</style>

