import { ListChecks, PenLine, Shuffle, ArrowRight, Sparkles } from 'lucide-react';
import { courses, vocabulary, formatNumber } from '../data/catalog';
import { groupsFor } from '../lib/learning';
export default function Practice({ start, state, dueWords, selection, onSelectionChange }) {
  const {mode,deck,number} = selection;
  const change = values => onSelectionChange({...selection,...values});
  const options = [
    {id:'mixed',icon:Shuffle,title:'Một chút thử thách',description:'Kết hợp chọn nghĩa và điền từ trong cùng một nhóm cố định.'},
    {id:'choice',icon:ListChecks,title:'Chọn nghĩa đúng',description:'Nhận diện từ vựng với 4 đáp án. Bước khởi đầu nhẹ nhàng.'},
    {id:'typing',icon:PenLine,title:'Nhớ và viết lại',description:'Điền từ vào câu hoặc viết từ theo nghĩa được gợi ý.'},
  ];
  const course = courses.find(c=>c.id===deck);
  const groups = course ? groupsFor(course) : [];
  const group = groups.find(g=>g.number===number) || groups[0];
  const selectedWords = deck==='due' ? dueWords : deck==='learned' ? vocabulary.filter(w=>state.words[w.id]?.level>0) : group?.words || [];
  const selectedTitle = course ? `${course.title} · Nhóm ${group?.number}` : deck==='due' ? 'Ôn tập đến hạn' : 'Những từ đã học';
  const count = group ? selectedWords.length : Math.min(state.settings.goal,selectedWords.length);
  return <>
    <div className="page-intro"><div><span className="eyebrow">THỬ MỘT CHÚT, NHỚ THÊM NHIỀU</span><h1>Góc luyện tập<span className="heading-dot">.</span></h1><p>Chọn một nhóm từ quen thuộc và luyện lại theo đúng thứ tự.</p></div></div>
    <div className="practice-layout"><div><h2 className="subheading">1. Chọn cách bạn muốn luyện</h2><div className="practice-modes">{options.map(o=><button className={`practice-mode ${mode===o.id?'selected':''}`} onClick={()=>change({mode:o.id})} key={o.id} aria-pressed={mode===o.id}><span className="mode-icon"><o.icon size={24}/></span><span><h3>{o.title}</h3><p>{o.description}</p></span><span className="radio-dot"/></button>)}</div>
      <h2 className="subheading mt-8">2. Chọn bộ từ và nhóm cố định</h2>
      <label className="field-label" htmlFor="practice-deck">Bộ từ</label><select id="practice-deck" className="w-full" value={deck} onChange={e=>change({deck:e.target.value,number:1})}>
        {[...courses].reverse().map(c=><option value={c.id} key={c.id}>{c.title} ({formatNumber(c.words.length)} từ)</option>)}
        <option value="due">Từ đến hạn ôn ({dueWords.length})</option><option value="learned">Những từ đã học</option>
      </select>
      {group?<><label className="field-label mt-5" htmlFor="practice-group">Nhóm từ</label><select id="practice-group" className="w-full" value={group.number} onChange={e=>change({number:Number(e.target.value)})}>{groups.map(g=><option key={g.id} value={g.number}>Nhóm {g.number} · {g.words.length} từ · bắt đầu: {g.words[0]?.word}</option>)}</select><p className="fine-print mt-3">Cùng một nhóm luôn có cùng danh sách và thứ tự từ, ở cả flashcard lẫn bài luyện tập.</p><details className="practice-word-preview"><summary>Xem {group.words.length} từ trong nhóm</summary><ol>{group.words.map(w=><li key={w.id}>{w.word}</li>)}</ol></details></>:<p className="fine-print mt-3">Danh sách ôn cá nhân thay đổi theo tiến độ học và ngày đến hạn của bạn.</p>}
    </div><aside className="practice-summary"><span className="mode-icon"><Sparkles size={26}/></span><h2>Luyện vững<br/>từng nhóm nhỏ</h2><p>{group?'Cùng những từ đã chọn, mỗi lần trở lại.':'Một phiên ngắn để giữ nhịp học mỗi ngày.'}</p><dl><div><dt>Bộ từ</dt><dd>{selectedTitle}</dd></div><div><dt>Số câu</dt><dd>{count} câu</dd></div><div><dt>Thứ tự</dt><dd>Theo danh sách</dd></div></dl>
      <button className="btn primary w-full" disabled={!count} onClick={()=>start(selectedWords,selectedTitle,mode,{full:!!group,courseId:course?.id,groupId:group?.id,groupNumber:group?.number,returnView:'practice'})}>Bắt đầu luyện tập<ArrowRight size={17}/></button>
      {!count&&<p className="fine-print">Chưa có từ trong bộ này. Hãy chọn bộ khác hoặc học từ mới trước nhé.</p>}<span className="fine-print">Bạn vẫn có thể làm lại từng từ hoặc luyện lại các từ chưa nhớ.</span>
    </aside></div>
  </>;
}
