'use strict';

/**
 * Oddiy Telegram bot: /start ga Mini App tugmasi bilan javob beradi
 * va bog'lanish so'rovlari haqida xabar yuboradi.
 * BOT_TOKEN bo'lmasa — hech narsa qilmaydigan "bot" qaytaradi.
 */
function createBot({ token, webAppUrl, log = console }) {
  if (!token) {
    return { enabled: false, notify: async () => {}, start() {}, stop() {} };
  }

  const api = async (method, payload) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`${method}: ${data.description}`);
    return data.result;
  };

  const openAppMarkup = (text = 'Ish UZ ni ochish') =>
    webAppUrl ? { inline_keyboard: [[{ text, web_app: { url: webAppUrl } }]] } : undefined;

  async function notify(chatId, text, buttonText) {
    if (!chatId) return;
    try {
      await api('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: openAppMarkup(buttonText),
      });
    } catch (e) {
      log.warn('[bot] xabar yuborilmadi:', e.message);
    }
  }

  let running = false;
  let offset = 0;

  async function handle(update) {
    const msg = update.message;
    if (!msg || !msg.text) return;
    if (msg.text.startsWith('/start') || msg.text.startsWith('/help')) {
      await api('sendMessage', {
        chat_id: msg.chat.id,
        text:
          `Assalomu alaykum, ${escapeHtml(msg.from.first_name || '')}! 👋\n\n` +
          '<b>Ish UZ</b> — ish qidirayotganlarni ish bilan, ish beruvchilarni munosib xodim bilan bog\'laydi.\n\n' +
          '🔎 <b>Ish qidiryapman</b> — rezyume to\'ldiring, sizga mos vakansiyalarni ko\'ring.\n' +
          '🧑‍💼 <b>Ishchi kerak</b> — kategoriya va filtr orqali mos ishchilarni toping.\n\n' +
          'Boshlash uchun pastdagi tugmani bosing 👇',
        parse_mode: 'HTML',
        reply_markup: openAppMarkup(),
      });
    }
  }

  async function loop() {
    while (running) {
      try {
        const updates = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
        for (const u of updates) {
          offset = u.update_id + 1;
          await handle(u).catch((e) => log.warn('[bot]', e.message));
        }
      } catch (e) {
        log.warn('[bot] polling xatosi:', e.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  return {
    enabled: true,
    notify,
    async start() {
      running = true;
      if (webAppUrl) {
        await api('setChatMenuButton', {
          menu_button: { type: 'web_app', text: 'Ish UZ', web_app: { url: webAppUrl } },
        }).catch((e) => log.warn('[bot] menu tugmasi:', e.message));
      }
      loop();
      log.info('[bot] ishga tushdi');
    },
    stop() {
      running = false;
    },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

module.exports = { createBot, escapeHtml };
