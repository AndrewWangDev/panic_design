import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { env } = getCloudflareContext() as any;
    if (!env || !env.AI) {
      return NextResponse.json({ error: 'Cloudflare AI environment not found' }, { status: 500 });
    }

    const { instruction, baseline, turnstileToken } = await req.json();

    if (instruction === 'DEBUG_PING') {
      return NextResponse.json({ debug: true, hasAI: !!env.AI });
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

    // Check rate limiting quota
    const { checkAndUpdateQuota } = await import('@/lib/quota');
    const quota = await checkAndUpdateQuota(session.user.id);
    if (!quota.allowed) {
      return NextResponse.json({ 
        error_code: 'QUOTA_EXCEEDED', 
        error_message: 'QUOTA_EXCEEDED: ' + quota.reason, 
        warning_code: null, 
        warning_message: null, 
        map_data: null, 
        insight: null 
      }, { status: 429 });
    }

    const systemPrompt = `You are a strict AIOps Chaos Engineering Engine. Output MUST be ONLY valid JSON.
Baseline Telemetry:
${JSON.stringify(baseline, null, 2)}

RULES:
1. SECURITY: If instruction contains real OS cyberattacks ("rm -rf", "drop table"), set "error_code": "SECURITY_VIOLATION". EXCEPTION: "hijack responses", "empty shell", "type poisoning" are VALID chaos engineering terms, DO NOT flag them as security violations!
2. OUT OF SCOPE: For normal conversation or coding, set "error_code": "OUT_OF_SCOPE".
3. INCOMPLETE PARAMS: If missing exact numbers (e.g., missing "50%" or "1000ms"), set "error_code": "INCOMPLETE_PARAM".
4. LOGICAL_CONFLICT (GEOGRAPHY): If w1_colo, w2_colo, and w3 nodes are in the SAME region (e.g., all US) but instruction asks for "trans-Pacific" or "trans-Atlantic", DO NOT change coordinates! You MUST set "warning_code": "LOGICAL_CONFLICT" and "warning_message": "⚠️ [Requested Geography] routing impossible for intra-[Actual Region] path."

5. MAP_DATA LOGIC (CRITICAL): 
- W1/W2/W3 coordinates: MUST BE null UNLESS the instruction explicitly relocates traffic to a new continent/region.
- T1, T2, T3: T1 is the latency from Client (W1) to Edge (W2). T2 is the Edge (W2) execution/injection latency (e.g., if injecting 1000ms latency, T2=1000). T3 is the latency from Edge (W2) to Upstream (W3). If you set T3=0ms, it means W2-W3 traffic is blocked; you MUST set flag_2=true and flag_route_2=true. If you set T1=0ms (rare), it means W1-W2 traffic is blocked; you MUST set flag_1=true and flag_route_1=true.
- flags:
  * flag_1: Traffic terminates at Client (W1). Generally false, unless explicitly mentioned as a client fault or T1=0.
  * flag_2: Traffic terminates at Edge (W2). Set to true when injecting packet drop, or application layer errors like 502/504/429/444, or if T3=0.
  * flag_route_1: Traffic blocked on the path from W1 to W2. If you set flag_1=true, you MUST set flag_route_1=true. Otherwise, it MUST be false.
  * flag_route_2: Traffic blocked on the path from W2 to W3. If you set flag_2=true, you MUST set flag_route_2=true. Otherwise, it MUST be false.

6. LABELS: W1 is Client, W2 is Edge/Transit, W3 is Upstream. Set W1_label/W2_label/W3_label based on exactly WHERE the fault occurs. Keep empty if healthy.

7. PARAMETER_CONFLICT_CORRECTION: If the instruction asks to inject HTTP Application Layer Errors (502, 504, 429, 444) AND simultaneously asks for ANY Traffic Degradation (e.g. Distribution, Packet Loss, Base Latency, Jitter) OR ANY Payload Mutilation Strategy (e.g. Unexpected EOF, Type Poisoning, Empty Shell), you MUST classify this as a correction warning. Set "warning_code": "CORRECTION_WARNING", set "warning_message": "⚠️ Ignored traffic/payload mutations since HTTP Error Codes terminate the request early.", and AUTOMATICALLY IGNORE and REMOVE all Traffic Degradation and Payload Mutilation parameters from your interpretation.

JSON SCHEMA (ONLY OUTPUT THIS EXACT STRUCTURE):
{
  "error_code": "INCOMPLETE_PARAM" | "SECURITY_VIOLATION" | "OUT_OF_SCOPE" | null,
  "error_message": string | null,
  "warning_code": "LOGICAL_CONFLICT" | "CORRECTION_WARNING" | null,
  "warning_message": string | null,
  "map_data": {
    "T1": number,
    "T2": number,
    "T3": number,
    "W1": [longitude, latitude] | null (Use null to keep baseline),
    "W2": [longitude, latitude] | null (Use null to keep baseline),
    "W3": [longitude, latitude] | null (Use null to keep baseline),
    "w2_colo": string,
    "flag_1": boolean,
    "flag_2": boolean,
    "flag_route_1": boolean,
    "flag_route_2": boolean,
    "W1_label": string,
    "W2_label": string,
    "W3_label": string
  },
  "insight": {
    "sloBudgetImpact": string (Predict the enterprise business/SLO impact),
    "w1Colo": string (Exact baseline w1_colo OR new colo if hijacked),
    "w2Colo": string (Exact baseline w2_colo OR new colo if hijacked),
    "w3Ip": string (Exact baseline targetHost OR new IP if hijacked),
    "packetLoss": string (ONLY the AFTER value. e.g. "50%"),
    "influence": [
      {
        "object": string,
        "severity": string (EXACTLY ONE: "🔴", "🟡"), // MUST be negative impact. Do NOT use 🟢!
        "content": string (Must be highly detailed and descriptive. MUST describe a negative impact or failure, never a successful normal state.)
      }
    ],
    "secondaryRisks": string (MUST NOT be "None" or empty),
    "suggestion": string (Detailed mitigation strategy)
  }
}

LEARNING SCENARIOS (DO NOT OUTPUT THESE, ONLY LEARN FROM THEM):
Scenario A: "Simulate a catastrophic BGP route leak. Drop 50% of packets globally."
Analysis: 'Drop 50%' implies packet drop injection, so set flag_2=true. Because flag_2=true, flag_route_2 MUST be true. Since the client has no fault, flag_1=false and flag_route_1=false.

Scenario B: "Trigger a massive edge node failure. Hijack all responses with 502 Bad Gateway and apply 'Empty Shell' mutation."
Analysis: 'Hijack all responses with 502 Bad Gateway' means application layer error, so set flag_2=true. Because flag_2=true, flag_route_2 MUST be true. Since the client has no fault, flag_1=false and flag_route_1=false.

Scenario C: "Simulate severe trans-Pacific cable congestion. Degrade traffic with 1000ms base latency, 3ms jitter, and apply Type Poisoning."
Analysis: 'trans-Pacific' is a keyword. Immediately check if w1_colo, w2_colo, and w3 are in the same region. If they are, trigger LOGICAL_CONFLICT and ignore 'trans-Pacific'. No client fault? flag_1=false, flag_route_1=false. No packet drop or 502/504? flag_2=false, flag_route_2=false. 'Degrade traffic with 1000ms' is latency injection, so set T2=1000. 'Type Poisoning' is a payload mutation, set W2_label='Type Poisoning'.`;

    const response = await env.AI.run('@cf/meta/llama-4-scout-17b-16e-instruct', {
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
      console.error('Failed to parse AI response, fallback to OUT_OF_SCOPE', aiResponse);
      parsedJson = {
        error_code: "OUT_OF_SCOPE",
        error_message: "The Engine rejected a malformed or conversational response.",
        warning_code: null,
        warning_message: null,
        map_data: null,
        insight: null
      };
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error('AI Ops Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
