import { StatusType } from '../engine/types';

/** Tên, mô tả và màu của trạng thái để hiển thị cho người chơi. */
export const STATUS_INFO: Record<StatusType, { name: string; desc: (value?: number) => string; buff: boolean; icon: string }> = {
  atkUp: { name: 'Tăng công', desc: () => 'Công +50%', buff: true, icon: 'C▲' },
  defUp: { name: 'Tăng thủ', desc: () => 'Thủ +60%', buff: true, icon: 'T▲' },
  spdUp: { name: 'Tăng tốc', desc: () => 'Tốc độ +30%, thanh hành động nạp nhanh hơn', buff: true, icon: 'S▲' },
  shield: { name: 'Khiên', desc: (v) => `Chặn ${v?.toLocaleString('vi-VN') ?? ''} sát thương trước khi mất máu`, buff: true, icon: '盾' },
  atkDown: { name: 'Giảm công', desc: () => 'Công −50%', buff: false, icon: 'C▼' },
  defDown: { name: 'Giảm thủ', desc: () => 'Thủ −70%, nhận nhiều sát thương hơn', buff: false, icon: 'T▼' },
  spdDown: { name: 'Giảm tốc', desc: () => 'Tốc độ −30%', buff: false, icon: 'S▼' },
  stun: { name: 'Choáng', desc: () => 'Mất lượt kế tiếp', buff: false, icon: '✦' },
  burn: { name: 'Bỏng', desc: (v) => `Mất ${v?.toLocaleString('vi-VN') ?? ''} máu đầu mỗi lượt (bỏ qua thủ)`, buff: false, icon: '火' },
};
