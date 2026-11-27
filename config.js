require('dotenv').config();

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN || '',
  // حد رفع ديسكورد (10 / 50 / 100 حسب بوست السيرفر)
  MAX_UPLOAD_MB: parseInt(process.env.MAX_UPLOAD_MB || '10', 10),
  DOWNLOAD_DIR: process.env.DOWNLOAD_DIR || 'downloads',
  // اختياري: ملف كوكيز بصيغة Netscape لإنستغرام/يوتيوب
  COOKIES_FILE: process.env.COOKIES_FILE || '',
  MAX_CONCURRENT: parseInt(process.env.MAX_CONCURRENT || '2', 10),
  YTDLP_PATH: process.env.YTDLP_PATH || 'yt-dlp',
};
