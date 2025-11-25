<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NSpace, useMessage, NSpin } from 'naive-ui'

const router = useRouter()
const message = useMessage()

const formValue = ref({
  cdk: '',
  username: '',
  password: '',
  confirmPassword: ''
})

const loading = ref(false)

const handleActivate = async () => {
  if (!formValue.value.cdk || !formValue.value.username || !formValue.value.password) {
    message.error('请填写所有必填项')
    return
  }

  if (formValue.value.password !== formValue.value.confirmPassword) {
    message.error('两次输入的密码不一致')
    return
  }

  if (formValue.value.password.length < 6) {
    message.error('密码长度至少6位')
    return
  }

  loading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: formValue.value.username,
        password: formValue.value.password,
        cdk: formValue.value.cdk.toUpperCase().trim()
      })
    })

    const data = await response.json()

    if (!response.ok) {
      message.error(data.message || '激活失败')
      return
    }

    // Success
    let successMsg = data.isRenewal ? '续费成功!' : '账号激活成功!'
    
    if (data.user?.expiryDate) {
      const expiryDate = new Date(data.user.expiryDate)
      successMsg += ` 您的账号有效期至 ${expiryDate.toLocaleDateString('zh-CN')}`
    } else {
      successMsg += ' 您已获得永久会员权限'
    }
    
    message.success(successMsg)
    
    // 如果是续费,保存token后跳转到dashboard;如果是新注册,跳转到登录页
    if (data.isRenewal && data.token) {
      localStorage.setItem('token', data.token)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } else {
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    }

  } catch (error: any) {
    console.error('Activation error:', error)
    message.error('激活失败,请检查网络连接')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
    <n-card class="w-full max-w-md p-6 shadow-lg" title="激活 / 注册 / 续费">
      <template #header-extra>
        <span class="text-sm text-gray-500">使用CDK激活新账号或为已有账号续费</span>
      </template>
      <n-spin :show="loading" description="正在处理...">
        <n-form :model="formValue">
          <n-form-item label="CDK (激活码)" path="cdk" required>
            <n-input 
              v-model:value="formValue.cdk" 
              placeholder="EMBY-XXXX-XXXX" 
              :disabled="loading"
              @input="formValue.cdk = formValue.cdk.toUpperCase()"
            />
          </n-form-item>
          <n-form-item label="用户名" path="username" required>
            <n-input 
              v-model:value="formValue.username" 
              placeholder="新用户注册或已有用户续费" 
              :disabled="loading"
            />
          </n-form-item>
          <n-form-item label="密码" path="password" required>
            <n-input
              v-model:value="formValue.password"
              type="password"
              show-password-on="click"
              placeholder="至少6位密码"
              :disabled="loading"
            />
          </n-form-item>
          <n-form-item label="确认密码" path="confirmPassword" required>
            <n-input
              v-model:value="formValue.confirmPassword"
              type="password"
              show-password-on="click"
              placeholder="再次输入密码"
              :disabled="loading"
              @keyup.enter="handleActivate"
            />
          </n-form-item>
          <n-space vertical>
            <n-button type="primary" block @click="handleActivate" :loading="loading">
              激活 / 续费
            </n-button>
            <n-button text block @click="router.push('/login')" :disabled="loading">
              返回登录
            </n-button>
          </n-space>
        </n-form>
      </n-spin>
    </n-card>
  </div>
</template>
