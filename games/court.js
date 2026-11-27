const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const VOTE_MS = 60_000;
const activeChannels = new Set();

function buildEmbed({ plaintiffId, defendantId, judgeId, reason, tally, endsAt }) {
  return new EmbedBuilder()
    .setTitle('⚖️ المحكمة انفتحت')
    .setColor(0xe67e22)
    .setDescription(`ينتهي التصويت <t:${Math.floor(endsAt / 1000)}:R>`)
    .addFields(
      { name: 'المدعي', value: `<@${plaintiffId}>`, inline: true },
      { name: 'المتهم', value: `<@${defendantId}>`, inline: true },
      { name: 'القاضي', value: `<@${judgeId}> (صوته بوزن 2)`, inline: true },
      { name: 'التهمة', value: reason.slice(0, 300) },
      { name: 'الأصوات', value: `⚖️ مذنب: ${tally.guilty} | ✅ بريء: ${tally.innocent}` },
    );
}

async function run(msg) {
  const channelId = msg.channelId;
  const plaintiffId = msg.author.id;
  const defendant = msg.mentions.users.find((u) => !u.bot && u.id !== plaintiffId);

  if (!defendant) return msg.reply('الاستخدام: `!محكمة @عضو سبب القضية`');
  if (activeChannels.has(channelId)) return msg.reply('فيه قضية شغالة بهالروم الحين.');

  const reason = msg.content.slice(6).replace(/<@!?\d+>/g, '').trim() || 'بدون سبب';

  // اختيار القاضي من الأعضاء اللي تكلموا مؤخراً (طلب واحد للـ API، سريع)
  const recent = await msg.channel.messages.fetch({ limit: 50 }).catch(() => null);
  const pool = recent
    ? [...new Set(recent.filter((m) => !m.author.bot).map((m) => m.author.id))]
        .filter((id) => id !== plaintiffId && id !== defendant.id)
    : [];
  if (pool.length === 0) return msg.reply('ما لقيت أعضاء كافيين يكونون قاضي.');

  const judgeId = pool[Math.floor(Math.random() * pool.length)];
  const votes = new Map(); // userId -> 'g' | 'i'
  const uid = Date.now().toString(36);
  const endsAt = Date.now() + VOTE_MS;

  const tally = () => {
    let guilty = 0, innocent = 0;
    for (const [id, v] of votes) {
      const w = id === judgeId ? 2 : 1;
      if (v === 'g') guilty += w; else innocent += w;
    }
    return { guilty, innocent };
  };

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`c_${uid}_g`).setLabel('مذنب').setEmoji('⚖️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`c_${uid}_i`).setLabel('بريء').setEmoji('✅').setStyle(ButtonStyle.Success),
  );

  const render = () => buildEmbed({ plaintiffId, defendantId: defendant.id, judgeId, reason, tally: tally(), endsAt });

  activeChannels.add(channelId);
  let sent;
  try {
    sent = await msg.channel.send({ embeds: [render()], components: [row] });
  } catch (e) {
    activeChannels.delete(channelId);
    throw e;
  }

  const collector = sent.createMessageComponentCollector({ time: VOTE_MS });

  collector.on('collect', async (i) => {
    if (i.user.id === defendant.id || i.user.id === plaintiffId) {
      return i.reply({ content: 'الطرفين ما يصوتون 🙂', ephemeral: true }).catch(() => {});
    }
    votes.set(i.user.id, i.customId.endsWith('_g') ? 'g' : 'i');
    i.reply({ content: 'تم تسجيل صوتك ✅', ephemeral: true }).catch(() => {});
    sent.edit({ embeds: [render()] }).catch(() => {});
  });

  collector.on('end', async () => {
    try {
      const t = tally();
      const total = t.guilty + t.innocent;
      let result;
      if (total === 0) result = '⚪ ما صوّت أحد، القضية سقطت.';
      else if (t.guilty === t.innocent) result = '⚪ تعادل، ما انطبق حكم.';
      else if (t.guilty > t.innocent) result = `⚖️ **مذنب!** <@${defendant.id}> انحكم عليه.`;
      else result = `✅ **بريء!** <@${defendant.id}> تبرّأ.`;

      await sent.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle('📜 الحكم')
            .setColor(0x2ecc71)
            .setDescription(`${result}\n\nالتهمة: ${reason}\nالأصوات: مذنب ${t.guilty} | بريء ${t.innocent}`),
        ],
        components: [],
      });
    } catch (e) {
      console.error('court end:', e.message);
    } finally {
      activeChannels.delete(channelId);
    }
  });
}

module.exports = {
  cmd: 'محكمة',
  name: 'المحكمة',
  usage: '!محكمة @عضو سبب',
  desc: 'ارفع قضية على عضو، والقاضي (عشوائي) والروم يصوتون على الحكم',
  rules: 'تكتب `!محكمة @عضو سبب القضية`. البوت يختار قاضي عشوائي من المتكلمين مؤخراً. تنفتح أزرار تصويت (مذنب / بريء) لمدة دقيقة، وصوت القاضي يحسب بوزن 2. الطرفين ما يصوتون. الأغلبية تحدد الحكم، والتعادل ما ينطبق حكم.',
  run,
};
