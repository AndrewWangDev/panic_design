/**
 * Security utilities for SSRF protection and input validation in Edge runtime.
 */

/**
 * Checks whether an IP address belongs to a private, loopback, link-local,
 * cloud metadata, or reserved network (RFC 1918, RFC 3927, RFC 5735, RFC 4291, etc.).
 *
 * Supports IPv4, IPv6, IPv4-mapped IPv6, and integer representations.
 */
export function isPrivateIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;

  let trimmed = ip.trim().toLowerCase();

  // Handle brackets in IPv6 like [::1]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    trimmed = trimmed.slice(1, -1);
  }

  // IPv4-mapped IPv6: ::ffff:192.0.2.128 or ::ffff:c000:0280
  if (trimmed.startsWith('::ffff:')) {
    const v4Part = trimmed.slice(7);
    if (v4Part.includes('.')) {
      return isPrivateIp(v4Part);
    }
    // If hex formatted like ::ffff:7f00:1
    const hexParts = v4Part.split(':');
    if (hexParts.length === 2) {
      const p1 = parseInt(hexParts[0], 16);
      const p2 = parseInt(hexParts[1], 16);
      if (!isNaN(p1) && !isNaN(p2)) {
        const b0 = (p1 >> 8) & 0xff;
        const b1 = p1 & 0xff;
        const b2 = (p2 >> 8) & 0xff;
        const b3 = p2 & 0xff;
        return isPrivateIpv4Octets(b0, b1, b2, b3);
      }
    }
    return true; // Malformed mapped v6, treat as unsafe
  }

  // Pure IPv6 checks
  if (trimmed.includes(':')) {
    // Unspecified & Loopback
    if (trimmed === '::' || trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:0' || trimmed === '0:0:0:0:0:0:0:1') {
      return true;
    }
    // Unique Local Addresses (fc00::/7 -> fc00 - fdff)
    if (trimmed.startsWith('fc') || trimmed.startsWith('fd')) {
      return true;
    }
    // Link-Local (fe80::/10 -> fe80 - febf)
    if (
      trimmed.startsWith('fe8') ||
      trimmed.startsWith('fe9') ||
      trimmed.startsWith('fea') ||
      trimmed.startsWith('feb')
    ) {
      return true;
    }
    // Site-Local (fec0::/10 -> deprecated but unsafe)
    if (
      trimmed.startsWith('fec') ||
      trimmed.startsWith('fed') ||
      trimmed.startsWith('fee') ||
      trimmed.startsWith('fef')
    ) {
      return true;
    }
    // IPv6 Multicast (ff00::/8)
    if (trimmed.startsWith('ff')) {
      return true;
    }
    // Discard prefix (100::/64)
    if (trimmed.startsWith('100:')) {
      return true;
    }
    // Documentation prefix (2001:db8::/32)
    if (trimmed.startsWith('2001:db8') || trimmed.startsWith('2001:0db8')) {
      return true;
    }

    return false;
  }

  // Integer representation (e.g. 2130706433 -> 127.0.0.1)
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      const b0 = (num >>> 24) & 255;
      const b1 = (num >>> 16) & 255;
      const b2 = (num >>> 8) & 255;
      const b3 = num & 255;
      return isPrivateIpv4Octets(b0, b1, b2, b3);
    }
    return true; // Out of range integer IP, treat as unsafe
  }

  // Standard or varied IPv4 octets
  const rawParts = trimmed.split('.');
  if (rawParts.length !== 4) {
    return true; // Malformed IP or non-standard format
  }

  const parts: number[] = [];
  for (const part of rawParts) {
    let val: number;
    if (part.startsWith('0x') || part.startsWith('0X')) {
      val = parseInt(part, 16);
    } else if (part.length > 1 && part.startsWith('0')) {
      val = parseInt(part, 8); // Octal notation e.g. 0177
    } else {
      val = Number(part);
    }

    if (isNaN(val) || val < 0 || val > 255) {
      return true; // Malformed octet
    }
    parts.push(val);
  }

  return isPrivateIpv4Octets(parts[0], parts[1], parts[2], parts[3]);
}

function isPrivateIpv4Octets(b0: number, b1: number, b2: number, b3: number): boolean {
  // 0.0.0.0/8 (Current network)
  if (b0 === 0) return true;

  // 10.0.0.0/8 (Private network - RFC 1918)
  if (b0 === 10) return true;

  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT - RFC 6598)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 (Loopback - RFC 1122)
  if (b0 === 127) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata endpoint 169.254.169.254 - RFC 3927)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255 - RFC 1918)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 (IETF Protocol Assignments - RFC 6890)
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24 (TEST-NET-1 - RFC 5737)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;

  // 192.168.0.0/16 (Private network - RFC 1918)
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 (Network benchmark tests - RFC 2544)
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 (TEST-NET-2 - RFC 5737)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;

  // 203.0.113.0/24 (TEST-NET-3 - RFC 5737)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 (Multicast - RFC 5771)
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 (Reserved for future use - RFC 1112)
  if (b0 >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Validates a target host string to prevent SSRF, internal network scanning,
 * and command/protocol injection.
 */
export function isValidTargetHost(rawHost: string): boolean {
  if (!rawHost || typeof rawHost !== 'string') return false;

  let host = rawHost.trim().toLowerCase();

  // Strip port if present (e.g., example.com:8080)
  if (host.includes(':')) {
    // If IPv6 enclosed in brackets, e.g. [2001:db8::1]:8080
    if (host.startsWith('[') && host.includes(']')) {
      const closingBracket = host.indexOf(']');
      const ipv6Part = host.substring(1, closingBracket);
      if (isPrivateIp(ipv6Part)) return false;
      host = ipv6Part;
    } else if (host.split(':').length === 2 && !host.includes('::')) {
      // Standard hostname:port or ipv4:port
      host = host.split(':')[0];
    }
  }

  // Length checks (RFC 1035: 1 to 253 characters)
  if (host.length === 0 || host.length > 253) return false;

  // Disallow protocols / schemes, paths, queries, fragments, credentials
  if (
    host.includes('/') ||
    host.includes('?') ||
    host.includes('#') ||
    host.includes('@') ||
    host.includes('\\')
  ) {
    return false;
  }

  // Disallowed private/special hostnames & TLDs
  const forbiddenExact = new Set([
    'localhost',
    'metadata',
    'metadata.google.internal',
    'instance-data',
    'router',
    'gateway',
    'broadcasthost'
  ]);
  if (forbiddenExact.has(host)) return false;

  const forbiddenSuffixes = [
    '.localhost',
    '.local',
    '.internal',
    '.arpa',
    '.invalid',
    '.test',
    '.example',
    '.onion',
    '.corp',
    '.home',
    '.lan'
  ];
  for (const suffix of forbiddenSuffixes) {
    if (host.endsWith(suffix)) return false;
  }

  // Check if it's an IP address directly
  if (!host.includes(':') && /^[0-9.]+$/.test(host)) {
    // If it's a numeric IP, verify it is NOT private
    if (isPrivateIp(host)) return false;
  } else if (host.includes(':')) {
    if (isPrivateIp(host)) return false;
  }

  // Hostname syntax validation (RFC 1123)
  // Must have at least one dot (e.g. domain.tld) to prevent querying single-word internal hosts
  if (!host.includes('.')) return false;

  // Labels must be separated by dots
  const labels = host.split('.');
  if (labels.some(label => label.length === 0 || label.length > 63)) return false;

  // Validate each label
  for (const label of labels) {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
      return false;
    }
  }

  return true;
}
