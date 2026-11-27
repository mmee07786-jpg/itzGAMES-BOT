const { EmbedBuilder } = require('discord.js');

const list = [require('./mafia'), require('./court'), require('./rps')];
const byCmd = Object.fromEntries(list.map((g) => [g.cmd, g]));

function listEmbed() {
  return new EmbedBuilder()
    .setTitle('🎮 قائمة الألعاب')
    .setColor(0x5865f2)
    .setDescription(
      list.map((g) => `**${g.name}**\n${g.desc}\n\`${g.usage}\``).join('\n\n'),
    )
    .setFooter({ text: 'كل الألعاب تبدأ بـ ! | اكتب !شرح اسم_اللعبة للشرح' });
}

function explain(name) {
  const g = list.find((x) => x.name === name || x.cmd === name);
  if (!g) return null;
  return new EmbedBuilder()
    .setTitle(`📖 شرح: ${g.name}`)
    .setColor(0x5865f2)
    .setDescription(g.rules || g.desc)
    .addFields({ name: 'طريقة التشغيل', value: `\`${g.usage}\`` });
}

module.exports = { list, byCmd, listEmbed, explain };
