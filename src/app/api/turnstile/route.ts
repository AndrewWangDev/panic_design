import { NextResponse } from 'next/server';
import { verifyTurnstileToken } from '@/lib/turnstile';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });

    const isValid = await verifyTurnstileToken(token);
    if (!isValid) return NextResponse.json({ success: false, error: 'Invalid turnstile token' }, { status: 403 });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
