import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = getPrisma();
    
    let tokens = await prisma.token.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    const expiredIds: string[] = [];

    tokens.forEach(t => {
      if (t.isRevoked) return;
      try {
        const config = JSON.parse(t.config);
        const ttlHours = parseInt(config.ttl) || 0;
        const expiresAt = new Date(t.createdAt.getTime() + ttlHours * 60 * 60 * 1000);
        if (expiresAt <= now) {
          expiredIds.push(t.id);
        }
      } catch (e) {
        // ignore
      }
    });

    if (expiredIds.length > 0) {
      await prisma.token.updateMany({
        where: { id: { in: expiredIds } },
        data: { isRevoked: true }
      });
      tokens = tokens.map(t => expiredIds.includes(t.id) ? { ...t, isRevoked: true } : t);
    }

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Fetch Tokens Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
