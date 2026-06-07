import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#ededed', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a1a1aa', textDecoration: 'none', marginBottom: '48px', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ededed'} onMouseOut={e => e.currentTarget.style.color = '#a1a1aa'}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Shield size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>Privacy Policy</h1>
        </div>
        
        <p style={{ color: '#a1a1aa', marginBottom: '48px' }}>Last Updated: June 2026</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>1. Introduction</h2>
            <p style={{ color: '#d4d4d8' }}>Welcome to Panic.Design. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>2. Data We Collect</h2>
            <p style={{ color: '#d4d4d8' }}>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
            <ul style={{ color: '#d4d4d8', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Identity Data:</strong> includes first name, last name, username or similar identifier (via GitHub OAuth).</li>
              <li style={{ marginBottom: '8px' }}><strong>Contact Data:</strong> includes email address.</li>
              <li style={{ marginBottom: '8px' }}><strong>Technical Data:</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform.</li>
              <li style={{ marginBottom: '8px' }}><strong>Usage Data:</strong> includes information about how you use our website, APIs, and chaos engineering services.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>3. How We Use Your Data</h2>
            <p style={{ color: '#d4d4d8' }}>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
            <ul style={{ color: '#d4d4d8', paddingLeft: '24px', marginTop: '12px' }}>
              <li style={{ marginBottom: '8px' }}>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., providing edge compute tokens).</li>
              <li style={{ marginBottom: '8px' }}>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests (e.g., preventing abuse, enforcing quota limits).</li>
              <li style={{ marginBottom: '8px' }}>Where we need to comply with a legal obligation.</li>
            </ul>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>4. Data Security</h2>
            <p style={{ color: '#d4d4d8' }}>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know. We use Cloudflare Turnstile to prevent automated abuse.</p>
          </section>

          <section>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>5. Contact Us</h2>
            <p style={{ color: '#d4d4d8' }}>If you have any questions about this privacy policy or our privacy practices, please contact us at support@andrewwangdev.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
