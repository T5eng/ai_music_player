# AI Music Player

AI 驱动的个性化音乐电台。根据用户行为和偏好，动态生成下一首歌曲。

## 访问地址

- **推荐（IP 直连）**：http://119.45.180.7/ai-music
- **域名（需完成备案后）**：http://mirac.site/ai-music

独立入口 `/ai-music`，不影响现有 pixelforge (`/`) 和 t-trading 服务。

## 功能

- Web 音乐播放器（播放 / 暂停 / 跳过 / 点赞 / 不喜欢）
- 根据用户行为动态推荐并生成下一首
- 偏好滑杆实时影响生成方向（能量、怀旧、人声、电子）
- Mureka API 集成（配置 API Key 后启用真实 AI 生成）
- 无 API Key 时自动进入演示模式（预置曲目 + 模拟生成流程）
- SSE 实时推送生成进度

## 技术栈

- Next.js 15 (App Router, standalone)
- SQLite (better-sqlite3)
- Tailwind CSS
- PM2 + Nginx 反向代理

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
# 访问 http://localhost:3010/ai-music
```

## 配置 Mureka API

在服务器 `/home/ubuntu/ai-music-player/.env` 中添加：

```
MUREKA_API_KEY=your_key_here
```

然后 `pm2 restart ai-music-player`

## 部署

```bash
export DEPLOY_PASSWORD=your_password
bash deploy/deploy.sh
```

服务运行在端口 **3010**，通过 Nginx 代理到 `/ai-music` 路径。
