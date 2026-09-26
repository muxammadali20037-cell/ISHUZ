'use strict';

const path = require('path');
const fs = require('fs');

// .env faylini (bo'lsa) o'qish — qo'shimcha kutubxonasiz
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { openDb } = require('./db');
const { createApp } = require('./app');
const { createBot } = require('./bot');

const PORT = Number(process.env.PORT) || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const WEBAPP_URL = process.env.WEBAPP_URL || '';
const root = path.join(__dirname, '..');

const db = openDb(process.env.DB_PATH || path.join(root, 'data', 'ishuz.db'));
const bot = createBot({ token: BOT_TOKEN, webAppUrl: WEBAPP_URL });
const app = createApp({
  db,
  bot,
  botToken: BOT_TOKEN,
  uploadDir: process.env.UPLOAD_DIR || path.join(root, 'uploads'),
  publicDir: path.join(root, 'public'),
});

app.listen(PORT, () => {
  console.log(`Ish UZ: http://localhost:${PORT}`);
  if (!BOT_TOKEN) console.log('BOT_TOKEN berilmagan — Telegram bot o\'chiq, faqat sayt rejimi.');
  bot.start();
});
