function norm(s) {
  return s
    .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
    .replace(/[إأآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function scramble(word) {
  for (let tries = 0; tries < 20; tries++) {
    const c = [...word];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    if (c.join('') !== word) return c.join('');
  }
  return [...word].reverse().join('');
}

// جولة: أول واحد يجاوب صح يفوز، وكل عضو له محاولة وحدة
function race(channel, question, answers, timeMs) {
  const targets = answers.map(norm);
  const tried = new Set();
  return new Promise(async (resolve) => {
    await channel.send(question).catch(() => {});
    const col = channel.createMessageCollector({
      time: timeMs,
      filter: (m) => !m.author.bot,
    });
    col.on('collect', (m) => {
      if (tried.has(m.author.id)) return;
      tried.add(m.author.id);
      if (targets.includes(norm(m.content))) {
        col.stop('win');
        resolve({ winner: m.author });
      }
    });
    col.on('end', (_, reason) => {
      if (reason !== 'win') resolve({ winner: null });
    });
  });
}

module.exports = { norm, pick, scramble, race };
