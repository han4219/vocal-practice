import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { defaultState, validateState, STORAGE_KEY } from '../lib/learning';
import { operation, replay, guestImport } from '../lib/operations';
import { syncQueued, needsExitWarning } from '../lib/sync';
import { supabase, cloudConfigured, authError, recoveryRequested } from '../lib/supabase';
const outboxPrefix = owner => `${STORAGE_KEY}:outbox:${owner}:`;
const cacheKey = owner => `${STORAGE_KEY}:sync:${owner}`;
function readQueue(owner, acknowledged=[]) {
  const prefix=outboxPrefix(owner),ack=new Set(acknowledged);
  return Object.keys(localStorage).filter(k=>k.startsWith(prefix)).map(k=>JSON.parse(localStorage.getItem(k))).filter(op=>!ack.has(op.id)).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
}
function readCache(owner, ids) {
  const raw=localStorage.getItem(cacheKey(owner));
  if(raw){const stored=JSON.parse(raw);return {...stored,owner,base:validateState(stored.base,ids),queue:readQueue(owner,stored.acknowledged),importId:stored.importId||crypto.randomUUID()};}
  const legacy=owner==='guest'?localStorage.getItem(STORAGE_KEY):null;
  return {owner,base:legacy?validateState(JSON.parse(legacy),ids):defaultState(),queue:readQueue(owner),importId:crypto.randomUUID(),importedGuestStamp:''};
}
const uniqueQueue = queue => [...new Map(queue.map(op=>[op.id,op])).values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
export function useProgress(vocabulary) {
  const ids=useRef(new Set(vocabulary.map(w=>w.id)));
  const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(!cloudConfigured),[recovery,setRecovery]=useState(recoveryRequested);
  const [warning,setWarning]=useState(''),[status,setStatus]=useState(cloudConfigured?'loading':'local'),[syncError,setSyncError]=useState('');
  const [envelope,setEnvelope]=useState(()=>{try{return readCache('guest',ids.current);}catch{return {owner:'guest',base:defaultState(),queue:[],importId:crypto.randomUUID()};}});
  const live=useRef(envelope),mounted=useRef(true),running=useRef(null),storageFailed=useRef(false);
  const owner=user?.id||'guest',scope=useRef(owner);scope.current=owner;
  const storageWarning=useCallback(()=>{storageFailed.current=true;setWarning('Không lưu được đầy đủ trên trình duyệt. Hãy đồng bộ ngay hoặc xuất bản sao lưu trước khi đóng trang.');},[]);
  const persist=useCallback(next=>{
    try{const {queue,...metadata}=next;localStorage.setItem(cacheKey(next.owner),JSON.stringify(metadata));if(next.owner==='guest')localStorage.setItem(STORAGE_KEY,JSON.stringify(replay(next.base,next.queue)));return true;}
    catch{storageWarning();return false;}
  },[storageWarning]);
  const update=useCallback(fn=>{const next=fn(live.current);live.current=next;persist(next);setEnvelope(next);},[persist]);
  useEffect(()=>{mounted.current=true;persist(live.current);return()=>{mounted.current=false;};},[persist]);
  useEffect(()=>{
    if(!supabase)return;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{setUser(session?.user||null);setAuthReady(true);if(event==='PASSWORD_RECOVERY')setRecovery(true);});
    supabase.auth.getSession().then(({data,error})=>{if(!mounted.current)return;if(error)setSyncError(authError(error));setUser(data.session?.user||null);setAuthReady(true);});
    return()=>subscription.unsubscribe();
  },[]);
  const download=useCallback(async uid=>{
    if(!supabase||uid==='guest'||running.current===uid)return;
    if(!navigator.onLine){setStatus('offline');return;}
    running.current=uid;setStatus('loading');
    try{
      const {data,error}=await supabase.from('voca_profiles').select('state').eq('user_id',uid).maybeSingle();if(error)throw error;
      if(scope.current!==uid||!mounted.current)return;
      const base=data?validateState(data.state,ids.current):defaultState();
      update(prev=>({...prev,base,queue:uniqueQueue([...prev.queue,...readQueue(uid,prev.acknowledged)]),lastSynced:Date.now()}));setSyncError('');setStatus('synced');
    }catch(error){if(scope.current===uid&&mounted.current){setSyncError(authError(error));setStatus(navigator.onLine?'error':'offline');}}
    finally{if(running.current===uid)running.current=null;}
  },[update]);
  // On sign-in, read once and overlay the durable local outbox. Never upload here.
  useEffect(()=>{
    if(!authReady)return;
    if(live.current.owner!==owner){try{const next=readCache(owner,ids.current);live.current=next;setEnvelope(next);}catch{const next={owner,base:defaultState(),queue:[],importId:crypto.randomUUID()};live.current=next;setEnvelope(next);storageWarning();}}
    setSyncError('');setStatus(owner==='guest'?'local':'loading');
    if(owner!=='guest')download(owner);
  },[owner,authReady,download,storageWarning]);
  const enqueue=useCallback(op=>{
    if(live.current.owner!==scope.current)return;
    try{localStorage.setItem(outboxPrefix(scope.current)+op.id,JSON.stringify(op));}catch{storageWarning();}
    update(prev=>({...prev,queue:[...prev.queue,op]}));setSyncError('');
  },[update,storageWarning]);
  const refresh=useCallback(async()=>{
    const uid=scope.current;
    if(!supabase||uid==='guest'||live.current.owner!==uid||running.current)return false;
    if(!navigator.onLine){setStatus('offline');setSyncError('Bạn đang mất mạng. Thay đổi vẫn được giữ trên máy; bấm Đồng bộ khi có mạng.');return false;}
    update(prev=>({...prev,queue:uniqueQueue([...prev.queue,...readQueue(uid,prev.acknowledged)])}));
    if(!live.current.queue.length){await download(uid);return true;}
    running.current=uid;setStatus('syncing');setSyncError('');
    try{
      await syncQueued({client:supabase,queue:live.current.queue,isCurrent:()=>scope.current===uid&&mounted.current,onBatch:({state,acknowledged})=>{
        const ack=new Set(acknowledged),base=validateState(state,ids.current);
        const next={...live.current,base,queue:uniqueQueue([...live.current.queue,...readQueue(uid,live.current.acknowledged)]).filter(op=>!ack.has(op.id)),acknowledged:[...(live.current.acknowledged||[]),...ack],lastSynced:Date.now()};
        // Save the baseline and acknowledgement before removing outbox entries.
        if(!persist(next))throw new Error('Đã gửi lên máy chủ nhưng chưa lưu được xác nhận trên máy. Hãy thử lại.');
        live.current=next;setEnvelope(next);
        let removed=true;for(const id of next.acknowledged){try{localStorage.removeItem(outboxPrefix(uid)+id);}catch{removed=false;}}
        if(removed)update(prev=>({...prev,acknowledged:[]}));
      }});
      if(scope.current===uid&&mounted.current){if(!live.current.queue.length){storageFailed.current=false;setWarning('');}setSyncError('');setStatus('synced');}
      return true;
    }catch(error){if(scope.current===uid&&mounted.current){setStatus(navigator.onLine?'error':'offline');setSyncError(error.code==='PGRST202'||error.code==='42P01'?'Dịch vụ đồng bộ chưa được cập nhật. Dữ liệu vẫn giữ trên máy; hãy báo chủ website.':authError(error));}return false;}
    finally{if(running.current===uid)running.current=null;}
  },[update,persist,download]);
  useEffect(()=>{
    const listener=e=>{if(e.key&&(e.key===cacheKey(scope.current)||e.key.startsWith(outboxPrefix(scope.current)))){try{const next=readCache(scope.current,ids.current);live.current=next;setEnvelope(next);}catch{storageWarning();}}};
    const offline=()=>setStatus('offline');const online=()=>setStatus('synced');
    const leave=e=>{if(needsExitWarning(scope.current,live.current.queue.length,storageFailed.current)){e.preventDefault();e.returnValue='';}};
    const saveLocal=()=>{for(const op of live.current.queue){try{localStorage.setItem(outboxPrefix(scope.current)+op.id,JSON.stringify(op));}catch{storageWarning();}}persist(live.current);};
    window.addEventListener('storage',listener);window.addEventListener('offline',offline);window.addEventListener('online',online);window.addEventListener('beforeunload',leave);window.addEventListener('pagehide',saveLocal);
    return()=>{window.removeEventListener('storage',listener);window.removeEventListener('offline',offline);window.removeEventListener('online',online);window.removeEventListener('beforeunload',leave);window.removeEventListener('pagehide',saveLocal);};
  },[persist,storageWarning]);
  const state=useMemo(()=>replay(envelope.base,envelope.queue),[envelope.base,envelope.queue]);
  const review=useCallback((wordId,result,details={})=>enqueue(operation('review',{wordId,result,details})),[enqueue]);
  const seen=useCallback(wordId=>{if(!replay(live.current.base,live.current.queue).words[wordId]?.seenAt)enqueue(operation('seen',{wordId}));},[enqueue]);
  const favorite=useCallback(wordId=>{const current=replay(live.current.base,live.current.queue);enqueue(operation('favorite',{wordId,value:!current.words[wordId]?.favorite}));},[enqueue]);
  const settings=useCallback(next=>enqueue(operation('settings',next)),[enqueue]);
  const saveLesson=useCallback(lesson=>enqueue(operation('lesson',lesson)),[enqueue]);
  const replaceState=useCallback(next=>enqueue(operation('import',{state:validateState(next,ids.current)})),[enqueue]);
  const importGuest=useCallback(()=>{
    const guest=readCache('guest',ids.current),stamp=`${guest.importId}:${guest.queue.at(-1)?.id||'baseline'}`;
    const first=guestImport(guest);
    try{for(const op of [first,...guest.queue])localStorage.setItem(outboxPrefix(scope.current)+op.id,JSON.stringify(op));}catch{storageWarning();}
    update(prev=>({...prev,queue:uniqueQueue([...prev.queue,first,...guest.queue]),importedGuestStamp:stamp}));
  },[update,storageWarning]);
  let guestAvailable=false;
  if(user){try{const guest=readCache('guest',ids.current),stamp=`${guest.importId}:${guest.queue.at(-1)?.id||'baseline'}`;guestAvailable=(Object.keys(guest.base.words).length>0||Object.keys(guest.base.lessons||{}).length>0||guest.queue.length>0)&&envelope.importedGuestStamp!==stamp;}catch{/* Warn when attempted. */}}
  const pending=user?envelope.queue.length:0;
  const displayStatus=status==='syncing'||status==='loading'||status==='offline'||status==='error'?status:pending?'pending':user?'synced':'local';
  return {state,setState:replaceState,warning,review,seen,favorite,settings,saveLesson,
    cloud:{configured:cloudConfigured,user,authReady:authReady&&envelope.owner===owner,status:displayStatus,error:syncError,pending,lastSynced:envelope.lastSynced,refresh,importGuest,guestAvailable,recovery,setRecovery}};
}
