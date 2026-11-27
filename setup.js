// يحمّل yt-dlp تلقائياً (للاستضافات اللي ما تسمح بتنصيب برامج)
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN_DIR = path.join(__dirname, 'bin');
const REFRESH_MS = 12 * 60 * 60 * 1000; // تحديث كل 12 ساعة

function assetName() {
  const p = process.platform;
  const a = os.arch();
  if (p === 'win32') return 'yt-dlp.exe';
  if (p === 'darwin') return 'yt-dlp_macos';
  if (p === 'linux') return a === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  return 'yt-dlp';
}

async function downloadBinary(dest) {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName()}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = dest + '.tmp';
  fs.writeFileSync(tmp, buf);
  fs.chmodSync(tmp, 0o755);
  fs.renameSync(tmp, dest);
}

async function ensureYtDlp() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;

  fs.mkdirSync(BIN_DIR, { recursive: true });
  const dest = path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  const exists = fs.existsSync(dest);
  const stale = exists && Date.now() - fs.statSync(dest).mtimeMs > REFRESH_MS;

  if (!exists || stale) {
    try {
      console.log('⬇️  تحميل/تحديث yt-dlp ...');
      await downloadBinary(dest);
      console.log('✅ yt-dlp جاهز');
    } catch (e) {
      if (!exists) throw new Error('فشل تحميل yt-dlp: ' + e.message);
      console.warn('⚠️ فشل التحديث، يستخدم النسخة القديمة:', e.message);
    }
  }
  return dest;
}

function getFfmpegPath() {
  try {
    return require('ffmpeg-static') || null;
  } catch {
    return null;
  }
}

module.exports = { ensureYtDlp, getFfmpegPath };
