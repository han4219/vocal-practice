import { useEffect, useState, useCallback, useRef } from 'react';
export function useSpeech(settings) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(null);
  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => { window.speechSynthesis.removeEventListener('voiceschanged', load); clearTimeout(pending.current); window.speechSynthesis.cancel(); };
  }, [supported]);
  const speak = useCallback((text) => {
    if (!supported) { setError('Trình duyệt này chưa hỗ trợ đọc giọng nói. Bạn vẫn có thể học với IPA.'); return; }
    clearTimeout(pending.current);
    window.speechSynthesis.cancel(); setError('');
    // Safari/Chrome can cancel a new utterance if started in the same tick as cancel().
    pending.current = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text.replace(/[()]/g, ''));
      utterance.lang = settings.accent; utterance.rate = settings.rate;
      utterance.voice = voices.find(v => v.lang === settings.accent) || voices.find(v => v.lang.startsWith('en')) || null;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = e => { setSpeaking(false); if (e.error !== 'interrupted' && e.error !== 'canceled') setError('Không phát được giọng đọc. Hãy kiểm tra giọng tiếng Anh trên thiết bị và thử lại.'); };
      window.speechSynthesis.speak(utterance);
    }, 60);
  }, [supported, settings.accent, settings.rate, voices]);
  return { speak, supported, speaking, error };
}
