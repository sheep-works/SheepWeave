<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useShWvStore } from '../store/shwv';
import { useI18nStore } from '../store/i18n';

const store = useShWvStore();
const i18nStore = useI18nStore();

const emit = defineEmits(['ConcordanceCommand']);

const data = computed(() => store.concordanceData);
const manualQuery = ref('');
const manualMode = ref('source');

const handleManualSearch = () => {
    if (!manualQuery.value) return;
    emit('ConcordanceCommand', 'manual-concordance', { query: manualQuery.value, mode: manualMode.value });
};

watch(data, (newVal) => {
    if (newVal && newVal.query) {
        manualQuery.value = newVal.query;
        manualMode.value = newVal.mode || 'source';
    }
}, { deep: true, immediate: true });

function highlight(text: string, query: string): string {
    if (!text || !query) return text;
    const escapeHTML = (str: string) => str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );

    let safeText = escapeHTML(text);
    let safeQuery = escapeHTML(query);
    const regex = new RegExp(`(${safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return safeText.replace(regex, '<mark class="highlight">$1</mark>');
}

</script>

<template>
    <div class="concordance-view">
        <div class="manual-search-container">
            <a-space>
                <a-input-search v-model="manualQuery" :placeholder="i18nStore.getText('searchTab', 'placeholder')" style="width: 300px"
                    @search="handleManualSearch" @press-enter="handleManualSearch" />
                <a-radio-group v-model="manualMode" type="button">
                    <a-radio value="source">{{ i18nStore.getText('searchTab', 'modeSource') }}</a-radio>
                    <a-radio value="target">{{ i18nStore.getText('searchTab', 'modeTarget') }}</a-radio>
                </a-radio-group>
                <a-tooltip :content="i18nStore.getText('searchTab', 'tooltipShortcut')">
                    <a-button type="primary" @click="handleManualSearch">{{ i18nStore.getText('searchTab', 'searchBtn') }}</a-button>
                </a-tooltip>
            </a-space>
        </div>

        <div v-if="!data && !manualQuery" class="empty-state">
            <p>{{ i18nStore.getText('common', 'nodata') }}</p>
            <p class="subtitle">
                {{ i18nStore.getText('searchTab', 'tooltipShortcut') }}
            </p>
        </div>
        <div v-else-if="data" class="results-container">
            <div class="header">
                <h2>Search Results</h2>
                <div class="query-info">
                    Search queried <strong>"{{ data.query }}"</strong> in <strong>{{ data.mode }}</strong>
                </div>
            </div>

            <!-- TB Matches -->
            <div class="section" v-if="data.tbMatches?.length > 0">
                <h3 class="section-title tb-title">Terminology Matches <span class="badge">{{ data.tbMatches.length
                        }}</span></h3>
                <div class="card" v-for="(match, i) in data.tbMatches" :key="'tb' + i">
                    <div class="card-meta">{{ match.file || 'TB' }}</div>
                    <div class="card-body">
                        <div class="col">
                            <strong>Source</strong>
                            <div class="content" v-html="highlight(match.src, data.query)"></div>
                        </div>
                        <div class="col">
                            <strong>Target</strong>
                            <div class="content" v-html="highlight(match.tgt || match.pre, data.query)"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- TM Matches -->
            <div class="section" v-if="data.tmMatches?.length > 0">
                <h3 class="section-title tm-title">Translation Memory <span class="badge">{{ data.tmMatches.length
                        }}</span></h3>
                <div class="card" v-for="(match, i) in data.tmMatches" :key="'tm' + i">
                    <div class="card-meta">{{ match.file || 'TM' }} (ID: {{ match.id }})</div>
                    <div class="card-body">
                        <div class="col">
                            <strong>Source</strong>
                            <div class="content" v-html="highlight(match.src, data.query)"></div>
                        </div>
                        <div class="col">
                            <strong>Target</strong>
                            <div class="content" v-html="highlight(match.tgt, data.query)"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Active Document Matches -->
            <div class="section" v-if="data.currentDocumentMatches?.length > 0">
                <h3 class="section-title doc-title">Current Document <span class="badge">{{
                    data.currentDocumentMatches.length }}</span></h3>
                <div class="card" v-for="(match, i) in data.currentDocumentMatches" :key="'doc' + i">
                    <div class="card-meta">Unit: {{ match.idx }} <span v-if="match.status === 1"
                            class="status conf">Confirmed</span></div>
                    <div class="card-body">
                        <div class="col">
                            <strong>Source</strong>
                            <div class="content" v-html="highlight(match.src, data.query)"></div>
                        </div>
                        <div class="col">
                            <strong>Target</strong>
                            <div class="content" v-html="highlight(match.tgt || match.pre, data.query)"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="data.tbMatches?.length === 0 && data.tmMatches?.length === 0 && data.currentDocumentMatches?.length === 0"
                class="no-hits">
                No matches found.
            </div>
        </div>
    </div>
</template>

<style scoped>
.concordance-view {
    height: 100%;
    overflow-y: auto;
    font-family: var(--vscode-font-family);
    color: var(--vscode-editor-foreground);
    display: flex;
    flex-direction: column;
}

.manual-search-container {
    margin-bottom: 2rem;
    background: var(--vscode-editorWidget-background);
    padding: 1rem;
    border-radius: 4px;
    border: 1px solid var(--vscode-widget-border);
}

.empty-state {
    text-align: center;
    margin-top: 3rem;
    color: var(--vscode-descriptionForeground);
}

.empty-state .subtitle {
    font-size: 0.9em;
    opacity: 0.8;
}

code {
    background: var(--vscode-textCodeBlock-background);
    padding: 2px 4px;
    border-radius: 4px;
}

.header {
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--vscode-minimap-errorHighlight);
    padding-bottom: 0.5rem;
}

.header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.4rem;
}

.query-info {
    font-size: 0.95rem;
}

.section {
    margin-bottom: 2rem;
}

.section-title {
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.tb-title {
    color: var(--vscode-terminal-ansiYellow);
}

.tm-title {
    color: var(--vscode-terminal-ansiBlue);
}

.doc-title {
    color: var(--vscode-terminal-ansiGreen);
}

.badge {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 12px;
    padding: 2px 8px;
    font-size: 0.8rem;
    font-weight: bold;
}

.card {
    background: var(--vscode-editorWidget-background);
    border: 1px solid var(--vscode-widget-border);
    border-radius: 4px;
    margin-bottom: 1rem;
    padding: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-meta {
    font-size: 0.8rem;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 0.5rem;
    border-bottom: 1px dotted var(--vscode-widget-border);
    padding-bottom: 0.2rem;
    display: flex;
    justify-content: space-between;
}

.status.conf {
    color: var(--vscode-terminal-ansiGreen);
    font-weight: bold;
}

.card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

.col strong {
    display: block;
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 0.25rem;
}

.content {
    font-size: 0.9rem;
    line-height: 1.4;
    white-space: pre-wrap;
    word-wrap: break-word;
}

:deep(.highlight) {
    background-color: var(--vscode-editor-findMatchHighlightBackground);
    color: var(--vscode-editor-foreground);
    border-radius: 2px;
    font-weight: bold;
}

.no-hits {
    text-align: center;
    padding: 2rem;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
}
</style>
