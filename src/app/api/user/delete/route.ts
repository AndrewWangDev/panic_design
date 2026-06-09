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

    const response = NextResponse.json({ success: true });
    
    // Explicitly wipe NextAuth cookies. Client-side signOut on Cloudflare Edge can sometimes fail.
    response.cookies.delete('authjs.session-token');
    response.cookies.delete('__Secure-authjs.session-token');
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('authjs.csrf-token');
    response.cookies.delete('__Host-authjs.csrf-token');

    return response;
  } catch (err) {
    console.error('Delete account error:', err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
