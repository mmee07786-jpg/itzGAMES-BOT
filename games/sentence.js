const { SENTENCES } = require('./data');
const { pick, race } = require('./engine');
const { addPoint } = require('./points');

async function run(msg) {
  const q = pick(SENTENCES);
  const { winner } = await race(
    msg.channel,
    `✏️ **كمّل الجملة:**\n${q.s}\nأول واحد يكتب الكلمة الصح يكسب نقطة (${30} ثانية).`,
    q.a,
    30_000,
  );
  if (winner) {
    const p = addPoint(msg.guildId, winner);
    return msg.channel.send(`🎉 ${winner} صح! الجواب: **${q.a[0]}** | نقاطه: ${p}`);
  }
  return msg.channel.send(`⌛ انتهى الوقت. الجواب كان: **${q.a[0]}**`);
}

module.exports = {
  cmd: 'تكملة',
  name: 'تكملة الجملة',
  usage: '!تكملة',
  desc: 'اكمل الجملة الناقصة، أول واحد صح يكسب نقطة',
  rules: 'البوت يعرض جملة فيها فراغ. اكتب الكلمة الناقصة بالشات. كل عضو له محاولة وحدة بالجولة، وأول واحد يجاوب صح يكسب نقطة.',
  run,
};
