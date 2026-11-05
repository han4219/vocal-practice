export const MAX_LESSON_WORDS = 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function lessonUrl(value = '') {
  if (!value.trim()) return '';
  try { const url = new URL(value.trim()); if (url.protocol === 'https:' || url.protocol === 'http:') return url.href; } catch { /* Invalid or unsafe URL. */ }
  throw new Error('Đường dẫn bài học phải bắt đầu bằng https:// hoặc http://.');
}
export function validateLessons(raw, validIds) {
  const result = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [id, item] of Object.entries(raw)) {
    if (!uuid.test(id) || !item || !Number.isFinite(item.updatedAt) || !uuid.test(item.revision || '') || !Array.isArray(item.wordIds)) continue;
    let sourceUrl; try { sourceUrl = lessonUrl(item.sourceUrl || ''); } catch { sourceUrl = ''; }
    result[id] = { id, title: String(item.title || '').trim().slice(0,100), wordIds: [...new Set(item.wordIds.filter(w=>validIds.has(w)))].slice(0,MAX_LESSON_WORDS), sourceUrl, updatedAt: Math.max(0,item.updatedAt), revision: item.revision, deleted: !!item.deleted };
  }
  return result;
}
export const newerLesson = (a,b) => !a || b.updatedAt > a.updatedAt || (b.updatedAt === a.updatedAt && b.revision > a.revision);
export function mergeLessons(current = {}, incoming = {}) {
  const result = {...current};
  for (const [id,item] of Object.entries(incoming)) if (newerLesson(result[id],item)) result[id]=item;
  return result;
}
export const activeLessons = state => Object.values(state.lessons || {}).filter(l=>!l.deleted).sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
export function favoriteWords(vocabulary, state) {
  return vocabulary.filter(w=>state.words[w.id]?.favorite).sort((a,b)=>(state.words[a.id].favoriteAt||0)-(state.words[b.id].favoriteAt||0)||a.id.localeCompare(b.id));
}
export function personalCourse(id, title, words) {
  return { id, title, subtitle:'Những từ bạn chọn cho buổi học của mình', words, personal:true, color:'amber', icon:'Star' };
}
export function lessonCourse(lesson, vocabulary) {
  const byId=vocabulary instanceof Map?vocabulary:new Map(vocabulary.map(w=>[w.id,w]));
  return personalCourse(`lesson-${lesson.id}`,lesson.title,lesson.wordIds.map(id=>byId.get(id)).filter(Boolean));
}
export const sourceLessonCourse = (lesson,vocabulary) => lessonCourse({...lesson,id:`source-${lesson.id}`},vocabulary);
export function findSourceLessons(lessons,query,byId) {
  const q=query.trim().toLowerCase();
  let sourceId=null;
  try { const url=new URL(q);if(url.hostname==='evstep.vn'&&url.pathname==='/mod/thglossary/view.php')sourceId=url.searchParams.get('id'); } catch { /* Search by word or numeric ID. */ }
  return lessons.filter(l=>sourceId?l.id===sourceId:!q||l.id===q||l.sourceUrl.toLowerCase().includes(q)||l.wordIds.some(id=>byId.get(id)?.word.toLowerCase().includes(q)));
}
