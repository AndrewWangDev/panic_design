import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { SignJWT } from 'jose';

import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as any;
    const { targetHost, fault, latency, jitter, distribution, customTtl } = body;

    if (!targetHost || !fault) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Default TTL is 15 minutes if not specified
    const ttlHours = customTtl || 0.25; 

    const prisma = getPrisma();

    // Fetch latest user salt just in case (optional, we could use session salt but db is safer)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { jwtSalt: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prepare Token config JSON
    const config = JSON.stringify({
      fault,
      latency,
      jitter,
      distribution,
      ttlHours
    });

    // Create DB entry first to get the Token ID
    const token = await prisma.token.create({
      data: {
        userId: session.user.id,
        targetHost,
        config,
        tokenHint: '', // Will update later after signing
        issuedWithSalt: user.jwtSalt
      }
    });

    // Generate JWT
    // Generate JWT
    const { env } = getCloudflareContext();
    const authSecret = (env as any)?.AUTH_SECRET || process.env.AUTH_SECRET;

    if (!authSecret) {
      console.error('Missing AUTH_SECRET in environment');
      return NextResponse.json({ error: 'Server misconfiguration: missing AUTH_SECRET' }, { status: 500 });
    }

    const secret = new TextEncoder().encode(authSecret);
    
    // Convert ttlHours to seconds string for expiration
    const expSeconds = Math.floor(ttlHours * 3600);

    // Resolve W3 (Target Host) coordinates
    let w3: [number, number] | undefined = undefined;
    try {
      // Use dns module to get IP address
      const dns = await import('dns/promises');
      const { address } = await dns.lookup(targetHost);
      
      // Get geo coordinates
      const geoRes = await fetch(`https://ipapi.co/${address}/json/`);
      const geoData = await geoRes.json();
      if (geoData && typeof geoData.longitude === 'number' && typeof geoData.latitude === 'number') {
        w3 = [geoData.longitude, geoData.latitude];
      }
    } catch (geoErr) {
      console.warn('Failed to resolve W3 coordinates:', geoErr);
      // Proceed without w3, backend will handle fallback
    }

    const jwt = await new SignJWT({
      tokenId: token.id,
      targetHost,
      fault,
      latency,
      jitter,
      distribution,
      userId: session.user.id,
      w3
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${expSeconds}s`)
      .sign(secret);

    // Update token hint
    const tokenHint = `eyJhbGci...${jwt.slice(-4)}`;
    await prisma.token.update({
      where: { id: token.id },
      data: { tokenHint }
    });

    return NextResponse.json({
      success: true,
      jwt,
      token: {
        ...token,
        tokenHint
      }
    });
  } catch (error) {
    console.error('Create Token Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
