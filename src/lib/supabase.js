import { createClient } from '@supabase/supabase-js';
export const recoveryRequested = typeof window !== 'undefined' && new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = !!url && !!key;
export const supabase = cloudConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function authError(error) {
  const messages = {
    invalid_credentials: 'Email hoặc mật khẩu chưa đúng.',
    email_not_confirmed: 'Bạn cần xác nhận email trước khi đăng nhập.',
    user_already_exists: 'Email này đã có tài khoản. Hãy đăng nhập.',
    over_email_send_rate_limit: 'Đã đạt giới hạn gửi email. Vui lòng chờ rồi thử lại.',
    weak_password: 'Mật khẩu cần ít nhất 8 ký tự và đủ mạnh.',
  };
  return messages[error?.code] || error?.message || 'Chưa kết nối được. Vui lòng thử lại.';
}
