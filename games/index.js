const { EmbedBuilder } = require('discord.js');

const list = [require('./court'), require('./rps')];
const byCmd = Object.fromEntries(list.map((g) => [g.cmd, g]));

function listEmbed() {
  return new EmbedBuilder()
    .setTitle('🎮 قائمة الألعاب')
    .setColor(0x5865f2)
    .setDescription(
      list.map((g) => `**${g.name}**\n${g.desc}\n\`${g.usage}\``).join('\n\n'),
    )
    .setFooter({ text: 'كل الألعاب تبدأ بـ ! | الأمر /games' });
}

module.exports = { list, byCmd, listEmbed };
