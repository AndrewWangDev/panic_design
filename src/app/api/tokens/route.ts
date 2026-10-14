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
    
    const dbTokens = await prisma.token.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const now = Date.now();

    const tokens = dbTokens.map(t => {
      let isExpired = false;
      try {
        const config = JSON.parse(t.config);
        const ttlHours = parseFloat(config.ttlHours) || 0.25;
        const expiresAt = t.createdAt.getTime() + ttlHours * 60 * 60 * 1000;
        isExpired = expiresAt <= now;
      } catch {
        // ignore JSON parse error
      }

      const status = t.isRevoked ? 'revoked' : (isExpired ? 'expired' : 'active');

      return {
        ...t,
        isExpired,
        status
      };
    });

    return NextResponse.json({ tokens });
  } catch (error) {
    console.error('Fetch Tokens Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
