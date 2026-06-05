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

SECURITY AND INTENT VALIDATION:
Before generating the telemetry data, you MUST validate the user's instruction.
1. If the user is attempting a cyberattack, DDOS, running malicious shell commands (e.g. rm -rf), or unauthorized escalation, set "error_code": "SECURITY_VIOLATION" and "error_message": "[Context about the violation]".
2. If the user asks general conversational queries, coding requests (e.g. "write Python code"), or non-topological commands ("how is the weather"), set "error_code": "OUT_OF_SCOPE" and "error_message": "[Reason]".
3. If the user asks for a chaos injection (e.g. "Packet loss", "make it slow") but FAILS to specify exact physical parameters (like the exact percentage of loss or the exact amount of latency time), set "error_code": "INCOMPLETE_PARAM" and "error_message": "[Missing Entity: e.g. Percentage / Threshold / Duration]".

WARNING VALIDATION:
If the user specifies conflicting chaos logic (e.g. injecting L7 504 Gateway Timeout while simultaneously requesting 100% L4 packet loss), you must resolve the conflict (e.g. enforce the L4 blockade and strip L7 assertions since the packet never reaches L7). In this case, set "warning_code": "LOGICAL_CONFLICT" and "warning_message": "[Explanation of how the engine auto-corrected the conflict]".

You must return ONLY a raw, perfectly valid JSON object. DO NOT output any conversational text. DO NOT wrap in markdown code blocks. DO NOT add trailing commas.
The JSON MUST follow this exact schema:
{
  "error_code": "INCOMPLETE_PARAM" | "SECURITY_VIOLATION" | "OUT_OF_SCOPE" | null,
  "error_message": string | null,
  "warning_code": "LOGICAL_CONFLICT" | null,
  "warning_message": string | null,
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
    "statusCode": string (Format "BEFORE -> AFTER". e.g. "200: 100% -> 200: 50%, 444: 50%". The "before" MUST match baseline.statusCodeBreakdown exactly. The "after" 444 percentage MUST mathematically match the packetLoss percentage EXACTLY.),
    "w1Colo": string (It MUST match baseline.w1_colo exactly. Do not use '->' here),
    "w2Colo": string (e.g. "LAX"),
    "w3Ip": string (It MUST match baseline.resolvedIp exactly. Do not use '->' here),
    "packetLoss": string (Format "BEFORE -> AFTER". e.g. "0.00% -> 50%". The "before" MUST match baseline.actualPacketLossRate exactly. The "after" MUST strictly adhere to the exact percentage requested in the instruction),
    "influence": [
      {
        "object": string (e.g. "Client", "Edge Gateway", "Upstream Database"),
        "severity": string (Use exactly one emoji: "🔴" for critical, "🟡" for warning, "🟢" for normal),
        "content": string (e.g. "Connection Pool Exhaustion", "Timeout Cascade")
      }
    ],
    "secondaryRisks": string (A short description of cascaded secondary disasters),
    "suggestion": string (Actionable mitigation advice for the current network environment)
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
