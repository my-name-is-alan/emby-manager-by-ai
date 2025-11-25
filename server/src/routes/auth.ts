import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import embyApi from '../utils/embyApi';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // 1. Try to authenticate with Emby directly first (to verify password)
    // Emby's authenticate by name endpoint: /Users/AuthenticateByName
    try {
      const embyAuthResponse = await embyApi.post('/Users/AuthenticateByName', {
        Username: username,
        Pw: password,
      });
      
      const embyUser = embyAuthResponse.data.User;
      const embyAccessToken = embyAuthResponse.data.AccessToken;

      // 2. Check if user exists in local DB, if not, create/sync it (optional, or just rely on Emby)
      // For this system, we want to track users locally too (for CDK history etc).
      let user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        // If user exists in Emby but not locally (e.g. the admin 'lvzy'), create local record
        // Note: We don't have the raw password to hash and store locally if we just authenticated via Emby.
        // So for Emby-native users, we might just trust Emby auth.
        // However, for our system's "CDK created users", we usually create them locally first.
        
        // Let's create a local record for this Emby user if missing
        user = await prisma.user.create({
          data: {
            username: embyUser.Name,
            password: '', // We don't know the password hash, leave empty or handle differently
            embyId: embyUser.Id,
            embyAccessToken, // Store the access token
            role: username === 'lvzy' ? 'admin' : 'user', // Hardcode admin for now based on prompt
          }
        });
      } else {
          // 检查用户是否已过期
          if (user.expiryDate && new Date(user.expiryDate) < new Date()) {
            return res.status(403).json({ 
              message: '您的账号已过期，请联系管理员续费或使用新的CDK激活',
              expired: true,
              expiryDate: user.expiryDate
            });
          }

          // 检查用户是否被禁用
          if (!user.isActive) {
            return res.status(403).json({ 
              message: '您的账号已被禁用，请联系管理员或使用新的CDK激活',
              disabled: true
            });
          }

          // Update Emby ID and access token
          user = await prisma.user.update({
              where: { id: user.id },
              data: { 
                embyId: embyUser.Id,
                embyAccessToken // Update the access token on each login
              }
          });
      }

      // 3. Generate Local JWT
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role, embyAccessToken }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          embyId: embyUser.Id,
          isActive: user.isActive,
          createdAt: user.createdAt,
          expiryDate: user.expiryDate,
          avatar: embyUser.PrimaryImageTag ? `${process.env.EMBY_SERVER_URL}/Items/${embyUser.Id}/Images/Primary?tag=${embyUser.PrimaryImageTag}` : null
        }
      });

    } catch (embyError: any) {
      console.error('Emby Auth Failed:', embyError.response?.data || embyError.message);
      
      // Check for specific Emby error messages if possible, or just pass through if it's a known structure
      // Emby often returns plain text or simple JSON for errors.
      // If it's a 401, it's usually auth failure.
      // If the user is locked out, Emby might return a specific message.
      
      if (embyError.response?.status === 401) {
         return res.status(401).json({ message: '用户名或密码错误' });
      }
      
      // For other errors (like account locked), try to pass the message or a generic one
      // Emby might return "User is disabled" or similar.
      let errorMessage = typeof embyError.response?.data === 'string' 
          ? embyError.response.data 
          : '登录失败，请检查 Emby 服务状态';

      // Translate common Emby errors
      if (errorMessage.includes('Your account is currently locked')) {
          errorMessage = '您的账户被暂时锁定，请稍后再试。';
      } else if (errorMessage.includes('User is disabled')) {
          errorMessage = '该账户已被禁用。';
      }
          
      return res.status(embyError.response?.status || 500).json({ message: errorMessage });
    }

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '服务器内部错误' });
  }
});

// Register (Activate CDK)
router.post('/register', async (req, res) => {
    const { username, password, cdk: cdkCode } = req.body;

    if (!username || !password || !cdkCode) {
        return res.status(400).json({ message: '缺少必填字段' });
    }

    try {
        // 1. Validate CDK
        const cdk = await prisma.cdk.findUnique({ 
            where: { code: cdkCode },
            include: { template: true }
        });
        
        if (!cdk) {
            return res.status(400).json({ message: 'CDK不存在' });
        }
        
        if (cdk.status !== 'unused') {
            return res.status(400).json({ message: 'CDK已被使用或已过期' });
        }

        // Check if CDK is expired (based on cdkValidDays)
        const cdkCreatedDate = new Date(cdk.createdAt);
        const cdkExpiryDate = new Date(cdkCreatedDate.getTime() + cdk.cdkValidDays * 24 * 60 * 60 * 1000);
        if (new Date() > cdkExpiryDate) {
            await prisma.cdk.update({
                where: { id: cdk.id },
                data: { status: 'expired' }
            });
            return res.status(400).json({ message: 'CDK已过期' });
        }

        // 2. Check if user already exists locally
        const existingUser = await prisma.user.findUnique({ where: { username } });
        
        // 如果用户已存在,进行续费逻辑
        if (existingUser) {
            // 验证密码
            const isPasswordValid = await bcrypt.compare(password, existingUser.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: '密码错误,无法续费' });
            }

            // 计算新的过期时间
            let newExpiryDate: Date | null = null;
            
            if (cdk.memberValidDays > 0) {
                // 如果当前用户有过期时间且未过期,在原过期时间基础上续期
                if (existingUser.expiryDate && new Date(existingUser.expiryDate) > new Date()) {
                    newExpiryDate = new Date(existingUser.expiryDate);
                } else {
                    // 如果已过期或没有过期时间,从当前时间开始计算
                    newExpiryDate = new Date();
                }
                newExpiryDate.setDate(newExpiryDate.getDate() + cdk.memberValidDays);
            }
            // 如果 memberValidDays 是 0,设为永久会员 (null)

            // 更新用户信息
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    expiryDate: newExpiryDate,
                    isActive: true, // 重新激活
                    usedCdk: { connect: { id: cdk.id } }
                }
            });

            // 如果用户之前被禁用,需要在 Emby 中重新启用
            if (!existingUser.isActive && existingUser.embyId) {
                try {
                    const currentPolicy = await embyApi.get(`/Users/${existingUser.embyId}`);
                    await embyApi.post(`/Users/${existingUser.embyId}/Policy`, {
                        ...currentPolicy.data.Policy,
                        IsDisabled: false
                    });
                } catch (embyError: any) {
                    console.error('Failed to re-enable Emby user:', embyError.response?.data || embyError.message);
                }
            }

            // 更新 CDK 状态
            await prisma.cdk.update({
                where: { id: cdk.id },
                data: {
                    status: 'used',
                    usedById: updatedUser.id,
                    usedAt: new Date()
                }
            });

            // 生成 JWT token
            const token = jwt.sign(
                { userId: updatedUser.id, username: updatedUser.username, role: updatedUser.role },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            return res.json({
                message: '续费成功',
                token,
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    role: updatedUser.role,
                    expiryDate: newExpiryDate
                },
                isRenewal: true
            });
        }

        // 3. Calculate user expiry date based on memberValidDays (新用户)
        let expiryDate: Date | null = null;
        if (cdk.memberValidDays > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + cdk.memberValidDays);
        }
        // If memberValidDays is 0, expiryDate stays null (永久)

        // 4. Create User in Emby
        let embyId: string;
        let embyAccessToken: string;
        
        try {
            // Get template policy and configuration if exists
            let policy = cdk.template ? JSON.parse(cdk.template.policy) : undefined;
            let configuration = cdk.template ? JSON.parse(cdk.template.configuration) : undefined;

            // Create user in Emby
            const embyCreateResponse = await embyApi.post('/Users/New', {
                Name: username
            });
            embyId = embyCreateResponse.data.Id;

            // Set Password for the new Emby user
            await embyApi.post(`/Users/${embyId}/Password`, {
                CurrentPw: '', // New user has no password
                NewPw: password
            });

            // Apply Policy if template exists
            if (policy) {
                await embyApi.post(`/Users/${embyId}/Policy`, policy);
            }

            // Apply Configuration if template exists
            if (configuration) {
                await embyApi.post(`/Users/${embyId}/Configuration`, configuration);
            }

            // Authenticate to get access token
            const authResponse = await embyApi.post('/Users/AuthenticateByName', {
                Username: username,
                Pw: password
            });
            embyAccessToken = authResponse.data.AccessToken;

        } catch (embyError: any) {
            console.error('Emby User Creation Failed:', embyError.response?.data || embyError.message);
            return res.status(500).json({ message: '创建Emby账号失败: ' + (embyError.response?.data?.Message || embyError.message) });
        }

        // 5. Create User Locally
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                embyId,
                embyAccessToken,
                role: 'user',
                expiryDate,
                usedCdk: { connect: { id: cdk.id } }
            }
        });

        // 6. Update CDK status
        await prisma.cdk.update({
            where: { id: cdk.id },
            data: {
                status: 'used',
                usedById: newUser.id,
                usedAt: new Date()
            }
        });

        res.json({ 
            message: '账号激活成功',
            expiryDate: expiryDate ? expiryDate.toISOString() : null,
            memberValidDays: cdk.memberValidDays
        });

    } catch (error: any) {
        console.error('Register error:', error);
        res.status(500).json({ message: '服务器内部错误' });
    }
});

export default router;
