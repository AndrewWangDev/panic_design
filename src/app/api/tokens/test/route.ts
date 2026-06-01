import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const baseUrl = process.env.DATA_PLANE_URL || 'http://127.0.0.1:8787';
    const gatewayUrl = `${baseUrl.replace(/\/$/, '')}/?token=${token}`;
    
    const startTime = Date.now();
    let status = 0;
    let statusText = '';
    let responseBody = '';
    
    try {
      // Execute real fetch to the local Data Plane worker
      const res = await fetch(gatewayUrl, {
        method: 'GET',
        headers: {
          'Accept': '*/*'
        }
      });
      status = res.status;
      statusText = res.statusText;
      responseBody = await res.text();
    } catch (e: any) {
      // If the data plane is not running, simulate a 503 or return the error
      status = 503;
      statusText = 'Service Unavailable (Data Plane offline)';
      responseBody = e.message;
    }
    
    const endTime = Date.now();
    const latency = endTime - startTime;

    return NextResponse.json({
      success: true,
      status,
      statusText,
      latency,
      responseBody
    });

  } catch (err) {
    console.error('Test injection error:', err);
    return NextResponse.json({ error: 'Failed to run injection test' }, { status: 500 });
  }
}
