import vocabularyUrl from './vocabulary.json?url';
import groupsUrl from './course-groups.json?url';
import { hydrateCatalog } from '../lib/catalog';
import { supabase } from '../lib/supabase';
import metadata from './metadata.json';
export { metadata };
export let vocabulary = [];
export let courses = [];
export let catalogSource = 'bundled';
export let catalogNotice = '';
let pending;
async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Không tải được bộ từ vựng.');
  return response.json();
}
export function loadCatalog() {
  if (!pending) pending = (async () => {
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('voca_get_catalog').abortSignal(AbortSignal.timeout(15000));
        if (error) throw error;
        ({ vocabulary, courses } = hydrateCatalog(data.words, data));
        catalogSource = 'database';
        return;
      } catch {
        catalogNotice = 'Đang dùng bản bộ từ đã lưu cùng website. Kiểm tra kết nối để tải bản mới nhất.';
      }
    }
    const [words, manifest] = await Promise.all([readJson(vocabularyUrl), readJson(groupsUrl)]);
    ({ vocabulary, courses } = hydrateCatalog(words, manifest));
    catalogSource = 'bundled';
  })().catch(error => { pending = null; throw error; });
  return pending;
}
export const categories = [{ id: 'all', label: 'Tất cả' }, { id: 'beginner', label: 'Cơ bản' }, { id: 'intermediate', label: 'Trung cấp' }, { id: 'advanced', label: 'Nâng cao' }, { id: 'grammar', label: 'Ngữ pháp' }, { id: 'everyday', label: 'Mở rộng' }];
export const formatNumber = n => n.toLocaleString('vi-VN');
