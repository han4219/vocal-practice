import { useEffect, useState, useRef, useReducer, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Volume2, Trophy, Keyboard, Lightbulb, X } from 'lucide-react';
import { ProgressBar, SoundButton, StarButton } from './UI';
import { normalizeAnswer, questionFor } from '../lib/learning';
import { freshCard, sessionState, sessionReducer } from '../lib/session';
function HintDialog({ word, speak, close }) {
  const ref = useRef();
  useEffect(() => { const prior = document.activeElement; const dialog = ref.current; dialog.showModal(); return () => { dialog.close(); prior?.focus(); }; }, []);
  return <dialog ref={ref} className="hint-dialog" aria-labelledby="hint-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <button className="icon-button close-modal" onClick={close} aria-label="Đóng gợi ý"><X size={19}/></button>
    <span className="hint-bulb"><Lightbulb size={30}/></span><span className="eyebrow">NHÌN MỘT CHÚT ĐỂ NHỚ LÂU HƠN</span>
    <h2 id="hint-title">{word.word}</h2><p className="ipa">{word.ipa}</p><p>{word.meaning}</p>
    <SoundButton word={word.word} speak={speak}/><p className="fine-print">Đóng gợi ý rồi tự viết lại nhé. Lượt có gợi ý vẫn được lưu, nhưng không tăng cấp ghi nhớ.</p>
    <button autoFocus className="btn primary w-full" onClick={close}>Mình nhớ rồi, viết lại thôi<ArrowRight size={17}/></button>
  </dialog>;
}
export default function StudySession({ session, state, review, seen, favorite, speak, close, restart, pool }) {
  const [current, dispatch] = useReducer(sessionReducer, undefined, sessionState);
  const [hintOpen, setHintOpen] = useState(false);
  const input = useRef(null); const lock = useRef(new Set());
  const index = current.index; const card = current.cards[index] || freshCard();
  const word = session.words[index]; const isFlash = session.mode === 'flashcard';
  const type = session.mode === 'mixed' ? (index % 2 ? 'typing' : 'choice') : session.mode;
  const question = useMemo(()=>questionFor(word,pool,type),[word,pool,type,card.attempt]);
  const assessed = Object.values(current.cards).filter(c=>c.attempts.length).length;
  useEffect(()=>{if(isFlash)seen(word.id);},[word.id,isFlash,seen]);
  useEffect(()=>{if(!isFlash&&question.type==='typing'&&!card.grade&&!hintOpen)input.current?.focus();},[index,card.attempt,card.grade,question.type,isFlash,hintOpen]);
  const submit = value => {
    const key = `${index}:${card.attempt}`;
    if(card.grade||lock.current.has(key)||(!isFlash&&!String(value).trim()))return;
    lock.current.add(key);
    const correct = isFlash ? value !== 'again' : question.type==='choice' ? value===word.meaning : normalizeAnswer(value)===normalizeAnswer(word.word);
    const result = !correct ? 'again' : card.hinted||card.retry ? 'assisted' : 'good';
    dispatch({type:'grade',correct,answer:value});
    review(word.id,result,{mode:session.mode,answer:String(value),correct,hinted:card.hinted,retry:card.retry,sessionId:session.id,courseId:session.courseId||null,groupTitle:session.title,groupId:session.groupId||null,groupNumber:session.groupNumber||null});
  };
  const go = next => { if(next>=0&&next<session.words.length){setHintOpen(false);dispatch({type:'go',index:next});} };
  const next = () => index===session.words.length-1 ? dispatch({type:'finish'}) : go(index+1);
  useEffect(()=>{
    const key=e=>{
      if(e.target.matches('input,select,textarea,button')||current.finished||hintOpen||e.metaKey||e.ctrlKey||e.altKey)return;
      if(e.key===' '&&isFlash){e.preventDefault();dispatch({type:'flip'});}
      if(e.key==='ArrowLeft'&&isFlash){e.preventDefault();go(index-1);}
      if(e.key==='ArrowRight'&&(isFlash||card.grade)){e.preventDefault();if(index<session.words.length-1)go(index+1);}
      if(isFlash&&card.flipped&&!card.grade&&['1','2'].includes(e.key)){e.preventDefault();submit(e.key==='1'?'again':'good');}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const results = session.words.map((w,i)=>({word:w,card:current.cards[i]}));
  const wrong = results.filter(r=>r.card?.attempts.at(-1)?.correct===false).map(r=>r.word);
  const unassessed = results.filter(r=>!r.card?.attempts.length).map(r=>r.word);
  const firstCorrect = results.filter(r=>r.card?.attempts[0]?.correct&&!r.card.attempts[0].hinted).length;
  if(current.finished)return <section className="session-complete">
    <div className="completion-medal"><Trophy size={48}/></div><span className="eyebrow">THÊM MỘT CHÚT TIẾN BỘ</span><h1>{isFlash?'Một nhóm nhỏ, thêm nhiều điều mới!':'Bạn vừa làm rất tốt!'}</h1>
    <p>Đã đánh giá {assessed}/{session.words.length} từ trong “{session.title}”.</p>
    <div className="results-summary"><div><strong>{firstCorrect}</strong><span>Tự nhớ ngay lần đầu</span></div><div><strong>{wrong.length}</strong><span>Cần ôn thêm</span></div><div><strong>{unassessed.length}</strong><span>Chưa đánh giá</span></div></div>
    {wrong.length>0&&<div className="wrong-words"><h3>Những từ cần thêm chút thời gian</h3>{wrong.map(w=><div key={w.id}><strong>{w.word}</strong><span>{w.meaning}</span><SoundButton word={w.word} speak={speak}/></div>)}</div>}
    <div className="flex justify-center gap-3 flex-wrap"><button className="btn outline" onClick={close}>{session.returnView==='practice'?'Về góc luyện tập':session.courseId?'Về danh sách nhóm':'Về khu vườn'}</button><button className="btn outline" onClick={()=>dispatch({type:'go',index:0})}>Xem lại các thẻ</button>{(wrong.length>0||unassessed.length>0)&&<button className="btn primary" onClick={()=>restart([...wrong,...unassessed],`Ôn thêm: ${session.title}`,session.mode,{ordered:true,full:true,courseId:session.courseId,groupId:session.groupId,groupNumber:session.groupNumber,returnView:session.returnView})}><RotateCcw size={17}/>Luyện các từ cần ôn</button>}</div>
    <p className="fine-print mt-5">Mỗi lượt trả lời được lưu riêng. Xem thẻ hoặc chuyển tới/lùi không làm tăng cấp ghi nhớ.</p>
  </section>;
  return <div className="study-page">
    <button className="text-button back-link" onClick={close}><ArrowLeft size={17}/>{session.returnView==='practice'?'Về góc luyện tập':session.courseId?'Về danh sách nhóm':'Về khu vườn'}</button>
    <div className="study-heading"><div><span className="eyebrow">{isFlash?'HỌC BẰNG FLASHCARD':question.type==='typing'?'NHỚ VÀ VIẾT LẠI':'CHỌN NGHĨA ĐÚNG'}</span><h1>{session.title}</h1></div><span className="session-count">{index+1}<span> / {session.words.length}</span></span></div>
    <ProgressBar value={assessed/session.words.length*100} label="Tiến độ phiên học"/>
    {isFlash ? <>
      <div className="flashcard-tools"><span className="pill subtle">{assessed}/{session.words.length} từ đã đánh giá</span><div className="flex gap-2"><StarButton active={state.words[word.id]?.favorite} onClick={()=>favorite(word.id)}/><SoundButton word={word.word} speak={speak}/></div></div>
      <button className={`flashcard ${card.flipped?'flipped':''}`} aria-label={card.flipped?'Lật lại mặt từ vựng':'Lật thẻ để xem nghĩa'} aria-pressed={card.flipped} onClick={()=>dispatch({type:'flip'})}>
        <div className="flashcard-inner"><div className="card-face front" aria-hidden={card.flipped}><span className="eyebrow">BẠN CÓ NHỚ TỪ NÀY?</span><h2>{word.word}</h2><span className="ipa">{word.ipa}</span><span className="flip-hint"><RotateCcw size={16}/>Chạm để lật thẻ</span></div>
        <div className="card-face back" aria-hidden={!card.flipped}><span className="eyebrow">{word.word}</span><h2>{word.meaning}</h2><p className="example-en">{word.example}</p><p className="example-vi">{word.translation}</p><span className="flip-hint"><RotateCcw size={16}/>Chạm để xem lại từ</span></div></div>
      </button>
      {card.flipped&&<button className="text-button example-sound" onClick={()=>speak(word.example)}><Volume2 size={17}/>Nghe câu ví dụ</button>}
      <div className="grading-actions">{card.grade?<><span className={card.grade==='correct'?'feedback-good':'feedback-wrong'}><Check size={18}/>{card.grade==='correct'?'Đã lưu lượt học này.':'Mình sẽ ôn lại từ này nhé.'}</span><button className="btn outline" onClick={()=>dispatch({type:'retry'})}><RotateCcw size={17}/>Học lại từ này</button></>:card.flipped?<><button className="btn outline" onClick={()=>submit('again')}><RotateCcw size={17}/>Chưa nhớ<span className="keycap">1</span></button><button className="btn primary" onClick={()=>submit('good')}><Check size={18}/>Mình nhớ rồi<span className="keycap">2</span></button></>:<button className="btn primary" onClick={()=>dispatch({type:'flip'})}>Khám phá nghĩa<RotateCcw size={16}/></button>}</div>
      <div className="card-navigation"><button className="btn outline" disabled={index===0} onClick={()=>go(index-1)}><ArrowLeft size={17}/>Từ trước</button><button className="btn primary" onClick={next}>{index===session.words.length-1?'Xem kết quả':'Từ tiếp theo'}<ArrowRight size={17}/></button></div>
      <div className="card-dots" aria-label="Chọn từ trong nhóm">{session.words.map((w,i)=><button key={w.id} onClick={()=>go(i)} className={`${i===index?'current':''} ${current.cards[i]?.grade||''}`} aria-label={`Từ ${i+1}: ${current.cards[i]?.grade?'đã đánh giá':'chưa đánh giá'}`} aria-current={i===index?'step':undefined}>{i+1}</button>)}</div>
      <p className="keyboard-tip"><Keyboard size={14}/>Space: lật thẻ · ← / →: di chuyển · 1 / 2: đánh giá</p>
    </> : <>
      <section className="quiz-card"><div className="quiz-top"><span className="pill subtle">{question.type==='typing'?'Điền từ / cụm từ':'Chọn 1 đáp án'}</span><StarButton active={state.words[word.id]?.favorite} onClick={()=>favorite(word.id)}/></div>
        {question.type==='choice'?<><h2>{word.word}</h2><div className="flex items-center justify-center gap-3"><span className="ipa">{word.ipa}</span><SoundButton word={word.word} speak={speak}/></div><p className="quiz-instruction">Từ này có nghĩa là gì?</p><div className="answer-options">{question.options.map((option,i)=><button key={option} disabled={!!card.grade} className={`answer-option ${card.grade&&option===word.meaning?'correct':''} ${card.grade&&card.answer===option&&card.grade==='wrong'?'wrong':''}`} onClick={()=>submit(option)}><span>{String.fromCharCode(65+i)}</span>{option}{card.grade&&option===word.meaning&&<Check size={18} className="ml-auto"/>}</button>)}</div></>:<>
          <p className="cloze-sentence">{question.prompt}</p><p className="meaning-hint">Nghĩa: <strong>{word.meaning}</strong></p>
          <div className="hint-controls"><button className="btn hint-button" disabled={!!card.grade} onClick={()=>{dispatch({type:'hint'});setHintOpen(true);}}><Lightbulb size={17}/>Xem gợi ý</button>{card.hinted&&<span className="fine-print">Đã xem gợi ý ở lượt này</span>}</div>
          <form onSubmit={e=>{e.preventDefault();if(!card.grade)submit(card.answer);}}><label className="sr-only" htmlFor="typed-answer">Đáp án tiếng Anh</label><input id="typed-answer" ref={input} className={`answer-input ${card.grade||''}`} value={card.answer} onChange={e=>dispatch({type:'type',value:e.target.value})} disabled={!!card.grade} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false" placeholder="Nhập từ / cụm từ tiếng Anh…"/>{!card.grade&&<button type="submit" className="btn primary w-full" disabled={!card.answer.trim()}>Kiểm tra<ArrowRight size={17}/></button>}</form>
        </>}
        {card.grade&&<div className={`quiz-feedback ${card.grade}`} role="status"><strong>{card.grade==='correct'?(card.hinted||card.retry?'Đúng rồi! Thêm một lần luyện để nhớ hơn.':'Chính xác! Thêm một từ ở lại.'):'Chưa đúng, cùng xem lại từ này nhé.'}</strong><p>{word.word} — {word.meaning}</p><p>{word.example}</p><span>{word.translation}</span><button className="text-button" onClick={()=>speak(word.example)}><Volume2 size={16}/>Nghe ví dụ</button></div>}
      </section>
      {card.grade&&<div className="quiz-post-actions"><button className="btn outline" onClick={()=>dispatch({type:'retry'})}><RotateCcw size={17}/>Làm lại từ này</button><button className="btn primary" onClick={next}>{index===session.words.length-1?'Xem kết quả':'Câu tiếp theo'}<ArrowRight size={18}/></button></div>}
    </>}
    {hintOpen&&<HintDialog word={word} speak={speak} close={()=>setHintOpen(false)}/>}
  </div>;
}
