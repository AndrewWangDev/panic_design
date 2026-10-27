import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isPrivateIp } from '@/lib/security';
import { jwtVerify } from 'jose';
import { getCloudflareContext } from '@opennextjs/cloudflare';

async function resolveHostIp(hostname: string): Promise<string | null> {
  try {
    const dnsRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { 'accept': 'application/dns-json' },
      signal: AbortSignal.timeout(3000)
    });
    const dnsData = await dnsRes.json() as { Status?: number; Answer?: Array<{ type: number; data: string }> };
    if (dnsData.Status === 0 && dnsData.Answer && dnsData.Answer.length > 0) {
      return dnsData.Answer.find(a => a.type === 1)?.data || dnsData.Answer[0].data;
    }
  } catch (err) {
    console.warn('DoH resolution error:', err);
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await req.json() as any;
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Cryptographic JWT verification using AUTH_SECRET
    const { env } = getCloudflareContext();
    const authSecret = (env as any)?.AUTH_SECRET || process.env.AUTH_SECRET;
    if (!authSecret) {
      return NextResponse.json({ error: 'Server misconfiguration: missing AUTH_SECRET' }, { status: 500 });
    }

    let payload: any;
    try {
      const secret = new TextEncoder().encode(authSecret);
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch {
      return NextResponse.json({
        error: 'INVALID_TOKEN',
        message: 'Chaos Token signature is invalid or expired.'
      }, { status: 400 });
    }

    // Verify token ownership
    if (payload.userId !== session.user.id) {
      return NextResponse.json({
        error: 'FORBIDDEN',
        message: 'Token does not belong to current authenticated session.'
      }, { status: 403 });
    }

    // Check rate limiting quota
    const { checkAndUpdateQuota } = await import('@/lib/quota');
    const quota = await checkAndUpdateQuota(session.user.id);
    if (!quota.allowed) {
      return NextResponse.json({ error: 'QUOTA_EXCEEDED', message: quota.reason }, { status: 429 });
    }

    const baseUrl = process.env.DATA_PLANE_URL || 'https://gateway.andrewwangdev.com';
    const gatewayUrl = `${baseUrl.replace(/\/$/, '')}/?token=${encodeURIComponent(token)}`;
    
    const startTime = Date.now();
    let status = 0;
    let statusText = '';
    let responseBody = '';
    let resHeaders: Headers = new Headers();
    
    try {
      const res = await fetch(gatewayUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*'
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(10000)
      });
      status = res.status;
      statusText = res.statusText;
      responseBody = await res.text();
      resHeaders = res.headers;
    } catch (e: any) {
      status = 503;
      statusText = 'Service Unavailable (Data Plane offline)';
      responseBody = e.message;
    }
    
    const t1_total = Date.now() - startTime;

    // Extract headers
    const hdrW1 = resHeaders.get('x-panic-w1');
    const hdrW3 = resHeaders.get('x-panic-w3');
    const hdrT2 = resHeaders.get('x-panic-t2');
    const hdrT3 = resHeaders.get('x-panic-t3');

    let w1 = [0, 0];
    let w3 = [0, 0];
    let t2 = 0;
    let t3 = 0;

    if (hdrW1) w1 = hdrW1.split(',').map(Number);
    if (hdrT2) t2 = Number(hdrT2);
    if (hdrT3) t3 = Number(hdrT3);

    // Fallbacks if data plane headers are missing
    if (!hdrW1) w1 = [-118.2437, 34.0522]; // Mock CF LAX

    // W3 fallback for missing data plane headers
    if (hdrW3 && hdrW3 !== '0,0') {
      w3 = hdrW3.split(',').map(Number);
    } else if (payload.w3 && Array.isArray(payload.w3) && payload.w3.length === 2) {
      w3 = payload.w3;
    } else if (payload.targetHost) {
      try {
        const address = await resolveHostIp(payload.targetHost);
        if (address && !isPrivateIp(address)) {
          const geoRes = await fetch(`https://ipapi.co/${address}/json/`, {
            signal: AbortSignal.timeout(3000)
          });
          const geoData = await geoRes.json() as { longitude?: number; latitude?: number };
          if (geoData && typeof geoData.longitude === 'number' && typeof geoData.latitude === 'number') {
            w3 = [geoData.longitude, geoData.latitude];
          } else {
            w3 = [0, 0];
          }
        } else {
          w3 = [0, 0];
        }
      } catch (geoErr) {
        console.warn('Fallback W3 resolution failed:', geoErr);
        w3 = [0, 0];
      }
    } else {
      w3 = [0, 0];
    }

    // Calculate Final Timings
    const t1_total_net = t1_total;
    
    // Calculate one-way trips for visual map scaling
    const t3_visual = t3 / 2; // W2 -> W3 single trip
    let t1_visual = (t1_total_net - t2 - t3) / 2; // W1 -> W2 single trip
    if (t1_visual < 5) t1_visual = 5; // Prevent negative rendering visually

    // Extract colo and abort reasons
    const colo = resHeaders.get('x-panic-colo') || 'UNKNOWN';
    const chaosReason = resHeaders.get('X-Chaos-Reason');
    const chaosClientContext = resHeaders.get('X-Chaos-Client-Context');

    // Resolve IP purely for terminal visual logging
    let resolvedIp = 'Unknown IP';
    if (payload.targetHost) {
      try {
        const address = await resolveHostIp(payload.targetHost);
        resolvedIp = address || 'Unresolved';
      } catch {
        resolvedIp = 'Unresolved';
      }
    }

    // In this CF-to-CF architecture, request.cf is passed through so W1 and W2 share the same physical colo.
    const w1_colo = colo;
    
    return NextResponse.json({
      success: true,
      status,
      statusText,
      totalLatency: t1_total_net,
      telemetry: {
         w1, w3,
         t1: t1_visual,
         t2: t2,
         t3: t3_visual,
         colo,
         w1_colo
      },
      chaosReason,
      chaosClientContext,
      resolvedIp,
      responseBody
    });

  } catch (err) {
    console.error('Test injection error:', err);
    return NextResponse.json({ error: 'Failed to run injection test' }, { status: 500 });
  }
}
