// PM2 process yapilandirmasi.
// Web (Next.js) ve scheduler ayri processler olarak calisir.
// Kullanim:
//   pm2 start ecosystem.config.js
//   pm2 logs / pm2 restart all / pm2 save
module.exports = {
  apps: [
    {
      name: "patlat-web",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: process.env.APP_PORT || "3000"
      }
    },
    {
      name: "patlat-scheduler",
      script: "./node_modules/.bin/tsx",
      args: "--conditions=react-server scheduler.ts",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
