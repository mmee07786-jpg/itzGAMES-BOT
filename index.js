require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const prism = require('prism-media');

const TOKEN = process.env.DISCORD_TOKEN || '';
const GUILD_ID = process.env.GUILD_ID || '';

if (!TOKEN) {
  console.error('❌ حط DISCORD_TOKEN في متغيرات البيئة');
  process.exit(1);
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

// ================= YouTube =================

class PlaybackError extends Error {}

function isYoutubeUrl(text) {
  try {
    return ytdl.validateURL(text);
  } catch {
    return false;
  }
}

// يحوّل رابط أو اسم أغنية إلى رابط يوتيوب
async function resolveSong(input) {
  const text = input.trim();
  if (isYoutubeUrl(text)) {
    const info = await ytdl.getBasicInfo(text);
    return { url: text, title: info.videoDetails.title };
  }
  const result = await ytSearch(text);
  const video = result?.videos?.[0];
  if (!video) throw new PlaybackError('ما لقيت نتيجة بهذا الاسم على يوتيوب.');
  return { url: video.url, title: video.title };
}

// يختار صيغة صوت Opus (ما تحتاج ffmpeg)
function pickOpusFormat(info) {
  const list = info.formats
    .filter((f) => f.hasAudio && !f.hasVideo && f.codecs?.includes('opus') && f.container === 'webm')
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
  return list[0] || null;
}

async function createResource(url) {
  const info = await ytdl.getInfo(url);
  const format = pickOpusFormat(info);
  if (!format) throw new PlaybackError('هذا الفيديو ما فيه صيغة صوت مدعومة، جرّب فيديو ثاني.');

  const stream = ytdl.downloadFromInfo(info, { format });
  const opusStream = stream.pipe(new prism.opus.WebmDemuxer());
  stream.on('error', () => {});
  opusStream.on('error', () => {});

  const resource = createAudioResource(opusStream, { inputType: StreamType.Opus });
  return { resource, info, title: info.videoDetails.title };
}

// فيديو مقترح من "الفيديوهات المشابهة" (يتجنب تكرار نفس الفيديو)
function pickRelated(info, currentUrl) {
  const all = (info?.related_videos || []).filter((v) => v?.id).slice(0, 6);
  if (!all.length) return null;
  const fresh = all.filter((v) => `https://www.youtube.com/watch?v=${v.id}` !== currentUrl);
  const list = fresh.length ? fresh : all;
  const v = list[Math.floor(Math.random() * list.length)];
  return { url: `https://www.youtube.com/watch?v=${v.id}`, title: v.title || 'فيديو مقترح' };
}

// ================= Player =================

// guildId -> session
const sessions = new Map();

function endSession(session) {
  if (sessions.get(session.guildId) === session) sessions.delete(session.guildId);
  session.audioPlayer.stop(true);
  session.connection.destroy();
}

async function playUrl(session, url) {
  const { resource, info, title } = await createResource(url);
  session.currentUrl = url;
  session.currentInfo = info;
  session.audioPlayer.play(resource);
  return title;
}

async function onTrackEnd(session) {
  // لو الجلسة انتهت أو استبدلت، لا تسوي شي
  if (sessions.get(session.guildId) !== session) return;
  try {
    if (session.mode === 'repeat') {
      await playUrl(session, session.currentUrl);
      return;
    }
    const next = pickRelated(session.currentInfo, session.currentUrl);
    if (!next) {
      session.textChannel?.send('⏹️ ما لقيت فيديو مشابه، وقف التشغيل.').catch(() => {});
      return;
    }
    session.textChannel?.send(`▶️ يشغل تلقائياً: **${next.title}**`).catch(() => {});
    await playUrl(session, next.url);
  } catch (e) {
    const msg = e instanceof PlaybackError ? e.message : 'صار خطأ أثناء التشغيل التالي.';
    if (!(e instanceof PlaybackError)) console.error(e);
    session.textChannel?.send(`❌ ${msg}`).catch(() => {});
  }
}

async function startPlayback({ guild, voiceChannel, textChannel, url, mode }) {
  const old = sessions.get(guild.id);
  if (old) endSession(old);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  const audioPlayer = createAudioPlayer();
  connection.subscribe(audioPlayer);

  const session = {
    guildId: guild.id,
    connection,
    audioPlayer,
    mode,
    textChannel,
    currentUrl: url,
    currentInfo: null,
  };
  sessions.set(guild.id, session);

  audioPlayer.on('error', (e) => {
    console.error('Player error:', e);
    session.textChannel?.send('❌ صار خطأ أثناء التشغيل.').catch(() => {});
  });
  audioPlayer.on(AudioPlayerStatus.Idle, () => onTrackEnd(session));

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      endSession(session);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  } catch {
    endSession(session);
    throw new PlaybackError('ما قدرت أدخل الروم الصوتي.');
  }

  try {
    return await playUrl(session, url);
  } catch (e) {
    endSession(session);
    throw e;
  }
}

// ================= Commands =================

const playCommand = {
  data: new SlashCommandBuilder().setName('play').setDescription('شغّل نغمة في روم صوتي'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ هذا الأمر يشتغل داخل السيرفرات بس.', ephemeral: true });
    }
    const guild = interaction.guild;

    const voiceChannels = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildVoice)
      .first(25);
    if (!voiceChannels.length) {
      return interaction.reply({ content: '❌ ما فيه رومات صوتية بهذا السيرفر.', ephemeral: true });
    }

    // 1) اختيار الروم
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`play_room_${interaction.id}`)
      .setPlaceholder('اختر الروم الصوتي')
      .addOptions(voiceChannels.map((c) => ({ label: c.name.slice(0, 100), value: c.id })));

    await interaction.reply({
      content: `اختر الروم اللي تبيني أدخله:\n${voiceChannels.map((c) => `🔊 <#${c.id}>`).join('\n')}`,
      components: [new ActionRowBuilder().addComponents(menu)],
    });
    const message = await interaction.fetchReply();

    let roomPick;
    try {
      roomPick = await message.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
      });
    } catch {
      return interaction.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
    }

    const voiceChannel = guild.channels.cache.get(roomPick.values[0]);
    if (!voiceChannel) {
      return roomPick.update({ content: '❌ الروم مو موجود.', components: [] });
    }

    const me = guild.members.me ?? (await guild.members.fetchMe());
    const perms = voiceChannel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.Connect) || !perms?.has(PermissionsBitField.Flags.Speak)) {
      return roomPick.update({
        content: `❌ ما عندي صلاحية الدخول أو التحدث في <#${voiceChannel.id}>.`,
        components: [],
      });
    }

    // 2) إدخال الرابط أو اسم الأغنية
    const modalId = `play_modal_${interaction.id}`;
    await roomPick.showModal(
      new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('رابط النغمة')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('song_link')
              .setLabel('رابط يوتيوب أو اسم الأغنية')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        )
    );

    let modalSubmit;
    try {
      modalSubmit = await roomPick.awaitModalSubmit({
        filter: (i) => i.customId === modalId && i.user.id === interaction.user.id,
        time: 120000,
      });
    } catch {
      return interaction.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
    }

    const song = modalSubmit.fields.getTextInputValue('song_link');

    // 3) اختيار الوضع: تكرار أو تلقائي
    await modalSubmit.reply({
      content: `اختر طريقة التشغيل لـ: **${song.slice(0, 200)}**`,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('mode_repeat')
            .setLabel('🔁 تكرار نفس النغمة')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('mode_autoplay')
            .setLabel('🔀 تلقائي (يتغير حسب يوتيوب)')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
    const modeMessage = await modalSubmit.fetchReply();

    let modePick;
    try {
      modePick = await modeMessage.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
      });
    } catch {
      return modalSubmit.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
    }

    const mode = modePick.customId === 'mode_repeat' ? 'repeat' : 'autoplay';
    const modeLabel = mode === 'repeat' ? '🔁 تكرار' : '🔀 تلقائي';

    await modePick.update({ content: '⏳ جاري التحضير...', components: [] });

    // 4) التشغيل
    try {
      const resolved = await resolveSong(song);
      const title = await startPlayback({
        guild,
        voiceChannel,
        textChannel: interaction.channel,
        url: resolved.url,
        mode,
      });
      await modePick.editReply({
        content: `🎶 يشغل الآن: **${title}**\nالروم: <#${voiceChannel.id}>\nالوضع: ${modeLabel}`,
      });
    } catch (e) {
      const isKnown = e instanceof PlaybackError;
      if (!isKnown) console.error(e);
      await modePick
        .editReply({ content: `❌ ${isKnown ? e.message : 'صار خطأ غير متوقع.'}` })
        .catch(() => {});
    }
  },
};

const stopCommand = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('يوقف التشغيل ويطلع البوت من الروم الصوتي'),

  async execute(interaction) {
    const session = sessions.get(interaction.guildId);
    if (!session) {
      return interaction.reply({ content: 'ما فيه تشغيل شغّال حالياً.', ephemeral: true });
    }
    endSession(session);
    return interaction.reply({ content: '⏹️ وقفت التشغيل وطلعت من الروم.' });
  },
};

const commands = new Map([playCommand, stopCommand].map((c) => [c.data.name, c]));

// ================= Client =================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('clientReady', async () => {
  const body = [...commands.values()].map((c) => c.data.toJSON());
  const rest = new REST().setToken(TOKEN);
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(client.user.id, GUILD_ID)
      : Routes.applicationCommands(client.user.id);
    await rest.put(route, { body });
    console.log(`✅ Logged in as ${client.user.tag}، تم تسجيل ${body.length} أوامر`);
  } catch (e) {
    console.error('فشل تسجيل الأوامر:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = commands.get(interaction.commandName);
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
