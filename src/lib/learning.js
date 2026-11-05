import { validateLessons } from './lessons.js';
export const LEVELS = ['Chưa học', 'Làm quen', 'Đang nhớ', 'Khá vững', 'Ghi nhớ tốt', 'Đã thuộc'];
export const INTERVALS = [0, 10 * 60000, 86400000, 3 * 86400000, 7 * 86400000, 21 * 86400000];
export const STORAGE_KEY = 'voca-garden-v1';
export const defaultState = () => ({ version: 1, words: {}, activity: {}, lessons: {}, settings: { goal: 10, accent: 'en-US', rate: 0.9 } });
export function dayKey(time = Date.now()) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function normalizeAnswer(value) {
  return value.trim().toLowerCase().normalize('NFKC').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
}
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function recordReview(state, id, result, now = Date.now()) {
  const prev = state.words[id] || {};
  const level = result === 'mastered' ? 5 : result === 'again' ? 1 : result === 'assisted' ? Math.max(1, prev.level || 0) : Math.min(5, (prev.level || 0) + 1);
  const today = dayKey(now);
  const activity = state.activity[today] || { ids: [], reviews: 0, correct: 0 };
  return { ...state, words: { ...state.words, [id]: { ...prev, level, reviews: (prev.reviews || 0) + 1, nextReview: Math.max(now, prev.lastReview || 0) + INTERVALS[level], lastReview: Math.max(now, prev.lastReview || 0) } },
    activity: { ...state.activity, [today]: { ids: [...new Set([...activity.ids, id])], reviews: activity.reviews + 1, correct: activity.correct + (['again','assisted'].includes(result) ? 0 : 1) } } };
}
export function isDue(item, now = Date.now()) { return (item?.level || 0) > 0 && Number.isFinite(item.nextReview) && item.nextReview <= now; }
export function streak(activity, now = Date.now()) {
  const d = new Date(now);
  if (!activity[dayKey(d)]?.reviews) d.setDate(d.getDate() - 1);
  let count = 0;
  while (activity[dayKey(d)]?.reviews) { count++; d.setDate(d.getDate() - 1); }
  return count;
}
export function weekActivity(activity, now = Date.now()) {
  return Array.from({ length: 7 }, (_, i) => { const date = new Date(now); date.setDate(date.getDate() - 6 + i); const key = dayKey(date); return { key, day: date.toLocaleDateString('vi-VN', { weekday: 'short' }), count: activity[key]?.ids.length || 0 }; });
}
export function questionFor(word, pool, type = 'choice', random = Math.random) {
  const escaped = word.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const canBlank = pattern.test(word.example);
  if (type === 'typing') return { word, type, prompt: canBlank ? word.example.replace(pattern, '$1________') : 'Viết từ / cụm từ tiếng Anh tương ứng với nghĩa bên dưới.', cloze: canBlank };
  const meanings = [...new Set(pool.filter(v => v.id !== word.id && v.word.toLowerCase() !== word.word.toLowerCase() && v.meaning !== word.meaning).map(v => v.meaning))];
  return { word, type: 'choice', options: shuffle([word.meaning, ...shuffle(meanings, random).slice(0, 3)], random) };
}
export function validateState(raw, validIds) {
  if (!raw || raw.version !== 1 || !raw.words || typeof raw.words !== 'object' || Array.isArray(raw.words) || !raw.activity || typeof raw.activity !== 'object' || Array.isArray(raw.activity) || !raw.settings || typeof raw.settings !== 'object') throw new Error('Tệp sao lưu không đúng định dạng Voca.');
  const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const state = defaultState();
  const acceptedIds = validIds instanceof Set ? validIds : new Set(validIds);
  for (const [id, value] of Object.entries(raw.words)) {
    if (!acceptedIds.has(id) || !value || typeof value !== 'object') continue;
    if (!Number.isInteger(value.level ?? 0) || (value.level ?? 0) < 0 || (value.level ?? 0) > 5) throw new Error('Cấp độ từ vựng không hợp lệ.');
    state.words[id] = { level: value.level || 0, favorite: !!value.favorite, reviews: count(value.reviews), nextReview: Number.isFinite(value.nextReview) ? Math.max(0, value.nextReview) : 0, lastReview: Number.isFinite(value.lastReview) ? Math.max(0, value.lastReview) : 0, seenAt: count(value.seenAt), favoriteAt: count(value.favoriteAt) };
  }
  for (const [day, value] of Object.entries(raw.activity)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || !Array.isArray(value.ids)) continue;
    const reviews = count(value.reviews);
    state.activity[day] = { ids: [...new Set(value.ids.filter(id => acceptedIds.has(id)))], reviews, correct: Math.min(reviews, count(value.correct)) };
  }
  state.settings = { goal: [5, 10, 15, 20].includes(raw.settings.goal) ? raw.settings.goal : 10, accent: ['en-US','en-GB'].includes(raw.settings.accent) ? raw.settings.accent : 'en-US', rate: [0.7,0.9,1].includes(raw.settings.rate) ? raw.settings.rate : 0.9 };
  state.lessons = validateLessons(raw.lessons,acceptedIds);
  state.settingsAt = count(raw.settingsAt);
  state.history = Array.isArray(raw.history) ? raw.history.filter(e => e && typeof e.id === 'string' && acceptedIds.has(e.wordId) && Number.isFinite(e.at)).slice(-100) : [];
  return state;
}

export function groupsFor(course) {
  if (Array.isArray(course.groups)) return course.groups;
  return Array.from({ length: Math.ceil(course.words.length / 20) }, (_, index) => ({
    id: `${course.id}-${index + 1}`, number: index + 1,
    words: course.words.slice(index * 20, (index + 1) * 20),
  }));
}
export function groupProgress(group, progress) {
  const learned = group.words.filter(w => progress[w.id]?.level > 0).length;
  return { learned, remaining: group.words.length - learned, complete: learned === group.words.length };
}
