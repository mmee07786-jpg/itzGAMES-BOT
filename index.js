const { Client, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const { byCmd, listEmbed, explain } = require('./games');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

process.on('unhandledRejection', (e) => console.error('unhandled:', e));

client.once('clientReady', () => {
  console.log(`شغال: ${client.user.tag}`);
  const cmd = new SlashCommandBuilder().setName('games').setDescription('قائمة الألعاب').toJSON();
  for (const guild of client.guilds.cache.values()) {
    client.application.commands.create(cmd, guild.id).catch((e) => console.error(guild.id, e.message));
  }
});

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand() || i.commandName !== 'games') return;
  await i.reply({ embeds: [listEmbed()] }).catch(() => {});
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild || !msg.content.startsWith('!')) return;

  const cmd = msg.content.slice(1).split(/\s+/)[0].toLowerCase();
  if (cmd === 'games') return msg.reply({ embeds: [listEmbed()] }).catch(() => {});

  if (cmd === 'شرح') {
    const embed = explain(msg.content.trim().split(/\s+/)[1]);
    return msg.reply(embed ? { embeds: [embed] } : 'ما لقيت هالعبة. جرّب `/games`').catch(() => {});
  }

  const game = byCmd[cmd];
  if (!game) return;

  try {
    await game.run(msg);
  } catch (e) {
    console.error(e);
    msg.reply('صار خطأ بسيط، جرب مرة ثانية.').catch(() => {});
  }
});

client.login(process.env.TOKEN);
