import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import embyApi from './embyApi';

const prisma = new PrismaClient();

/**
 * 检查并处理过期用户
 * - 禁用 Emby 账号
 * - 更新本地数据库状态
 */
async function checkExpiredUsers() {
  try {
    console.log('[定时任务] 开始检查过期用户...');
    
    const now = new Date();
    
    // 查找所有已过期但仍处于活跃状态的用户
    const expiredUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        expiryDate: {
          not: null,
          lt: now // 小于当前时间
        }
      }
    });

    if (expiredUsers.length === 0) {
      console.log('[定时任务] 没有过期用户');
      return;
    }

    console.log(`[定时任务] 发现 ${expiredUsers.length} 个过期用户`);

    let successCount = 0;
    let failCount = 0;

    for (const user of expiredUsers) {
      try {
        // 1. 在 Emby 中禁用用户
        if (user.embyId) {
          await embyApi.post(`/Users/${user.embyId}/Policy`, {
            IsDisabled: true
          });
          console.log(`  ✓ 已禁用 Emby 用户: ${user.username} (${user.embyId})`);
        }

        // 2. 更新本地数据库状态
        await prisma.user.update({
          where: { id: user.id },
          data: { isActive: false }
        });

        console.log(`  ✓ 已更新本地用户状态: ${user.username}`);
        successCount++;

      } catch (error: any) {
        console.error(`  ✗ 处理用户失败: ${user.username}`, error.message);
        failCount++;
      }
    }

    console.log(`[定时任务] 处理完成: 成功 ${successCount}, 失败 ${failCount}`);

  } catch (error: any) {
    console.error('[定时任务] 检查过期用户失败:', error);
  }
}

/**
 * 初始化定时任务
 */
export function initScheduledTasks() {
  console.log('📅 正在初始化定时任务...');

  // 每天凌晨 3 点执行
  cron.schedule('0 3 * * *', () => {
    console.log('[定时任务] 触发: 检查过期用户');
    checkExpiredUsers();
  });

  // 每小时执行一次(可选,更及时)
  cron.schedule('0 * * * *', () => {
    console.log('[定时任务] 触发: 检查过期用户(每小时)');
    checkExpiredUsers();
  });

  // 启动时立即执行一次
  console.log('⏰ 定时任务已启动:');
  console.log('  - 每天 03:00 检查过期用户');
  console.log('  - 每小时整点检查过期用户');
  
  // 立即执行一次
  setTimeout(() => {
    console.log('[定时任务] 启动时检查...');
    checkExpiredUsers();
  }, 5000); // 5秒后执行,避免启动时阻塞
}

// 手动执行检查(用于测试或立即执行)
export async function runExpiredUsersCheck() {
  return checkExpiredUsers();
}
