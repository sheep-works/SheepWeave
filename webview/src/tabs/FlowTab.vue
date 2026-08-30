<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18nStore } from '../store/i18n';
import { IconThunderbolt, IconRefresh } from '@arco-design/web-vue/es/icon';

interface ProjectConfig {
  projectName: string;
  sourceLang: string;
  targetLang: string;
}

const i18nStore = useI18nStore();

const props = defineProps<{
  config: ProjectConfig
}>();

const emit = defineEmits(["FlowCommand"]);

const langOptions = ['en-US', 'ja-JP', 'zh-CN'];
const activeTab = ref('3'); // Default to "On Working"

// Individual refs to simplify analysis and ensure reactivity
const pName = ref(props.config.projectName);
const sLang = ref(props.config.sourceLang);
const tLang = ref(props.config.targetLang);
const useFprmFilter = ref(false);
const filterFiles = ref<string[]>([]);
const selectedFilterFile = ref<string>('');

const scanFilterFiles = () => {
  emit('FlowCommand', 'scan-filter-files');
};

const onUseFprmChange = (val: boolean | (string | number | boolean)[]) => {
  if (val) {
    scanFilterFiles();
  }
};

onMounted(() => {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'FILTER_FILES_SCANNED') {
      filterFiles.value = message.data || [];
      if (filterFiles.value.length > 0 && !selectedFilterFile.value) {
        selectedFilterFile.value = filterFiles.value[0];
      }
    }
  });
  scanFilterFiles();
});

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
      <a-space align="center">
        <icon-thunderbolt :style="{ fontSize: '24px', marginRight: '8px' }" />
        <a-typography-title :heading="4" style="margin: 0">{{ i18nStore.getText('flowTab', 'typography') }}</a-typography-title>
      </a-space>
    </div>

    <a-divider style="margin: 16px 0;" />

    <a-tabs position="left" v-model="activeTab" style="flex: 1; min-height: 0;">
      <!-- Init / Open -->
      <a-tab-pane key="1" :title="i18nStore.getText('flowTab', 'initTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'initTitle')" :bordered="false">
            <a-list>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'initDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'initDesc')">
                    <a-button @click="$emit('FlowCommand', 'archive-previous')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'openDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'openDesc')">
                    <a-button @click="$emit('FlowCommand', 'open-current')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'openWorkflowDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'openWorkflowDesc')">
                    <a-button @click="$emit('FlowCommand', 'open-workflow-ini')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
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
                  <div style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start; width: 100%;">
                    <!-- Line 1: Project Name & Languages -->
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                      <a-input v-model="pName" placeholder="Project Name" style="width: 200px" />
                      <a-select v-model="sLang" :options="langOptions" placeholder="Source" style="width: 120px" allow-create allow-search />
                      <span style="margin: 0 5px;">➔</span>
                      <a-select v-model="tLang" :options="langOptions" placeholder="Target" style="width: 120px" allow-create allow-search />
                    </div>
                    <!-- Line 2: Filter options & Action -->
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                      <a-tooltip :content="i18nStore.getText('flowTab', 'useFprmFilterTooltip')">
                        <a-checkbox v-model="useFprmFilter">{{ i18nStore.getText('flowTab', 'useFprmFilter') }}</a-checkbox>
                      </a-tooltip>
                      <a-select v-model="selectedFilterFile" :disabled="!useFprmFilter" placeholder="Select .fprm" style="width: 200px" allow-search>
                        <a-option v-for="f in filterFiles" :key="f" :value="f">{{ f }}</a-option>
                      </a-select>
                      <a-button type="text" :disabled="!useFprmFilter" @click="scanFilterFiles" title="Refresh filter list">
                        <template #icon><icon-refresh /></template>
                      </a-button>
                      <a-tooltip :content="i18nStore.getText('flowTab', 'prepareDesc')">
                        <a-button
                          @click="$emit('FlowCommand', 'extract-source', { projectName: pName, sourceLang: sLang, targetLang: tLang, useFprmFilter: useFprmFilter, selectedFilterFile: selectedFilterFile })">
                          {{ i18nStore.getText('flowTab', 'btnText') }}
                        </a-button>
                      </a-tooltip>
                    </div>
                  </div>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'createDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'createDesc')">
                    <a-button @click="$emit('FlowCommand', 'convert-to-shwv')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'advanceWorkflowDesc') }}</a-typography-text>
                  <a-popconfirm
                    :content="i18nStore.getText('flowTab', 'advanceWorkflowConfirm')"
                    type="warning"
                    :ok-text="i18nStore.getText('common', 'execute')"
                    :cancel-text="i18nStore.getText('common', 'cancel')"
                    @ok="$emit('FlowCommand', 'advance-workflow')"
                  >
                    <a-button status="warning">
                      {{ i18nStore.getText('flowTab', 'advanceWorkflowBtn') }}
                    </a-button>
                  </a-popconfirm>
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
                  <a-tooltip :content="i18nStore.getText('flowTab', 'loadDesc')">
                    <a-button @click="$emit('FlowCommand', 'load')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'reanalyzeDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'reanalyzeDesc')">
                    <a-button @click="$emit('FlowCommand', 'reanalyze')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'addFilesDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'addFilesDesc')">
                    <a-button @click="$emit('FlowCommand', 'add-files')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
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
                  <a-tooltip :content="i18nStore.getText('flowTab', 'completeDesc')">
                    <a-button @click="$emit('FlowCommand', 'export-xliff')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'packageDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'packageDesc')">
                    <a-button @click="$emit('FlowCommand', 'merge-to-final')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'archiveDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'archiveDesc')">
                    <a-button @click="$emit('FlowCommand', 'archive-previous')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
            </a-list>
          </a-card>
        </div>
      </a-tab-pane>

      <!-- Trial -->
      <a-tab-pane key="5" :title="i18nStore.getText('flowTab', 'trialTitle')">
        <div class="pane-content">
          <a-card :title="i18nStore.getText('flowTab', 'trialTitle')" :bordered="false">
            <a-list>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'trialDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'trialDesc')">
                    <a-button @click="$emit('FlowCommand', 'generate-sample')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
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
  box-sizing: border-box;
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
