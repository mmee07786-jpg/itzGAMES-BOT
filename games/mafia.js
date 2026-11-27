const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const JOIN_MS = 60_000;
const NIGHT_MS = 30_000;
const DAY_MS = 40_000;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 25;
const running = new Set();

const ROLE_NAME = { mafia: '🔪 مافيا', doctor: '🩺 دكتور', detective: '🔍 محقق', citizen: '🙂 مواطن' };

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeRoles(n) {
  const mafia = Math.max(1, Math.floor(n / 4));
  const roles = Array(mafia).fill('mafia');
  roles.push('doctor', 'detective');
  while (roles.length < n) roles.push('citizen');
  return shuffle(roles);
}

function topList(votes) {
  const c = new Map();
  for (const v of votes) c.set(v, (c.get(v) || 0) + 1);
  let best = 0;
  let list = [];
  for (const [k, v] of c) {
    if (v > best) { best = v; list = [k]; }
    else if (v === best) list.push(k);
  }
  return list;
}

function pickMost(votes) {
  const list = topList(votes);
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

function topOne(votes) {
  const list = topList(votes);
  return list.length === 1 ? list[0] : null;
}

function buttonRows(items, prefix) {
  const rows = [];
  for (let i = 0; i < items.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const it of items.slice(i, i + 5)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(prefix + it.id)
          .setLabel(it.label.slice(0, 80))
          .setStyle(ButtonStyle.Secondary),
      );
    }
    rows.push(row);
  }
  return rows;
}

// يرسل أزرار بالخاص ويرجع اختيار اللاعب، أو null إذا ما رد أو الخاص مقفل
async function ask(user, text, options) {
  try {
    const dm = await user.createDM();
    const m = await dm.send({ content: text, components: buttonRows(options, 'pick:') });
    const i = await m.awaitMessageComponent({ time: NIGHT_MS });
    await i.update({ content: '✅ تم استلام اختيارك', components: [] }).catch(() => {});
    return i.customId.slice(5);
  } catch {
    return null;
  }
}

function lobbyEmbed(state) {
  const list = [...state.players.values()].map((u) => `• ${u.username}`).join('\n') || 'لا أحد بعد';
  return new EmbedBuilder()
    .setTitle('🕵️ مافيا: التسجيل مفتوح')
    .setColor(0x992d22)
    .setDescription(`اضغط **انضم** خلال ${JOIN_MS / 1000} ثانية (الحد الأدنى ${MIN_PLAYERS} والأقصى ${MAX_PLAYERS})`)
    .addFields({ name: `اللاعبين (${state.players.size})`, value: list });
}

function checkWin(state) {
  const mafia = [...state.alive].filter((id) => state.roles.get(id) === 'mafia').length;
  const others = state.alive.size - mafia;
  if (mafia === 0) return 'citizens';
  if (mafia >= others) return 'mafia';
  return null;
}

async function play(msg, state) {
  const channel = msg.channel;

  const joinRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mafia_join').setLabel('انضم').setEmoji('✋').setStyle(ButtonStyle.Primary),
  );
  const lobby = await channel.send({ embeds: [lobbyEmbed(state)], components: [joinRow] });

  const joinCol = lobby.createMessageComponentCollector({ time: JOIN_MS });
  joinCol.on('collect', (i) => {
    if (state.players.has(i.user.id)) {
      return i.reply({ content: 'انت منضم أصلاً', ephemeral: true }).catch(() => {});
    }
    if (state.players.size >= MAX_PLAYERS) {
      return i.reply({ content: 'اكتمل العدد', ephemeral: true }).catch(() => {});
    }
    state.players.set(i.user.id, i.user);
    i.reply({ content: 'انضممت ✅', ephemeral: true }).catch(() => {});
    lobby.edit({ embeds: [lobbyEmbed(state)] }).catch(() => {});
  });
  await new Promise((r) => joinCol.once('end', r));
  await lobby.edit({ components: [] }).catch(() => {});

  if (state.players.size < MIN_PLAYERS) {
    return channel.send(`ما اكتمل العدد (${MIN_PLAYERS} لاعبين على الأقل). ألغيت اللعبة.`);
  }

  const ids = [...state.players.keys()];
  const roles = makeRoles(ids.length);
  ids.forEach((id, k) => {
    state.roles.set(id, roles[k]);
    state.alive.add(id);
  });
  await Promise.all(
    ids.map((id) =>
      state.players.get(id).send(`🎭 دورك: **${ROLE_NAME[state.roles.get(id)]}**`).catch(() => {}),
    ),
  );
  await channel.send(
    `🎲 بدأت المافيا بـ ${ids.length} لاعبين. الأدوار وصلت بالخاص، إذا ما وصلتك رسالة افتح الخاص للبوت.`,
  );

  const name = (id) => state.players.get(id).username;
  let round = 1;
  let winner = null;

  while (!winner) {
    // ===== الليل =====
    const aliveIds = [...state.alive];
    const mafiaIds = aliveIds.filter((id) => state.roles.get(id) === 'mafia');
    const all = aliveIds.map((id) => ({ id, label: name(id) }));
    const nonMafia = all.filter((o) => !mafiaIds.includes(o.id));

    await channel.send(
      `🌙 **الليلة ${round}**: المافيا تختار ضحيتها، والدكتور والمحقق يسوون أفعالهم بالخاص (${NIGHT_MS / 1000} ثانية).`,
    );

    const mafiaVotes = [];
    let saved = null;
    await Promise.all(
      aliveIds.map(async (id) => {
        const role = state.roles.get(id);
        if (role === 'citizen') return;
        const user = state.players.get(id);

        if (role === 'mafia') {
          const pick = await ask(user, 'اختر ضحيتك:', nonMafia);
          if (pick) mafiaVotes.push(pick);
        } else if (role === 'doctor') {
          const pick = await ask(user, 'اختر من تحميه الليلة:', all);
          if (pick) saved = pick;
        } else {
          const pick = await ask(user, 'اختر من تتحراه:', all);
          if (pick) {
            const isMafia = state.roles.get(pick) === 'mafia';
            await user
              .send(`🔍 نتيجة التحري: **${name(pick)}** ${isMafia ? 'مافيا 🔪' : 'مو مافيا ✅'}`)
              .catch(() => {});
          }
        }
      }),
    );

    const target = pickMost(mafiaVotes);
    if (!target) {
      await channel.send('🌤️ المافيا ما قتلت أحد الليلة.');
    } else if (target === saved) {
      await channel.send(`🩺 حاولت المافيا تقتل، لكن الدكتور أنقذ **${name(target)}**!`);
    } else {
      state.alive.delete(target);
      await channel.send(`☠️ انقتل **${name(target)}**، وكان ${ROLE_NAME[state.roles.get(target)]}.`);
    }

    winner = checkWin(state);
    if (winner) break;

    // ===== النهار: التصويت =====
    const dayVotes = new Map();
    const dayMsg = await channel.send({
      content: `🗳️ **التصويت**: اختر مين تبي تطرده (${DAY_MS / 1000} ثانية).`,
      components: buttonRows([...state.alive].map((id) => ({ id, label: name(id) })), 'vote:'),
    });

    const dayCol = dayMsg.createMessageComponentCollector({ time: DAY_MS });
    dayCol.on('collect', (i) => {
      if (!state.alive.has(i.user.id)) {
        return i.reply({ content: 'انت ميت، ما تصوت 💀', ephemeral: true }).catch(() => {});
      }
      const pick = i.customId.slice(5);
      if (!state.alive.has(pick)) return;
      dayVotes.set(i.user.id, pick);
      i.reply({ content: 'تم تسجيل صوتك ✅', ephemeral: true }).catch(() => {});
    });
    await new Promise((r) => dayCol.once('end', r));
    await dayMsg.edit({ components: [] }).catch(() => {});

    const out = topOne([...dayVotes.values()]);
    if (out) {
      state.alive.delete(out);
      await channel.send(`⚖️ طُرد **${name(out)}**، وكان ${ROLE_NAME[state.roles.get(out)]}.`);
    } else {
      await channel.send('🤷 ما انطرد أحد (تعادل أو ما صوّت أحد).');
    }

    winner = checkWin(state);
    round++;
  }

  const finalList = ids.map((id) => `• ${name(id)}: ${ROLE_NAME[state.roles.get(id)]}`).join('\n');
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setTitle(winner === 'mafia' ? '🔪 فازت المافيا!' : '🏆 فاز المواطنون!')
        .setColor(0x2ecc71)
        .setDescription(finalList),
    ],
  });
}

async function run(msg) {
  const ch = msg.channelId;
  if (running.has(ch)) return msg.reply('فيه لعبة مافيا شغالة بهالروم.');
  running.add(ch);
  const state = { players: new Map(), alive: new Set(), roles: new Map() };
  try {
    await play(msg, state);
  } catch (e) {
    console.error('mafia:', e);
    msg.channel.send('صار خطأ وانتهت اللعبة.').catch(() => {});
  } finally {
    running.delete(ch);
  }
}

module.exports = {
  cmd: 'مافيا',
  name: 'المافيا',
  usage: '!مافيا',
  desc: 'لعبة المافيا: أدوار سرية، ليل ونهار، والمافيا تحاول تقتل الكل',
  rules:
    'تكتب `!مافيا` وتنفتح قائمة التسجيل دقيقة. الأدوار توزع بالخاص: المافيا تختار ضحية كل ليلة، والدكتور يحمي لاعب، والمحقق يتحرى ويعرف إذا الشخص مافيا. بالنهار الكل يصوت على طرد مشتبه. المواطنين يفوزون إذا طردوا كل المافيا، والمافيا تفوز إذا صارت تساوي المواطنين. الحد الأدنى 4 لاعبين والأقصى 25، ولازم يكون الخاص مفتوح للبوت.',
  run,
};
