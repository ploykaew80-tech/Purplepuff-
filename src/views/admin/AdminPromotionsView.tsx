import React, { useState, useRef } from 'react';
import { Tag, Plus, Edit, Trash2, Calendar, Save, X, FolderOpen, Image as ImageIcon } from 'lucide-react';
import type { Promotion, User } from '../../types';
import { uploadAdminImage } from '../../lib/api';

interface AdminPromotionsViewProps {
  promotions: Promotion[];
  currentUser: User;
  onSavePromotion: (promotion: Partial<Promotion>) => Promise<void>;
  onDeletePromotion: (promoId: string) => Promise<void>;
}

export const AdminPromotionsView: React.FC<AdminPromotionsViewProps> = ({
  promotions,
  currentUser,
  onSavePromotion,
  onDeletePromotion
}) => {
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<Promotion>>({
    title: '',
    description: '',
    image_url: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
    start_date: '2025-01-01',
    end_date: '2025-12-31',
    status: 'ACTIVE'
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setFormData(prev => ({ ...prev, image_url: base64 }));
          uploadAdminImage(base64, file.name).catch(() => {});
        } else {
          setFormData(prev => ({ ...prev, image_url: reader.result as string }));
        }
        setUploadingImage(false);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleOpenAdd = () => {
    setEditingPromo(null);
    setFormData({
      title: '',
      description: '',
      image_url: 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      status: 'ACTIVE'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({ ...promo });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;

    try {
      setSaving(true);
      await onSavePromotion(editingPromo ? { ...formData, id: editingPromo.id } : formData);
      setIsModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="admin-promotions-view" className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-display">
            PROMOTION MANAGEMENT
          </h2>
          <p className="text-xs text-purple-300/80">
            สร้างและจัดการแคมเปญโปรโมชั่น ดีลพิเศษ และแบนเนอร์
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-lg flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ ADD PROMOTION</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {promotions.map(promo => (
          <div
            key={promo.id}
            className="rounded-3xl bg-cosmic-card border border-purple-500/20 overflow-hidden shadow-xl flex flex-col justify-between"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-purple-950">
              <img
                src={promo.image_url}
                alt={promo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-md ${
                  promo.status === 'ACTIVE'
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300'
                    : 'bg-zinc-900/80 border-zinc-500 text-zinc-300'
                }`}>
                  {promo.status}
                </span>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white font-display mb-1.5">
                  {promo.title}
                </h3>
                <p className="text-xs text-purple-200/80 line-clamp-3 leading-relaxed mb-3">
                  {promo.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-purple-300/70">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>{promo.start_date || 'เริ่มแล้ว'} {promo.end_date ? `— ${promo.end_date}` : ''}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-purple-900/40 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenEdit(promo)}
                  className="px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800 text-purple-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>แก้ไข</span>
                </button>
                <button
                  onClick={() => setDeleteConfirmId(promo.id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ลบ</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-[#1d0a33] border border-rose-500/40 text-center space-y-4">
            <h3 className="text-base font-bold text-white">ยืนยันการลบโปรโมชั่น</h3>
            <p className="text-xs text-purple-300/80">
              คุณต้องการลบโปรโมชั่นนี้ใช่หรือไม่?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 rounded-xl text-xs font-semibold bg-purple-900/50 text-purple-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={async () => {
                  await onDeletePromotion(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                ลบโปรโมชั่น
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-3xl bg-[#1c0d3a] border border-purple-500/30 p-6 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/40">
              <h3 className="text-base font-bold text-white font-display">
                {editingPromo ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่นใหม่'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-purple-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">
                  หัวข้อโปรโมชั่น (Title) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-800/40 text-white text-xs sm:text-sm focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="space-y-2 p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/40">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-yellow-300" />
                    <span>รูปภาพแบนเนอร์โปรโมชั่น *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-yellow-500 hover:from-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'กำลังโหลด...' : 'เลือกรูปจากเครื่อง/อัลบั้ม'}</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 rounded-xl bg-purple-950 border border-purple-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={formData.image_url || 'https://images.unsplash.com/photo-1527661591475-527312dd65f5?auto=format&fit=crop&w=800&q=80'}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      required
                      value={formData.image_url || ''}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://... หรือ Base64 Data URL"
                      className="w-full px-3.5 py-2 rounded-xl bg-purple-950/80 border border-purple-800/40 text-white text-xs font-mono focus:border-purple-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-purple-300 block mb-1">
                    วันที่เริ่มต้น
                  </label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-800/40 text-white text-xs focus:border-purple-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-purple-300 block mb-1">
                    วันที่สิ้นสุด
                  </label>
                  <input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-purple-950/50 border border-purple-800/40 text-white text-xs focus:border-purple-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">
                  สถานะโปรโมชั่น
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/60 border border-purple-800/40 text-white text-xs sm:text-sm focus:border-purple-400 focus:outline-none cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE (เปิดใช้งาน)</option>
                  <option value="INACTIVE">INACTIVE (ปิดใช้งาน)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1">
                  รายละเอียดโปรโมชั่น
                </label>
                <textarea
                  rows={3}
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-800/40 text-white text-xs sm:text-sm focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-purple-900/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-950/50 text-purple-300 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึกโปรโมชั่น'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
