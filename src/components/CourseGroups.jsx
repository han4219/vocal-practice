import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { groupsFor, groupProgress, LEVELS } from '../lib/learning';
import { ProgressBar, SoundButton, Empty } from './UI';
export default function CourseGroups({ course, selected, selectGroup, state, start, back, backLabel = 'Về khu vườn', speak }) {
  const groups = groupsFor(course);
  const [filter, setFilter] = useState('all');
  const current = groups.find(g => g.number === selected) || groups[0];
  if(!current)return <><button className="text-button back-link" onClick={back}><ArrowLeft size={17}/>{backLabel}</button><Empty title="Bộ từ này đang trống" description="Đánh dấu ngôi sao ở Sổ từ vựng hoặc thêm từ vào bài học để bắt đầu." action={back} label="Về khu vườn"/></>;
  const stats = groupProgress(current, state.words);
  const visible = groups.filter(g => filter === 'all' || (filter === 'done') === groupProgress(g, state.words).complete);
  const completed = groups.filter(g => groupProgress(g, state.words).complete).length;
  const launch = (onlyNew = false) => start(onlyNew ? current.words.filter(w => !state.words[w.id]?.level) : current.words,
    `${course.title} · Nhóm ${current.number}`, 'flashcard', { ordered: true, full: true, courseId: course.id, groupId: current.id, groupNumber: current.number });
  return <>
    <button className="text-button back-link" onClick={back}><ArrowLeft size={17}/>{backLabel}</button>
    <div className="page-intro"><div><span className="eyebrow">MỖI NHÓM NHỎ, MỘT BƯỚC TIẾN</span><h1>{course.title}</h1><p>{course.words.length.toLocaleString('vi-VN')} từ · {groups.length} nhóm · Tối đa 20 từ / nhóm</p></div><span className="pill subtle">{completed}/{groups.length} nhóm đã học hết</span></div>
    <div className="groups-layout"><section className="panel group-picker"><h2>Chọn một nhóm từ</h2><div className="tabs">{[['all','Tất cả'],['todo','Chưa học hết'],['done','Đã học hết']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>
      <div className="group-buttons">{visible.map(g=>{const p=groupProgress(g,state.words);return <button key={g.id} className={`group-button ${current.id===g.id?'selected':''} ${p.complete?'completed':''}`} aria-pressed={current.id===g.id} onClick={()=>selectGroup(g.number)}><span>{p.complete?<Check size={15}/>:g.number}</span><strong>Nhóm {g.number}</strong><small>{p.learned}/{g.words.length} đã học</small></button>})}</div>{!visible.length&&<p className="fine-print">Chưa có nhóm phù hợp với bộ lọc này.</p>}
    </section><section className="panel group-detail"><div className="section-line"><h2>Nhóm {current.number}</h2><span className="pill subtle">{stats.learned}/{current.words.length} đã học</span></div><ProgressBar value={stats.learned/current.words.length*100} label={`Nhóm ${current.number}`}/><p className="fine-print mt-3">“Đã học” khi bạn tự đánh giá hoặc trả lời bài tập. Bạn có thể xem trước và quay lại bất kỳ từ nào.</p>
      <div className="group-actions"><button className="btn primary" onClick={()=>launch()}>{stats.learned?<RotateCcw size={16}/>:<ArrowRight size={16}/>} {stats.learned?'Học lại cả nhóm':'Học nhóm này'}</button>{stats.learned>0&&stats.remaining>0&&<button className="btn outline" onClick={()=>launch(true)}>Học {stats.remaining} từ chưa học</button>}</div>
      <ol className="group-word-list">{current.words.map((w,i)=>{const p=state.words[w.id];return <li key={w.id}><span className="word-number">{i+1}</span><div><strong>{w.word}</strong><p>{w.meaning}</p></div><span className={`level-tag level-${p?.level||0}`}>{p?.level?LEVELS[p.level]:p?.seenAt?'Đã xem':'Chưa học'}</span><SoundButton word={w.word} speak={speak}/></li>})}</ol>
    </section></div>
  </>;
}
