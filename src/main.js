import { Telegraf, session } from "telegraf";
import { message } from 'telegraf/filters';
import { code } from 'telegraf/format';
import config from 'config';
import { ogg } from './ogg.js';
import { openai } from "./openai.js";
import { isUserHasAccess } from "./utils.js";

console.log(config.get("TEST_ENV"));

const users = [
    492402006,
    1454495143
];

const INITIAL_SESSION = {
    messages: [],
};

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));

bot.use(session());

bot.command('help', async (ctx) => {
    await ctx.reply(`
/new - Начать новую сессию(весь контекст предыдущих сообщений теряется).

Бот понимает как голосовые, так и текстовые сообщения.
    `)
})

bot.command('new', async (ctx) => {
    if (isUserHasAccess(users, ctx.from.id)) {
        ctx.session = JSON.parse(JSON.stringify(INITIAL_SESSION));
        await ctx.reply('Новая сессия. Отправьте голосовое или текстовое сообщение.')
    } else {
        await ctx.reply(code('Обратитесь к администратору, чтобы получить доступ. \nUserID: ', ctx.from.id));
    }
});

bot.command('start', async (ctx) => {
    if (isUserHasAccess(users, ctx.from.id)) {
        ctx.session = JSON.parse(JSON.stringify(INITIAL_SESSION));
        await ctx.reply('Новая сессия. Отправьте голосовое или текстовое сообщение.\n\nДля доп. информации введите /help');
    } else {
        await ctx.reply(code('Обратитесь к администратору, чтобы получить доступ. \nUserID: ', ctx.from.id));
    }
});

bot.on(message('sticker'), async ctx => {
    if (isUserHasAccess(users, ctx.from.id)) {
        await ctx.reply('Добро пожаловать, снова');
    } else {
        await ctx.reply(code('Обратитесь к администратору, чтобы получить доступ. \nUserID: ', ctx.from.id));
    }
});

bot.on(message('voice'), async ctx => {
    if (isUserHasAccess(users, ctx.from.id)) {
        ctx.session ??= JSON.parse(JSON.stringify(INITIAL_SESSION));
        
        try {
            await ctx.reply(code('Сообщение получил. Ожидание ответа...'));
            const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
            const userId = String(ctx.message.from.id);
            const oggPath = await ogg.create(link.href, userId);
            const mp3Path = await ogg.toMp3(oggPath, userId);

            const text = await openai.transcription(mp3Path);
            await ctx.reply(code('Ваш запрос: ', text));

            ctx.session.messages.push({ role: openai.roles.USER, content: text });
            const response = await openai.chat(ctx.session.messages);
            ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

            await ctx.reply(response.content);
        } catch (e) {
            console.log('Error while voice message: ', e.message);
        }
    } else {
        await ctx.reply(code('Обратитесь к администратору, чтобы получить доступ. \nUserID: ', ctx.from.id));
    }
});

bot.on(message('text'), async ctx => {
    if (isUserHasAccess(users, ctx.from.id)) {
        ctx.session ??= JSON.parse(JSON.stringify(INITIAL_SESSION));

        try {
            await ctx.reply(code('Сообщение получил. Ожидание ответа...'));

            ctx.session.messages.push({ role: openai.roles.USER, content: ctx.message.text });
            const response = await openai.chat(ctx.session.messages);
            ctx.session.messages.push({ role: openai.roles.ASSISTANT, content: response.content });

            await ctx.reply(response.content);
        } catch (e) {
            console.log('Error while voice message: ', e.message);
        }
    } else {
        await ctx.reply(code('Обратитесь к администратору, чтобы получить доступ. \nUserID: ', ctx.from.id));
    }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));