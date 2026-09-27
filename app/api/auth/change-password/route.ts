import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // 1. Check session authentication cookie
    const sessionCookie = request.cookies.get('session_auth')?.value;
    if (sessionCookie !== 'authenticated') {
      return NextResponse.json(
        { success: false, message: 'غير مصرح لك بالقيام بهذه العملية (جلسة الدخول منتهية)' },
        { status: 401 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || typeof currentPassword !== 'string' || !currentPassword.trim()) {
      return NextResponse.json(
        { success: false, message: 'يرجى إدخال الرمز السري الحالي' },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return NextResponse.json(
        { success: false, message: 'يجب أن يتكون الرمز السري الجديد من 4 خانات على الأقل' },
        { status: 400 }
      );
    }

    // 2. Fetch current password from DB or env fallback to verify authorization
    let activePassword: string | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password')
        .maybeSingle();

      if (!error && data && typeof data.value === 'string' && data.value.trim().length > 0) {
        activePassword = data.value.trim();
      }
    } catch (dbError) {
      console.warn('Database query for active password verification failed:', dbError);
    }

    if (!activePassword) {
      const envSecret = process.env.ADMIN_SECRET_CODE;
      if (envSecret && envSecret.trim().length > 0) {
        activePassword = envSecret.trim();
      }
    }

    if (activePassword && currentPassword.trim() !== activePassword) {
      return NextResponse.json(
        { success: false, message: 'الرمز السري الحالي غير صحيح، يرجى التأكد وإعادة المحاولة' },
        { status: 400 }
      );
    }

    // 3. Upsert new password in public.app_settings
    const nowIso = new Date().toISOString();
    const { error: upsertError } = await supabaseAdmin
      .from('app_settings')
      .upsert(
        {
          key: 'admin_password',
          value: newPassword.trim(),
          updated_at: nowIso,
        },
        { onConflict: 'key' }
      );

    if (upsertError) {
      console.error('Error saving new password in public.app_settings:', upsertError);
      return NextResponse.json(
        { success: false, message: `فشل حفظ الرمز السري في قاعدة البيانات: ${upsertError.message}` },
        { status: 500 }
      );
    }

    // 4. Return success response and refresh/maintain the 24-hour authentication session cookie
    const response = NextResponse.json({
      success: true,
      message: 'تم تغيير الرمز السري بنجاح',
    });

    const SESSION_EXPIRATION_SECONDS = 24 * 60 * 60;
    response.cookies.set('session_auth', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRATION_SECONDS,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Change password route error:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم أثناء محاولة تحديث الرمز السري' },
      { status: 500 }
    );
  }
}
