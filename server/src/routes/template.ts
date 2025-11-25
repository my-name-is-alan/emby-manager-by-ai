import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// 获取所有模板
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.template.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(templates);
  } catch (error: any) {
    console.error('Failed to fetch templates:', error);
    res.status(500).json({ message: 'Failed to fetch templates' });
  }
});

// 获取单个模板
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error('Failed to fetch template:', error);
    res.status(500).json({ message: 'Failed to fetch template' });
  }
});

// 创建模板
router.post('/', async (req, res) => {
  try {
    const { name, description, validDays, policy, configuration } = req.body;
    
    if (!name || validDays === undefined) {
      return res.status(400).json({ message: '模板名称和有效天数不能为空' });
    }

    // 默认的 policy 和 configuration（如果未提供）
    const defaultPolicy = {
      IsAdministrator: false,
      IsHidden: false,
      IsDisabled: false,
      EnableAllFolders: true,
      EnabledFolders: [],
      EnableAllDevices: true,
      EnabledDevices: [],
      EnableAllChannels: true,
      EnabledChannels: [],
      EnableRemoteControlOfOtherUsers: false,
      EnableSharedDeviceControl: false,
      EnableRemoteAccess: true,
      EnableLiveTvManagement: false,
      EnableLiveTvAccess: true,
      EnableMediaPlayback: true,
      EnableAudioPlaybackTranscoding: true,
      EnableVideoPlaybackTranscoding: true,
      EnablePlaybackRemuxing: true,
      EnableContentDeletion: false,
      EnableContentDownloading: false,
      EnableSyncTranscoding: false,
      EnableMediaConversion: false,
      InvalidLoginAttemptCount: 0,
      EnablePublicSharing: false,
      BlockedTags: [],
      BlockedMediaFolders: [],
      BlockedChannels: [],
      RemoteClientBitrateLimit: 0,
      AuthenticationProviderId: 'Emby.Server.Implementations.Library.DefaultAuthenticationProvider',
      ExcludedSubFolders: [],
      DisablePremiumFeatures: false,
      SimultaneousStreamLimit: 0
    };

    const defaultConfiguration = {
      AudioLanguagePreference: 'chi',
      PlayDefaultAudioTrack: true,
      SubtitleLanguagePreference: 'chi',
      DisplayMissingEpisodes: false,
      SubtitleMode: 'Default',
      EnableLocalPassword: false,
      OrderedViews: [],
      LatestItemsExcludes: [],
      MyMediaExcludes: [],
      HidePlayedInLatest: true,
      RememberAudioSelections: true,
      RememberSubtitleSelections: true,
      EnableNextEpisodeAutoPlay: true
    };

    const template = await prisma.template.create({
      data: {
        name,
        description: description || null,
        validDays: parseInt(validDays),
        policy: policy ? JSON.stringify(policy) : JSON.stringify(defaultPolicy),
        configuration: configuration ? JSON.stringify(configuration) : JSON.stringify(defaultConfiguration)
      }
    });

    res.json(template);
  } catch (error: any) {
    console.error('Failed to create template:', error);
    res.status(500).json({ message: 'Failed to create template' });
  }
});

// 更新模板
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, validDays, policy, configuration } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (validDays !== undefined) updateData.validDays = parseInt(validDays);
    if (policy !== undefined) updateData.policy = JSON.stringify(policy);
    if (configuration !== undefined) updateData.configuration = JSON.stringify(configuration);

    const template = await prisma.template.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.json(template);
  } catch (error: any) {
    console.error('Failed to update template:', error);
    res.status(500).json({ message: 'Failed to update template' });
  }
});

// 删除模板
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否有CDK使用了这个模板
    const cdkCount = await prisma.cdk.count({
      where: { templateId: parseInt(id) }
    });

    if (cdkCount > 0) {
      return res.status(400).json({ 
        message: `无法删除该模板，还有 ${cdkCount} 个CDK正在使用此模板` 
      });
    }

    await prisma.template.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    console.error('Failed to delete template:', error);
    res.status(500).json({ message: 'Failed to delete template' });
  }
});

export default router;
