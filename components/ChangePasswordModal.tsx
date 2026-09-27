'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  KeyRound, 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setToast(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    // Frontend validations
    if (!currentPassword.trim()) {
      setToast({ message: 'يرجى إدخال الرمز السري الحالي', type: 'error' });
      return;
    }

    if (!newPassword.trim()) {
      setToast({ message: 'يرجى إدخال الرمز السري الجديد', type: 'error' });
      return;
    }

    if (newPassword.trim().length < 4) {
      setToast({ message: 'يجب أن يتكون الرمز السري الجديد من 4 خانات على الأقل', type: 'error' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setToast({ message: 'الرمز السري الجديد وتأكيده غير متطابقين', type: 'error' });
      return;
    }

    if (newPassword.trim() === currentPassword.trim()) {
      setToast({ message: 'الرمز السري الجديد مطابق للرمز الحالي، يرجى اختيار رمز مختلف', type: 'error' });
      return;
    }

    setIsLoading(true);
    setToast(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({ 
          message: data.message || 'تم تحديث الرمز السري بنجاح! جلستك لا تزال نشطة.', 
          type: 'success' 
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        if (onSuccess) {
          onSuccess();
        }

        // Auto close after brief moment on success
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        setToast({
          message: data.message || 'فشل تحديث الرمز السري، يرجى المحاولة لاحقاً',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Password change error:', err);
      setToast({
        message: 'حدث خطأ في الاتصال بالخادم، يرجى إعادة المحاولة',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, isLoading, onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-cairo dir-rtl no-print">
      {/* Modal Card */}
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-neutral-100 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
      >
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-orange-700 to-orange-800 p-4 sm:p-5 text-white flex items-center justify-between border-b border-orange-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0 shadow-inner">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="change-password-title" className="text-base sm:text-lg font-black text-white leading-tight">
                تغيير الرمز السري
              </h2>
              <p className="text-[11px] sm:text-xs text-orange-100 font-medium mt-0.5">
                تحديث رمز الدخول لنظام المكتبة العصرية
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          
          {/* Toast / Status Feedback Notification */}
          {toast && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <span>{toast.message}</span>
              </div>
            </div>
          )}

          {/* 1. Current Password Input */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-orange-700 shrink-0" />
              <span>الرمز السري الحالي:</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                autoFocus
                disabled={isLoading}
                placeholder="أدخل الرمز السري الحالي..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:border-orange-700 focus:ring-1 focus:ring-orange-700 font-mono tracking-wider transition-all min-h-[44px] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors min-h-[44px] min-w-[40px]"
                title={showCurrent ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 2. New Password Input */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-orange-700 shrink-0" />
              <span>الرمز السري الجديد:</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                disabled={isLoading}
                placeholder="أدخل الرمز السري الجديد (4 خانات فأكثر)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:border-orange-700 focus:ring-1 focus:ring-orange-700 font-mono tracking-wider transition-all min-h-[44px] disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors min-h-[44px] min-w-[40px]"
                title={showNew ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 3. Confirm New Password Input */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-700 shrink-0" />
              <span>تأكيد الرمز السري الجديد:</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                disabled={isLoading}
                placeholder="أعد إدخال الرمز السري الجديد للتأكيد..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-neutral-50 border rounded-2xl pl-11 pr-4 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-1 font-mono tracking-wider transition-all min-h-[44px] disabled:opacity-60 ${
                  confirmPassword && newPassword && confirmPassword !== newPassword
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 bg-rose-50/30'
                    : 'border-neutral-200 focus:border-orange-700 focus:ring-orange-700'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors min-h-[44px] min-w-[40px]"
                title={showConfirm ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-[11px] font-bold text-rose-600 mt-1">الرمز غير مطابق للرمز الجديد أعلاه</p>
            )}
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors min-h-[40px] disabled:opacity-50"
            >
              إلغاء
            </button>
            
            <button
              type="submit"
              disabled={
                isLoading ||
                !currentPassword.trim() ||
                !newPassword.trim() ||
                !confirmPassword.trim() ||
                newPassword !== confirmPassword
              }
              className="bg-orange-700 hover:bg-orange-800 text-white text-xs font-black px-5 py-2.5 rounded-full transition-all shadow-md shadow-orange-700/20 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 min-h-[40px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>جاري الحفظ...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>حفظ الرمز الجديد</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
