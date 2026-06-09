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

    const { instruction, currentFormState, turnstileToken } = await req.json();

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
      return NextResponse.json({ status: 'error', error_message: 'QUOTA_EXCEEDED: ' + quota.reason, data: null }, { status: 429 });
    }

    const systemPrompt = `You are a strict Chaos Engineering Form AutoFill Engine. 
The user is instructing you to configure a cloud network fault. You will output a strict JSON configuration based on their instruction.

CURRENT FORM STATE:
${JSON.stringify(currentFormState || {}, null, 2)}

SECURITY AND INTENT VALIDATION (CRITICAL):
You MUST validate the user's intent. If any of the following 3 conditions are met, you MUST set "status" to "error" and populate "error_message".
1. Cyberattack or OS commands: e.g. "DDOS", "rm -rf". -> "error_message": "SECURITY_VIOLATION: [Context]".
2. General/Conversational/Out of Scope: e.g. "Write code", "Tell me a story", "Write a newspaper". -> "error_message": "OUT_OF_SCOPE: [Reason]".
3. Incomplete Chaos Parameters: e.g. "Make network slow" without specifying how many ms, or "Add packet loss" without a percentage. -> "error_message": "INCOMPLETE_PARAM: Missing Entity [e.g. Percentage / Latency]". NOTE: If the user requests an advanced chaos feature (like "unexpected EOF", "type poisoning") that is NOT supported by the JSON Schema below, DO NOT flag it as incomplete. Simply IGNORE the unsupported feature and successfully extract whatever IS supported (e.g. latency, packetLoss).

If an error is triggered, you MUST still return a valid JSON object.

WARNING VALIDATION:
If the user specifies conflicting chaos logic, you must auto-correct it. Specifically, if the user asks to inject HTTP Application Layer Errors (502, 504, 429, 444) AND simultaneously asks for ANY Traffic Degradation (e.g. Distribution, Packet Loss, Base Latency, Jitter) OR ANY Payload Mutilation Strategy (e.g. Unexpected EOF, Type Poisoning, Empty Shell), you MUST classify this as a correction warning. In this case, set "status" to "warning", provide a "conflict_reason", and set "resolution": "⚠️ Ignored traffic/payload mutations since HTTP Error Codes terminate the request early.". Then AUTOMATICALLY IGNORE and REMOVE all Traffic Degradation and Payload Mutilation parameters from your interpretation, keeping ONLY the HTTP error code in "faultType".

OUTPUT FORMAT (CRITICAL - FAILURE IS UNACCEPTABLE):
You must return ONLY a raw, perfectly valid JSON object. DO NOT output conversational text. DO NOT wrap in markdown like \`\`\`json. Your response MUST start with "{" and end with "}".

The JSON MUST follow this exact schema:
{
  "status": "success" | "warning" | "error",
  "conflict_reason": "string | null (Populate ONLY if status is warning)",
  "resolution": "string | null (Populate ONLY if status is warning)",
  "error_message": "string | null (Populate ONLY if status is error)",
  "data": {
    "targetHostname": "string (Extract from input or keep current state)",
    "scope": "Global" | "Cloud ASNs" | "Cellular" | "Cross-Region" | "Bots Only",
    "tokenTtl": "number (in minutes)",
    "faultType": "latency" | "502" | "504" | "429",
    "distribution": "Uniform" | "Normal" | "Spikes" | null (MUST BE null if faultType is NOT latency),
    "baseLatency": "number (0-10000) | null (MUST BE null if faultType is NOT latency)",
    "jitter": "number | null (MUST BE strictly <= baseLatency. MUST BE null if faultType is NOT latency)",
    "packetLoss": "number (0-100) | null (MUST BE null if faultType is NOT latency)",
    "mutilationStrategy": "None" | "Unexpected EOF" | "Type Poisoning" | "Empty Shell" (Default to "None" if not explicitly requested)
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
    
    // Extract JSON if model hallucinated wrappers
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
      console.error('Failed to parse AI response, fallback to error', aiResponse);
      parsedJson = {
        status: "error",
        error_message: "FATAL: Missing quantifiable metrics or out-of-scope directive detected. The engine refuses to generate blind configurations.",
        data: null
      };
    }

    return NextResponse.json(parsedJson);

  } catch (error: any) {
    console.error('AI Ops AutoFill Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
