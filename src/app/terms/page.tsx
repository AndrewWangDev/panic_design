import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#ededed', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a1a1aa', textDecoration: 'none', marginBottom: '48px', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ededed'} onMouseOut={e => e.currentTarget.style.color = '#a1a1aa'}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <FileText size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Terms of Service</h1>
        </div>
        
        <p style={{ color: '#a1a1aa', marginBottom: '48px' }}>Last Updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>1. Agreement to Terms</h2>
            <p style={{ color: '#d4d4d8' }}>By accessing or using the Panic.Design platform ("Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the Service.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>2. Acceptable Use</h2>
            <p style={{ color: '#d4d4d8' }}>You agree not to use the Service to:</p>
            <ul style={{ color: '#d4d4d8', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Launch Distributed Denial of Service (DDoS) attacks against any third-party infrastructure.</li>
              <li style={{ marginBottom: '8px' }}>Bypass or attempt to bypass the rate limits and quotas configured on your account.</li>
              <li style={{ marginBottom: '8px' }}>Deploy edge tokens to networks or applications that you do not own or have explicit authorization to test.</li>
              <li style={{ marginBottom: '8px' }}>Engage in any activity that disrupts or interferes with our edge network infrastructure.</li>
            </ul>
            <p style={{ color: '#d4d4d8', marginTop: '12px' }}>Any violation of these acceptable use policies will result in immediate and permanent termination of your account.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>3. Service Quotas and Limitations</h2>
            <p style={{ color: '#d4d4d8' }}>The Service operates on a free-tier beta basis. We reserve the right to modify, suspend, or terminate access to the Service, including adjusting daily/hourly quotas (currently set at 100/day, 30/hour) or the maximum concurrent token limits, at our sole discretion without prior notice.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>4. Disclaimer of Warranty</h2>
            <p style={{ color: '#d4d4d8' }}>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no representations or warranties of any kind, express or implied, as to the operation of their services, or the information, content or materials included therein. You expressly agree that your use of the Service is at your sole risk.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>5. Limitation of Liability</h2>
            <p style={{ color: '#d4d4d8' }}>In no event shall Panic.Design or its operators be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
