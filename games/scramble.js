const { WORDS } = require('./data');
const { pick, scramble, race } = require('./engine');
const { addPoint } = require('./points');

async function run(msg) {
  const word = pick(WORDS);
  const mixed = scramble(word);
  const { winner } = await race(
    msg.channel,
    `🔀 **رتّب الحروف وقول الكلمة:** \`${mixed}\`\n(30 ثانية، أول واحد صح يكسب نقطة)`,
    [word],
    30_000,
  );
  if (winner) {
    const p = addPoint(msg.guildId, winner);
    return msg.channel.send(`🎉 ${winner} صح! الكلمة: **${word}** | نقاطه: ${p}`);
  }
  return msg.channel.send(`⌛ انتهى الوقت. الكلمة كانت: **${word}**`);
}

module.exports = {
  cmd: 'خربطة',
  name: 'الخربطة',
  usage: '!خربطة',
  desc: 'حروف عربية مخربطة، رتبها واكتب الكلمة',
  rules: 'البوت يعرض حروف الكلمة مخلوطة. اكتب الكلمة الصحيحة بالشات. كل عضو محاولة وحدة، وأول واحد يصيب يكسب نقطة.',
  run,
};
