import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

const root = new URL('../src/data/', import.meta.url);
const sourceUrl = 'https://docs.google.com/spreadsheets/d/18AO8DQRxVdA8ORhFcFTVzIcLVdtPvGmxxdciKQ7TLvc/gviz/tq?tqx=out:csv&gid=0';
const offline = process.argv.includes('--offline');
const raw = offline ? await readFile(new URL('source.csv', root), 'utf8') : await fetch(sourceUrl, { signal: AbortSignal.timeout(60000) }).then(async r => {
  if (!r.ok) throw new Error(`Google Sheets: HTTP ${r.status}. Enable link-viewer access and retry. The current snapshot is preserved.`);
  return r.text();
});
const rows = parse(raw.replace(/^\uFEFF/, ''), { columns: true, skip_empty_lines: true, bom: true });
if (!rows.length || !('Từ / cụm từ' in rows[0])) throw new Error('Unrecognised CSV headers; current data preserved.');
const slug = value => value.split(' - ')[0];
const id = (word, meaning, pos) => createHash('sha256').update(`${word.toLowerCase().trim()}|${meaning.toLowerCase().trim()}|${pos.toLowerCase().trim()}`).digest('hex').slice(0, 16);
const dictionaryCache = new Map();
async function enrich(word) {
  if (dictionaryCache.has(word)) return dictionaryCache.get(word);
  const result = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : []).catch(() => []);
  const entry = result[0];
  const defs = entry?.meanings?.flatMap(m => m.definitions) || [];
  const value = { ipa: entry?.phonetic || entry?.phonetics?.find(p => p.text)?.text, meaning: defs[0]?.definition, example: defs.find(d => d.example)?.example };
  dictionaryCache.set(word, value);
  return value;
}
const vocabulary = [];
const unresolved = [];
for (const [i, row] of rows.entries()) {
  const word = row['Từ / cụm từ']?.trim();
  if (!word) continue;
  let ipa = row['Phiên âm IPA']?.trim(), meaning = row['Nghĩa tiếng Việt']?.trim(), example = row['Ví dụ đời sống (EN)']?.trim();
  const enrichedFields = [];
  let meaningLanguage = 'vi';
  if (!ipa || !meaning || !example) {
    const fill = await enrich(word);
    if (!ipa && fill.ipa) { ipa = fill.ipa; enrichedFields.push('ipa'); }
    if (!meaning && fill.meaning) { meaning = fill.meaning; meaningLanguage = 'en'; enrichedFields.push('meaning (English definition)'); }
    if (!example && fill.example) { example = fill.example; enrichedFields.push('example'); }
  }
  if (!ipa || !meaning || !example) unresolved.push({ row: i + 2, word, missing: ['ipa','meaning','example'].filter(k => !({ipa,meaning,example})[k]) });
  const pos = row['Loại từ']?.trim() || '';
  vocabulary.push({ id: id(word, meaning || '', pos), word, ipa, pos, meaning, meaningLanguage, example,
    translation: row['Dịch ví dụ (VI)']?.trim() || '',
    courses: (row['Khóa học nguồn'] || '').split(/\s*;\s*/).filter(Boolean).map(slug),
    source: 'sheet', sourceRow: i + 2, audio: row['Nghe phát âm (eVSTEP)']?.trim() || '',
    enrichedFields });
}
if (unresolved.length) {
  await writeFile(new URL('enrichment-needed.json', root), JSON.stringify(unresolved, null, 2));
  throw new Error(`${unresolved.length} entries need editorial enrichment; see src/data/enrichment-needed.json. Snapshot preserved; no invented IPA/examples.`);
}
const importedSourceEntries = vocabulary.length;
const additions = JSON.parse(await readFile(new URL('additions.json', root), 'utf8'));
const existing = new Set(vocabulary.map(v => v.word.toLowerCase()));
let added = 0;
for (const [word, ipa, pos, meaning, example, translation] of additions) {
  if (existing.has(word.toLowerCase())) continue;
  vocabulary.push({ id: id(word, meaning, pos), word, ipa, pos, meaning, meaningLanguage: 'vi', example, translation, courses: ['everyday'], source: 'editorial', audio: '', enrichedFields: [] });
  existing.add(word.toLowerCase()); added++;
}
// Preserve entries referenced by an existing lesson even if the Sheet removes them.
// New entries are appended as new groups by prepare-catalog; no existing group shifts.
let archivedEntries = 0;
try {
  const manifest = JSON.parse(await readFile(new URL('course-groups.json', root), 'utf8'));
  const previous = JSON.parse(await readFile(new URL('vocabulary.json', root), 'utf8'));
  const assigned = new Set(manifest.courses.flatMap(c => c.groups.flatMap(g => g.wordIds)));
  const incoming = new Set(vocabulary.map(w => w.id));
  for (const word of previous) if (assigned.has(word.id) && !incoming.has(word.id)) {
    vocabulary.push({ ...word, archived: true }); archivedEntries++;
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
if (new Set(vocabulary.map(v => v.id)).size !== vocabulary.length) throw new Error('Duplicate word/sense IDs; snapshot preserved.');
const courseNames = new Map(rows.flatMap(r => (r['Khóa học nguồn'] || '').split(/\s*;\s*/)).filter(Boolean).map(s => [slug(s), s.split(' - ').slice(1).join(' - ')]));
const metadata = { sourceUrl: sourceUrl.split('/gviz')[0] + '/edit?gid=0', sourceTitle: 'Vocabulary cần nhớ', sourceSheet: 'Từ vựng', importedAt: new Date().toISOString(), sourceEntries: importedSourceEntries, archivedEntries, uniqueSourceWords: new Set(rows.map(r => r['Từ / cụm từ']?.trim().toLowerCase())).size, addedEntries: added, totalEntries: vocabulary.length, courseNames: Object.fromEntries(courseNames) };
await writeFile(new URL('vocabulary.json', root), JSON.stringify(vocabulary));
await writeFile(new URL('metadata.json', root), JSON.stringify(metadata, null, 2));
if (!offline) await writeFile(new URL('source.csv', root), raw);
console.log(`Imported ${metadata.sourceEntries} source entries + ${added} new phrases = ${vocabulary.length}. All required fields complete.`);

await import('./prepare-catalog.mjs');
