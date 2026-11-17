<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useI18nStore } from '../store/i18n';
import { IconThunderbolt, IconRefresh, IconDown } from '@arco-design/web-vue/es/icon';

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
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'initFromProjectJsonDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'initFromProjectJsonDesc')">
                    <a-button type="primary" @click="$emit('FlowCommand', 'init-from-project-json')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space align="center">
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'suffolkWebInitDesc') }}</a-typography-text>
                  <a-link href="https://lambuage.com/app/suffolk" target="_blank">
                    Suffolk Web (WASM) ↗
                  </a-link>
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
                    <!-- Line 2: Filter options -->
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
                      <!-- [個別実行] 変換のみ実行ボタン（検証用コメントアウト）
                      <a-tooltip :content="i18nStore.getText('flowTab', 'prepareDesc')">
                        <a-button
                          @click="$emit('FlowCommand', 'extract-source', { projectName: pName, sourceLang: sLang, targetLang: tLang, useFprmFilter: useFprmFilter, selectedFilterFile: selectedFilterFile })">
                          {{ i18nStore.getText('flowTab', 'btnText') }}
                        </a-button>
                      </a-tooltip>
                      -->
                    </div>
                    <!-- Line 3: 一括開始ボタン -->
                    <div style="margin-top: 4px;">
                      <a-button
                        type="primary"
                        @click="$emit('FlowCommand', 'extract-and-convert', { projectName: pName, sourceLang: sLang, targetLang: tLang, useFprmFilter: useFprmFilter, selectedFilterFile: selectedFilterFile })">
                        {{ i18nStore.getText('flowTab', 'btnStartPrepare') }}
                      </a-button>
                    </div>
                    <!-- Line 4: Tikal / エンジンに関するヒント -->
                    <div style="margin-top: 4px; font-size: 12px; color: var(--color-text-3); line-height: 1.5;">
                      {{ i18nStore.getText('flowTab', 'engineHint') }}
                    </div>
                    <!-- Line 5: Suffolk Web (WASM) 検証・GUIツール案内 -->
                    <a-alert type="info" style="margin-top: 12px; width: 100%;" :show-icon="true">
                      <template #title>
                        <a-space>
                          <span style="font-weight: 600;">{{ i18nStore.getText('flowTab', 'suffolkWebTitle') }}</span>
                          <a-link href="https://lambuage.com/app/suffolk" target="_blank" style="font-weight: 500;">
                            https://lambuage.com/app/suffolk ↗
                          </a-link>
                        </a-space>
                      </template>
                      {{ i18nStore.getText('flowTab', 'suffolkWebPrepareDesc') }}
                    </a-alert>
                  </div>
                </a-space>
              </a-list-item>
              <!-- [個別実行] プロジェクトファイルの作成と解析（検証用コメントアウト）
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'createDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'createDesc')">
                    <a-button @click="$emit('FlowCommand', 'convert-to-shwv')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              -->
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
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'addOrSyncFilesDesc') }}</a-typography-text>
                  <a-dropdown @select="(val: any) => $emit('FlowCommand', val)">
                    <a-button type="primary">
                      {{ i18nStore.getText('flowTab', 'addOrSyncBtn') }}
                      <icon-down style="margin-left: 4px;" />
                    </a-button>
                    <template #content>
                      <a-doption value="add-files">
                        <div style="padding: 2px 4px;">
                          <div style="font-weight: 600;">🧶 {{ i18nStore.getText('flowTab', 'addSourceTitle') }}</div>
                          <div style="font-size: 11px; color: var(--color-text-3); margin-top: 2px;">{{ i18nStore.getText('flowTab', 'addSourceSub') }}</div>
                        </div>
                      </a-doption>
                      <a-doption value="reanalyze">
                        <div style="padding: 2px 4px;">
                          <div style="font-weight: 600;">📈 {{ i18nStore.getText('flowTab', 'reanalyzeRefTitle') }}</div>
                          <div style="font-size: 11px; color: var(--color-text-3); margin-top: 2px;">{{ i18nStore.getText('flowTab', 'reanalyzeRefSub') }}</div>
                        </div>
                      </a-doption>
                    </template>
                  </a-dropdown>
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
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'exportPatchDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'exportPatchDesc')">
                    <a-button type="outline" status="success" @click="$emit('FlowCommand', 'export-scoped-patch')">{{ i18nStore.getText('flowTab', 'exportPatchBtn') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
              <a-list-item>
                <a-space>
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'mergePatchDesc') }}</a-typography-text>
                  <a-tooltip :content="i18nStore.getText('flowTab', 'mergePatchDesc')">
                    <a-button type="outline" status="warning" @click="$emit('FlowCommand', 'merge-patch-dialog')">{{ i18nStore.getText('flowTab', 'mergePatchBtn') }}</a-button>
                  </a-tooltip>
                </a-space>
              </a-list-item>
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
                <a-space align="center">
                  <a-typography-text>{{ i18nStore.getText('flowTab', 'suffolkWebCompleteDesc') }}</a-typography-text>
                  <a-link href="https://lambuage.com/app/suffolk" target="_blank">
                    Suffolk Web (WASM) ↗
                  </a-link>
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
              <a-list-item>
                <a-space align="center">
                  <a-typography-text type="secondary">🌐</a-typography-text>
                  <a-link href="https://storage.lambuage.com/#samples" target="_blank">
                    {{ i18nStore.getText('flowTab', 'sampleLink') || 'サンプルファイルはこちら' }}
                  </a-link>
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
