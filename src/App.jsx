import { useState, useEffect, useMemo } from 'react';
import { Sprout, LayoutDashboard, BookOpen, Dumbbell, ChartNoAxesCombined, Settings2, Flame, ArrowRight, Menu, X, Heart, Search } from 'lucide-react';
import { vocabulary, courses } from './data/catalog';
import { isDue, shuffle, dayKey, streak } from './lib/learning';
import { useProgress } from './hooks/useProgress';
import { useSpeech } from './hooks/useSpeech';
import Dashboard from './components/Dashboard';
import CourseGroups from './components/CourseGroups';
import { syncLabels } from './components/AccountPanel';
import Library from './components/Library';
import Practice from './components/Practice';
import Progress from './components/Progress';
import Settings from './components/Settings';
import StudySession from './components/StudySession';
import { WordDetail } from './components/UI';
const navItems=[['home','Khu vườn của tôi',LayoutDashboard],['library','Sổ từ vựng',BookOpen],['practice','Luyện tập',Dumbbell],['progress','Tiến độ học tập',ChartNoAxesCombined]];
export default function App() {
  const [view,setView]=useState(()=>{const hash=window.location.hash.slice(1);return ['home','library','practice','progress','settings'].includes(hash)?hash:'home';});
  const [activeCourse,setActiveCourse]=useState(()=>courses.find(c=>c.id===window.location.hash.split('/')[1])||null);
  const [mobile,setMobile]=useState(false);const [session,setSession]=useState(null);const [selectedWord,setSelectedWord]=useState(null);const [now,setNow]=useState(Date.now());
  const {state,setState,warning,review,seen,favorite,settings,cloud}=useProgress(vocabulary);
  const speech=useSpeech(state.settings);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{const listener=()=>{const h=window.location.hash.slice(1);if(h.startsWith('course/')){setActiveCourse(courses.find(c=>c.id===h.split('/')[1])||null);setView('home');setSession(null);setMobile(false);}else if(['home','library','practice','progress','settings'].includes(h)){setView(h);setActiveCourse(null);setSession(null);setMobile(false);}};window.addEventListener('hashchange',listener);return()=>window.removeEventListener('hashchange',listener);},[]);
  useEffect(()=>{const handler=e=>{if(e.key==='Escape'){setSelectedWord(null);setMobile(false);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
  useEffect(()=>{
    if(!selectedWord)return;
    const prior=document.activeElement;
    const handler=e=>{if(e.key!=='Tab')return;const all=document.querySelectorAll('.word-detail button, .word-detail a');const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}};
    document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);prior?.focus();};
  },[selectedWord]);
  const dueWords=useMemo(()=>vocabulary.filter(w=>isDue(state.words[w.id],now)),[state.words,now]);
  const navigate=next=>{setView(next);setActiveCourse(null);window.history.pushState(null,'',`#${next}`);setSession(null);setMobile(false);window.scrollTo({top:0,behavior:'instant'});};
  const openCourse=course=>{setActiveCourse(course);setView('home');setSession(null);setMobile(false);window.history.pushState(null,'',`#course/${course.id}`);window.scrollTo({top:0,behavior:'instant'});};
  const start=(words,title,mode='flashcard',options={})=>{
    if(!words.length)return;
    const ordered=options.ordered?words:shuffle(words).sort((a,b)=>{
      const ap=state.words[a.id],bp=state.words[b.id];
      return (isDue(ap)?0:!ap?.level?1:2)-(isDue(bp)?0:!bp?.level?1:2);
    });
    setSession({id:crypto.randomUUID(),words:options.full?ordered:ordered.slice(0,mode==='flashcard'?20:state.settings.goal),title,mode,courseId:options.courseId});setMobile(false);window.scrollTo({top:0,behavior:'instant'});
  };
  useEffect(()=>{if(cloud.recovery)navigate('settings');},[cloud.recovery]);
  if(!cloud.authReady)return <main className="boot-screen"><Sprout size={35}/><h1>Đang chuẩn bị hành trình của bạn…</h1></main>;
  return <div className="app-shell"><a href="#main-content" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById('main-content').focus();}}>Chuyển đến nội dung</a>{mobile&&<button className="sidebar-scrim" onClick={()=>setMobile(false)} aria-label="Đóng menu"/>}<aside className={`sidebar ${mobile?'is-open':''}`}><button className="brand" onClick={()=>navigate('home')} aria-label="Voca - Trang chủ"><span className="brand-icon"><Sprout size={25}/></span><span>voca<span className="brand-dot">.</span></span></button><div className="sidebar-tagline">Một chút mỗi ngày, thêm ngàn từ hay.</div><span className="nav-caption">KHÔNG GIAN HỌC TẬP</span><nav aria-label="Điều hướng chính">{navItems.map(([id,label,Icon])=><button key={id} className={`nav-item ${view===id&&!session?'active':''}`} onClick={()=>navigate(id)} aria-current={view===id&&!session?'page':undefined}><Icon size={20}/><span>{label}</span>{id==='practice'&&dueWords.length>0&&<span className="nav-badge">{dueWords.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="garden-tip"><span className="tip-leaf"><Sprout size={28} strokeWidth={1.4}/></span><h3>Nhỏ thôi, nhưng mỗi ngày.</h3><p>5 phút hôm nay, thêm một chút tự tin ngày mai.</p><button onClick={()=>openCourse(courses.find(c=>c.id==='everyday'))}>Gieo một từ mới<ArrowRight size={15}/></button></div><button className={`nav-item settings-nav ${view==='settings'?'active':''}`} onClick={()=>navigate('settings')}><Settings2 size={19}/>Tùy chỉnh</button><div className="sidebar-profile"><span className="avatar">B</span><div><strong>Người gieo từ</strong><span>Hành trình của riêng bạn</span></div><span className="profile-dot"/></div></div></aside>
    <div className="main-shell"><header className="topbar"><div className="flex items-center gap-3"><button className="icon-button menu-toggle" onClick={()=>setMobile(!mobile)} aria-label="Mở menu" aria-expanded={mobile}>{mobile?<X/>:<Menu/>}</button><span className="breadcrumb">Không gian học tập<span>/</span><strong>{session?'Phiên học':view==='settings'?'Tùy chỉnh':navItems.find(n=>n[0]===view)?.[1]}</strong></span></div><div className="topbar-right"><button className="top-search icon-button" aria-label="Tìm từ vựng" onClick={()=>navigate('library')}><Search size={19}/></button><span className="top-streak"><Flame size={18}/><strong>{streak(state.activity)}</strong><span>ngày liên tiếp</span></span><button className={`cloud-chip ${cloud.status}`} onClick={()=>navigate('settings')} title={cloud.error||syncLabels[cloud.status]}>{cloud.user?(cloud.pending?'Đang lưu…':syncLabels[cloud.status]):'Đăng nhập'}</button><span className="avatar small">{cloud.user?.email?.[0]?.toUpperCase()||'B'}</span></div></header>
    <main id="main-content" tabIndex={-1} className={session?'main-content session-content':'main-content'}>{warning&&<div className="notice" role="alert">{warning}</div>}{speech.error&&<div className="notice" role="status">{speech.error}</div>}{session?<StudySession key={session.id} session={session} state={state} review={review} seen={seen} favorite={favorite} speak={speech.speak} close={()=>session.courseId?openCourse(courses.find(c=>c.id===session.courseId)):navigate('home')} restart={start} pool={vocabulary}/>:activeCourse?<CourseGroups key={activeCourse.id} course={activeCourse} state={state} start={start} back={()=>navigate('home')} speak={speech.speak}/>:view==='home'?<Dashboard state={state} start={start} dueWords={dueWords} navigate={navigate} openCourse={openCourse}/>:view==='library'?<Library state={state} favorite={favorite} speak={speech.speak} start={start} openWord={setSelectedWord}/>:view==='practice'?<Practice state={state} start={start} dueWords={dueWords}/>:view==='progress'?<Progress state={state} start={start} dueWords={dueWords} navigate={navigate}/>:<Settings cloud={cloud} state={state} setState={setState} settings={settings} speak={speech.speak}/>}</main><footer className="footer"><span>voca. · Trồng từ mới, nuôi tự tin.</span><span>Made for your everyday growth <Heart size={12}/></span></footer></div><WordDetail word={selectedWord} onClose={()=>setSelectedWord(null)} state={state} favorite={favorite} speak={speech.speak} start={start} review={review}/></div>;
}
