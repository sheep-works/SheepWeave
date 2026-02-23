import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import { createPinia } from 'pinia';

const pinia = createPinia();

createApp(App).use(pinia).use(ArcoVue).mount('#app')
