import { auth } from "@/auth";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const userId = session.user.id;
    const prisma = getPrisma();
    
    const fakeHash = crypto.randomUUID();
    
    // Unbind Github, scramble data, and increment jwtSalt for global revocation
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubId: null,
        username: 'Deleted User',
        email: `deleted_${fakeHash}@panic.design`,
        avatarUrl: null,
        jwtSalt: { increment: 1 }
      }
    });

    // Revoke all active tokens in DB for completeness
    await prisma.token.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
