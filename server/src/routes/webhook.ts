import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import embyApi from '../utils/embyApi';

const router = Router();
const prisma = new PrismaClient();

const EMBY_SERVER_URL = process.env.EMBY_SERVER_URL || 'https://eb.izkm.cn';

// Helper functions from emby.ts
const generateImageUrl = (itemId: string, type: string = 'Primary', tag?: string, maxWidth?: number) => {
  if (!itemId) return '';
  let url = `${EMBY_SERVER_URL}/Items/${itemId}/Images/${type}`;
  const params = [];
  if (tag) params.push(`tag=${tag}`);
  if (maxWidth) params.push(`maxWidth=${maxWidth}`);
  if (params.length > 0) url += `?${params.join('&')}`;
  return url;
};

const generateEmbyWebUrl = (item: any, serverId: string) => {
  const baseUrl = `${EMBY_SERVER_URL}/web/index.html#!/item?id=${item.Id}`;
  const params = [`serverId=${serverId}`];
  
  if (item.Type === 'Series' || item.Type === 'Season' || item.Type === 'Episode') {
    params.push('context=home');
  }
  
  return `${baseUrl}&${params.join('&')}`;
};

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

// Emby Webhook 接收接口
router.post('/emby', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Emby webhook:', JSON.stringify(payload, null, 2));

    // Emby webhook 通知类型
    const event = payload.Event || payload.NotificationType;
    
    // 只处理新媒体入库事件
    if (event !== 'library.new') {
      return res.json({ success: true, message: 'Event ignored' });
    }

    const item = payload.Item;
    if (!item || !item.Id) {
      return res.status(400).json({ success: false, message: 'Invalid item data' });
    }

    // 获取 server ID
    const serverInfoRes = await embyApi.get('/System/Info/Public');
    const serverId = serverInfoRes.data.Id;

    // 检查是否已存在
    const existing = await prisma.mediaItem.findUnique({
      where: { embyId: item.Id }
    });

    if (existing) {
      console.log(`Media item ${item.Id} already exists, skipping`);
      return res.json({ success: true, message: 'Item already exists' });
    }

    // 生成 URLs
    const backdropUrl = item.BackdropImageTags && item.BackdropImageTags.length > 0
      ? generateImageUrl(item.Id, 'Backdrop', item.BackdropImageTags[0], 1920)
      : '';
    
    const posterUrl = getPosterUrl(item);
    const webUrl = generateEmbyWebUrl(item, serverId);

    // 存储到数据库
    const mediaItem = await prisma.mediaItem.create({
      data: {
        embyId: item.Id,
        name: item.Name || 'Unknown',
        overview: item.Overview || null,
        type: item.Type || 'Unknown',
        productionYear: item.ProductionYear || null,
        dateCreated: item.DateCreated ? new Date(item.DateCreated) : new Date(),
        backdropUrl: backdropUrl || null,
        posterUrl: posterUrl || null,
        webUrl: webUrl || null,
      }
    });

    console.log('Media item saved:', mediaItem);
    res.json({ success: true, data: mediaItem });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取最新入库的媒体
router.get('/latest-media', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const items = await prisma.mediaItem.findMany({
      orderBy: { dateCreated: 'desc' },
      take: parseInt(limit as string),
    });

    res.json(items);
  } catch (error: any) {
    console.error('Failed to fetch latest media:', error);
    res.status(500).json({ message: 'Failed to fetch latest media' });
  }
});

export default router;
