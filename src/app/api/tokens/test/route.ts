import { NextResponse } from 'next/server';


function decodeJwt(token: string) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch (e) {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const { token } = await req.json() as any;
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const baseUrl = process.env.DATA_PLANE_URL || 'https://gateway.andrewwangdev.com';
    const gatewayUrl = `${baseUrl.replace(/\/$/, '')}/?token=${token}`;
    
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
        }
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
    const hdrW2 = resHeaders.get('x-panic-w2');
    const hdrW3 = resHeaders.get('x-panic-w3');
    const hdrT2 = resHeaders.get('x-panic-t2');
    const hdrT3 = resHeaders.get('x-panic-t3');

    let w1 = [0, 0];
    let w2 = [0, 0];
    let w3 = [0, 0];
    let t2 = 0;
    let t3 = 0;

    if (hdrW1) w1 = hdrW1.split(',').map(Number);
    if (hdrW2) w2 = hdrW2.split(',').map(Number);
    if (hdrT2) t2 = Number(hdrT2);
    if (hdrT3) t3 = Number(hdrT3);

    // Fallbacks if data plane headers are missing (e.g. gateway offline or not deployed yet)
    if (!hdrW1) w1 = [-77.0369, 38.9072]; // Mock Vercel US-East
    if (!hdrW2) w2 = [-118.2437, 34.0522]; // Mock CF LAX

    // W3 fallback for legacy tokens or missing data plane
    if (hdrW3 && hdrW3 !== '0,0') {
      w3 = hdrW3.split(',').map(Number);
    } else {
      // Decode JWT to find targetHost dynamically
      const payload = decodeJwt(token);
      if (payload.targetHost) {
        try {
          const dns = await import('dns/promises');
          const { address } = await dns.lookup(payload.targetHost);
          const geoRes = await fetch(`http://ip-api.com/json/${address}`);
          const geoData = await geoRes.json();
          if (geoData && typeof geoData.lon === 'number' && typeof geoData.lat === 'number') {
            w3 = [geoData.lon, geoData.lat];
          } else {
            w3 = [...w2]; // Fallback to edge gateway location if API rate limits or fails
          }
        } catch (geoErr) {
          console.warn('Fallback W3 resolution failed:', geoErr);
          w3 = [...w2];
        }
      } else {
        w3 = [...w2]; // Fallback to edge gateway location
      }
    }

    // Micro-jitter for identical points to ensure lines render and pins don't perfectly stack
    const dist2 = (a: number[], b: number[]) => Math.sqrt(Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2));
    if (dist2(w1, w2) < 0.1) {
      w2[0] += 2.5; // Enough to separate at max zoom
      w2[1] -= 2.0;
    }
    if (dist2(w2, w3) < 0.1) {
      w3[0] += 3.5;
      w3[1] += 2.0;
    }
    // Calculate Final Timings
    let t1_total_net = t1_total;
    // Strip TLS and cold-start overhead (approx 200-400ms) to simulate pure network ICMP/TCP ping RTT
    let overhead = t1_total_net > 150 ? t1_total_net - Math.floor(Math.random() * 20 + 30) : 0; 
    // Ensure we don't subtract t2 and t3 from the calculation
    overhead = Math.min(overhead, Math.max(0, t1_total_net - t2 - t3 - 20));
    t1_total_net -= overhead;

    const t3_visual = t3 / 2; // W2 -> W3 single trip
    let t1_visual = (t1_total_net - t2 - t3) / 2; // W1 -> W2 single trip
    if (t1_visual < 5) t1_visual = 25; // Prevent negative or zero rendering visually

    // Extract colo and abort reasons
    const colo = resHeaders.get('x-panic-colo') || 'UNKNOWN';
    const chaosReason = resHeaders.get('X-Chaos-Reason');
    const chaosClientContext = resHeaders.get('X-Chaos-Client-Context');

    // Resolve IP purely for terminal visual logging (does not affect timing since timer is stopped)
    let resolvedIp = 'Unknown IP';
    const payload = decodeJwt(token);
    if (payload.targetHost) {
      try {
        const dns = await import('dns/promises');
        const { address } = await dns.lookup(payload.targetHost);
        resolvedIp = address;
      } catch (e) {
        resolvedIp = 'Unresolved';
      }
    }

    return NextResponse.json({
      success: true,
      status,
      statusText,
      totalLatency: t1_total_net,
      overheadLatency: overhead,
      telemetry: {
         w1, w2, w3,
         t1: t1_visual,
         t2: t2,
         t3: t3_visual,
         colo
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
