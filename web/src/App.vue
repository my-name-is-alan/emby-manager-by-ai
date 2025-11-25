<script setup lang="ts">
import { NConfigProvider, NGlobalStyle, NMessageProvider, NDialogProvider, darkTheme, lightTheme, NButton } from 'naive-ui'
import { computed, ref } from 'vue'
import { useOsTheme } from 'naive-ui'

const osTheme = useOsTheme()
const isDark = ref(false)

// Initialize theme based on OS
if (osTheme.value === 'dark') {
  isDark.value = true
  document.documentElement.classList.add('dark')
}

const theme = computed(() => (isDark.value ? darkTheme : lightTheme))

const toggleTheme = () => {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
</script>

<template>
  <n-config-provider :theme="theme">
    <n-global-style />
    <n-message-provider>
      <n-dialog-provider>
        <router-view />
        
        <!-- Global Theme Toggle (Floating) -->
        <div class="fixed bottom-4 right-4 z-50">
          <n-button circle size="large" @click="toggleTheme" class="shadow-lg">
            <template #icon>
              <div :class="isDark ? 'i-mdi-weather-sunny text-yellow-400' : 'i-mdi-weather-night text-gray-600'" />
            </template>
          </n-button>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style>
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
