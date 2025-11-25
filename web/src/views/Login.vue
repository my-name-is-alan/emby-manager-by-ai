<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage, NIcon } from 'naive-ui'
import { useUserStore } from '../stores/user'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()
const loading = ref(false)
const bgUrl = ref('/api/emby/login-background') // Use ref for dynamic binding if needed, or just string in template but bound properly

const formValue = ref({
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!formValue.value.username || !formValue.value.password) {
    message.warning('请输入用户名和密码')
    return
  }
  
  loading.value = true
  try {
    await userStore.login(formValue.value.username, formValue.value.password)
    message.success('登录成功')
    router.push('/dashboard')
  } catch (error: any) {
    message.error(error)
  } finally {
    loading.value = false
  }
}

const goToActivate = () => {
  router.push('/activate')
}
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-900">
    <!-- 背景图 -->
    <div class="absolute inset-0 z-0">
       <img :src="bgUrl" class="w-full h-full object-cover opacity-30 scale-105" alt="background" />
       <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80"></div>
    </div>

    <n-card class="w-full max-w-md z-10 shadow-2xl bg-white/95 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl border-0" size="large">
      <div class="text-center mb-8">
        <div class="text-6xl mb-4 flex justify-center">
          <div class="i-mdi-play-circle text-primary" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white tracking-wide">Emby Manager</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2 text-sm">您的私人家庭影院门户</p>
      </div>

      <n-form :model="formValue" size="large">
        <n-form-item path="username" :show-label="false">
          <n-input v-model:value="formValue.username" placeholder="用户名 / Email">
            <template #prefix>
              <div class="i-mdi-account text-gray-400" />
            </template>
          </n-input>
        </n-form-item>
        <n-form-item path="password" :show-label="false">
          <n-input
            v-model:value="formValue.password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <div class="i-mdi-lock text-gray-400" />
            </template>
          </n-input>
        </n-form-item>
        <n-space vertical size="large">
          <n-button type="primary" block size="large" @click="handleLogin" class="font-bold" :loading="loading">
            登 录
          </n-button>
          <div class="flex justify-between text-sm px-1">
            <n-button text type="primary" @click="goToActivate">
              <template #icon><div class="i-mdi-ticket-confirmation" /></template>
              使用 CDK 注册账号
            </n-button>
            <n-button text class="text-gray-500 hover:text-gray-700">忘记密码?</n-button>
          </div>
        </n-space>
      </n-form>
    </n-card>
    
    <div class="absolute bottom-4 text-gray-500 text-xs z-10">
      &copy; 2025 Emby Manager. All rights reserved.
    </div>
  </div>
</template>
