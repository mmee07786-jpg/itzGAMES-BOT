const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const prism = require('prism-media');
const { createAudioResource, StreamType } = require('@discordjs/voice');

class PlaybackError extends Error {}

function isYoutubeUrl(text) {
  try {
    return ytdl.validateURL(text);
  } catch {
    return false;
  }
}

// يحوّل رابط أو اسم أغنية إلى {url, title}
async function resolve(input) {
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

// يختار أفضل صيغة صوت أوبَس (ما تحتاج ffmpeg)
function pickOpusFormat(info) {
  const audioOnly = info.formats.filter((f) => f.hasAudio && !f.hasVideo);
  const opus = audioOnly
    .filter((f) => f.codecs && f.codecs.includes('opus') && f.container === 'webm')
    .sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
  return opus[0] || null;
}

// يبني مصدر صوت جاهز للتشغيل + معلومات الفيديو (للتكرار/الاقتراحات)
async function createResource(url) {
  const info = await ytdl.getInfo(url);
  const format = pickOpusFormat(info);
  if (!format) {
    throw new PlaybackError('هذا الفيديو ما فيه صيغة صوت مدعومة، جرّب فيديو ثاني.');
  }

  const stream = ytdl.downloadFromInfo(info, { format });
  const demuxer = new prism.opus.WebmDemuxer();
  const opusStream = stream.pipe(demuxer);

  stream.on('error', () => {}); // الأخطاء تظهر عبر حدث الـ AudioPlayer
  opusStream.on('error', () => {});

  const resource = createAudioResource(opusStream, {
    inputType: StreamType.Opus,
    metadata: { title: info.videoDetails.title, url },
  });

  return { resource, info, title: info.videoDetails.title };
}

// يرجع فيديو مقترح عشوائي من "فيديوهات مشابهة" ليوتيوب
function pickRelated(info, excludeUrl) {
  const list = (info?.related_videos || []).filter((v) => v && v.id);
  if (!list.length) return null;
  const candidates = list.slice(0, 5);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const url = `https://www.youtube.com/watch?v=${pick.id}`;
  if (url === excludeUrl && list.length > 1) {
    return pickRelated({ related_videos: list.slice(1) }, excludeUrl);
  }
  return { url, title: pick.title || 'فيديو مقترح' };
}

module.exports = { resolve, createResource, pickRelated, isYoutubeUrl, PlaybackError };
