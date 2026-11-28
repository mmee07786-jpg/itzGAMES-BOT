// يحمّل yt-dlp تلقائياً (للاستضافات اللي ما تسمح بتنصيب برامج)
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const TMP_DIR = path.join(BIN_DIR, 'tmp'); // مجلد مؤقت خاص بالبوت
const REFRESH_MS = 12 * 60 * 60 * 1000; // تحديث كل 12 ساعة

function hasPython() {
  try {
    return spawnSync('python3', ['--version']).status === 0;
  } catch {
    return false;
  }
}

// نسخة بايثون (zipapp) ما تحتاج فك ضغط، وهي الأفضل لو بايثون موجود.
// غيرها نستخدم النسخة المستقلة.
function pick() {
  const p = process.platform;
  const a = os.arch();
  if (p === 'win32') return { asset: 'yt-dlp.exe', file: 'yt-dlp-bin.exe' };
  if (p === 'darwin') return { asset: 'yt-dlp_macos', file: 'yt-dlp-bin' };
  if (hasPython()) return { asset: 'yt-dlp', file: 'yt-dlp-py' };
  return {
    asset: a === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux',
    file: 'yt-dlp-bin',
  };
}

async function downloadBinary(asset, dest) {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
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

  fs.mkdirSync(TMP_DIR, { recursive: true });
  // نظّف مخلفات فك الضغط القديمة
  for (const n of fs.readdirSync(TMP_DIR)) {
    fs.rmSync(path.join(TMP_DIR, n), { recursive: true, force: true });
  }
  // احذف النسخة القديمة اللي كانت تسبب المشكلة
  fs.rmSync(path.join(BIN_DIR, 'yt-dlp'), { force: true });

  const { asset, file } = pick();
  const dest = path.join(BIN_DIR, file);
  const exists = fs.existsSync(dest);
  const stale = exists && Date.now() - fs.statSync(dest).mtimeMs > REFRESH_MS;

  if (!exists || stale) {
    try {
      console.log(`⬇️  تحميل/تحديث yt-dlp (${asset}) ...`);
      await downloadBinary(asset, dest);
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

module.exports = { ensureYtDlp, getFfmpegPath, TMP_DIR };
