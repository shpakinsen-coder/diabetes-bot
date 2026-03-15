const { Telegraf } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk').default;
const { buildSystemPrompt } = require('./prompt');
const storage = require('./storage');

const bot = new Telegraf(process.env.DIABETES_BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_CODE_OAUTH_TOKEN });

const ALLOWED_USER_ID = null; // null = любой пользователь, потом можно ограничить

bot.start((ctx) => {
  ctx.replyWithHTML(
    '<b>Привет, Даня!</b>\n\n' +
    'Я твой диабет-ассистент. Пиши мне:\n' +
    '[x] Показания сахара: <code>8.2</code> или <code>сахар 8.2</code>\n' +
    '[x] Что съел: <code>рис 200г, курица 150г</code>\n' +
    '[x] Подколку: <code>уколол 6 ед</code>\n' +
    '[x] Любой вопрос про диабет, питание, тренировки\n\n' +
    'Всё записываю и считаю за день.'
  );
});

bot.command('today', async (ctx) => {
  const entries = storage.getTodayEntries(ctx.from.id);
  if (entries.length === 0) {
    return ctx.replyWithHTML('За сегодня записей нет.');
  }
  let text = '<b>Записи за сегодня:</b>\n\n';
  for (const e of entries) {
    const time = new Date(e.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
    });
    text += `<code>${time}</code> ${e.type}: ${e.text}\n`;
  }
  // Подсчёт белка за день
  const totalProtein = entries
    .filter(e => e.protein_g)
    .reduce((sum, e) => sum + e.protein_g, 0);
  const totalCarbs = entries
    .filter(e => e.carbs_xe)
    .reduce((sum, e) => sum + e.carbs_xe, 0);
  const totalInsulin = entries
    .filter(e => e.units)
    .reduce((sum, e) => sum + e.units, 0);

  if (totalProtein > 0 || totalCarbs > 0 || totalInsulin > 0) {
    text += '\n<b>Итого:</b>\n';
    if (totalProtein > 0) text += `Белок: ${totalProtein}г\n`;
    if (totalCarbs > 0) text += `Углеводы: ${totalCarbs} ХЕ\n`;
    if (totalInsulin > 0) text += `Инсулин: ${totalInsulin} ед.\n`;
  }
  ctx.replyWithHTML(text);
});

bot.command('reset', (ctx) => {
  storage.saveConversation(ctx.from.id, []);
  ctx.replyWithHTML('Контекст разговора сброшен. Записи сохранены.');
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;

  if (ALLOWED_USER_ID && userId !== ALLOWED_USER_ID) {
    return ctx.reply('Этот бот только для личного использования.');
  }

  try {
    await ctx.sendChatAction('typing');

    const todayEntries = storage.getTodayEntries(userId);
    const systemPrompt = buildSystemPrompt(todayEntries);
    const conversation = storage.getConversation(userId);

    conversation.push({ role: 'user', content: userMessage });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversation.slice(-20),
    });

    const assistantText = response.content[0].text;

    // Извлекаем данные если есть
    const dataMatches = assistantText.matchAll(/<data>(.*?)<\/data>/g);
    for (const match of dataMatches) {
      try {
        const entry = JSON.parse(match[1]);
        storage.addEntry(userId, entry);
      } catch (e) {
        console.error('Failed to parse data entry:', e.message);
      }
    }

    // Убираем теги <data> из ответа пользователю
    const cleanText = assistantText.replace(/<data>.*?<\/data>\n?/g, '').trim();

    conversation.push({ role: 'assistant', content: assistantText });
    storage.saveConversation(userId, conversation);

    await ctx.replyWithHTML(cleanText);
  } catch (err) {
    console.error('Error:', err.message);
    if (err.message.includes('Could not process')) {
      await ctx.reply('Не смог обработать. Попробуй переформулировать.');
    } else {
      await ctx.reply('Ошибка: ' + err.message.slice(0, 200));
    }
  }
});

bot.catch((err) => {
  console.error('Bot error:', err.message);
});

bot.launch();
console.log('Diabetes bot started!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
