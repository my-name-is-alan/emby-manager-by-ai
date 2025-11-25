<script setup lang="ts">
import { 
  NLayout, NLayoutSider, NLayoutContent, NMenu, NCard, NDataTable, 
  NButton, NSpace, NTag, NModal, NForm, NFormItem, NInputNumber, 
  NSelect, useMessage, NInput, NGrid, NGridItem, NStatistic, NList, 
  NListItem, NThing, NAvatar, NSpin, NSwitch, NPopconfirm 
} from 'naive-ui'
import { h, ref, reactive, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../utils/api'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()

const menuOptions = [
  { label: '概览', key: 'overview', icon: () => h('div', { class: 'i-mdi-view-dashboard' }) },
  { label: 'CDK 管理', key: 'cdk', icon: () => h('div', { class: 'i-mdi-ticket-percent' }) },
  { label: '用户管理', key: 'users', icon: () => h('div', { class: 'i-mdi-account-group' }) },
  { label: '模板管理', key: 'templates', icon: () => h('div', { class: 'i-mdi-file-cog' }) },
  { label: '最新入库', key: 'media', icon: () => h('div', { class: 'i-mdi-new-box' }) },
  { label: '系统设置', key: 'settings', icon: () => h('div', { class: 'i-mdi-cog' }) },
]

const activeKey = ref('overview')
const loading = ref(false)

// --- Settings Logic ---
const settingsLoading = ref(false)
const libraryOptions = ref<{label: string, value: string}[]>([])
const systemConfig = reactive({
  login_background_library_id: null as string | null
})

const fetchSettingsData = async () => {
  settingsLoading.value = true
  try {
    // Fetch Libraries
    const libsRes = await api.get('/config/libraries')
    libraryOptions.value = libsRes.data.map((lib: any) => ({
      label: lib.Name,
      value: lib.Id
    }))
    // Add a "All Libraries" option
    libraryOptions.value.unshift({ label: '全部库 (随机)', value: '' })

    // Fetch Config
    const configRes = await api.get('/config')
    const bgConfig = configRes.data.find((c: any) => c.key === 'login_background_library_id')
    if (bgConfig) {
      systemConfig.login_background_library_id = bgConfig.value
    }
  } catch (error) {
    message.error('获取设置失败')
  } finally {
    settingsLoading.value = false
  }
}

const saveSettings = async () => {
  try {
    await api.post('/config', {
      key: 'login_background_library_id',
      value: systemConfig.login_background_library_id || '',
      description: 'Library ID for login background'
    })
    message.success('设置已保存')
  } catch (error) {
    message.error('保存失败')
  }
}

watch(activeKey, (newKey) => {
  if (newKey === 'settings') {
    fetchSettingsData()
  }
})

// --- Overview Data ---
const overviewStats = ref({
  totalUsers: 0,
  activeUsers: 0,
  totalCDKs: 0,
  usedCDKs: 0,
  latestMedia: [] as any[]
})

const fetchOverviewData = async () => {
  loading.value = true
  try {
    const [usersRes, cdksRes, mediaRes] = await Promise.all([
      api.get('/cdk/users'),
      api.get('/cdk'),
      api.get('/webhook/latest-media', { params: { limit: 10 } })
    ])
    
    overviewStats.value.totalUsers = usersRes.data.length
    overviewStats.value.activeUsers = usersRes.data.filter((u: any) => u.isActive).length
    overviewStats.value.totalCDKs = cdksRes.data.length
    overviewStats.value.usedCDKs = cdksRes.data.filter((c: any) => c.status === 'used').length
    overviewStats.value.latestMedia = mediaRes.data.slice(0, 5)
  } catch (error: any) {
    console.error('Failed to fetch overview data:', error)
  } finally {
    loading.value = false
  }
}

const libraryStats = computed(() => [
  { label: '注册用户', value: overviewStats.value.totalUsers, icon: 'i-mdi-account-group', color: 'text-blue-500' },
  { label: '活跃用户', value: overviewStats.value.activeUsers, icon: 'i-mdi-account-check', color: 'text-green-500' },
  { label: 'CDK总数', value: overviewStats.value.totalCDKs, icon: 'i-mdi-ticket-percent', color: 'text-purple-500' },
  { label: '已使用CDK', value: overviewStats.value.usedCDKs, icon: 'i-mdi-ticket-confirmation', color: 'text-orange-500' },
])

// --- User Management ---
const usersData = ref<any[]>([])

const fetchUsers = async () => {
  loading.value = true
  try {
    const response = await api.get('/cdk/users')
    usersData.value = response.data
  } catch (error: any) {
    message.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const toggleUserStatus = async (user: any) => {
  try {
    await api.put(`/cdk/users/${user.id}`, { isActive: !user.isActive })
    user.isActive = !user.isActive
    message.success(`已${user.isActive ? '启用' : '禁用'}用户`)
  } catch (error: any) {
    message.error('操作失败')
  }
}

const userColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { 
    title: '用户名', 
    key: 'username',
    render(row: any) {
      return h('div', { class: 'flex items-center gap-2' }, [
        h(NAvatar, { 
          round: true, 
          size: 'small',
          color: '#18a058'
        }, { default: () => row.username.charAt(0).toUpperCase() }),
        h('span', { class: 'font-medium' }, row.username)
      ])
    }
  },
  { 
    title: '角色', 
    key: 'role',
    render(row: any) {
      return h(NTag, { 
        type: row.role === 'admin' ? 'warning' : 'default',
        size: 'small'
      }, { default: () => row.role === 'admin' ? '管理员' : '普通用户' })
    }
  },
  { 
    title: '状态', 
    key: 'isActive',
    render(row: any) {
      return h(NSwitch, { 
        value: row.isActive,
        onUpdateValue: () => toggleUserStatus(row)
      })
    }
  },
  { 
    title: '注册时间', 
    key: 'createdAt',
    render(row: any) {
      return new Date(row.createdAt).toLocaleDateString('zh-CN')
    }
  },
  { 
    title: '到期时间', 
    key: 'expiryDate',
    render(row: any) {
      return row.expiryDate ? new Date(row.expiryDate).toLocaleDateString('zh-CN') : '永久'
    }
  }
]

// --- CDK Management ---
const cdkData = ref<any[]>([])

const fetchCDKs = async () => {
  loading.value = true
  try {
    const response = await api.get('/cdk')
    cdkData.value = response.data
  } catch (error: any) {
    message.error('获取CDK列表失败')
  } finally {
    loading.value = false
  }
}

const deleteCDK = async (id: number) => {
  try {
    await api.delete(`/cdk/${id}`)
    cdkData.value = cdkData.value.filter(item => item.id !== id)
    message.success('删除成功')
  } catch (error: any) {
    message.error('删除失败')
  }
}

const cdkColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { 
    title: 'CDK', 
    key: 'code',
    render(row: any) {
      return h('span', { class: 'font-mono font-bold' }, row.code)
    }
  },
  { 
    title: '状态', 
    key: 'status',
    render(row: any) {
      const typeMap: any = { unused: 'success', used: 'info', expired: 'error' }
      const labelMap: any = { unused: '未使用', used: '已使用', expired: '已过期' }
      return h(NTag, { type: typeMap[row.status], bordered: false }, { default: () => labelMap[row.status] })
    }
  },
  { 
    title: 'CDK有效期', 
    key: 'cdkValidDays',
    width: 120,
    render(row: any) {
      return `${row.cdkValidDays} 天`
    }
  },
  { 
    title: '会员时长', 
    key: 'memberValidDays',
    width: 100,
    render(row: any) {
      return row.memberValidDays === 0 ? '永久' : `${row.memberValidDays} 天`
    }
  },
  { 
    title: '模板', 
    key: 'template',
    render(row: any) {
      return row.template?.name || '-'
    }
  },
  { 
    title: '使用者', 
    key: 'usedBy',
    render(row: any) {
      return row.user?.username || '-'
    }
  },
  { 
    title: '使用时间', 
    key: 'usedAt',
    render(row: any) {
      return row.usedAt ? new Date(row.usedAt).toLocaleDateString('zh-CN') : '-'
    }
  },
  {
    title: '操作',
    key: 'actions',
    render(row: any) {
      return h(NSpace, {}, { default: () => [
        h(NButton, { 
          size: 'small', 
          secondary: true,
          onClick: () => {
            navigator.clipboard.writeText(row.code)
            message.success('已复制 CDK')
          }
        }, { default: () => '复制' }),
        h(NPopconfirm, {
          onPositiveClick: () => deleteCDK(row.id)
        }, {
          trigger: () => h(NButton, { 
            size: 'small', 
            type: 'error', 
            ghost: true
          }, { default: () => '删除' }),
          default: () => '确定删除这个CDK吗？'
        })
      ]})
    }
  }
]

// --- Template Management ---
const templatesData = ref<any[]>([])
const showTemplateModal = ref(false)
const templateForm = reactive({
  id: null as number | null,
  name: '',
  description: '',
  validDays: 30
})

const fetchTemplates = async () => {
  loading.value = true
  try {
    const response = await api.get('/template')
    templatesData.value = response.data
  } catch (error: any) {
    message.error('获取模板列表失败')
  } finally {
    loading.value = false
  }
}

const openTemplateModal = (template?: any) => {
  if (template) {
    templateForm.id = template.id
    templateForm.name = template.name
    templateForm.description = template.description || ''
    templateForm.validDays = template.validDays
  } else {
    templateForm.id = null
    templateForm.name = ''
    templateForm.description = ''
    templateForm.validDays = 30
  }
  showTemplateModal.value = true
}

const handleSaveTemplate = async () => {
  if (!templateForm.name) {
    message.error('模板名称不能为空')
    return
  }

  try {
    if (templateForm.id) {
      await api.put(`/template/${templateForm.id}`, templateForm)
      message.success('模板更新成功')
    } else {
      await api.post('/template', templateForm)
      message.success('模板创建成功')
    }
    showTemplateModal.value = false
    fetchTemplates()
  } catch (error: any) {
    message.error(templateForm.id ? '更新失败' : '创建失败')
  }
}

const deleteTemplate = async (id: number) => {
  try {
    await api.delete(`/template/${id}`)
    templatesData.value = templatesData.value.filter(item => item.id !== id)
    message.success('删除成功')
  } catch (error: any) {
    message.error(error.response?.data?.message || '删除失败')
  }
}

const templateColumns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '模板名称', key: 'name' },
  { 
    title: '描述', 
    key: 'description',
    ellipsis: { tooltip: true },
    render(row: any) {
      return row.description || '-'
    }
  },
  { 
    title: '有效期', 
    key: 'validDays',
    width: 100,
    render(row: any) {
      return row.validDays === 0 ? '永久' : `${row.validDays} 天`
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render(row: any) {
      return h(NSpace, {}, { default: () => [
        h(NButton, { 
          size: 'small', 
          secondary: true,
          onClick: () => openTemplateModal(row)
        }, { default: () => '编辑' }),
        h(NPopconfirm, {
          onPositiveClick: () => deleteTemplate(row.id)
        }, {
          trigger: () => h(NButton, { 
            size: 'small', 
            type: 'error', 
            ghost: true
          }, { default: () => '删除' }),
          default: () => '确定删除这个模板吗？'
        })
      ]})
    }
  }
]

// --- Generate CDK Logic ---
const showGenerateModal = ref(false)
const generateForm = reactive({
  count: 1,
  cdkValidDays: 365, // CDK本身的有效期（多少天内可以使用）
  memberValidDays: 30, // 会员有效期（激活后账号可以使用多久）
  useTemplate: false,
  templateId: null as number | null
})

const handleGenerate = async () => {
  try {
    const payload: any = {
      count: generateForm.count,
      cdkValidDays: generateForm.cdkValidDays // CDK有效期总是需要的
    }
    
    if (generateForm.useTemplate && generateForm.templateId) {
      payload.templateId = generateForm.templateId
    } else {
      payload.memberValidDays = generateForm.memberValidDays
    }

    await api.post('/cdk/generate', payload)
    message.success(`成功生成 ${generateForm.count} 个 CDK`)
    showGenerateModal.value = false
    fetchCDKs()
    
    // 重置表单
    generateForm.count = 1
    generateForm.cdkValidDays = 365
    generateForm.memberValidDays = 30
    generateForm.useTemplate = false
    generateForm.templateId = null
  } catch (error: any) {
    message.error('生成失败')
  }
}

// --- Media Management ---
const mediaItems = ref<any[]>([])

const fetchMediaItems = async () => {
  loading.value = true
  try {
    const response = await api.get('/webhook/latest-media', { params: { limit: 50 } })
    mediaItems.value = response.data
  } catch (error: any) {
    message.error('获取媒体列表失败')
  } finally {
    loading.value = false
  }
}

const mediaColumns = [
  { 
    title: '封面', 
    key: 'poster',
    width: 80,
    render(row: any) {
      return h('img', { 
        src: row.posterUrl || row.backdropUrl,
        class: 'w-12 h-16 object-cover rounded',
        style: 'min-width: 48px'
      })
    }
  },
  { 
    title: '标题', 
    key: 'name',
    ellipsis: { tooltip: true }
  },
  { 
    title: '类型', 
    key: 'type',
    width: 100,
    render(row: any) {
      const typeMap: any = {
        Movie: { label: '电影', color: 'primary' },
        Series: { label: '剧集', color: 'success' },
        Season: { label: '季', color: 'info' },
        Episode: { label: '集', color: 'warning' }
      }
      const info = typeMap[row.type] || { label: row.type, color: 'default' }
      return h(NTag, { type: info.color, size: 'small' }, { default: () => info.label })
    }
  },
  { 
    title: '年份', 
    key: 'productionYear',
    width: 80
  },
  { 
    title: '入库时间', 
    key: 'dateCreated',
    width: 180,
    render(row: any) {
      return new Date(row.dateCreated).toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render(row: any) {
      return h(NButton, {
        size: 'small',
        secondary: true,
        onClick: () => window.open(row.webUrl, '_blank')
      }, { default: () => '查看' })
    }
  }
]

// Watch active key and fetch data
watch(activeKey, (newKey) => {
  if (newKey === 'overview') {
    fetchOverviewData()
  } else if (newKey === 'cdk') {
    fetchCDKs()
  } else if (newKey === 'users') {
    fetchUsers()
  } else if (newKey === 'templates') {
    fetchTemplates()
  } else if (newKey === 'media') {
    fetchMediaItems()
  } else if (newKey === 'settings') {
    fetchSettingsData()
  }
}, { immediate: true })

onMounted(() => {
  fetchOverviewData()
  fetchTemplates() // 预加载模板列表用于CDK生成
})
</script>

<template>
  <n-layout has-sider class="h-screen">
    <n-layout-sider bordered width="240" collapse-mode="width" :collapsed-width="64" show-trigger>
      <div class="p-4 font-bold text-lg flex items-center gap-2 truncate">
        <div class="i-mdi-shield-account text-primary text-2xl" />
        <span>Emby Admin</span>
      </div>
      <n-menu v-model:value="activeKey" :options="menuOptions" />
      <div class="p-4 mt-auto border-t border-gray-200 dark:border-gray-700">
        <n-button block secondary @click="router.push('/dashboard')">
          <template #icon><div class="i-mdi-arrow-left" /></template>
          返回前台
        </n-button>
      </div>
    </n-layout-sider>
    
    <n-layout-content class="bg-gray-50 dark:bg-gray-900 p-6">
      <!-- Overview Module -->
      <div v-if="activeKey === 'overview'" class="space-y-6">
        <h2 class="text-2xl font-bold mb-4">系统概览</h2>
        
        <n-spin :show="loading">
          <!-- Stats Cards -->
          <n-grid x-gap="12" y-gap="12" cols="2 s:4" responsive="screen">
            <n-grid-item v-for="stat in libraryStats" :key="stat.label">
              <n-card size="small" class="hover:shadow-md transition">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-gray-500 text-sm">{{ stat.label }}</div>
                    <div class="text-2xl font-bold mt-1">{{ stat.value }}</div>
                  </div>
                  <div :class="`${stat.icon} text-4xl ${stat.color} opacity-80`" />
                </div>
              </n-card>
            </n-grid-item>
          </n-grid>

          <!-- Latest Media -->
          <n-card title="最新入库媒体" class="mt-6">
            <n-list v-if="overviewStats.latestMedia.length > 0">
              <n-list-item v-for="item in overviewStats.latestMedia" :key="item.id">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <img v-if="item.posterUrl || item.backdropUrl" :src="item.posterUrl || item.backdropUrl" class="w-10 h-14 object-cover rounded" />
                    <div>
                      <div class="font-medium">{{ item.name }}</div>
                      <div class="text-xs text-gray-500">{{ item.type }} · {{ item.productionYear || '-' }}</div>
                    </div>
                  </div>
                  <div class="text-xs text-gray-400">
                    {{ new Date(item.dateCreated).toLocaleDateString('zh-CN') }}
                  </div>
                </div>
              </n-list-item>
            </n-list>
            <div v-else class="flex flex-col items-center justify-center py-8 text-gray-400">
              <div class="i-mdi-inbox-outline text-5xl mb-2" />
              <p class="text-sm">暂无媒体入库记录</p>
            </div>
          </n-card>
        </n-spin>
      </div>

      <!-- CDK Management -->
      <div v-else-if="activeKey === 'cdk'" class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">CDK 管理</h2>
          <n-button type="primary" @click="showGenerateModal = true">
            <template #icon><div class="i-mdi-plus" /></template>
            生成新 CDK
          </n-button>
        </div>
        
        <n-card class="flex-1 shadow-sm rounded-xl">
          <n-spin :show="loading">
            <n-data-table :columns="cdkColumns" :data="cdkData" :pagination="{ pageSize: 10 }" />
          </n-spin>
        </n-card>
      </div>

      <!-- User Management -->
      <div v-else-if="activeKey === 'users'" class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">用户管理</h2>
          <n-space>
            <n-button secondary @click="fetchUsers">
              <template #icon><div class="i-mdi-refresh" /></template>
              刷新
            </n-button>
          </n-space>
        </div>
        
        <n-card class="flex-1 shadow-sm rounded-xl">
          <n-spin :show="loading">
            <n-data-table :columns="userColumns" :data="usersData" :pagination="{ pageSize: 10 }" />
          </n-spin>
        </n-card>
      </div>

      <!-- Template Management -->
      <div v-else-if="activeKey === 'templates'" class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">模板管理</h2>
          <n-button type="primary" @click="openTemplateModal()">
            <template #icon><div class="i-mdi-plus" /></template>
            创建模板
          </n-button>
        </div>
        
        <n-card class="flex-1 shadow-sm rounded-xl">
          <n-spin :show="loading">
            <n-data-table :columns="templateColumns" :data="templatesData" :pagination="{ pageSize: 10 }" />
          </n-spin>
        </n-card>
      </div>

      <!-- Media Management -->
      <div v-else-if="activeKey === 'media'" class="h-full flex flex-col">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">最新入库媒体</h2>
          <n-button secondary @click="fetchMediaItems">
            <template #icon><div class="i-mdi-refresh" /></template>
            刷新
          </n-button>
        </div>
        
        <n-card class="flex-1 shadow-sm rounded-xl">
          <n-spin :show="loading">
            <n-data-table :columns="mediaColumns" :data="mediaItems" :pagination="{ pageSize: 15 }" />
          </n-spin>
        </n-card>
      </div>

      <!-- Settings Module -->
      <div v-else-if="activeKey === 'settings'" class="max-w-2xl mx-auto">
        <h2 class="text-2xl font-bold mb-6">系统设置</h2>
        <n-card title="登录页设置" class="shadow-sm rounded-xl">
          <n-spin :show="settingsLoading">
            <n-form label-placement="left" label-width="120">
              <n-form-item label="背景图来源库">
                <n-select 
                  v-model:value="systemConfig.login_background_library_id" 
                  :options="libraryOptions" 
                  placeholder="选择一个媒体库"
                  clearable
                />
                <template #feedback>
                  选择用于登录页背景展示的媒体库。留空则从所有库中随机获取。
                </template>
              </n-form-item>
              <n-form-item>
                <n-button type="primary" @click="saveSettings">保存设置</n-button>
              </n-form-item>
            </n-form>
          </n-spin>
        </n-card>
      </div>


    </n-layout-content>

    <!-- Generate CDK Modal -->
    <n-modal v-model:show="showGenerateModal">
      <n-card style="width: 500px" title="生成 CDK" :bordered="false" size="huge" role="dialog" aria-modal="true">
        <n-form label-placement="left" label-width="140">
          <n-form-item label="生成数量">
            <n-input-number v-model:value="generateForm.count" :min="1" :max="50" class="w-full" />
          </n-form-item>
          <n-form-item label="CDK有效期 (天)">
            <n-input-number v-model:value="generateForm.cdkValidDays" :min="1" :max="3650" class="w-full" />
            <template #feedback>
              <span class="text-xs text-gray-500">CDK多少天内可以使用</span>
            </template>
          </n-form-item>
          <n-form-item label="使用模板">
            <n-switch v-model:value="generateForm.useTemplate" />
          </n-form-item>
          <n-form-item v-if="generateForm.useTemplate" label="选择模板">
            <n-select 
              v-model:value="generateForm.templateId" 
              :options="templatesData.map((t: any) => ({ label: `${t.name} (${t.validDays === 0 ? '永久' : t.validDays + '天'})`, value: t.id }))"
              placeholder="选择模板"
            />
          </n-form-item>
          <n-form-item v-else label="会员时长 (天)">
            <n-input-number v-model:value="generateForm.memberValidDays" :min="0" :max="3650" class="w-full" />
            <template #feedback>
              <span class="text-xs text-gray-500">激活后账号可以使用多久，0=永久</span>
            </template>
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="flex justify-end gap-2">
            <n-button @click="showGenerateModal = false">取消</n-button>
            <n-button type="primary" @click="handleGenerate">确认生成</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>

    <!-- Template Modal -->
    <n-modal v-model:show="showTemplateModal">
      <n-card style="width: 500px" :title="templateForm.id ? '编辑模板' : '创建模板'" :bordered="false" size="huge" role="dialog" aria-modal="true">
        <n-form label-placement="left" label-width="120">
          <n-form-item label="模板名称" required>
            <n-input v-model:value="templateForm.name" placeholder="例如：月度会员" />
          </n-form-item>
          <n-form-item label="模板描述">
            <n-input 
              v-model:value="templateForm.description" 
              type="textarea" 
              placeholder="可选的模板说明"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </n-form-item>
          <n-form-item label="有效期 (天)" required>
            <n-input-number v-model:value="templateForm.validDays" :min="0" :max="3650" class="w-full" />
            <template #feedback>
              <span class="text-xs text-gray-500">0 表示永久有效</span>
            </template>
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="flex justify-end gap-2">
            <n-button @click="showTemplateModal = false">取消</n-button>
            <n-button type="primary" @click="handleSaveTemplate">{{ templateForm.id ? '更新' : '创建' }}</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </n-layout>
</template>
