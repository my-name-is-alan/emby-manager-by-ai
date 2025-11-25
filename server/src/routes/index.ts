import { Router } from 'express';
import authRoutes from './auth';
import cdkRoutes from './cdk';
import embyRoutes from './emby';
import configRoutes from './config';
import webhookRoutes from './webhook';
import templateRoutes from './template';
import adminRoutes from './admin';

const router = Router();

router.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

router.use('/auth', authRoutes);
router.use('/cdk', cdkRoutes);
router.use('/emby', embyRoutes);
router.use('/config', configRoutes);
router.use('/webhook', webhookRoutes);
router.use('/template', templateRoutes);
router.use('/admin', adminRoutes);

export default router;
