import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { passcode } = await request.json();
    const adminSecret = process.env.ADMIN_SECRET_CODE;

    // Strictly enforce ADMIN_SECRET_CODE environment variable
    if (!adminSecret || !adminSecret.trim()) {
      return NextResponse.json(
        { success: false, message: 'رمز الدخول السري غير مهيأ في إعدادات الخادم (ADMIN_SECRET_CODE غير معرف)' },
        { status: 500 }
      );
    }

    if (passcode && passcode.trim() === adminSecret.trim()) {
      const response = NextResponse.json({ success: true });

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
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً' },
      { status: 500 }
    );
  }
}
