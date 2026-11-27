const { Client, GatewayIntentBits } = require('discord.js');
const games = require('./games');

const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  if (!msg.content.startsWith(PREFIX)) return;

  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  if (cmd === 'قائمة' || cmd === 'العاب' || cmd === 'ألعاب') {
    return msg.reply({ embeds: [games.listEmbed()] }).catch(() => {});
  }

  if (cmd === 'شرح') {
    const query = args.join(' ').trim();
    if (!query) {
      return msg.reply('اكتب اسم اللعبة بعد الأمر، مثلاً: `!شرح مافيا`').catch(() => {});
    }
    const embed = games.explain(query);
    if (!embed) {
      return msg.reply('ما لقيت لعبة بهذا الاسم.').catch(() => {});
    }
    return msg.reply({ embeds: [embed] }).catch(() => {});
  }

  const game = games.byCmd[cmd];
  if (!game || typeof game.run !== 'function') return;

  try {
    await game.run(msg, args);
  } catch (err) {
    console.error(`Error running game "${cmd}":`, err);
    msg.reply('صار خطأ أثناء تشغيل اللعبة.').catch(() => {});
  }
});

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
  console.error('❌ لم يتم العثور على DISCORD_TOKEN أو TOKEN في متغيرات البيئة.');
  process.exit(1);
}

client.login(token);
