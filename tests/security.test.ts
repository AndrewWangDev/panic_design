import { describe, it, expect } from 'vitest';
import { isPrivateIp, isValidTargetHost } from '../src/lib/security';

describe('Security: isPrivateIp (SSRF defense)', () => {
  it('should identify IPv4 loopback & RFC1918 private ranges as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.254')).toBe(true);
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.254.1.1')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('192.168.0.254')).toBe(true);
  });

  it('should block Cloud Metadata & link-local IP (169.254.169.254)', () => {
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);
  });

  it('should block Carrier-grade NAT (100.64.0.0/10)', () => {
    expect(isPrivateIp('100.64.0.1')).toBe(true);
    expect(isPrivateIp('100.127.255.255')).toBe(true);
  });

  it('should block IPv6 loopback, link-local, and ULA', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('fd00::dead:beef')).toBe(true);
    expect(isPrivateIp('[::1]')).toBe(true);
  });

  it('should block IPv4-mapped IPv6', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:7f00:0001')).toBe(true);
  });

  it('should block integer / decimal & octal / hex encoded IPs', () => {
    // 2130706433 is 127.0.0.1
    expect(isPrivateIp('2130706433')).toBe(true);
    // 0x7f000001
    expect(isPrivateIp('0x7f.0.0.1')).toBe(true);
    // octal 0177.0.0.1
    expect(isPrivateIp('0177.0.0.1')).toBe(true);
  });

  it('should allow legitimate public IPv4 and IPv6 addresses', () => {
    expect(isPrivateIp('1.1.1.1')).toBe(false);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('104.21.5.19')).toBe(false);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('Security: isValidTargetHost', () => {
  it('should reject empty, protocol-prefixed, or path-containing hosts', () => {
    expect(isValidTargetHost('')).toBe(false);
    expect(isValidTargetHost('http://example.com')).toBe(false);
    expect(isValidTargetHost('https://example.com/api')).toBe(false);
    expect(isValidTargetHost('example.com/test')).toBe(false);
    expect(isValidTargetHost('example.com?query=1')).toBe(false);
    expect(isValidTargetHost('user:pass@example.com')).toBe(false);
  });

  it('should reject localhost and reserved internal suffixes', () => {
    expect(isValidTargetHost('localhost')).toBe(false);
    expect(isValidTargetHost('api.localhost')).toBe(false);
    expect(isValidTargetHost('service.internal')).toBe(false);
    expect(isValidTargetHost('app.local')).toBe(false);
    expect(isValidTargetHost('corp.lan')).toBe(false);
    expect(isValidTargetHost('metadata.google.internal')).toBe(false);
  });

  it('should reject private IP host targets', () => {
    expect(isValidTargetHost('127.0.0.1')).toBe(false);
    expect(isValidTargetHost('169.254.169.254')).toBe(false);
    expect(isValidTargetHost('10.10.10.10')).toBe(false);
    expect(isValidTargetHost('192.168.1.1')).toBe(false);
  });

  it('should accept valid public domain names', () => {
    expect(isValidTargetHost('example.com')).toBe(true);
    expect(isValidTargetHost('example.com:8080')).toBe(true);
    expect(isValidTargetHost('sub.domain.org:3000')).toBe(true);
    expect(isValidTargetHost('api.panic.design')).toBe(true);
    expect(isValidTargetHost('httpbin.org')).toBe(true);
    expect(isValidTargetHost('cloudflare.com')).toBe(true);
  });

  it('should accept valid public IPv4 and IPv6 target hosts', () => {
    expect(isValidTargetHost('1.1.1.1')).toBe(true);
    expect(isValidTargetHost('8.8.8.8:443')).toBe(true);
    expect(isValidTargetHost('2606:4700:4700::1111')).toBe(true);
    expect(isValidTargetHost('[2606:4700:4700::1111]')).toBe(true);
    expect(isValidTargetHost('[2606:4700:4700::1111]:443')).toBe(true);
    expect(isValidTargetHost('[2001:4860:4860::8888]')).toBe(true);
  });

  it('should reject private IPv6 hosts in brackets or bare', () => {
    expect(isValidTargetHost('::1')).toBe(false);
    expect(isValidTargetHost('[::1]')).toBe(false);
    expect(isValidTargetHost('[::1]:8080')).toBe(false);
    expect(isValidTargetHost('fe80::1')).toBe(false);
    expect(isValidTargetHost('fc00::1')).toBe(false);
  });

  it('should reject path, query, credential, or invalid port truncation bypass attempts', () => {
    expect(isValidTargetHost('example.com:/admin')).toBe(false);
    expect(isValidTargetHost('example.com/admin')).toBe(false);
    expect(isValidTargetHost('example.com?query=1')).toBe(false);
    expect(isValidTargetHost('example.com#hash')).toBe(false);
    expect(isValidTargetHost('admin@example.com')).toBe(false);
    expect(isValidTargetHost('example.com:invalidPort')).toBe(false);
    expect(isValidTargetHost('example.com:999999')).toBe(false);
    expect(isValidTargetHost('example.com:0')).toBe(false);
    expect(isValidTargetHost('[2606:4700:4700::1111]/admin')).toBe(false);
    expect(isValidTargetHost('[2606:4700:4700::1111]@evil.com')).toBe(false);
    expect(isValidTargetHost('[2606:4700:4700::1111]:999999')).toBe(false);
    expect(isValidTargetHost('[2606:4700:4700::1111]:0')).toBe(false);
  });
});
