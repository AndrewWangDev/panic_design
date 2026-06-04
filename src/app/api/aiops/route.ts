import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const runtime = 'edge';

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
    "T1": number (latency in ms from Cloud Runner to Edge),
    "T2": number (latency in ms injected by fault),
    "T3": number (latency in ms from Edge to Upstream, 0 if dropped),
    "W1": [longitude, latitude] (Cloud Runner),
    "W2": [longitude, latitude] (Edge Gateway),
    "W3": [longitude, latitude] (Upstream Target),
    "w2_colo": string (Edge colo code, e.g., "LAX"),
    "flag_1": boolean (true if the route W1 ➔ W2 is completely broken/aborted),
    "flag_2": boolean (true if the route W2 ➔ W3 is completely broken/aborted),
    "flag_route_1": boolean (true if W1 ➔ W2 route is detoured/inefficient),
    "flag_route_2": boolean (true if W2 ➔ W3 route is detoured/inefficient),
    "W1_label": string (extra label for W1, or ""),
    "W2_label": string (extra label for W2, e.g., "Packet Loss", or ""),
    "W3_label": string (extra label for W3, e.g., "Unreachable", or "")
  },
  "insight": string (A concise, professional 1-3 sentence AIOps analysis of the impact to display in the COPILOT INSIGHT panel)
}`;

    const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
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
