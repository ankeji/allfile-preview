import Vue from 'vue'
import '@allfile-preview/core'
import App from './App.vue'

// 告知 Vue2：file- 开头的标签是自定义元素，跳过组件解析（消除 Unknown custom element 警告）
Vue.config.ignoredElements = [/^file-/]
// 开发期日志更友好
Vue.config.productionTip = false

new Vue({
  render: (h) => h(App)
}).$mount('#app')
