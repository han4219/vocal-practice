import { defaultState, recordReview, dayKey } from './learning.js';
export function operation(kind, payload) {
  const at = Date.now();
  return { id: crypto.randomUUID(), kind, payload, at, day: dayKey(at) };
}
export function mergeProgress(current, incoming) {
  const result = { ...current, words: { ...current.words }, activity: { ...current.activity } };
  for (const [id, item] of Object.entries(incoming.words)) {
    const prior = current.words[id] || {};
    const latest = (item.lastReview || 0) > (prior.lastReview || 0) ? item : prior;
    const favorite = (item.favoriteAt || 0) > (prior.favoriteAt || 0) || !current.words[id] ? item : prior;
    result.words[id] = { ...prior, ...latest, reviews: Math.max(item.reviews || 0, prior.reviews || 0), seenAt: Math.max(item.seenAt || 0, prior.seenAt || 0), favorite: !!favorite.favorite, favoriteAt: favorite.favoriteAt || 0 };
  }
  for (const [day, item] of Object.entries(incoming.activity)) {
    const prior = current.activity[day] || { ids: [], reviews: 0, correct: 0 };
    result.activity[day] = { ids: [...new Set([...prior.ids, ...item.ids])], reviews: Math.max(prior.reviews, item.reviews), correct: Math.max(prior.correct, item.correct) };
  }
  if ((incoming.settingsAt || 0) > (current.settingsAt || 0) || !Object.keys(current.words).length) {
    result.settings = incoming.settings;
    result.settingsAt = incoming.settingsAt || 0;
  }
  result.history = [...new Map([...(incoming.history || []), ...(current.history || [])].map(h => [h.id, h])).values()].sort((a,b)=>a.at-b.at).slice(-100);
  return result;
}
export function applyOperation(state, op) {
  const p = op.payload;
  if (op.kind === 'import') return mergeProgress(state, p.state);
  if (op.kind === 'settings') return { ...state, settings: { ...state.settings, ...p }, settingsAt: op.at };
  const prior = state.words[p.wordId] || {};
  if (op.kind === 'seen') return { ...state, words: { ...state.words, [p.wordId]: { ...prior, seenAt: Math.max(op.at, prior.seenAt || 0) } } };
  if (op.kind === 'favorite') return { ...state, words: { ...state.words, [p.wordId]: { ...prior, favorite: p.value, favoriteAt: op.at } } };
  if (op.kind === 'review') {
    let next = recordReview(state, p.wordId, p.result, op.at);
    // Use the recorded local calendar day even when replayed from a different timezone.
    const localDay = dayKey(op.at);
    if (op.day !== localDay) {
      const before = state.activity[op.day] || { ids: [], reviews: 0, correct: 0 };
      next.activity = { ...state.activity, [op.day]: { ids: [...new Set([...before.ids,p.wordId])], reviews: before.reviews+1, correct: before.correct+(['again','assisted'].includes(p.result)?0:1) } };
    }
    next.history = [...(state.history || []), { id: op.id, wordId: p.wordId, at: op.at, result: p.result, ...p.details }].slice(-100);
    return next;
  }
  return state;
}
export const replay = (state = defaultState(), queue = []) => queue.reduce(applyOperation, state);
