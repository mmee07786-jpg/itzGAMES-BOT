const EMOJI = { حجرة: '🪨', ورقة: '📄', مقص: '✂️' };
const BEATS = { حجرة: 'مقص', مقص: 'ورقة', ورقة: 'حجرة' };
const OPTIONS = Object.keys(EMOJI);

function run(msg) {
  const pick = msg.content.split(/\s+/)[1];
  if (!EMOJI[pick]) return msg.reply('اختر: `!حجرة حجرة` أو `!حجرة ورقة` أو `!حجرة مقص`');

  const bot = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
  const res = pick === bot ? 'تعادل 🤝' : BEATS[pick] === bot ? 'فزت 🎉' : 'خسرت 😅';
  return msg.reply(`أنت: ${EMOJI[pick]} ${pick} | البوت: ${EMOJI[bot]} ${bot}\n**${res}**`);
}

module.exports = {
  cmd: 'حجرة',
  name: 'حجرة ورقة مقص',
  usage: '!حجرة ورقة',
  desc: 'تحدّ سريع ضد البوت',
  rules: 'تكتب `!حجرة` متبوعة باختيارك: حجرة أو ورقة أو مقص. البوت يختار عشوائياً ويقارن. الحجرة تغلب المقص، والمقص يغلب الورقة، والورقة تغلب الحجرة.',
  run,
};
