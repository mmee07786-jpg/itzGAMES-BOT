const { SlashCommandBuilder } = require('discord.js');
const player = require('../player');

const data = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('يوقف التشغيل ويطلع البوت من الروم الصوتي');

async function execute(interaction) {
  const stopped = player.stop(interaction.guild.id);
  await interaction.reply({
    content: stopped ? '⏹️ وقفت التشغيل وطلعت من الروم.' : 'ما فيه تشغيل شغّال حالياً.',
    ephemeral: !stopped,
  });
}

module.exports = { data, execute };
