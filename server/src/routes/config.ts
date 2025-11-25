import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import embyApi from '../utils/embyApi';

const router = Router();
const prisma = new PrismaClient();

// Get all system configs
router.get('/', async (req, res) => {
  const configs = await prisma.systemConfig.findMany();
  res.json(configs);
});

// Update a config
router.post('/', async (req, res) => {
  const { key, value, description } = req.body;
  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value, description },
    create: { key, value, description },
  });
  res.json(config);
});

// Get Emby Libraries (for selection)
router.get('/libraries', async (req, res) => {
  try {
    // Emby API to get user's views (libraries)
    // Note: This usually requires a User Id. If we use the API Key, we might need to specify a user or use a different endpoint.
    // /Library/VirtualFolders is a system level endpoint, might work with API Key.
    // Let's try /Library/MediaFolders first, or /Users/{UserId}/Views if we have a user context.
    // Since this is admin config, we can try to get views for the first admin user or system wide.
    
    // Attempt 1: /Library/VirtualFolders (System level)
    const response = await embyApi.get('/Library/VirtualFolders');
    res.json(response.data);
  } catch (error: any) {
    console.error('Failed to fetch libraries (VirtualFolders):', error.response?.data || error.message);
    
    // Fallback Attempt 2: Get all items that are folders/views
    try {
        const itemsResponse = await embyApi.get('/Items', {
            params: {
                Recursive: false,
                IncludeItemTypes: 'CollectionFolder', // or 'UserView'
            }
        });
        res.json(itemsResponse.data.Items);
    } catch (fallbackError: any) {
        console.error('Failed to fetch libraries (Fallback):', fallbackError.response?.data || fallbackError.message);
        res.status(500).json({ message: 'Failed to fetch libraries' });
    }
  }
});

export default router;
