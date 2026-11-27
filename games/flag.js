const { EmbedBuilder } = require('discord.js');
const { FLAGS } = require('./data');
const { pick, race } = require('./engine');
const { addPoint } = require('./points');

async function run(msg) {
  const f = pick(FLAGS);
  const embed = new EmbedBuilder()
    .setTitle('🏳️ خمّن العلم')
    .setDescription('اكتب اسم الدولة بالعربي (30 ثانية). أول واحد صح يكسب نقطة.')
    .setImage(`https://flagcdn.com/w640/${f.code}.png`)
    .setColor(0x3498db);

  const { winner } = await race(msg.channel, { embeds: [embed] }, f.names, 30_000);
  if (winner) {
    const p = addPoint(msg.guildId, winner);
    return msg.channel.send(`🎉 ${winner} صح! الدولة: **${f.names[0]}** | نقاطه: ${p}`);
  }
  return msg.channel.send(`⌛ انتهى الوقت. الجواب كان: **${f.names[0]}**`);
}

module.exports = {
  cmd: 'علم',
  name: 'خمّن العلم',
  usage: '!علم',
  desc: 'يعرض علم دولة، اكتب اسمها بالعربي',
  rules: 'البوت يعرض صورة علم. اكتب اسم الدولة بالعربي بالشات، وأول واحد يصيب يكسب نقطة.',
  run,
};
