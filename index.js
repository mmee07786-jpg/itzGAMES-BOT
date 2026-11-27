const fs = require('fs');
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { TOKEN, DOWNLOAD_DIR, MAX_CONCURRENT } = require('./config');
const downloader = require('./downloader');

if (!TOKEN) {
  console.error('حط DISCORD_TOKEN في ملف .env');
  process.exit(1);
}

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// طابور بسيط لتحديد عدد التحميلات المتزامنة
let active = 0;
const queue = [];
async function acquire() {
  if (active < MAX_CONCURRENT) { active++; return; }
  await new Promise((r) => queue.push(r));
  active++;
}
function release() {
  active--;
  const next = queue.shift();
  if (next) next();
}

// كولداون 15 ثانية لكل مستخدم
const COOLDOWN_MS = 15000;
const cooldowns = new Map();

const command = new SlashCommandBuilder()
  .setName('download')
  .setDescription('تحميل فيديو أو صوت من تيك توك / إنستغرام / تويتر / بنترست / يوتيوب')
  .addStringOption((o) =>
    o.setName('url').setDescription('رابط الفيديو').setRequired(true))
  .addStringOption((o) =>
    o.setName('type').setDescription('نوع التحميل').setRequired(false)
      .addChoices(
        { name: '🎬 فيديو', value: 'video' },
        { name: '🎵 صوت (MP3)', value: 'audio' },
      ));

client.once('clientReady', async () => {
  await client.application.commands.set([command.toJSON()]);
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'download') return;

  const url = interaction.options.getString('url', true).trim();
  const kind = interaction.options.getString('type') || 'video';

  const last = cooldowns.get(interaction.user.id) || 0;
  const wait = COOLDOWN_MS - (Date.now() - last);
  if (wait > 0) {
    return interaction.reply({
      content: `⏳ انتظر ${Math.ceil(wait / 1000)} ثانية.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!downloader.isSupported(url)) {
    return interaction.reply({
      content: '❌ الرابط غير مدعوم. المدعوم: تيك توك، إنستغرام، تويتر/X، بنترست، يوتيوب.',
      flags: MessageFlags.Ephemeral,
    });
  }

  cooldowns.set(interaction.user.id, Date.now());
  await interaction.deferReply();

  let workdir = null;
  await acquire();
  try {
    const result = await downloader.download(url, kind);
    workdir = result.workdir;
    await interaction.editReply({
      content: `✅ **${result.title.slice(0, 150)}**`,
      files: [new AttachmentBuilder(result.filePath)],
    });
  } catch (err) {
    let msg = '❌ صار خطأ غير متوقع.';
    if (err instanceof downloader.DownloadError) msg = `❌ ${err.message}`;
    else if (err.code === 40005 || err.status === 413) msg = '❌ الملف كبير على ديسكورد.';
    else console.error(err);
    await interaction.editReply({ content: msg }).catch(() => {});
  } finally {
    release();
    if (workdir) await downloader.cleanup(workdir);
  }
});

downloader.getYtDlp()
  .then(() => client.login(TOKEN))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
