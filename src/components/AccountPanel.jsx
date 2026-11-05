import { useState } from 'react';
import { Cloud, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { supabase, authError } from '../lib/supabase';
export const syncLabels = { local:'Chỉ lưu trên máy', pending:'Chưa đồng bộ · đã lưu trên máy', loading:'Đang tải tài khoản…', syncing:'Đang đồng bộ…', synced:'Đã đồng bộ', offline:'Mất mạng · đang giữ trên máy', error:'Đang chờ đồng bộ' };
export default function AccountPanel({ cloud }) {
  const [mode,setMode]=useState('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const redirectTo=new URL(import.meta.env.BASE_URL,window.location.href).href.split('#')[0].split('?')[0];
  const submit=async e=>{
    e.preventDefault();setBusy(true);setMessage('');
    try {
      let response;
      if(cloud.recovery){response=await supabase.auth.updateUser({password});if(!response.error){cloud.setRecovery(false);setMessage('Đã cập nhật mật khẩu.');}}
      else if(mode==='signup'){response=await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});if(!response.error&&!response.data.session)setMessage('Hãy mở email xác nhận tài khoản, sau đó đăng nhập.');}
      else if(mode==='reset'){response=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(!response.error)setMessage('Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.');}
      else response=await supabase.auth.signInWithPassword({email,password});
      if(response?.error)throw response.error;
      setPassword('');
    } catch(error){setMessage(authError(error));}finally{setBusy(false);}
  };
  const logout=async()=>{
    if(cloud.pending&&!window.confirm(`Còn ${cloud.pending} thay đổi chưa gửi lên máy chủ. Chúng được giữ cho tài khoản này trên trình duyệt, nhưng chưa có trên thiết bị khác. Vẫn đăng xuất?`))return;
    setBusy(true);const {error}=await supabase.auth.signOut({scope:'local'});if(error)setMessage(authError(error));setBusy(false);
  };
  return <section className="panel account-panel"><span className="eyebrow">HÀNH TRÌNH THEO BẠN ĐI KHẮP NƠI</span><div className="section-line mt-3"><h2>Tài khoản & đồng bộ</h2><Cloud size={22}/></div>
    {!cloud.configured?<><p>Đăng nhập để tiếp tục hành trình học trên điện thoại và máy tính bằng cùng một tài khoản.</p><p className="notice mt-4">Tính năng đồng bộ chưa được bật. Bạn vẫn có thể học và lưu tiến độ trên thiết bị này.</p><p className="fine-print">Khi tính năng này được bật, bạn có thể đưa tiến độ có sẵn lên tài khoản để học trên thiết bị khác.</p></>:cloud.user&&!cloud.recovery?<>
      <p className="account-email">{cloud.user.email}</p><p className={`sync-status ${cloud.status}`}>{syncLabels[cloud.status]}{cloud.pending>0?` · ${cloud.pending} thay đổi đang chờ`:''}</p>
      {cloud.lastSynced&&<p className="fine-print">Lần đồng bộ gần nhất: {new Date(cloud.lastSynced).toLocaleTimeString('vi-VN')}</p>}{cloud.error&&<p className="notice" role="status">{cloud.error}</p>}
      <p className="fine-print mt-3">Tiến độ, lượt trả lời, từ yêu thích và tùy chỉnh được lưu riêng theo tài khoản. Mọi thay đổi được giữ trên máy. Chỉ khi bạn bấm Đồng bộ, dữ liệu mới được gửi lên tài khoản. Tải lại trang hoặc đăng nhập sẽ lấy dữ liệu từ máy chủ và giữ lại các thay đổi đang chờ trên máy.</p>
      {cloud.guestAvailable&&<div className="guest-migration"><h3>Bạn đã có tiến độ trên máy này</h3><p>Đưa dữ liệu đang học khi chưa đăng nhập lên tài khoản để dùng trên thiết bị khác.</p><button className="btn primary" onClick={cloud.importGuest}>Thêm tiến độ có sẵn vào hàng chờ</button></div>}
      <div className="flex gap-3 flex-wrap mt-5"><button className="btn outline" onClick={cloud.refresh} disabled={cloud.status==='syncing'||cloud.status==='loading'}><RefreshCw size={16}/>Đồng bộ ngay</button><button className="btn outline" disabled={busy} onClick={logout}><LogOut size={16}/>Đăng xuất</button></div>
    </>:<><p>Đăng nhập cùng tài khoản trên các thiết bị để tiếp tục hành trình học của bạn.</p><form className="auth-form" onSubmit={submit}>
      {!cloud.recovery&&<><label htmlFor="account-email" className="field-label">Email</label><input id="account-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></>}
      {(mode!=='reset'||cloud.recovery)&&<><label htmlFor="account-password" className="field-label">{cloud.recovery?'Mật khẩu mới':'Mật khẩu'}</label><input id="account-password" type="password" minLength={mode==='signup'||cloud.recovery?8:1} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='signup'||cloud.recovery?'new-password':'current-password'} required/></>}
      <button className="btn primary w-full mt-5" disabled={busy}><LogIn size={17}/>{busy?'Đang xử lý…':cloud.recovery?'Lưu mật khẩu mới':mode==='signup'?'Tạo tài khoản':mode==='reset'?'Gửi liên kết đặt lại':'Đăng nhập'}</button>
    </form>{!cloud.recovery&&<div className="auth-mode-links"><button className="text-button" onClick={()=>{setMode(mode==='signup'?'login':'signup');setMessage('');}}>{mode==='signup'?'Đã có tài khoản? Đăng nhập':'Chưa có tài khoản? Đăng ký'}</button><button className="text-button" onClick={()=>{setMode(mode==='reset'?'login':'reset');setMessage('');}}>{mode==='reset'?'Về đăng nhập':'Quên mật khẩu?'}</button></div>}</>}
    {cloud.recovery&&!cloud.user&&<button className="text-button mt-4" onClick={()=>cloud.setRecovery(false)}>Về đăng nhập</button>}{cloud.error&&!cloud.user&&<p className="notice mt-4" role="status">{cloud.error}</p>}{message&&<p className="notice mt-4" role="status">{message}</p>}
  </section>;
}
