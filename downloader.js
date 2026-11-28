const { spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MAX_UPLOAD_MB, DOWNLOAD_DIR, COOKIES_FILE } = require('./config');
const { ensureYtDlp, getFfmpegPath, TMP_DIR } = require('./setup');

const ALLOWED_DOMAINS = [
  'tiktok.com',
  'pinterest.com', 'pin.it',
  'instagram.com',
  'twitter.com', 'x.com', 't.co',
  'youtube.com', 'youtu.be',
];

// لو الملف أكبر من حد الرفع ينزل بجودة أقل
const QUALITY_LADDER = [1080, 720, 480, 360, 240];

class DownloadError extends Error {}

function isSupported(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  } catch {
    return false;
  }
}

let ytdlpPromise = null;
function getYtDlp() {
  if (!ytdlpPromise) ytdlpPromise = ensureYtDlp();
  return ytdlpPromise;
}

async function runYtDlp(args, timeoutMs = 180000) {
  const bin = await getYtDlp();
  const ffmpeg = getFfmpegPath();
  if (ffmpeg) args = ['--ffmpeg-location', ffmpeg, ...args];
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, {
      windowsHide: true,
      env: { ...process.env, TMPDIR: TMP_DIR, TEMP: TMP_DIR, TMP: TMP_DIR },
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new DownloadError('انتهى وقت التحميل.'));
    }, timeoutMs);

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error('تعذر تشغيل yt-dlp: ' + e.message));
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve({ stdout, stderr });
      console.error('yt-dlp stderr:', stderr.slice(-800));
      reject(mapError(stderr));
    });
  });
}

function mapError(stderr) {
  const s = (stderr || '').toLowerCase();
  if (s.includes('login') || s.includes('cookies') || s.includes('sign in'))
    return new DownloadError('الموقع يطلب تسجيل دخول (جرّب إضافة كوكيز).');
  if (s.includes('private')) return new DownloadError('الفيديو خاص.');
  if (s.includes('no video')) return new DownloadError('الرابط ما فيه فيديو.');
  return new DownloadError('فشل التحميل، تأكد من الرابط.');
}

function baseArgs(workdir) {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--restrict-filenames',
    '--socket-timeout', '20',
    '--retries', '3',
    '-o', path.join(workdir, '%(id)s.%(ext)s'),
    '--print', '%(title)s',
    '--no-simulate',
  ];
  if (COOKIES_FILE && fsSync.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
  }
  return args;
}

async function largestFile(dir) {
  const names = await fs.readdir(dir);
  let best = null;
  for (const n of names) {
    const p = path.join(dir, n);
    const st = await fs.stat(p);
    if (st.isFile() && (!best || st.size > best.size)) best = { path: p, size: st.size };
  }
  return best;
}

async function emptyDir(dir) {
  for (const n of await fs.readdir(dir)) await fs.rm(path.join(dir, n), { force: true });
}

async function download(url, kind) {
  const limit = MAX_UPLOAD_MB * 1024 * 1024;
  const workdir = path.join(DOWNLOAD_DIR, crypto.randomUUID());
  await fs.mkdir(workdir, { recursive: true });

  try {
    if (kind === 'audio') {
      const args = [
        ...baseArgs(workdir),
        '-f', 'bestaudio/best',
        '-x', '--audio-format', 'mp3', '--audio-quality', '192K',
        url,
      ];
      const { stdout } = await runYtDlp(args);
      const file = await largestFile(workdir);
      if (!file) throw new DownloadError('ما لقيت ملف بعد التحميل.');
      if (file.size > limit)
        throw new DownloadError(`الصوت أكبر من حد الرفع (${MAX_UPLOAD_MB}MB).`);
      return { filePath: file.path, title: firstLine(stdout), workdir };
    }

    for (const h of QUALITY_LADDER) {
      await emptyDir(workdir);
      const format =
        `bv*[height<=${h}][ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/` +
        `bv*[height<=${h}]+ba/b[height<=${h}]/b`;
      const args = [...baseArgs(workdir), '-f', format, '--merge-output-format', 'mp4', url];
      const { stdout } = await runYtDlp(args);
      const file = await largestFile(workdir);
      if (!file) throw new DownloadError('ما لقيت ملف بعد التحميل.');
      if (file.size <= limit) return { filePath: file.path, title: firstLine(stdout), workdir };
    }
    throw new DownloadError(`الفيديو أكبر من حد الرفع (${MAX_UPLOAD_MB}MB) حتى بأقل جودة.`);
  } catch (err) {
    await cleanup(workdir);
    throw err;
  }
}

function firstLine(s) {
  return (s || '').split('\n')[0].trim() || 'video';
}

async function cleanup(workdir) {
  await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
}

module.exports = { isSupported, download, cleanup, DownloadError, getYtDlp };
