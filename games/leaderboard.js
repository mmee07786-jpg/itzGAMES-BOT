const { EmbedBuilder } = require('discord.js');
const { top } = require('./points');

async function run(msg) {
  const rows = top(msg.guildId, 10);
  if (!rows.length) return msg.reply('ما فيه نقاط لحد الحين. العب أول لعبة!');
  const text = rows.map((r, i) => `**${i + 1}.** ${r.name}: ${r.points} نقطة`).join('\n');
  return msg.reply({
    embeds: [new EmbedBuilder().setTitle('🏆 لوحة النقاط').setDescription(text).setColor(0xf1c40f)],
  });
}

module.exports = {
  cmd: 'نقاط',
  name: 'لوحة النقاط',
  usage: '!نقاط',
  desc: 'أفضل 10 لاعبين بالسيرفر حسب النقاط',
  rules: 'يعرض أفضل 10 لاعبين بالسيرفر حسب النقاط اللي كسبوها بالألعاب.',
  run,
};
