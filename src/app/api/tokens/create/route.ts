import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { checkAndUpdateQuota } from '@/lib/quota';
import { SignJWT } from 'jose';
import { isPrivateIp } from '@/lib/security';

import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as any;
    const { targetHost, scope, fault, latency, jitter, distribution, packetLoss, mutilationStrategy, customTtl, turnstileToken } = body;

    if (!targetHost || !fault) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Turnstile Check
    if (process.env.NODE_ENV !== 'development' && !turnstileToken) {
      return NextResponse.json({ error: 'Security verification missing' }, { status: 403 });
    }
    if (turnstileToken) {
      const { verifyTurnstileToken } = await import('@/lib/turnstile');
      const isValid = await verifyTurnstileToken(turnstileToken);
      if (!isValid) return NextResponse.json({ error: 'Security verification failed' }, { status: 403 });
    }

    // Check Quota Limit
    const quota = await checkAndUpdateQuota(session.user.id);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: quota.reason }, { status: 429 });
    }

    const prisma = getPrisma();

    // Check concurrent active tokens
    const unrevokedTokens = await prisma.token.findMany({
      where: {
        userId: session.user.id,
        isRevoked: false
      },
      select: {
        createdAt: true,
        config: true
      }
    });

    let activeCount = 0;
    const nowMs = Date.now();
    for (const t of unrevokedTokens) {
      try {
        const conf = JSON.parse(t.config);
        const ttlHours = conf.ttlHours || conf.ttl || 0.25;
        const expiresAtMs = new Date(t.createdAt).getTime() + (ttlHours * 60 * 60 * 1000);
        if (expiresAtMs > nowMs) {
          activeCount++;
        }
      } catch(e) {
        activeCount++;
      }
    }

    if (activeCount >= 5) {
      return NextResponse.json({ error: 'CONCURRENT_CAP_EXCEEDED' }, { status: 403 });
    }

    // Fetch latest user salt
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { jwtSalt: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Default TTL is 15 minutes if not specified
    const ttlHours = customTtl || 0.25;

    // Prepare Token config JSON
    const config = JSON.stringify({
      fault,
      scope,
      latency,
      jitter,
      distribution,
      packetLoss,
      mutilationStrategy,
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

    // Resolve W3 (Target Host) coordinates using Edge-compatible fetch
    let w3: [number, number] | undefined = undefined;
    try {
      const dnsRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${targetHost}&type=A`, {
        headers: { 'accept': 'application/dns-json' }
      });
      const dnsData = await dnsRes.json() as any;
      
      let address = '';
      if (dnsData.Status === 0 && dnsData.Answer && dnsData.Answer.length > 0) {
        address = dnsData.Answer.find((a: any) => a.type === 1)?.data || dnsData.Answer[0].data;
      }
      
      if (address && !isPrivateIp(address)) {
        // Get geo coordinates
        const geoRes = await fetch(`https://ipapi.co/${address}/json/`);
        const geoData = await geoRes.json() as any;
        if (geoData && typeof geoData.longitude === 'number' && typeof geoData.latitude === 'number') {
          w3 = [geoData.longitude, geoData.latitude];
        }
      }
    } catch (geoErr) {
      console.warn('Failed to resolve W3 coordinates:', geoErr);
      // Proceed without w3, backend will handle fallback
    }

    const jwt = await new SignJWT({
      tokenId: token.id,
      targetHost,
      scope,
      fault,
      latency,
      jitter,
      distribution,
      packetLoss,
      mutilationStrategy,
      userId: session.user.id,
      jwtSalt: user.jwtSalt,
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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
