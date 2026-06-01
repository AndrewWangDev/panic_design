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

    // 1. Get active tokens count
    const activeTokens = await prisma.token.count({
      where: {
        userId: session.user.id,
        isRevoked: false
      }
    });

    // 2. Get current month usage
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const usage = await prisma.usage.findUnique({
      where: {
        userId_month: {
          userId: session.user.id,
          month: monthStr
        }
      }
    });

    return NextResponse.json({
      tokens: activeTokens,
      usage: usage?.requestCount || 0,
      limit: usage?.limit || 10000
    });
  } catch (error) {
    console.error('Fetch Stats Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
