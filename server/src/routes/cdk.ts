import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// 生成随机 CDK 码
function generateCDKCode(): string {
  const prefix = 'EMBY';
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${part1}-${part2}`;
}

// 获取所有 CDK
router.get('/', async (req, res) => {
  try {
    const cdks = await prisma.cdk.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            validDays: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(cdks);
  } catch (error: any) {
    console.error('Failed to fetch CDKs:', error);
    res.status(500).json({ message: 'Failed to fetch CDKs' });
  }
});

// 生成 CDK
router.post('/generate', async (req, res) => {
  try {
    const { count = 1, memberValidDays, cdkValidDays = 365, templateId } = req.body;
    
    if (count < 1 || count > 50) {
      return res.status(400).json({ message: '生成数量必须在 1-50 之间' });
    }

    let finalMemberValidDays = memberValidDays;
    let finalTemplateId = templateId;

    // 如果指定了模板，从模板获取会员有效天数
    if (templateId) {
      const template = await prisma.template.findUnique({
        where: { id: parseInt(templateId) }
      });
      
      if (!template) {
        return res.status(404).json({ message: '模板不存在' });
      }
      
      finalMemberValidDays = template.validDays;
      finalTemplateId = template.id;
    } else if (memberValidDays === undefined || memberValidDays === null) {
      // 如果既没有模板也没有自定义会员天数，默认30天
      finalMemberValidDays = 30;
    }

    const cdks = [];
    for (let i = 0; i < count; i++) {
      const code = generateCDKCode();
      const cdk = await prisma.cdk.create({
        data: {
          code,
          status: 'unused',
          cdkValidDays: cdkValidDays, // CDK本身的有效期
          memberValidDays: finalMemberValidDays, // 会员有效期
          templateId: finalTemplateId || null,
          createdById: 1 // 默认管理员创建
        }
      });
      cdks.push(cdk);
    }

    res.json({ success: true, cdks });
  } catch (error: any) {
    console.error('Failed to generate CDKs:', error);
    res.status(500).json({ message: 'Failed to generate CDKs' });
  }
});

// 删除 CDK
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.cdk.delete({
      where: { id: parseInt(id) }
    });
    res.json({ success: true, message: 'CDK deleted' });
  } catch (error: any) {
    console.error('Failed to delete CDK:', error);
    res.status(500).json({ message: 'Failed to delete CDK' });
  }
});

// 获取所有用户
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    res.json(users);
  } catch (error: any) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// 更新用户状态
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive }
    });
    
    res.json(user);
  } catch (error: any) {
    console.error('Failed to update user:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

export default router;
