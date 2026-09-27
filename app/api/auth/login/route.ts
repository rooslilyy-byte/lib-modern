import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();

    if (!passcode || typeof passcode !== 'string' || !passcode.trim()) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال رمز الدخول السري' },
        { status: 400 }
      );
    }

    let expectedPassword: string | null = null;

    // 1. Attempt to fetch admin password dynamically from Supabase public.app_settings
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password')
        .maybeSingle();

      if (!error && data && typeof data.value === 'string' && data.value.trim().length > 0) {
        expectedPassword = data.value.trim();
      }
    } catch (dbError) {
      console.warn('Database lookup for admin_password failed, using fallback:', dbError);
    }

    // 2. Fallback to ADMIN_SECRET_CODE environment variable if database lookup yielded nothing
    if (!expectedPassword) {
      const adminSecret = process.env.ADMIN_SECRET_CODE;
      if (adminSecret && adminSecret.trim().length > 0) {
        expectedPassword = adminSecret.trim();
      }
    }

    // If no password is configured in database or environment variable
    if (!expectedPassword) {
      return NextResponse.json(
        { success: false, message: 'رمز الدخول السري غير مهيأ في إعدادات النظام أو الخادم' },
        { status: 500 }
      );
    }

    // 3. Verify submitted passcode
    if (passcode.trim() === expectedPassword) {
      const response = NextResponse.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
      });

      // Set HTTP-only authentication session cookie strictly valid for 24 hours (86400 seconds)
      const SESSION_EXPIRATION_SECONDS = 24 * 60 * 60; // 86,400 seconds = 24 hours

      response.cookies.set('session_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_EXPIRATION_SECONDS,
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { success: false, message: 'رمز الدخول غير صحيح، يرجى التأكد وإعادة المحاولة' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login route error:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً' },
      { status: 500 }
    );
  }
}

