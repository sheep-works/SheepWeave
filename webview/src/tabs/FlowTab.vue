<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18nStore } from '../store/i18n';
import { IconThunderbolt } from '@arco-design/web-vue/es/icon';

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
const activeTab = ref('3'); // Default to "On Working"

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
    <div class="header">
      <a-space>
        <icon-thunderbolt :style="{ fontSize: '24px', marginRight: '8px' }" />
        <a-typography-title :heading="4" style="margin: 0">Project Workflow</a-typography-title>
      </a-space>
    </div>

    <a-divider />

    <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
      <!-- Init / Open -->
      <a-tab-pane key="1" :title="i18nStore.getText('flowTab', 'initTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'initTitle')" :bordered="false">
            <a-list>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'initDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'archive-previous')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'openDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'open-current')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'openWorkflowDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'open-workflow-ini')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
            </a-list>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- Prepare -->
      <a-tab-pane key="2" :title="i18nStore.getText('flowTab', 'prepareTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'prepareTitle')" :bordered="false">
            <a-list>
              <a-list-item>
                <a-space direction="vertical" style="width: 100%;">
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'prepareDesc') }}</a-typography-text>
                  <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                    <a-input v-model="pName" placeholder="Project Name" style="width: 200px" />
                    <a-select v-model="sLang" :options="langOptions" placeholder="Source" style="width: 120px" allow-create allow-search />
                    <span style="margin: 0 5px;">➔</span>
                    <a-select v-model="tLang" :options="langOptions" placeholder="Target" style="width: 120px" allow-create allow-search />
                    <a-button
                      @click="$emit('FlowCommand', 'extract-source', { projectName: pName, sourceLang: sLang, targetLang: tLang })">
                      {{ i18nStore.getText('flowTab', 'btnText') }}
                    </a-button>
                  </div>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'createDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'convert-to-shwv')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
            </a-list>
          </a-card>
        </div>
      </a-tab-pane>
      
      <!-- On Working -->
      <a-tab-pane key="3" :title="i18nStore.getText('flowTab', 'onWorkingTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'onWorkingTitle')" :bordered="false">
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
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'addFilesDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'add-files')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
            </a-list>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- Complete -->
      <a-tab-pane key="4" :title="i18nStore.getText('flowTab', 'completeTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'completeTitle')" :bordered="false">
            <a-list>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'completeDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'export-xliff')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'packageDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'merge-to-final')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'archiveDesc') }}</a-typography-text>
                  <a-button @click="$emit('FlowCommand', 'archive-previous')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                </a-space>
              </a-list-item>
            </a-list>
          </a-card>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.flow-tab {
  width: 100%;
  height: 100%;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.pane-content {
  height: 100%;
  overflow-y: auto;
  padding-right: 12px;
}

.header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

button {
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}
</style>
