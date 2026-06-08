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

RULES:
1. SECURITY: If instruction contains real OS cyberattacks ("rm -rf", "drop table"), set "error_code": "SECURITY_VIOLATION". EXCEPTION: "hijack responses", "empty shell", "type poisoning" are VALID chaos engineering terms, DO NOT flag them as security violations!
2. OUT OF SCOPE: For normal conversation or coding, set "error_code": "OUT_OF_SCOPE".
3. INCOMPLETE PARAMS: If missing exact numbers (e.g., missing "50%" or "1000ms"), set "error_code": "INCOMPLETE_PARAM".
4. LOGICAL_CONFLICT (GEOGRAPHY): If Baseline nodes are in the SAME region (e.g., all US) but instruction asks for "trans-Pacific" or "trans-Atlantic", DO NOT change coordinates! You MUST set "warning_code": "LOGICAL_CONFLICT" and "warning_message": "⚠️ [Requested Geography] routing impossible for intra-[Actual Region] path."
5. STATUS CODE (CRITICAL): Format MUST be "BEFORE_STR -> AFTER_STR". Left side = baseline.statusCodeBreakdown. Right side MUST use baseline.fault (if 502/504/429) AND 444 (for dropped packets). NEVER use 200 on right side if baseline is an error code!

JSON SCHEMA (ONLY OUTPUT THIS EXACT STRUCTURE):
{
  "error_code": "INCOMPLETE_PARAM" | "SECURITY_VIOLATION" | "OUT_OF_SCOPE" | null,
  "error_message": string | null,
  "warning_code": "LOGICAL_CONFLICT" | null,
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
    "statusCode": string (ONLY the AFTER breakdown. e.g. "504: 50%, 444: 50%". Use baseline.fault if applicable),
    "w1Colo": string (Exact baseline w1_colo OR new colo if hijacked),
    "w2Colo": string (Exact baseline w2_colo OR new colo if hijacked),
    "w3Ip": string (Exact baseline targetHost OR new IP if hijacked),
    "packetLoss": string (ONLY the AFTER value. e.g. "50%"),
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
}

EXAMPLE 1:
Input: "Simulate trans-Pacific route leak. Drop 50% of packets." (Assuming Baseline targetHost is "example.com", w1_colo is "SJC", w2_colo is "SJC", fault is 504)
Output:
{
  "error_code": null,
  "error_message": null,
  "warning_code": "LOGICAL_CONFLICT",
  "warning_message": "⚠️ Trans-Pacific routing impossible for intra-US path.",
  "map_data": {
    "T1": 100, "T2": 0, "T3": 0,
    "W1": null, "W2": null, "W3": null,
    "w2_colo": "SJC", "flag_1": false, "flag_2": true, "flag_route_1": false, "flag_route_2": false,
    "W1_label": "", "W2_label": "Packet Loss", "W3_label": "Unreachable"
  },
  "insight": {
    "statusCode": "504: 50%, 444: 50%",
    "w1Colo": "SJC",
    "w2Colo": "SJC",
    "w3Ip": "example.com",
    "packetLoss": "50%",
    "influence": [
      {
        "object": "Client",
        "severity": "🔴",
        "content": "Packet loss"
      }
    ],
    "secondaryRisks": "None",
    "suggestion": "Fix routing"
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
