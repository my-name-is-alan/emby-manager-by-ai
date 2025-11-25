import { Router } from 'express';
import embyApi from '../utils/embyApi';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const EMBY_SERVER_URL = process.env.EMBY_SERVER_URL || 'https://eb.izkm.cn';

// 缓存 serverId 避免重复请求
let cachedServerId: string | null = null;
let serverIdCacheTime: number = 0;
const SERVER_ID_CACHE_TTL = 3600000; // 1小时缓存

async function getServerId(): Promise<string> {
  const now = Date.now();
  if (cachedServerId && (now - serverIdCacheTime) < SERVER_ID_CACHE_TTL) {
    return cachedServerId;
  }
  
  const serverInfoRes = await embyApi.get('/System/Info/Public');
  cachedServerId = serverInfoRes.data.Id;
  serverIdCacheTime = now;
  return cachedServerId!;
}

// Helper function to generate image URL
const generateImageUrl = (itemId: string, type: string = 'Primary', tag?: string, maxWidth?: number) => {
  if (!itemId) return '';
  let url = `${EMBY_SERVER_URL}/Items/${itemId}/Images/${type}`;
  const params = [];
  if (tag) params.push(`tag=${tag}`);
  if (maxWidth) params.push(`maxWidth=${maxWidth}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  return url;
};

// Helper function to generate Emby web URL
const generateEmbyWebUrl = (item: any, serverId: string) => {
  const baseUrl = `${EMBY_SERVER_URL}/web/index.html#!/item?id=${item.Id}`;
  const params = [`serverId=${serverId}`];
  
  // Add context=home for Series, Season, Episode types
  if (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
    params.push('context=home');
  }
  
  return `${baseUrl}&${params.join('&')}`;
};

// Helper function to get poster URL with fallback logic
const getPosterUrl = (item: any) => {
  if (item.ImageTags?.Primary) {
    return generateImageUrl(item.Id, 'Primary', item.ImageTags.Primary, 500);
  } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
    const parentId = item.SeriesId || item.ParentId;
    if (parentId) {
      return `${EMBY_SERVER_URL}/Items/${parentId}/Images/Backdrop?maxWidth=500&tag=${item.ParentBackdropImageTags[0]}&quality=70`;
    }
  }
  return '';
};

// Helper function to transform items with web URLs and image URLs
const transformItemsWithUrls = (items: any[], serverId: string) => {
  if (!items || !Array.isArray(items)) return [];
  return items.map(item => ({
    ...item,
    WebUrl: generateEmbyWebUrl(item, serverId),
    PosterUrl: getPosterUrl(item),
    BackdropUrl: item.BackdropImageTags?.[0] ? generateImageUrl(item.Id, 'Backdrop', item.BackdropImageTags[0]) : '',
    PrimaryImageUrl: item.ImageTags?.Primary ? generateImageUrl(item.Id, 'Primary', item.ImageTags.Primary) : ''
  }));
};

// Public endpoint to get a random high-quality background from Emby
router.get('/login-background', async (req, res) => {
  try {
    // Get configured parent ID from DB
    const config = await prisma.systemConfig.findUnique({ where: { key: 'login_background_library_id' } });
    const parentId = config?.value;

    // 1. Get multiple random items with backdrops, then pick one to ensure true randomness
    const params: any = {
      Recursive: true,
      IncludeItemTypes: 'Movie,Series',
      ImageTypes: 'Backdrop',
      SortBy: 'Random',
      Limit: 20, // Get more items to improve randomness
    };

    if (parentId) {
      params.ParentId = parentId;
    }

    const itemsResponse = await embyApi.get('/Items', { params });

    if (!itemsResponse.data.Items || itemsResponse.data.Items.length === 0) {
      // Fallback if no items found
      return res.redirect('https://picsum.photos/1920/1080?grayscale');
    }

    // Pick a random item from the results (server-side randomization)
    const randomIndex = Math.floor(Math.random() * itemsResponse.data.Items.length);
    const itemId = itemsResponse.data.Items[randomIndex].Id;

    // 2. Stream the image content
    // Note: We use the same embyApi instance which has the API Key header
    const imageResponse = await embyApi.get(`/Items/${itemId}/Images/Backdrop/0`, {
      params: {
        MaxHeight: 1080,
        Quality: 90,
      },
      responseType: 'stream'
    });

    // 3. Pipe the image to the client
    res.setHeader('Content-Type', imageResponse.headers['content-type']);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // Disable cache to ensure random images
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    imageResponse.data.pipe(res);

  } catch (error) {
    console.error('Error fetching background from Emby:', error);
    res.redirect('https://picsum.photos/1920/1080?grayscale');
  }
});

// Get latest added items
router.get('/latest', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 并行执行数据库查询和服务器信息获取(使用缓存)
    const [user, serverId] = await Promise.all([
      prisma.user.findFirst({ where: { embyId: userId as string } }),
      getServerId()
    ]);
    
    if (!user?.embyAccessToken) {
      return res.status(401).json({ message: '用户令牌无效，请重新登录' });
    }

    // Use user's access token instead of admin API key
    const response = await embyApi.get('/Users/' + userId + '/Items/Latest', {
      params: {
        Limit: 30,
        Fields: 'PrimaryImageAspectRatio,Overview,BackdropImageTags',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Banner,Thumb'
      },
      headers: {
        'X-Emby-Token': user.embyAccessToken
      }
    });
    
    // Transform items to include WebUrl
    const itemsWithUrls = transformItemsWithUrls(response.data, serverId);
    res.json(itemsWithUrls);
  } catch (error: any) {
    console.error('Failed to fetch latest items:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch latest items' });
  }
});

// Get resume items (continue watching)
router.get('/resume', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 并行执行数据库查询和服务器信息获取
    const [user, serverInfoRes] = await Promise.all([
      prisma.user.findFirst({ where: { embyId: userId as string } }),
      embyApi.get('/System/Info/Public')
    ]);
    
    if (!user?.embyAccessToken) {
      return res.status(401).json({ message: '用户令牌无效，请重新登录' });
    }

    const serverId = serverInfoRes.data.Id;

    // Use user's access token with the same parameters as Emby Web
    const response = await embyApi.get('/Users/' + userId + '/Items/Resume', {
      params: {
        Recursive: true,
        Fields: 'BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,ProductionYear',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        MediaTypes: 'Video',
        Limit: 12
      },
      headers: {
        'X-Emby-Token': user.embyAccessToken
      }
    });
    
    // Transform items to include WebUrl
    const itemsWithUrls = transformItemsWithUrls(response.data.Items || [], serverId);
    res.json({
      ...response.data,
      Items: itemsWithUrls
    });
  } catch (error: any) {
    console.error('Failed to fetch resume items:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch resume items' });
  }
});

// Get user views (libraries)
router.get('/views', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 并行执行数据库查询和服务器信息获取
    const [user, serverInfoRes] = await Promise.all([
      prisma.user.findFirst({ where: { embyId: userId as string } }),
      embyApi.get('/System/Info/Public')
    ]);
    
    if (!user?.embyAccessToken) {
      return res.status(401).json({ message: '用户令牌无效，请重新登录' });
    }

    const serverId = serverInfoRes.data.Id;

    // Use user's access token instead of admin API key
    const response = await embyApi.get('/Users/' + userId + '/Views', {
      headers: {
        'X-Emby-Token': user.embyAccessToken
      }
    });
    
    // Add image URLs and library URLs to each view
    const itemsWithUrls = response.data.Items?.map((view: any) => ({
      ...view,
      PrimaryImageUrl: view.ImageTags?.Primary ? generateImageUrl(view.Id, 'Primary', view.ImageTags.Primary) : '',
      LibraryUrl: `${EMBY_SERVER_URL}/web/index.html#!/videos?serverId=${serverId}&parentId=${view.Id}`
    })) || [];
    
    res.json({
      ...response.data,
      Items: itemsWithUrls,
      ServerId: serverId
    });
  } catch (error: any) {
    console.error('Failed to fetch views:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch views' });
  }
});

// Get popular items (most played)
router.get('/popular', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 并行执行数据库查询和服务器信息获取
    const [user, serverInfoRes] = await Promise.all([
      prisma.user.findFirst({ where: { embyId: userId as string } }),
      embyApi.get('/System/Info/Public')
    ]);
    
    if (!user?.embyAccessToken) {
      return res.status(401).json({ message: '用户令牌无效，请重新登录' });
    }

    const serverId = serverInfoRes.data.Id;

    // Use user's access token to get items sorted by play count
    const response = await embyApi.get('/Users/' + userId + '/Items', {
      params: {
        SortBy: 'PlayCount',
        SortOrder: 'Descending',
        Limit: 20,
        Recursive: true,
        IncludeItemTypes: 'Movie,Series,Episode',
        Fields: 'PrimaryImageAspectRatio,Overview,PlayCount',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop',
        MinPlays: 1 // Only items that have been played at least once
      },
      headers: {
        'X-Emby-Token': user.embyAccessToken
      }
    });
    
    // Transform items to include WebUrl
    const itemsWithUrls = transformItemsWithUrls(response.data.Items || [], serverId);
    res.json({
      ...response.data,
      Items: itemsWithUrls
    });
  } catch (error: any) {
    console.error('Failed to fetch popular items:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch popular items' });
  }
});

// Get recently played items
router.get('/recent', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // 并行执行数据库查询和服务器信息获取
    const [user, serverInfoRes] = await Promise.all([
      prisma.user.findFirst({ where: { embyId: userId as string } }),
      embyApi.get('/System/Info/Public')
    ]);
    
    if (!user?.embyAccessToken) {
      return res.status(401).json({ message: '用户令牌无效，请重新登录' });
    }

    const serverId = serverInfoRes.data.Id;

    // Use user's access token to get recently played items
    const response = await embyApi.get('/Users/' + userId + '/Items', {
      params: {
        SortBy: 'DatePlayed',
        SortOrder: 'Descending',
        Limit: 20,
        Recursive: true,
        Filters: 'IsPlayed',
        IncludeItemTypes: 'Movie,Series,Episode',
        Fields: 'PrimaryImageAspectRatio,Overview,UserData,DateCreated',
        ImageTypeLimit: 1,
        EnableImageTypes: 'Primary,Backdrop'
      },
      headers: {
        'X-Emby-Token': user.embyAccessToken
      }
    });
    
    // Transform items to include WebUrl
    const itemsWithUrls = transformItemsWithUrls(response.data.Items || [], serverId);
    res.json({
      ...response.data,
      Items: itemsWithUrls
    });
  } catch (error: any) {
    console.error('Failed to fetch recent items:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to fetch recent items' });
  }
});

export default router;
