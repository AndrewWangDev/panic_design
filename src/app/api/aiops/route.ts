import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';


export async function POST(req: Request) {
  try {
    const { env } = getCloudflareContext() as any;
    if (!env || !env.AI) {
      return NextResponse.json({ error: 'Cloudflare AI environment not found' }, { status: 500 });
    }

    const { instruction, baseline } = await req.json();

    if (instruction === 'DEBUG_PING') {
      return NextResponse.json({ debug: true, hasAI: !!env.AI });
    }

    const systemPrompt = `You are an AIOps Chaos Engineering Engine. 
The user is simulating a cloud architecture disaster. They will provide an instruction, and you will output a strict JSON configuration to render the simulated impact on a global network map.

Baseline Telemetry:
${JSON.stringify(baseline, null, 2)}

You must return ONLY a raw, valid JSON object (no markdown, no conversation, just the JSON).
The JSON MUST follow this exact schema:
{
  "map_data": {
    "T1": number (MUST BE PROVIDED. latency in ms from Cloud Runner to Edge. If W1➔W2 fails, this can be 0 or high),
    "T2": number (MUST BE PROVIDED. latency in ms injected by fault at Edge Gateway. If not related to latency injection, simulate a realistic jitter around 0, e.g. 2 or 1),
    "T3": number (latency in ms from Edge to Upstream. 0 if dropped/aborted),
    "W1": [longitude, latitude] (Cloud Runner),
    "W2": [longitude, latitude] (Edge Gateway),
    "W3": [longitude, latitude] (Upstream Target),
    "w2_colo": string (Edge colo code, e.g., "LAX"),
    "flag_1": boolean (true ONLY if the route W1 ➔ W2 is completely broken/aborted. WARNING: For 502/504/429 at Edge Gateway, the packet successfully reaches Edge W2, so W1➔W2 is NOT broken, flag_1 MUST be false!),
    "flag_2": boolean (true if the route W2 ➔ W3 is broken/aborted. e.g., for 502/504 or Edge Packet Loss, the packet never reaches W3, so flag_2 MUST be true. A dashed line with a red cross will be drawn from W2 to W3),
    "flag_route_1": boolean (true if W1 ➔ W2 route is detoured/inefficient),
    "flag_route_2": boolean (true if W2 ➔ W3 route is detoured/inefficient),
    "W1_label": string (extra label for W1, or ""),
    "W2_label": string (extra label for W2, e.g., "502 Bad Gateway", "504 Gateway Timeout", "Packet Loss", or ""),
    "W3_label": string (extra label for W3, e.g., "Unreachable", or "")
  },
  "insight": {
    "statusCode": string (e.g. "200 -> 502", "200 -> 504", or "200 -> 444"),
    "w1Colo": string (e.g. "SJC"),
    "w2Colo": string (e.g. "LAX"),
    "w3Ip": string (e.g. "1.2.3.4"),
    "packetLoss": string (e.g. "0.00% -> 100%"),
    "t1": { "before": number, "after": number },
    "t2": { "before": number, "after": number },
    "t3": { "before": number, "after": number },
    "totalTime": { "before": number, "after": number },
    "summary": string (A concise 1-sentence AIOps analysis of the influence)
  }
}`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction }
      ]
    });

    let aiResponse = response.response || '';
    
    // Attempt to extract JSON if the model hallucinated wrapper text
    let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    let parsedJson = null;

    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('Failed to parse AI output:', jsonMatch[0]);
      }
    }

    if (!parsedJson) {
      return NextResponse.json({ error: 'Failed to parse AI response', raw: aiResponse }, { status: 500 });
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error('AI Ops Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
