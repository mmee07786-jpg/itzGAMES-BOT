const {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');
const youtube = require('./youtube');

// guildId -> { connection, audioPlayer, mode, currentUrl, currentInfo, textChannel }
const sessions = new Map();

async function playUrl(guildId, url) {
  const session = sessions.get(guildId);
  if (!session) return;
  const { resource, info, title } = await youtube.createResource(url);
  session.currentUrl = url;
  session.currentInfo = info;
  session.audioPlayer.play(resource);
  return title;
}

async function handleTrackEnd(guildId) {
  const session = sessions.get(guildId);
  if (!session) return;
  try {
    if (session.mode === 'repeat') {
      await playUrl(guildId, session.currentUrl);
    } else {
      const next = youtube.pickRelated(session.currentInfo, session.currentUrl);
      if (!next) {
        session.textChannel?.send('⏹️ ما لقيت فيديو مشابه، البوت وقف التشغيل.').catch(() => {});
        return;
      }
      session.textChannel
        ?.send(`▶️ يشغل تلقائياً: **${next.title}**`)
        .catch(() => {});
      await playUrl(guildId, next.url);
    }
  } catch (e) {
    const msg = e instanceof youtube.PlaybackError ? e.message : 'صار خطأ أثناء التشغيل التالي.';
    session.textChannel?.send(`❌ ${msg}`).catch(() => {});
  }
}

async function start({ guild, voiceChannel, textChannel, url, mode, title }) {
  let session = sessions.get(guild.id);

  if (session) {
    session.connection.destroy();
    sessions.delete(guild.id);
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  const audioPlayer = createAudioPlayer();
  connection.subscribe(audioPlayer);

  session = { connection, audioPlayer, mode, textChannel, currentUrl: url };
  sessions.set(guild.id, session);

  audioPlayer.on('error', (e) => {
    console.error('Player error:', e);
    textChannel?.send('❌ صار خطأ أثناء التشغيل.').catch(() => {});
  });

  audioPlayer.on(AudioPlayerStatus.Idle, () => handleTrackEnd(guild.id));

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      connection.destroy();
      sessions.delete(guild.id);
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  } catch {
    connection.destroy();
    sessions.delete(guild.id);
    throw new youtube.PlaybackError('ما قدرت أدخل الروم الصوتي.');
  }

  const resolvedTitle = title || (await playUrl(guild.id, url));
  return resolvedTitle;
}

function stop(guildId) {
  const session = sessions.get(guildId);
  if (!session) return false;
  session.audioPlayer.stop();
  session.connection.destroy();
  sessions.delete(guildId);
  return true;
}

function getSession(guildId) {
  return sessions.get(guildId);
}

module.exports = { start, stop, getSession };
