import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles, Volume2, Trophy, Keyboard } from 'lucide-react';
import { ProgressBar, SoundButton, StarButton } from './UI';
import { normalizeAnswer, questionFor } from '../lib/learning';
export default function StudySession({ session, state, review, favorite, speak, close, restart, pool }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [graded, setGraded] = useState(null);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const input = useRef(null);
  const word = session.words[index];
  const type = session.mode === 'mixed' ? (index % 2 ? 'typing' : 'choice') : session.mode;
  const [question, setQuestion] = useState(()=>questionFor(word,pool,type));
  const isFlash = session.mode === 'flashcard';
  const submit = (value) => {
    if (graded || (!isFlash && !String(value).trim())) return;
    const correct = isFlash ? value !== 'again' : question.type === 'choice' ? value === word.meaning : normalizeAnswer(value) === normalizeAnswer(word.word);
    const result = isFlash ? value : correct ? 'good' : 'again';
    setGraded(correct ? 'correct' : 'wrong'); setAnswer(value);
    setAnswers(a=>[...a,{word,correct}]); review(word.id,result);
  };
  const next = () => {
    if (index === session.words.length-1) { setFinished(true); return; }
    const nextIndex = index+1;
    setIndex(nextIndex); setFlipped(false); setGraded(null); setAnswer('');
    const nextType = session.mode === 'mixed' ? (nextIndex % 2 ? 'typing' : 'choice') : session.mode;
    setQuestion(questionFor(session.words[nextIndex],pool,nextType));
  };
  useEffect(()=> { if (!isFlash && question.type === 'typing') input.current?.focus(); },[index,question.type,isFlash]);
  useEffect(()=>{
    const key = e => {
      if (e.target.matches('input,select,textarea,button') || finished || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key===' ' && isFlash && !graded) { e.preventDefault(); setFlipped(f=>!f); }
      if ((e.key==='ArrowRight'||e.key==='Enter') && graded) { e.preventDefault();next(); }
      if (isFlash && flipped && !graded && ['1','2'].includes(e.key)) { e.preventDefault();submit(e.key==='1'?'again':'good'); }
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  });
  const wrong = answers.filter(a=>!a.correct).map(a=>a.word);
  if (finished) return <section className="session-complete"><div className="completion-medal"><Trophy size={48}/></div><span className="eyebrow">THÊM MỘT CHÚT TIẾN BỘ</span><h1>{isFlash?'Hạt mầm đã được gieo!':'Bạn vừa làm rất tốt!'}</h1><p>Đã hoàn thành {answers.length} từ trong bộ “{session.title}”.</p><div className="results-summary"><div><strong>{answers.filter(a=>a.correct).length}</strong><span>{isFlash?'Đã nhớ':'Câu đúng'}</span></div><div><strong>{wrong.length}</strong><span>Cần ôn thêm</span></div><div><strong>{Math.round(answers.filter(a=>a.correct).length/answers.length*100)}%</strong><span>{isFlash?'Tỷ lệ nhớ':'Chính xác'}</span></div></div>{wrong.length>0 && <div className="wrong-words"><h3>Những từ cần thêm chút thời gian</h3>{wrong.map(w=><div key={w.id}><strong>{w.word}</strong><span>{w.meaning}</span><SoundButton word={w.word} speak={speak}/></div>)}</div>}<div className="flex justify-center gap-3 flex-wrap"><button className="btn outline" onClick={close}>Về khu vườn</button>{wrong.length>0&&<button className="btn primary" onClick={()=>restart(wrong,`Luyện lại: ${session.title}`,session.mode)}><RotateCcw size={17}/>Luyện lại từ chưa nhớ</button>}</div><p className="fine-print">Tiến độ và lịch ôn đã được cập nhật.</p></section>;
  return <div className="study-page"><button className="text-button back-link" onClick={close}><ArrowLeft size={17}/>Về khu vườn</button><div className="study-heading"><div><span className="eyebrow">{isFlash?'HỌC BẰNG FLASHCARD':question.type==='typing'?'NHỚ VÀ VIẾT LẠI':'CHỌN NGHĨA ĐÚNG'}</span><h1>{session.title}</h1></div><span className="session-count">{index+1}<span> / {session.words.length}</span></span></div><ProgressBar value={answers.length/session.words.length*100} label="Tiến độ phiên học"/>
    {isFlash ? <><div className="flashcard-tools"><span className="pill subtle">Từ {index+1} · {word.pos || 'từ vựng'}</span><div className="flex gap-2"><StarButton active={state.words[word.id]?.favorite} onClick={()=>favorite(word.id)}/><SoundButton word={word.word} speak={speak}/></div></div><button className={`flashcard ${flipped?'flipped':''}`} aria-label={flipped?'Lật lại mặt từ vựng':'Lật thẻ để xem nghĩa'} aria-pressed={flipped} onClick={()=>!graded&&setFlipped(v=>!v)}><div className="flashcard-inner"><div className="card-face front" aria-hidden={flipped}><span className="eyebrow">BẠN CÓ NHỚ TỪ NÀY?</span><h2>{word.word}</h2><span className="ipa">{word.ipa}</span><span className="flip-hint"><RotateCcw size={16}/>Chạm để lật thẻ</span></div><div className="card-face back" aria-hidden={!flipped}><span className="eyebrow">{word.word}</span><h2>{word.meaning}</h2><p className="example-en">{word.example}</p><p className="example-vi">{word.translation}</p><span className="flip-hint"><RotateCcw size={16}/>Chạm để xem lại từ</span></div></div></button>{flipped&&<button className="text-button example-sound" onClick={()=>speak(word.example)}><Volume2 size={17}/>Nghe câu ví dụ</button>}<div className="grading-actions">{graded?<><span className={graded==='correct'?'feedback-good':'feedback-wrong'}><Check size={18}/>{graded==='correct'?'Tuyệt! Đã cập nhật lịch ôn.':'Không sao, mình sẽ sớm ôn lại.'}</span><button className="btn primary" onClick={next}>{index===session.words.length-1?'Xem kết quả':'Từ tiếp theo'}<ArrowRight size={17}/></button></>:flipped?<><button className="btn outline" onClick={()=>submit('again')}><RotateCcw size={17}/>Chưa nhớ<span className="keycap">1</span></button><button className="btn primary" onClick={()=>submit('good')}><Check size={18}/>Mình nhớ rồi<span className="keycap">2</span></button></>:<button className="btn primary" onClick={()=>setFlipped(true)}>Khám phá nghĩa<RotateCcw size={16}/></button>}</div><p className="keyboard-tip"><Keyboard size={14}/>Space: lật thẻ · 1 / 2: đánh giá · →: tiếp tục</p></> : <><section className="quiz-card"><div className="quiz-top"><span className="pill subtle">{question.type==='typing'?'Điền từ / cụm từ':'Chọn 1 đáp án'}</span><StarButton active={state.words[word.id]?.favorite} onClick={()=>favorite(word.id)}/></div>{question.type==='choice'?<><h2>{word.word}</h2><div className="flex items-center justify-center gap-3"><span className="ipa">{word.ipa}</span><SoundButton word={word.word} speak={speak}/></div><p className="quiz-instruction">Từ này có nghĩa là gì?</p><div className="answer-options">{question.options.map((option,i)=><button key={option} disabled={!!graded} className={`answer-option ${graded&&option===word.meaning?'correct':''} ${graded&&answer===option&&graded==='wrong'?'wrong':''}`} onClick={()=>submit(option)}><span>{String.fromCharCode(65+i)}</span>{option}{graded&&option===word.meaning&&<Check size={18} className="ml-auto"/>}</button>)}</div></>:<><p className="cloze-sentence">{question.prompt}</p><p className="meaning-hint">Gợi ý: <strong>{word.meaning}</strong></p><form onSubmit={e=>{e.preventDefault();if(graded)next();else submit(answer);}}><label className="sr-only" htmlFor="typed-answer">Đáp án tiếng Anh</label><input id="typed-answer" ref={input} className={`answer-input ${graded||''}`} value={answer} onChange={e=>setAnswer(e.target.value)} disabled={!!graded} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false" placeholder="Nhập từ / cụm từ tiếng Anh…"/>{!graded&&<button type="submit" className="btn primary w-full" disabled={!answer.trim()}>Kiểm tra<ArrowRight size={17}/></button>}</form></>}{graded&&<div className={`quiz-feedback ${graded}`} role="status"><strong>{graded==='correct'?'Chính xác! Thêm một từ ở lại.':'Gần đúng rồi, hãy ghi nhớ nhé.'}</strong><p>{word.word} — {word.meaning}</p><p>{word.example}</p><span>{word.translation}</span><button className="text-button" onClick={()=>speak(word.example)}><Volume2 size={16}/>Nghe ví dụ</button></div>}</section>{graded&&<button className="btn primary quiz-next" onClick={next}>{index===session.words.length-1?'Xem kết quả':'Câu tiếp theo'}<ArrowRight size={18}/></button>}</>}
  </div>;
}
