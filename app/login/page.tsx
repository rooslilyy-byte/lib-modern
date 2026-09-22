'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, KeyRound, AlertCircle, ArrowLeft, Loader2, BookOpen } from 'lucide-react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.message || 'رمز الدخول غير صحيح، يرجى التأكد وإعادة المحاولة');
      }
    } catch (err) {
      setError('حدث خطأ بالاتصال، يرجى إعادة المحاولة.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] flex flex-col items-center justify-center p-4 font-cairo dir-rtl selection:bg-neutral-900 selection:text-white relative overflow-hidden">

      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative z-10 space-y-6">

        {/* Bookstore Branding */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-center shadow-xs">
            <img src="/logo-lib-modern-alt.jpg" alt="Lib Moderne - المكتبة العصرية" className="h-full w-auto object-contain mx-auto" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              المكتبة العصرية
            </h1>
            <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mt-0.5">
              Lib Moderne POS
            </p>
            <p className="text-xs text-neutral-500 font-medium mt-1">
              نظام متابعة وتوزيع خصاصات الدخول المدرسي
            </p>
          </div>
        </div>

        {/* Auth Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-3.5 rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Passcode Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-orange-500" />
              <span>رمز الدخول السري (Passcode):</span>
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-neutral-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="أدخل الرمز السري هنا..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-neutral-50/80 border border-neutral-200/80 rounded-2xl pr-11 pl-11 py-3 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-mono tracking-wider transition-all min-h-[48px] shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors min-h-[48px] min-w-[44px]"
                title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !passcode.trim()}
            className="w-full bg-neutral-900 hover:bg-black text-white text-sm font-extrabold py-3.5 px-6 rounded-full transition-all duration-300 shadow-md hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                <span>جاري التحقق من الرمز...</span>
              </>
            ) : (
              <>
                <span>تسجيل الدخول للنظام</span>
                <ArrowLeft className="w-4 h-4 text-orange-500" />
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="pt-2 border-t border-neutral-100 text-[11px] text-neutral-400 text-center font-medium">
          حماية خاصة بطاقم عمل المكتبة العصرية (Lib Moderne) • الجلسة ممتدة 30 يوماً
        </div>

      </div>
    </div>
  );
}
