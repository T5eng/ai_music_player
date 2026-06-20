module.exports = {
  apps: [
    {
      name: "ai-music-player",
      script: "node_modules/.bin/next",
      args: "start -p 3010",
      cwd: "/home/ubuntu/ai-music-player",
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
    },
  ],
};
