"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', textDecoration: 'none', marginBottom: '48px', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ededed'} onMouseOut={e => e.currentTarget.style.color = '#a1a1aa'}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <FileText size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', marginBottom: '48px' }}>Last Updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>1. Acceptance of Terms</h2>
            <p style={{ color: 'var(--text-primary)' }}>By accessing or using the panic.design control plane and edge injection network, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>2. Authorized Target Scope (Zero-Tolerance Policy)</h2>
            <p style={{ color: 'var(--text-primary)' }}>panic.design is a weaponized proxy built strictly for internal resilience engineering and authorized chaos testing.</p>
            <p style={{ color: 'var(--text-primary)', marginTop: '12px' }}>You may ONLY route traffic and inject faults against domains, APIs, or infrastructure that you own, or for which you possess explicit, written authorization from the owner.</p>
            <ul style={{ color: 'var(--text-primary)', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>PROHIBITED CONDUCT:</strong> You are strictly prohibited from utilizing this platform for Distributed Denial of Service (DDoS) attacks, phishing, fraud, vulnerability exploitation, or any malicious activities.</li>
              <li style={{ marginBottom: '8px' }}><strong>ENFORCEMENT:</strong> Violation of this sandbox boundary will result in immediate account termination, IP ban, cryptographic preservation of your audit trails, and proactive reporting to relevant law enforcement agencies and upstream ISPs.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>3. Account Restrictions & Fair Use</h2>
            <p style={{ color: 'var(--text-primary)' }}>To protect our edge compute quotas and prevent proxy abuse:</p>
            <ul style={{ color: 'var(--text-primary)', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>One Human, One Account:</strong> You are prohibited from operating multiple accounts to bypass rate limits.</li>
              <li style={{ marginBottom: '8px' }}><strong>No Transferability:</strong> Selling, renting, lending, or transferring your panic.design account or generated JWTs to third parties is strictly forbidden.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)' }}>4. Disclaimer of Warranties (Force Majeure)</h2>
            <p style={{ color: 'var(--text-primary)' }}>This service relies on global BGP routing, Anycast networks, and complex L4/L7 edge logic. While we strive for high fidelity, the internet is inherently volatile.</p>
            <p style={{ color: 'var(--text-primary)', marginTop: '12px' }}>panic.design is provided on an "AS IS" and "AS AVAILABLE" basis.</p>
            <p style={{ color: 'var(--text-primary)', marginTop: '12px' }}>We do not warrant or guarantee 100% service uptime or absolute accuracy in telemetry, as our infrastructure is subject to network latency, upstream routing blackholes, and other force majeure events beyond our control.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
