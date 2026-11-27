const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'points.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFile(FILE, JSON.stringify(db), () => {});
}

function addPoint(guildId, user) {
  db[guildId] ??= {};
  const e = (db[guildId][user.id] ??= { name: user.username, points: 0 });
  e.name = user.username;
  e.points++;
  save();
  return e.points;
}

function top(guildId, n = 10) {
  return Object.values(db[guildId] ?? {})
    .sort((a, b) => b.points - a.points)
    .slice(0, n);
}

module.exports = { addPoint, top };
