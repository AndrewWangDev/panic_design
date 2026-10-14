import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  let secretKey: string | undefined = process.env.TURNSTILE_SECRET_KEY;
  try {
    const cf = getCloudflareContext();
    if (cf?.env && typeof (cf.env as Record<string, unknown>).TURNSTILE_SECRET_KEY === 'string') {
      secretKey = (cf.env as Record<string, string>).TURNSTILE_SECRET_KEY;
    }
  } catch {
    // Outside Cloudflare context (e.g. local development or unit test)
  }

  if (!secretKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('TURNSTILE_SECRET_KEY is not defined. Skipping verification in dev.');
      return true;
    }
    console.error('TURNSTILE_SECRET_KEY is missing in production environment. Rejecting verification.');
    return false;
  }

  if (!token) {
    return false;
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`
    });

    const data = await res.json() as { success?: boolean };
    return Boolean(data?.success);
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}

