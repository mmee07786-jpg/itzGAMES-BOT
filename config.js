require('dotenv').config();

module.exports = {
  TOKEN: process.env.DISCORD_TOKEN || '',
  // اختياري: سرّع تسجيل الأوامر بقصرها على سيرفر واحد وقت التجربة
  GUILD_ID: process.env.GUILD_ID || '',
};
