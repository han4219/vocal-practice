import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { defaultState, validateState, STORAGE_KEY } from '../lib/learning';
import { operation, replay } from '../lib/operations';
import { supabase, cloudConfigured, authError, recoveryRequested } from '../lib/supabase';
const outboxPrefix = owner => `${STORAGE_KEY}:outbox:${owner}:`;
function readQueue(owner) {
  const prefix=outboxPrefix(owner);
  return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(localStorage.getItem(k))).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
const cacheKey = owner => `${STORAGE_KEY}:sync:${owner}`;
function readCache(owner, ids) {
  const raw = localStorage.getItem(cacheKey(owner));
  if (raw) {
    const stored = JSON.parse(raw);
    return { owner, base: validateState(stored.base, ids), queue: readQueue(owner), importId: stored.importId || crypto.randomUUID(), importedGuestStamp: stored.importedGuestStamp || '' };
  }
  const legacy = owner === 'guest' ? localStorage.getItem(STORAGE_KEY) : null;
  return { owner, base: legacy ? validateState(JSON.parse(legacy), ids) : defaultState(), queue: readQueue(owner), importId: crypto.randomUUID(), importedGuestStamp: '' };
}
export function useProgress(vocabulary) {
  const ids = useRef(new Set(vocabulary.map(w=>w.id)));
  const [user,setUser] = useState(null);
  const [authReady,setAuthReady] = useState(!cloudConfigured);
  const [recovery,setRecovery] = useState(recoveryRequested);
  const [warning,setWarning] = useState('');
  const [status,setStatus] = useState(cloudConfigured?'loading':'local');
  const [syncError,setSyncError] = useState('');
  const [lastSynced,setLastSynced] = useState(null);
  const [envelope,setEnvelope] = useState(()=>{
    try{return readCache('guest',ids.current);}catch{return {owner:'guest',base:defaultState(),queue:[],importId:crypto.randomUUID()};}
  });
  const live = useRef(envelope); const mounted = useRef(true); const running = useRef(null);
  const owner = user?.id || 'guest'; const scope = useRef(owner); scope.current = owner;
  const persist = useCallback(next=>{
    try {
      const {queue,...metadata}=next;
      localStorage.setItem(cacheKey(next.owner),JSON.stringify(metadata));
      if(next.owner==='guest')localStorage.setItem(STORAGE_KEY,JSON.stringify(replay(next.base,next.queue)));
    } catch { setWarning('Không đủ chỗ lưu trên trình duyệt. Hãy kết nối mạng để đồng bộ hoặc xuất bản sao lưu trước khi đóng trang.'); }
  },[]);
  const update = useCallback(fn=>{
    const next = fn(live.current); live.current = next; persist(next); setEnvelope(next);
  },[persist]);
  useEffect(()=>{persist(live.current);},[persist]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if(!supabase)return;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      setUser(session?.user||null);setAuthReady(true);if(event==='PASSWORD_RECOVERY')setRecovery(true);
    });
    supabase.auth.getSession().then(({data,error})=>{if(!mounted.current)return;if(error)setSyncError(authError(error));setUser(data.session?.user||null);setAuthReady(true);});
    return()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!authReady)return;
    if(live.current.owner!==owner){
      try { const next=readCache(owner,ids.current);live.current=next;setEnvelope(next); }
      catch {const next={owner,base:defaultState(),queue:[],importId:crypto.randomUUID()};live.current=next;setEnvelope(next);setWarning('Không đọc được bản lưu của tài khoản này. Đang lấy lại dữ liệu từ máy chủ.');}
    }
    setSyncError('');setStatus(user?'loading':'local');
  },[owner,authReady]);
  const enqueue = useCallback(op=>{
    if(live.current.owner!==scope.current)return;
    try{localStorage.setItem(outboxPrefix(scope.current)+op.id,JSON.stringify(op));}catch{setWarning('Không lưu được lượt học chờ đồng bộ. Hãy giữ trang mở và kết nối mạng.');}
    update(prev=>({...prev,queue:[...prev.queue,op]}));
  },[update]);
  const refresh = useCallback(async()=>{
    const uid=scope.current;
    if(!supabase||uid==='guest'||live.current.owner!==uid)return;
    if(!navigator.onLine){setStatus('offline');return;}
    if(running.current===uid)return;
    running.current=uid;setStatus('syncing');
    try {
      const ack=new Set();
      // The queue is persisted before any network request. RPCs deduplicate by UUID.
      while(scope.current===uid){
        const next=live.current.queue.find(op=>!ack.has(op.id));if(!next)break;
        const {error}=await supabase.rpc('voca_apply_operation',{op:next});if(error)throw error;
        ack.add(next.id);
      }
      if(scope.current!==uid)return;
      const {data,error}=await supabase.from('voca_profiles').select('state').eq('user_id',uid).maybeSingle();if(error)throw error;
      if(scope.current!==uid)return;
      const base=data?validateState(data.state,ids.current):defaultState();
      for(const id of ack)localStorage.removeItem(outboxPrefix(uid)+id);
      update(prev=>prev.owner===uid?{...prev,base,queue:[...new Map([...prev.queue.filter(op=>!ack.has(op.id)),...readQueue(uid)].map(op=>[op.id,op])).values()]}:prev);
      setLastSynced(Date.now());setSyncError('');setStatus('synced');
    } catch(error) {
      if(scope.current===uid&&mounted.current){setStatus(navigator.onLine?'error':'offline');setSyncError(error.code==='PGRST202'||error.code==='42P01'?'Dịch vụ lưu trữ chưa sẵn sàng. Kết quả vẫn đang giữ trên máy; hãy báo chủ website kiểm tra.':authError(error));}
    } finally {if(running.current===uid)running.current=null;}
  },[update]);
  useEffect(()=>{
    if(!authReady||envelope.owner!==owner||!user)return;
    refresh();
  },[authReady,owner,envelope.owner,envelope.queue.length,refresh,user]);
  useEffect(()=>{
    if(!user)return;
    const tick=()=>refresh(); const offline=()=>setStatus('offline');
    const interval=setInterval(tick,30000);window.addEventListener('online',tick);window.addEventListener('offline',offline);window.addEventListener('focus',tick);
    const channel=supabase.channel(`voca-${user.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'voca_profiles',filter:`user_id=eq.${user.id}`},()=>{if(!live.current.queue.length)refresh();}).subscribe();
    return()=>{clearInterval(interval);window.removeEventListener('online',tick);window.removeEventListener('offline',offline);window.removeEventListener('focus',tick);supabase.removeChannel(channel);};
  },[user?.id,refresh]);
  // Reconcile guest changes between tabs. Cloud accounts reconcile through the server.
  useEffect(()=>{const listener=e=>{if(e.key&&(e.key===cacheKey(scope.current)||e.key.startsWith(outboxPrefix(scope.current)))){try{const next=readCache(scope.current,ids.current);live.current=next;setEnvelope(next);}catch{setWarning('Không đọc được thay đổi từ tab khác.');}}};window.addEventListener('storage',listener);return()=>window.removeEventListener('storage',listener);},[]);
  const state = useMemo(()=>replay(envelope.base,envelope.queue),[envelope.base,envelope.queue]);
  const review = useCallback((wordId,result,details={})=>enqueue(operation('review',{wordId,result,details})),[enqueue]);
  const seen = useCallback(wordId=>{const current=replay(live.current.base,live.current.queue);if(!current.words[wordId]?.seenAt)enqueue(operation('seen',{wordId}));},[enqueue]);
  const favorite = useCallback(wordId=>{const current=replay(live.current.base,live.current.queue);enqueue(operation('favorite',{wordId,value:!current.words[wordId]?.favorite}));},[enqueue]);
  const settings = useCallback(next=>enqueue(operation('settings',next)),[enqueue]);
  const replaceState = useCallback(next=>enqueue(operation('import',{state:validateState(next,ids.current)})),[enqueue]);
  const importGuest = useCallback(()=>{
    const guest=readCache('guest',ids.current);
    const stamp=`${guest.importId}:${guest.queue.at(-1)?.id||'baseline'}`;
    const first=operation('import',{state:guest.base});first.id=guest.importId;
    for(const op of [first,...guest.queue])localStorage.setItem(outboxPrefix(scope.current)+op.id,JSON.stringify(op));
    update(prev=>({...prev,queue:[...prev.queue,first,...guest.queue].filter((op,i,all)=>all.findIndex(x=>x.id===op.id)===i),importedGuestStamp:stamp}));
  },[update]);
  let guestAvailable=false;
  if(user){try{const guest=readCache('guest',ids.current);const stamp=`${guest.importId}:${guest.queue.at(-1)?.id||'baseline'}`;guestAvailable=(Object.keys(guest.base.words).length>0||guest.queue.length>0)&&envelope.importedGuestStamp!==stamp;}catch{/* Reported when import is attempted. */}}
  return {state,setState:replaceState,warning,review,seen,favorite,settings,
    cloud:{configured:cloudConfigured,user,authReady:authReady&&envelope.owner===owner,status,error:syncError,pending:user?envelope.queue.length:0,lastSynced,refresh,importGuest,guestAvailable,recovery,setRecovery}};
}
