"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '48px', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ededed'} onMouseOut={e => e.currentTarget.style.color = '#a1a1aa'}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Shield size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px' }}>Last Updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <section>
            <p style={{ color: 'var(--text-primary)' }}>At panic.design, we build tools for resilience, and that philosophy extends to your data. We adhere to a strict data-minimization architecture. This Privacy Policy outlines what we collect, why we need it, and how we protect it.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>1. Data Collection & Authentication</h2>
            <ul style={{ color: 'var(--text-primary)', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Third-Party OAuth:</strong> We use GitHub OAuth exclusively for registration and login. We retrieve only your baseline profile (Email, Name, Avatar) to establish your developer identity.</li>
              <li style={{ marginBottom: '8px' }}><strong>Cookies:</strong> We utilize secure, HTTP-only cookies strictly for session management and identity authentication. We do not use tracking or advertising cookies.</li>
              <li style={{ marginBottom: '8px' }}><strong>Bot Protection:</strong> To defend our control plane against automated abuse, we implement Cloudflare Turnstile. This service operates in a non-interactive mode and may collect ephemeral telemetry, including your IP address and browser fingerprint, solely for human-verification purposes. For more details, please review the <a href="https://www.cloudflare.com/en-gb/turnstile-privacy-policy/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>Cloudflare Turnstile Privacy Policy</a>.</li>
              <li style={{ marginBottom: '8px' }}><strong>Anti-Abuse Telemetry:</strong> We collect necessary environmental metadata (e.g., request rates, geographic origin) to validate environment security and enforce our rate-limiting quotas.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>2. Edge Passthrough & Upstream Disclosure</h2>
            <div style={{ padding: '16px', background: 'rgba(255, 59, 48, 0.1)', borderLeft: '4px solid #ff3b30', borderRadius: '4px' }}>
              <p style={{ color: 'var(--text-primary)', margin: 0 }}><strong>CRITICAL NOTICE:</strong> When you execute a RUN Cloud Injection directive, our Cloudflare Workers act as a proxy. To prevent our infrastructure from being utilized as an anonymous attack vector, we actively pass through the request.cf object to your specified Target Hostname. This means the target server will receive metadata including your approximate geographic coordinates (Longitude/Latitude) and IP reputation. This is a mandatory upstream anti-abuse mechanism.</p>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>3. Data Retention & Cryptographic Anonymization</h2>
            <p style={{ color: 'var(--text-primary)' }}>We believe in the right to be forgotten. Upon account deletion:</p>
            <ul style={{ color: 'var(--text-primary)', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}>All active Edge Chaos Tokens (JWTs) are instantaneously revoked and blacklisted.</li>
              <li style={{ marginBottom: '8px' }}>Your Personally Identifiable Information (PII) — including your email, name, and avatar — is permanently scrubbed from our active databases.</li>
              <li style={{ marginBottom: '8px' }}>To preserve the integrity of our systemic audit logs, your records are retained but cryptographically anonymized, replaced entirely by unidentifiable random hashes.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>4. California Privacy Rights (CCPA/CPRA)</h2>
            <p style={{ color: 'var(--text-primary)' }}>If you are a California resident, you have the right to request access to your data and request its deletion (which is executed via the cryptographic anonymization detailed above). We do not, and will never, sell your personal information.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
