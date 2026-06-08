import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { auth } from '@/auth';

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

RULE 1: SECURITY (HIGHEST PRIORITY)
If instruction contains ANY hacking, DDOS, malicious intent, or shell commands like "rm -rf", "drop table", you MUST set "error_code": "SECURITY_VIOLATION". This overrides all other rules.

RULE 2: OUT OF SCOPE
If instruction is a normal conversation ("hello"), coding ("write python"), or non-topological, set "error_code": "OUT_OF_SCOPE".

RULE 3: INCOMPLETE PARAMS
If instruction asks for "packet loss" or "latency" but provides NO EXACT NUMBER (e.g., missing "50%" or "1000ms"), set "error_code": "INCOMPLETE_PARAM".

RULE 4: GEOGRAPHIC & LOGICAL CONFLICTS
If instruction asks for "trans-Pacific" or "trans-Atlantic" but the Baseline Telemetry W1/W2/W3 are in the SAME region (e.g., all US), DO NOT change coordinates! Set "warning_code": "LOGICAL_CONFLICT" and "warning_message": "⚠️ [Requested Geography] routing impossible for intra-[Actual Region] path."
If instruction asks for L7 faults while L4 packet loss is 100%, set "warning_code": "LOGICAL_CONFLICT".

JSON SCHEMA (ONLY OUTPUT THIS EXACT STRUCTURE):
{
  "error_code": "INCOMPLETE_PARAM" | "SECURITY_VIOLATION" | "OUT_OF_SCOPE" | null,
  "error_message": string | null,
  "warning_code": "LOGICAL_CONFLICT" | null,
  "warning_message": string | null,
  "map_data": {
    "T1": number (Round-Trip Time from Cloud to Edge),
    "T2": number (Latency injected at Edge. 0 if none),
    "T3": number (Round-Trip Time from Edge to Upstream),
    "W1": [longitude, latitude] (Keep baseline unless failover is requested),
    "W2": [longitude, latitude] (Keep baseline),
    "W3": [longitude, latitude] (Keep baseline),
    "w2_colo": string,
    "flag_1": boolean,
    "flag_2": boolean (True if 502/504/429 or Edge packet loss drops the packet),
    "flag_route_1": boolean,
    "flag_route_2": boolean,
    "W1_label": string,
    "W2_label": string (e.g. "Latency +1000ms", "504 Gateway Timeout"),
    "W3_label": string
  },
  "insight": {
    "statusCode": string (CRITICAL FORMAT: "BEFORE_STR -> AFTER_STR". Left side MUST exactly match baseline.statusCodeBreakdown. Right side MUST reflect current fault. e.g. "200: 100% -> 429: 50%, 444: 50%". If baseline.fault is an error code, use it! Do NOT use 200 on right side if fault is 502/504/429.),
    "w1Colo": string (Exact baseline w1_colo. No ->),
    "w2Colo": string,
    "w3Ip": string,
    "packetLoss": string (Format: "BEFORE_STR -> AFTER_STR". e.g. "0.00% -> 50%"),
    "influence": [
      {
        "object": string,
        "severity": string (EXACTLY ONE: "🔴", "🟡", "🟢"),
        "content": string
      }
    ],
    "secondaryRisks": string,
    "suggestion": string
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
