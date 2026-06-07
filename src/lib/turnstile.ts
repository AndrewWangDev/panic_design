export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAADgKGvp5Q9hEQeHKHqO-dVEBP6M';
  if (!secretKey) {
    console.warn('TURNSTILE_SECRET_KEY is not defined. Skipping verification in dev.');
    return true; // Bypass if not configured
  }

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`
    });

    const data = await res.json();
    return data.success;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}
