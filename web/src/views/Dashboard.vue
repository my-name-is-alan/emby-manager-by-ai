<script setup lang="ts">
import { 
  NLayout, NLayoutHeader, NLayoutContent, NCard, NGrid, NGridItem, 
  NStatistic, NButton, NSpace, NCarousel, NAvatar, NProgress, 
  NModal, NForm, NFormItem, NInput, useMessage, NDropdown, NSpin
} from 'naive-ui'
import { ref, h, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import api from '../utils/api'

const router = useRouter()
const message = useMessage()
const userStore = useUserStore()

const loading = ref(true)
const latestMedia = ref<any[]>([])
const resumeItems = ref<any[]>([])
const libraries = ref<any[]>([])

// Extract userId from JWT or user store
const userId = computed(() => {
  // Assuming we store embyId in user object
  return userStore.user?.embyId || ''
})

const fetchDashboardData = async () => {
  loading.value = true
  try {
    // 优先加载关键内容(最新入库和继续观看)
    const [latestRes, resumeRes] = await Promise.all([
      api.get('/webhook/latest-media', { params: { limit: 10 } }),
      api.get('/emby/resume', { params: { userId: userId.value } })
    ])
    
    // 异步加载次要内容(不阻塞页面渲染)
    const viewsPromise = api.get('/emby/views', { params: { userId: userId.value } })
    const popularPromise = api.get('/emby/popular', { params: { userId: userId.value } })
    const recentPromise = api.get('/emby/recent', { params: { userId: userId.value } })

    // Use data from webhook stored items
    latestMedia.value = latestRes.data
      .filter((item: any) => item.backdropUrl)
      .map((item: any) => ({
        id: item.embyId,
        title: item.name,
        year: item.productionYear,
        backdrop: item.backdropUrl,
        webUrl: item.webUrl,
        overview: item.overview || '暂无简介',
        dateCreated: item.dateCreated
      }))

    resumeItems.value = resumeRes.data.Items?.map((item: any) => ({
      id: item.Id,
      title: item.Name,
      progress: item.UserData?.PlayedPercentage || 0,
      poster: item.PosterUrl || 'https://picsum.photos/300/450?grayscale',
      webUrl: item.WebUrl
    })) || []
    
    // 页面已可交互，后台加载次要数据
    loading.value = false
    
    // 异步加载媒体库信息(不阻塞页面)
    viewsPromise.then(viewsRes => {
      libraries.value = viewsRes.data.Items?.map((view: any) => ({
        id: view.Id,
        name: view.Name,
        icon: getLibraryIcon(view.CollectionType),
        count: view.ChildCount || 0,
        cover: view.PrimaryImageUrl || 'https://picsum.photos/400/225?grayscale',
        collectionType: view.CollectionType,
        libraryUrl: view.LibraryUrl
      })) || []
    }).catch(err => console.error('Failed to load libraries:', err))
    
    // 可选：加载热门/最近播放等其他数据
    // popularPromise.then(...).catch(...)
    // recentPromise.then(...).catch(...)
    
  } catch (error: any) {
    console.error('Failed to fetch dashboard data:', error)
    message.error('获取数据失败')
    loading.value = false
  }
}

const getLibraryIcon = (type: string) => {
  const iconMap: any = {
    movies: 'i-mdi-movie-open',
    tvshows: 'i-mdi-television-classic',
    music: 'i-mdi-music',
    books: 'i-mdi-book-open-page-variant'
  }
  return iconMap[type] || 'i-mdi-folder'
}

onMounted(() => {
  if (userId.value) {
    fetchDashboardData()
  } else {
    message.error('未找到用户信息，请重新登录')
    router.push('/login')
  }
})

// --- Logic ---
const showChangePassword = ref(false)
const passwordForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

const handleLogout = () => {
  userStore.logout()
  message.info('已退出登录')
  router.push('/login')
}

const handleChangePassword = () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    message.error('两次新密码输入不一致')
    return
  }
  message.success('密码修改成功')
  showChangePassword.value = false
  passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
}

const userOptions = [
  { label: '修改密码', key: 'change-password', icon: () => h('div', { class: 'i-mdi-key' }) },
  { label: '管理员后台', key: 'admin', icon: () => h('div', { class: 'i-mdi-shield-account' }) },
  { type: 'divider', key: 'd1' },
  { label: '退出登录', key: 'logout', icon: () => h('div', { class: 'i-mdi-logout text-red-500' }) }
]

const handleUserSelect = (key: string) => {
  if (key === 'logout') handleLogout()
  if (key === 'admin') router.push('/admin')
  if (key === 'change-password') showChangePassword.value = true
}

const openMedia = (item: any) => {
  // Use URL provided by backend
  const url = item.libraryUrl || item.webUrl
  if (url) {
    window.open(url, '_blank')
  }
}
</script>

<template>
  <n-layout class="h-screen flex flex-col">
    <!-- Header -->
    <n-layout-header bordered class="px-6 py-3 flex justify-between items-center bg-white dark:bg-gray-800 shadow-sm" :style="{ position: 'sticky', top: 0, zIndex: 100 }">
      <div class="flex items-center gap-3">
        <div class="i-mdi-play-circle text-3xl text-primary" />
        <div class="text-xl font-bold tracking-tight">
          <span class="hidden sm:inline">Emby Dashboard</span>
          <span class="sm:hidden">Emby</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <n-button circle secondary>
          <template #icon><div class="i-mdi-magnify" /></template>
        </n-button>
        <n-dropdown :options="userOptions" @select="handleUserSelect">
          <div class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition">
            <n-avatar round size="small" color="#18a058">
              {{ (userStore.user?.username || 'U').charAt(0).toUpperCase() }}
            </n-avatar>
            <span class="font-medium">{{ userStore.user?.username || 'User' }}</span>
            <div class="i-mdi-chevron-down" />
          </div>
        </n-dropdown>
      </div>
    </n-layout-header>

    <n-layout-content class="flex-1 bg-gray-50 dark:bg-gray-900 overflow-x-hidden" content-style="padding: 24px;">
      <div class="w-full max-w-[1200px] mx-auto space-y-8">
        
        <!-- Three Column Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-6 max-w-full" v-if="!loading">
          <!-- Left Sidebar - User Card & Continue Watching -->
          <aside class="space-y-6">
            <!-- User Profile Card -->
            <n-card :bordered="false" class="shadow-lg">
              <div class="text-center">
                <!-- Avatar -->
                <div class="relative inline-block mb-3">
                  <n-avatar 
                    round 
                    :size="80"
                    color="#18a058"
                    class="ring-3 ring-gray-100 dark:ring-gray-700 text-2xl"
                  >
                    {{ (userStore.user?.username || 'U').charAt(0).toUpperCase() }}
                  </n-avatar>
                </div>
                
                <!-- Username & Role -->
                <h3 class="text-lg font-bold mb-1">{{ userStore.user?.username || 'User' }}</h3>
                <p class="text-xs text-gray-500 mb-3">
                  <span class="inline-flex items-center gap-1">
                    <div :class="userStore.user?.role === 'admin' ? 'i-mdi-shield-crown' : 'i-mdi-account'" />
                    {{ userStore.user?.role === 'admin' ? '管理员' : '普通用户' }}
                  </span>
                </p>

                <!-- Divider -->
                <div class="border-t border-gray-100 dark:border-gray-700 my-3"></div>

                <!-- Account Details -->
                <div class="space-y-2 text-left">
                  <div class="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <div class="i-mdi-calendar-clock text-lg text-blue-500 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-xs text-gray-500">注册时间</div>
                      <div class="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                        {{ userStore.user?.createdAt ? new Date(userStore.user.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '-' }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <div class="i-mdi-calendar-check text-lg text-green-500 flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="text-xs text-gray-500">到期时间</div>
                      <div class="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">
                        {{ userStore.user?.expiryDate ? new Date(userStore.user.expiryDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '永久有效' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </n-card>

            <!-- Continue Watching -->
            <n-card title="继续观看" :bordered="false" class="shadow-lg">
              <div v-if="resumeItems.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
                <div class="i-mdi-play-pause text-5xl text-gray-300 dark:text-gray-600 mb-2" />
                <p class="text-sm text-gray-400 dark:text-gray-600">暂无继续观看的内容</p>
              </div>
              <div v-else class="space-y-3">
                <div 
                  v-for="item in resumeItems.slice(0, 5)" 
                  :key="item.id"
                  class="flex gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition"
                  @click="openMedia(item)"
                >
                  <div class="relative w-16 h-24 flex-shrink-0 rounded overflow-hidden">
                    <img :src="item.poster" class="w-full h-full object-cover" />
                    <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                      <div class="h-full bg-primary" :style="{ width: item.progress + '%' }"></div>
                    </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{{ item.title }}</div>
                    <div class="text-xs text-gray-500 mt-1">{{ Math.round(item.progress) }}%</div>
                  </div>
                </div>
              </div>
            </n-card>
          </aside>

          <!-- Center Content - Latest Media (Blog Style) -->
          <main class="space-y-6 min-w-0 overflow-hidden">
            <!-- Empty State -->
            <div v-if="latestMedia.length === 0" class="flex flex-col items-center justify-center py-16">
              <div class="i-mdi-inbox-outline text-8xl text-gray-300 dark:text-gray-600 mb-4" />
              <h3 class="text-xl font-bold text-gray-400 dark:text-gray-500 mb-2">暂无最新入库内容</h3>
              <p class="text-sm text-gray-400 dark:text-gray-600">等待新媒体入库后会在这里显示</p>
            </div>

            <div v-else class="space-y-4">
              <!-- Latest Media Item (Blog Card Style) -->
              <n-card 
                v-for="item in latestMedia" 
                :key="item.id"
                :bordered="false"
                class="shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
                @click="openMedia(item)"
              >
                <div class="flex items-start gap-4">
                  <!-- User Avatar (like blog author) -->
                  <n-avatar 
                    round 
                    :size="48"
                    color="#18a058"
                  >
                    管
                  </n-avatar>
                  
                  <div class="flex-1 min-w-0">
                    <!-- Header Info -->
                    <div class="mb-2">
                      <div class="flex items-center gap-2">
                        <span class="font-bold">管理员</span>
                        <span class="text-gray-400 text-sm">{{ item.year }}</span>
                      </div>
                      <div class="text-xs text-gray-400 mt-1">
                        {{ item.dateCreated ? new Date(item.dateCreated).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '入库时间未知' }}
                      </div>
                    </div>
                    
                    <!-- Title -->
                    <h3 class="text-lg font-bold mb-2">{{ item.title }}</h3>
                    
                    <!-- Description -->
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                      {{ item.overview }}
                    </p>
                    
                    <!-- Cover Image (Smaller) -->
                    <div class="relative w-full max-w-md aspect-video rounded-lg overflow-hidden mb-3">
                      <img :src="item.backdrop" class="w-full h-full object-cover" />
                    </div>
                    
                    <!-- Tag -->
                    <div class="flex items-center gap-2 mb-3">
                      <div class="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-xs">
                        <div class="i-mdi-new-box" />
                        最新入库
                      </div>
                    </div>
                    
                    <!-- Footer Stats (like blog engagement) -->
                    <div class="flex items-center gap-6 text-sm text-gray-500">
                      <span class="flex items-center gap-1">
                        <div class="i-mdi-eye-outline" /> 391
                      </span>
                      <span class="flex items-center gap-1">
                        <div class="i-mdi-comment-outline" /> 0
                      </span>
                      <span class="flex items-center gap-1">
                        <div class="i-mdi-heart-outline" /> 19
                      </span>
                    </div>
                  </div>
                </div>
              </n-card>
              
              <!-- Load More Button -->
              <div class="text-center py-4">
                <n-button secondary>加载更多</n-button>
              </div>
            </div>
          </main>

          <!-- Right Sidebar - Libraries (Tag Style) -->
          <aside class="space-y-6">
            <n-card title="媒体库" :bordered="false" class="shadow-lg">
              <div v-if="libraries.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
                <div class="i-mdi-folder-open-outline text-5xl text-gray-300 dark:text-gray-600 mb-2" />
                <p class="text-sm text-gray-400 dark:text-gray-600">暂无媒体库</p>
              </div>
              <div v-else class="flex flex-wrap gap-2">
                <div 
                  v-for="lib in libraries" 
                  :key="lib.id"
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-primary/10 dark:hover:bg-primary/20 cursor-pointer transition text-sm"
                  @click="openMedia(lib)"
                >
                  <div :class="`${lib.icon} text-base text-primary`" />
                  <span class="font-medium">{{ lib.name }}</span>
                </div>
              </div>
            </n-card>
          </aside>
        </div>

        <!-- Skeleton Loading -->
        <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-6 max-w-full" v-else>
          <!-- Left Sidebar Skeleton -->
          <aside class="space-y-6">
            <!-- User Card Skeleton -->
            <n-card :bordered="false" class="shadow-lg">
              <div class="text-center">
                <div class="relative inline-block mb-3">
                  <n-skeleton circle :sharp="false" style="width: 80px; height: 80px;" />
                </div>
                <n-skeleton text style="width: 120px; height: 24px; margin: 0 auto 8px;" :sharp="false" />
                <n-skeleton text style="width: 80px; height: 16px; margin: 0 auto 16px;" :sharp="false" />
                <div class="border-t border-gray-100 dark:border-gray-700 my-3"></div>
                <div class="space-y-2 text-left">
                  <div class="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <n-skeleton circle style="width: 18px; height: 18px;" :sharp="false" />
                    <div class="flex-1">
                      <n-skeleton text style="width: 60px; height: 12px; margin-bottom: 4px;" :sharp="false" />
                      <n-skeleton text style="width: 100px; height: 14px;" :sharp="false" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <n-skeleton circle style="width: 18px; height: 18px;" :sharp="false" />
                    <div class="flex-1">
                      <n-skeleton text style="width: 60px; height: 12px; margin-bottom: 4px;" :sharp="false" />
                      <n-skeleton text style="width: 80px; height: 14px;" :sharp="false" />
                    </div>
                  </div>
                </div>
              </div>
            </n-card>
            
            <!-- Continue Watching Skeleton -->
            <n-card :bordered="false" class="shadow-lg">
              <template #header>
                <n-skeleton text style="width: 80px; height: 20px;" :sharp="false" />
              </template>
              <div class="space-y-3">
                <div v-for="i in 3" :key="i" class="flex gap-3 p-2 rounded-lg">
                  <n-skeleton style="width: 64px; height: 96px; flex-shrink: 0;" :sharp="false" />
                  <div class="flex-1">
                    <n-skeleton text style="width: 100%; height: 16px; margin-bottom: 8px;" :sharp="false" />
                    <n-skeleton text style="width: 40px; height: 14px;" :sharp="false" />
                  </div>
                </div>
              </div>
            </n-card>
          </aside>

          <!-- Center Content Skeleton -->
          <main class="space-y-6 min-w-0 overflow-hidden">
            <div class="space-y-4">
              <n-card v-for="i in 3" :key="i" :bordered="false" class="shadow-lg">
                <div class="flex items-start gap-4">
                  <n-skeleton circle style="width: 48px; height: 48px;" :sharp="false" />
                  <div class="flex-1 min-w-0">
                    <div class="mb-2">
                      <div class="flex items-center gap-2 mb-2">
                        <n-skeleton text style="width: 80px; height: 18px;" :sharp="false" />
                        <n-skeleton text style="width: 50px; height: 14px;" :sharp="false" />
                      </div>
                      <n-skeleton text style="width: 120px; height: 12px;" :sharp="false" />
                    </div>
                    <n-skeleton text style="width: 70%; height: 22px; margin-bottom: 12px;" :sharp="false" />
                    <div class="space-y-2 mb-3">
                      <n-skeleton text style="width: 100%; height: 14px;" :sharp="false" />
                      <n-skeleton text style="width: 100%; height: 14px;" :sharp="false" />
                      <n-skeleton text style="width: 80%; height: 14px;" :sharp="false" />
                    </div>
                    <n-skeleton style="width: 100%; max-width: 448px; height: 252px; margin-bottom: 12px; border-radius: 8px;" :sharp="false" />
                    <div class="flex items-center gap-2 mb-3">
                      <n-skeleton style="width: 80px; height: 24px; border-radius: 4px;" :sharp="false" />
                    </div>
                    <div class="flex items-center gap-6">
                      <n-skeleton text style="width: 50px; height: 14px;" :sharp="false" />
                      <n-skeleton text style="width: 40px; height: 14px;" :sharp="false" />
                      <n-skeleton text style="width: 40px; height: 14px;" :sharp="false" />
                    </div>
                  </div>
                </div>
              </n-card>
            </div>
          </main>

          <!-- Right Sidebar Skeleton -->
          <aside class="space-y-6">
            <n-card :bordered="false" class="shadow-lg">
              <template #header>
                <n-skeleton text style="width: 60px; height: 20px;" :sharp="false" />
              </template>
              <div class="flex flex-wrap gap-2">
                <n-skeleton v-for="i in 4" :key="i" style="width: 100px; height: 36px; border-radius: 9999px;" :sharp="false" />
              </div>
            </n-card>
          </aside>
        </div>

      </div>
    </n-layout-content>

    <!-- Change Password Modal -->
    <n-modal v-model:show="showChangePassword">
      <n-card style="width: 400px" title="修改密码" :bordered="false" size="huge" role="dialog" aria-modal="true">
        <n-form>
          <n-form-item label="旧密码">
            <n-input type="password" v-model:value="passwordForm.oldPassword" show-password-on="click" placeholder="请输入当前密码" />
          </n-form-item>
          <n-form-item label="新密码">
            <n-input type="password" v-model:value="passwordForm.newPassword" show-password-on="click" placeholder="请输入新密码" />
          </n-form-item>
          <n-form-item label="确认新密码">
            <n-input type="password" v-model:value="passwordForm.confirmPassword" show-password-on="click" placeholder="请再次输入新密码" />
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="flex justify-end gap-2">
            <n-button @click="showChangePassword = false">取消</n-button>
            <n-button type="primary" @click="handleChangePassword">确认修改</n-button>
          </div>
        </template>
      </n-card>
    </n-modal>
  </n-layout>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>
