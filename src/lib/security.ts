/**
 * Security utilities for SSRF protection and input validation in Edge runtime.
 */

/**
 * Checks whether an IPv4 address belongs to a private, loopback, link-local,
 * or cloud metadata network (RFC 1918, RFC 3927, RFC 5735, etc.).
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;

  const trimmed = ip.trim();

  // IPv6 loopback / unique local / link local
  if (
    trimmed === '::1' ||
    trimmed === '::' ||
    trimmed.toLowerCase().startsWith('fc') ||
    trimmed.toLowerCase().startsWith('fd') ||
    trimmed.toLowerCase().startsWith('fe80')
  ) {
    return true;
  }

  // IPv4 check
  const parts = trimmed.split('.').map(p => Number(p));
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP, treat as unsafe
  }

  const [b0, b1] = parts;

  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private network)
  if (b0 === 10) return true;

  // 127.0.0.0/8 (Loopback)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata endpoint 169.254.169.254)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.168.0.0/16 (Private network)
  if (b0 === 192 && b1 === 168) return true;

  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 255.255.255.255 (Broadcast)
  if (parts.every(p => p === 255)) return true;

  return false;
}
