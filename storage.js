const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function getUserFile(userId) {
  return path.join(DATA_DIR, `user_${userId}.json`);
}

function loadUser(userId) {
  const file = getUserFile(userId);
  if (!fs.existsSync(file)) return { entries: [], conversations: [] };
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveUser(userId, data) {
  fs.writeFileSync(getUserFile(userId), JSON.stringify(data, null, 2), 'utf8');
}

function addEntry(userId, entry) {
  const data = loadUser(userId);
  data.entries.push({ ...entry, timestamp: new Date().toISOString() });
  saveUser(userId, data);
  return data;
}

function getTodayEntries(userId) {
  const data = loadUser(userId);
  const today = new Date().toISOString().slice(0, 10);
  return data.entries.filter(e => e.timestamp.startsWith(today));
}

function getRecentEntries(userId, n = 20) {
  const data = loadUser(userId);
  return data.entries.slice(-n);
}

function getConversation(userId) {
  const data = loadUser(userId);
  return data.conversations || [];
}

function saveConversation(userId, messages) {
  const data = loadUser(userId);
  data.conversations = messages.slice(-30);
  saveUser(userId, data);
}

module.exports = { addEntry, getTodayEntries, getRecentEntries, getConversation, saveConversation, loadUser };
