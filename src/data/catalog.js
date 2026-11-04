import vocabularyUrl from './vocabulary.json?url';
export let vocabulary = [];
export let courses = [];
let pending;
export function loadCatalog() {
  if (!pending) pending = fetch(vocabularyUrl).then(r => { if (!r.ok) throw new Error('Không tải được bộ từ vựng.'); return r.json(); }).then(data => {
    vocabulary = data;
    courses = Object.entries(names).map(([id, [title, subtitle, category, color, icon]]) => ({ id, title, subtitle, category, color, icon, words: vocabulary.filter(w => w.courses.includes(id)) }));
  }).catch(error => { pending = null; throw error; });
  return pending;
}
import metadata from './metadata.json';
export { metadata };
const names = {
  'A1.01G': ['Ngữ pháp khởi đầu', 'Những viên gạch đầu tiên', 'grammar', 'peach', 'BookOpen'],
  'A2.02G': ['Ngữ pháp nền tảng', 'Hiểu đúng, dùng tự tin', 'grammar', 'sage', 'Layers'],
  'A3.03G': ['Ngữ pháp mở rộng', 'Nâng tầm cách diễn đạt', 'grammar', 'lavender', 'Sparkles'],
  'A4.04G': ['Ngữ pháp chuyên sâu', 'Làm chủ những cấu trúc khó', 'grammar', 'blue', 'GraduationCap'],
  'B1.01': ['Lắng nghe từ đầu', 'Làm quen với tiếng Anh mỗi ngày', 'beginner', 'sage', 'Headphones'],
  'B1.02': ['Đọc hiểu cơ bản', 'Khám phá thế giới qua câu chữ', 'beginner', 'peach', 'BookOpen'],
  'B2.03': ['Lắng nghe tự tin', 'Bắt nhịp những cuộc hội thoại', 'intermediate', 'blue', 'Headphones'],
  'B2.04': ['Đọc hiểu mở rộng', 'Thêm góc nhìn, thêm vốn từ', 'intermediate', 'lavender', 'BookOpen'],
  'B2.05': ['Viết điều bạn nghĩ', 'Diễn đạt ý tưởng thật rõ ràng', 'intermediate', 'peach', 'PenLine'],
  'B2.06': ['Nói thật tự nhiên', 'Để mỗi cuộc trò chuyện dễ hơn', 'intermediate', 'sage', 'MessagesSquare'],
  'B3.07': ['Luyện nghe chuyên sâu', 'Thử thách đôi tai của bạn', 'advanced', 'blue', 'Headphones'],
  'B3.08': ['Đọc hiểu chuyên sâu', 'Chinh phục những chủ đề mới', 'advanced', 'lavender', 'BookOpen'],
  'B3.09': ['Viết chuyên sâu', 'Chọn từ chính xác và tinh tế', 'advanced', 'peach', 'PenLine'],
  'B3.10': ['Giao tiếp chuyên sâu', 'Tự tin nói điều mình muốn', 'advanced', 'sage', 'MessagesSquare'],
  'everyday': ['Nhịp sống mỗi ngày', '25 cụm từ nhỏ, dùng được ngay', 'everyday', 'sage', 'Sprout'],
};
export const categories = [{ id: 'all', label: 'Tất cả' }, { id: 'beginner', label: 'Cơ bản' }, { id: 'intermediate', label: 'Trung cấp' }, { id: 'advanced', label: 'Nâng cao' }, { id: 'grammar', label: 'Ngữ pháp' }, { id: 'everyday', label: 'Mở rộng' }];
export const formatNumber = n => n.toLocaleString('vi-VN');
