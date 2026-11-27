const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
const games = require('./games');

const PREFIX = '!';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const slashCommands = [
  new SlashCommandBuilder()
    .setName('games')
    .setDescription('يعرض طريقة فتح قائمة الألعاب'),
].map((cmd) => cmd.toJSON());

async function registerSlashCommands(appId) {
  const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
  if (!token || !appId) return;

  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationCommands(appId), { body: slashCommands });
  console.log('✅ تم تسجيل أمر /games بنجاح');
}

client.once('ready', async () => {
  console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
  try {
    await registerSlashCommands(client.application.id);
  } catch (err) {
    console.error('❌ فشل تسجيل أمر /games:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'games') {
    await interaction.reply({
      content: 'اكتب الامر\n!قائمة',
      flags: MessageFlags.Ephemeral,
    }).catch(() => {});
  }
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
