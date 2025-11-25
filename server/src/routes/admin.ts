import { Router } from 'express';
import { runExpiredUsersCheck } from '../utils/scheduler';

const router = Router();

// 手动触发过期用户检查(管理员使用)
router.post('/check-expired', async (req, res) => {
  try {
    console.log('手动触发过期用户检查');
    await runExpiredUsersCheck();
    res.json({ success: true, message: '过期用户检查完成' });
  } catch (error: any) {
    console.error('手动检查失败:', error);
    res.status(500).json({ success: false, message: '检查失败' });
  }
});

export default router;
