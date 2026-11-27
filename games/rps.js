const EMOJI = { حجرة: '🪨', ورقة: '📄', مقص: '✂️' };
const BEATS = { حجرة: 'مقص', مقص: 'ورقة', ورقة: 'حجرة' };
const OPTIONS = Object.keys(EMOJI);

function run(msg) {
  const pick = msg.content.split(/\s+/)[1];
  if (!EMOJI[pick]) return msg.reply('اختر: `!rps حجرة` أو `!rps ورقة` أو `!rps مقص`');

  const bot = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
  const res = pick === bot ? 'تعادل 🤝' : BEATS[pick] === bot ? 'فزت 🎉' : 'خسرت 😅';
  return msg.reply(`أنت: ${EMOJI[pick]} ${pick} | البوت: ${EMOJI[bot]} ${bot}\n**${res}**`);
}

module.exports = {
  cmd: 'rps',
  name: 'حجرة ورقة مقص',
  usage: '!rps حجرة',
  desc: 'تحدّ سريع ضد البوت',
  run,
};
