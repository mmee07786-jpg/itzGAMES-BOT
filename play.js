const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const youtube = require('../youtube');
const player = require('../player');

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('شغّل نغمة في روم صوتي');

async function execute(interaction) {
  const voiceChannels = interaction.guild.channels.cache
    .filter((c) => c.type === ChannelType.GuildVoice)
    .first(25);

  if (!voiceChannels.length) {
    return interaction.reply({ content: '❌ ما فيه رومات صوتية بهذا السيرفر.', ephemeral: true });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`play_room_${interaction.id}`)
    .setPlaceholder('اختر الروم الصوتي')
    .addOptions(voiceChannels.map((c) => ({ label: c.name, value: c.id })));

  const roomsList = voiceChannels.map((c) => `🔊 <#${c.id}>`).join('\n');

  await interaction.reply({
    content: `اختر الروم اللي تبيني أدخله:\n${roomsList}`,
    components: [new ActionRowBuilder().addComponents(menu)],
  });

  const message = await interaction.fetchReply();

  let selectInteraction;
  try {
    selectInteraction = await message.awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === interaction.user.id,
      time: 60000,
    });
  } catch {
    return interaction.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
  }

  const voiceChannel = interaction.guild.channels.cache.get(selectInteraction.values[0]);
  if (!voiceChannel) {
    return selectInteraction.update({ content: '❌ الروم مو موجود.', components: [] });
  }

  const me = interaction.guild.members.me;
  const perms = voiceChannel.permissionsFor(me);
  if (!perms?.has(PermissionsBitField.Flags.Connect) || !perms?.has(PermissionsBitField.Flags.Speak)) {
    return selectInteraction.update({
      content: `❌ ما عندي صلاحية الدخول أو التحدث في <#${voiceChannel.id}>.`,
      components: [],
    });
  }

  const modalId = `play_modal_${interaction.id}`;
  const modal = new ModalBuilder()
    .setCustomId(modalId)
    .setTitle('رابط النغمة')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('song_link')
          .setLabel('رابط يوتيوب أو اسم الأغنية')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

  await selectInteraction.showModal(modal);

  let modalSubmit;
  try {
    modalSubmit = await selectInteraction.awaitModalSubmit({
      filter: (i) => i.customId === modalId && i.user.id === interaction.user.id,
      time: 120000,
    });
  } catch {
    return interaction.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
  }

  const input = modalSubmit.fields.getTextInputValue('song_link');

  const repeatBtn = new ButtonBuilder()
    .setCustomId('mode_repeat')
    .setLabel('🔁 تكرار نفس النغمة')
    .setStyle(ButtonStyle.Primary);
  const autoBtn = new ButtonBuilder()
    .setCustomId('mode_autoplay')
    .setLabel('🔀 تلقائي (يتغير حسب يوتيوب)')
    .setStyle(ButtonStyle.Secondary);

  await modalSubmit.reply({
    content: `اختر طريقة التشغيل لـ: **${input}**`,
    components: [new ActionRowBuilder().addComponents(repeatBtn, autoBtn)],
  });

  const modeMessage = await modalSubmit.fetchReply();

  let buttonInteraction;
  try {
    buttonInteraction = await modeMessage.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 30000,
    });
  } catch {
    return modalSubmit.editReply({ content: '⏳ انتهى الوقت، جرّب `/play` مرة ثانية.', components: [] });
  }

  const mode = buttonInteraction.customId === 'mode_repeat' ? 'repeat' : 'autoplay';
  const modeLabel = mode === 'repeat' ? '🔁 تكرار' : '🔀 تلقائي';

  await buttonInteraction.update({ content: `⏳ جاري التحضير...`, components: [] });

  try {
    const song = await youtube.resolve(input);
    const title = await player.start({
      guild: interaction.guild,
      voiceChannel,
      textChannel: interaction.channel,
      url: song.url,
      mode,
      title: song.title,
    });

    await buttonInteraction.editReply({
      content: `🎶 يشغل الآن: **${title}**\nالروم: <#${voiceChannel.id}>\nالوضع: ${modeLabel}`,
    });
  } catch (e) {
    const msg = e instanceof youtube.PlaybackError ? e.message : 'صار خطأ غير متوقع.';
    if (!(e instanceof youtube.PlaybackError)) console.error(e);
    await buttonInteraction.editReply({ content: `❌ ${msg}` });
  }
}

module.exports = { data, execute };
