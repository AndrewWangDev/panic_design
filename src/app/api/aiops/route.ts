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

You must return ONLY a raw, perfectly valid JSON object. DO NOT output any conversational text. DO NOT wrap in markdown code blocks. DO NOT add trailing commas.
The JSON MUST follow this exact schema:
{
  "map_data": {
    "T1": number (MUST BE PROVIDED. Round-Trip Time in ms from Cloud Runner to Edge. If flag_1 is false, T1 MUST NOT be 0, you must use baseline t1_rtt or a realistic number. If flag_1 is true, T1 can be 0 or high),
    "T2": number (MUST BE PROVIDED. latency in ms injected by fault at Edge Gateway. If not related to latency injection, simulate a realistic jitter around 0, e.g. 2 or 1),
    "T3": number (Round-Trip Time in ms from Edge to Upstream. If flag_2 is false, T3 MUST NOT be 0. If flag_2 is true, the packet is dropped so T3 is 0),
    "W1": [longitude, latitude] (Cloud Runner),
    "W2": [longitude, latitude] (Edge Gateway),
    "W3": [longitude, latitude] (Upstream Target),
    "w2_colo": string (Edge colo code, e.g., "LAX"),
    "flag_1": boolean (true ONLY if the route W1 ➔ W2 is completely broken/aborted. WARNING: For 502/504/429/444 at Edge Gateway, the packet successfully reaches Edge W2, so W1➔W2 is NOT broken, flag_1 MUST be false!),
    "flag_2": boolean (true if the route W2 ➔ W3 is broken/aborted. e.g., for 502/504 or Edge Packet Loss, the packet never reaches W3, so flag_2 MUST be true. A dashed line with a red cross will be drawn from W2 to W3),
    "flag_route_1": boolean (true if W1 ➔ W2 route is detoured/inefficient),
    "flag_route_2": boolean (true if W2 ➔ W3 route is detoured/inefficient),
    "W1_label": string (extra label for W1, or ""),
    "W2_label": string (extra label for W2, e.g., "502 Bad Gateway", "504 Gateway Timeout", "Packet Loss". If T2 > 0, it MUST include "+X ms", e.g. "Latency +500ms"),
    "W3_label": string (extra label for W3, e.g., "Unreachable", or "")
  },
  "insight": {
    "statusCode": string (Format "BEFORE -> AFTER". e.g. "200: 100% -> 200: 50%, 444: 50%". The "before" MUST match baseline.statusCodeBreakdown exactly. The "after" must logically match the exact packet loss percentage requested),
    "w1Colo": string (It MUST match baseline.w1_colo exactly. Do not use '->' here),
    "w2Colo": string (e.g. "LAX"),
    "w3Ip": string (It MUST match baseline.resolvedIp exactly. Do not use '->' here),
    "packetLoss": string (Format "BEFORE -> AFTER". e.g. "0.00% -> 50%". The "before" MUST match baseline.actualPacketLossRate exactly. The "after" MUST strictly adhere to the exact percentage requested in the instruction),
    "t1": { "before": number, "after": number }, // "before" MUST exactly match baseline.t1_rtt
    "t2": { "before": number, "after": number | string }, // "before" MUST exactly match baseline.t2. "after" MUST ignore packet loss completely and remain its original value (unless the instruction explicitly asks to increase/decrease latency). However, if packetLoss is exactly 100%, then "after" MUST be the string "NaN".
    "t3": { "before": number, "after": number }, // "before" MUST exactly match baseline.t3_rtt
    "totalTime": { "before": number, "after": number }, // "before" MUST exactly be t1_rtt + t2 + t3_rtt. "after" MUST exactly be map_data's T1 + T2 + T3.
    "summary": string (A concise 1-sentence AIOps analysis of the influence)
  }
}`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      max_tokens: 1500,
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
