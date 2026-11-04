export function extendManifest(definitions, words, previous = { version: 1, courses: [] }) {
  const ids = new Set(words.map(w => w.id));
  const prior = new Map(previous.courses.map(c => [c.id, c]));
  return { version: 1, courses: definitions.map(course => {
    const groups = (prior.get(course.id)?.groups || []).map(g => ({ ...g, wordIds: [...g.wordIds] }));
    const assigned = new Set(groups.flatMap(g => g.wordIds));
    for (const id of assigned) if (!ids.has(id)) throw new Error(`Assigned word ${id} must be retained in the vocabulary snapshot.`);
    const added = words.filter(w => w.courses.includes(course.id) && !assigned.has(w.id));
    // Never fill or shift an existing group, including a short final group.
    const first = groups.length + 1;
    for (let i = 0; i < added.length; i += 20) {
      const number = first + i / 20;
      groups.push({ id: `${course.id}-${number}`, number, wordIds: added.slice(i, i + 20).map(w => w.id) });
    }
    return { ...course, groups };
  }) };
}
export function hydrateCatalog(words, manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.courses) || !manifest.courses.length || !Array.isArray(words) || !words.length) throw new Error('Bộ từ chưa sẵn sàng.');
  const byId = new Map();
  for (const word of words) {
    if (!word.id || byId.has(word.id) || !word.word || !word.meaning || !word.example) throw new Error('Nội dung bộ từ không hợp lệ.');
    byId.set(word.id, { ...word, courses: [] });
  }
  const seenCourses = new Set(); const groupIds = new Set();
  const courses = manifest.courses.map(course => {
    if (!course.id || seenCourses.has(course.id) || !Array.isArray(course.groups) || !course.groups.length) throw new Error('Danh sách nhóm không hợp lệ.');
    seenCourses.add(course.id); const assigned = new Set();
    const groups = course.groups.map((group, i) => {
      if (group.number !== i + 1 || group.id !== `${course.id}-${group.number}` || groupIds.has(group.id) || !Array.isArray(group.wordIds) || !group.wordIds.length || group.wordIds.length > 20) throw new Error('Thứ tự nhóm không hợp lệ.');
      groupIds.add(group.id);
      const groupWords = group.wordIds.map(id => {
        const word = byId.get(id);
        if (!word || assigned.has(id)) throw new Error('Từ trong nhóm bị thiếu hoặc lặp lại.');
        assigned.add(id); word.courses.push(course.id); return word;
      });
      return { id: group.id, number: group.number, words: groupWords };
    });
    return { ...course, groups, words: groups.flatMap(g => g.words) };
  });
  return { vocabulary: [...byId.values()], courses };
}
export function courseRoute(hash) {
  const parts = hash.replace(/^#/, '').split('/');
  if (parts[0] !== 'course') return null;
  const number = Number(parts[2] || 1);
  return { courseId: parts[1], number: Number.isInteger(number) && number > 0 ? number : 1 };
}
export function practiceRoute(hash) {
  const parts = hash.replace(/^#/, '').split('/');
  if (parts[0] !== 'practice') return null;
  const number = Number(parts[2] || 1);
  return { deck: parts[1] || 'everyday', number: Number.isInteger(number) && number > 0 ? number : 1, mode: ['mixed', 'choice', 'typing'].includes(parts[3]) ? parts[3] : 'mixed' };
}
export const practiceHash = ({ deck, number, mode }) => `#practice/${deck}/${number}/${mode}`;
export function lessonWords(words, { full = false, mode = 'flashcard', goal = 10 } = {}) {
  return full ? [...words] : words.slice(0, mode === 'flashcard' ? 20 : goal);
}
