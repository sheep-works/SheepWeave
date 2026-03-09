00<script setup lang="ts">
import { useI18nStore } from '../store/i18n';
const i18nStore = useI18nStore();
defineEmits(["FlowCommand"]);

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
              <a-space>
                <a-typography-text>{{ i18nStore.getText('flowTab', 'prepareDesc') }}</a-typography-text>
                <a-button @click="$emit('FlowCommand', 'prepare')">{{ i18nStore.getText('flowTab', 'btnText') }}</a-button>  
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
