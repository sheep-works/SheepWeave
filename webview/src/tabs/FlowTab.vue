<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18nStore } from '../store/i18n';

interface ProjectConfig {
    projectName: string;
    sourceLang: string;
    targetLang: string;
}

const i18nStore = useI18nStore();

const props = defineProps<{
    config: ProjectConfig
}>();

defineEmits(["FlowCommand"]);

const langOptions = ['en-US', 'ja-JP', 'zh-CN'];

// Individual refs to simplify analysis and ensure reactivity
const pName = ref(props.config.projectName);
const sLang = ref(props.config.sourceLang);
const tLang = ref(props.config.targetLang);

// Sync local state when props change (e.g. on config load from extension)
watch(() => props.config, (newVal) => {
    if (newVal) {
        pName.value = newVal.projectName;
        sLang.value = newVal.sourceLang;
        tLang.value = newVal.targetLang;
    }
}, { deep: true });

</script>

<template>
  <div class="flow-tab">
    <h2>Project Flow</h2>
    <a-timeline class="actions">
      <a-timeline-item>
        <a-card :title="i18nStore.getText('flowTab', 'initTitle')">
          <a-list>
            <a-list-item>
              <a-space>
                <a-typography-text>{{ i18nStore.getText('flowTab', 'openDesc') }}</a-typography-text>
                <a-button @click="$emit('FlowCommand', 'open-current')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
              </a-space>
            </a-list-item>
            <a-list-item>
              <a-space>
                <a-typography-text>{{ i18nStore.getText('flowTab', 'initDesc') }}</a-typography-text>
                <a-button @click="$emit('FlowCommand', 'init')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
              </a-space>
            </a-list-item>
            <a-list-item>
              <a-space direction="vertical" style="width: 100%;">
                <a-typography-text>{{ i18nStore.getText('flowTab', 'prepareDesc') }}</a-typography-text>
                <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                  <a-input v-model="pName" placeholder="Project Name" style="width: 200px" />
                  <a-select v-model="sLang" :options="langOptions" placeholder="Source" style="width: 120px" />
                  <span style="margin: 0 5px;">➔</span>
                  <a-select v-model="tLang" :options="langOptions" placeholder="Target" style="width: 120px" />
                  <a-button @click="$emit('FlowCommand', 'prepare', { projectName: pName, sourceLang: sLang, targetLang: tLang })">
                    {{ i18nStore.getText('flowTab', 'btnText') }}
                  </a-button>  
                </div>
              </a-space>
            </a-list-item>
            <a-list-item>
            <a-space>
                <a-typography-text>{{ i18nStore.getText('flowTab', 'createDesc') }}</a-typography-text>
                <a-button @click="$emit('FlowCommand', 'create')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
              </a-space>
            </a-list-item>
          </a-list>
        </a-card>
      </a-timeline-item>
      <a-timeline-item>
        <a-card :title="i18nStore.getText('flowTab', 'onWorkingTitle')">
          <a-list>
            <a-list-item>
              <a-space>
                <a-typography-text>{{ i18nStore.getText('flowTab', 'loadDesc') }}</a-typography-text>
                <a-button @click="$emit('FlowCommand', 'load')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
              </a-space>
            </a-list-item>
            <a-list-item>
            <a-space>
              <a-typography-text>{{ i18nStore.getText('flowTab', 'reanalyzeDesc') }}</a-typography-text>
              <a-button @click="$emit('FlowCommand', 'reanalyze')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
            </a-space>
            </a-list-item>
          </a-list>
        </a-card>
      </a-timeline-item>
      <a-timeline-item>
        <a-card :title="i18nStore.getText('flowTab', 'onWorkingTitle')">
          <a-list>
            <a-list-item>
            <a-space>
              <a-typography-text>{{ i18nStore.getText('flowTab', 'completeDesc') }}</a-typography-text>
              <a-button @click="$emit('FlowCommand', 'complete')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
            </a-space>
            </a-list-item>
            <a-list-item>
            <a-space>
              <a-typography-text>{{ i18nStore.getText('flowTab', 'packageDesc') }}</a-typography-text>
              <a-button @click="$emit('FlowCommand', 'package')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
            </a-space>
            </a-list-item>
          </a-list>
        </a-card>
      </a-timeline-item>
    </a-timeline>
    <div class="stats">
        <h3>Statistics</h3>
        <p>Segments: 0</p>
        <p>Untranslated: 0</p>
    </div>
  </div>
</template>

<style scoped>
.actions {
    margin-bottom: 20px;
}
button {
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
}
</style>
