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
    
    const payload = decodeJwt(token);

    if (hdrT2) t2 = Number(hdrT2);
    if (hdrT3) t3 = Number(hdrT3);

    // Fallbacks if data plane headers are missing (e.g. gateway offline or not deployed yet)
    if (!hdrW1) w1 = [-118.2437, 34.0522]; // Mock CF LAX

    // W3 fallback for legacy tokens or missing data plane
    if (hdrW3 && hdrW3 !== '0,0') {
      w3 = hdrW3.split(',').map(Number);
    } else {
      // Decode JWT to find targetHost dynamically
      if (payload.targetHost) {
        try {
          const dns = await import('dns/promises');
          const { address } = await dns.lookup(payload.targetHost);
          const geoRes = await fetch(`http://ip-api.com/json/${address}`);
          const geoData = await geoRes.json();
          if (geoData && typeof geoData.lon === 'number' && typeof geoData.lat === 'number') {
            w3 = [geoData.lon, geoData.lat];
          } else {
            w3 = [0, 0];
          }
        } catch (geoErr) {
          console.warn('Fallback W3 resolution failed:', geoErr);
          w3 = [0, 0];
        }
      } else {
        w3 = [0, 0]; // Fallback to 0,0
      }
    }
    // Calculate Final Timings
    let t1_total_net = t1_total;
    
    // Calculate one-way trips for visual map scaling
    const t3_visual = t3 / 2; // W2 -> W3 single trip
    let t1_visual = (t1_total_net - t2 - t3) / 2; // W1 -> W2 single trip
    if (t1_visual < 5) t1_visual = 5; // Prevent negative rendering visually

    // Extract colo and abort reasons
    const colo = resHeaders.get('x-panic-colo') || 'UNKNOWN';
    const chaosReason = resHeaders.get('X-Chaos-Reason');
    const chaosClientContext = resHeaders.get('X-Chaos-Client-Context');

    // Resolve IP purely for terminal visual logging (does not affect timing since timer is stopped)
    let resolvedIp = 'Unknown IP';
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
      telemetry: {
         w1, w3,
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
