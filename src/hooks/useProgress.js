import { useState, useEffect, useCallback } from 'react';
import { defaultState, validateState, STORAGE_KEY, recordReview } from '../lib/learning';

export function useProgress(vocabulary) {
  const [initial] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return { state: saved ? validateState(JSON.parse(saved), new Set(vocabulary.map(v => v.id))) : defaultState(), warning: '' };
    } catch {
      return { state: defaultState(), warning: 'Không đọc được tiến độ cũ trên trình duyệt. Bạn có thể nhập lại bản sao lưu trong Tùy chỉnh.' };
    }
  });
  const [warning, setWarning] = useState(initial.warning);
  const [state, setState] = useState(initial.state);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { setWarning('Trình duyệt không cho lưu tiến độ. Hãy xuất bản sao lưu trước khi đóng trang.'); }
  }, [state]);
  const review = useCallback((id, result) => setState(prev => recordReview(prev, id, result)), []);
  const favorite = id => setState(prev => ({ ...prev, words: { ...prev.words, [id]: { ...prev.words[id], favorite: !prev.words[id]?.favorite } } }));
  const settings = next => setState(prev => ({ ...prev, settings: { ...prev.settings, ...next } }));
  return { state, setState, warning, review, favorite, settings };
}
