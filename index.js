const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const { TOKEN, GUILD_ID } = require('./config');

if (!TOKEN) {
  console.error('حط DISCORD_TOKEN في ملف .env');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) {
  console.error('❌ مجلد commands ناقص على المستودع. لازم يكون فيه play.js و stop.js داخل مجلد اسمه commands بجانب index.js');
  process.exit(1);
}
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

const commandData = [];
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
  commandData.push(command.data.toJSON());
}

client.once('clientReady', async () => {
  const rest = new REST().setToken(TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commandData });
    } else {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commandData });
    }
    console.log(`✅ Logged in as ${client.user.tag}, تم تسجيل ${commandData.length} أوامر`);
  } catch (e) {
    console.error('فشل تسجيل الأوامر:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (e) {
    console.error('خطأ بتنفيذ الأمر:', e);
    const payload = { content: '❌ صار خطأ غير متوقع.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(TOKEN);
