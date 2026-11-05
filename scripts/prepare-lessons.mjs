import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
const root=new URL('../src/data/',import.meta.url);
const words=JSON.parse(await readFile(new URL('vocabulary.json',root),'utf8'));
const valid=new Set(words.map(w=>w.id));
const bySourceRow=new Map(words.filter(w=>w.source==='sheet'&&!w.archived).map(w=>[w.sourceRow,w]));
const rows=parse(await readFile(new URL('source.csv',root),'utf8'),{columns:true,bom:true,skip_empty_lines:true});
const groups=new Map();
for (const [index,row] of rows.entries()) {
  let hash=createHash('sha256').update([row['Từ / cụm từ'],row['Nghĩa tiếng Việt'],row['Loại từ']].map(v=>(v||'').toLowerCase().trim()).join('|')).digest('hex').slice(0,16);
  // Enrichment can supply a missing meaning before the vocabulary ID is hashed.
  // Resolve that case from the validated current source row, never a fuzzy match.
  if(!valid.has(hash)&&!row['Nghĩa tiếng Việt']?.trim()){
    const enriched=bySourceRow.get(index+2);
    if(enriched?.word.toLowerCase()===row['Từ / cụm từ']?.trim().toLowerCase())hash=enriched.id;
  }
  if (!valid.has(hash)) throw new Error(`Missing vocabulary entry: ${row['Từ / cụm từ']}`);
  for (const link of row['Danh mục nguồn'].split(/\s*;\s*/).filter(Boolean)) {
    const url=new URL(link);if(url.hostname!=='evstep.vn'||url.pathname!=='/mod/thglossary/view.php')continue;
    const id=url.searchParams.get('id');if(!/^\d+$/.test(id))continue;
    if(!groups.has(id))groups.set(id,{id,title:`Danh mục eVSTEP #${id}`,sourceUrl:`https://evstep.vn/mod/thglossary/view.php?id=${id}`,wordIds:[]});
    const group=groups.get(id);if(!group.wordIds.includes(hash))group.wordIds.push(hash);
  }
}
const lessons=[...groups.values()].sort((a,b)=>Number(a.id)-Number(b.id));
await writeFile(new URL('lesson-catalog.json',root),JSON.stringify(lessons));
console.log(`Prepared ${lessons.length} source glossaries. Names are source IDs, not invented lesson titles.`);
