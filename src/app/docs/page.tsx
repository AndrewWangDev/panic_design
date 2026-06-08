"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Microscope, CheckCircle2 } from 'lucide-react';

export default function Docs() {
  const [activeSection, setActiveSection] = useState('auth');
  
  const authRef = useRef<HTMLDivElement>(null);
  const injectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });

    if (authRef.current) observer.observe(authRef.current);
    if (injectionRef.current) observer.observe(injectionRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ backgroundColor: '#000', color: '#ededed', fontFamily: 'Inter, sans-serif', minHeight: '100vh', paddingBottom: '120px' }}>
      
      {/* 1. Global Hero Section */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px 40px 24px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#a1a1aa', textDecoration: 'none', marginBottom: '40px', fontSize: '0.9rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ededed'} onMouseOut={e => e.currentTarget.style.color = '#a1a1aa'}>
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 16px 0' }}>API Reference</h1>
        <p style={{ color: '#a1a1aa', fontSize: '1.2rem', margin: '0 0 40px 0', maxWidth: '600px' }}>
          Integrating panic.design requires zero code changes.
        </p>
        
        <pre style={{ 
          background: 'rgba(255,255,255,0.02)', 
          border: '1px solid rgba(255,255,255,0.05)', 
          padding: '24px', 
          borderRadius: '12px', 
          fontFamily: 'var(--font-mono), monospace', 
          fontSize: '0.8rem', 
          color: '#71717a',
          overflowX: 'auto',
          lineHeight: 1.6
        }}>
{`[ Your Backend ]  ◄─────►  [ panic.design Edge Gateway ]  ◄─────►  [ External Client ]
 (Target Host)                (Global W2 Proxy Nodes)                (W1 Ingress)`}
        </pre>
      </div>

      {/* 2. Split-Pane Layout */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '64px', position: 'relative' }}>
        
        {/* Left Column (Prose & Tables) */}
        <div style={{ paddingBottom: '120px' }}>
          
          <div id="auth" ref={authRef} style={{ marginBottom: '80px', paddingTop: '40px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>1. Authentication</h2>
            <p style={{ color: '#d4d4d8', lineHeight: 1.7, marginBottom: '24px' }}>
              All requests to the control plane and data plane must be authenticated using your <code style={codeStyle}>PANIC_TOKEN</code>. Pass it via the standard HTTP Authorization header.
            </p>
          </div>

          <div id="injection" ref={injectionRef} style={{ paddingTop: '40px', minHeight: '600px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginBottom: '24px', borderBottom: '1px solid #333', paddingBottom: '12px' }}>2. Proxy Data Plane Integration</h2>
            <p style={{ color: '#d4d4d8', lineHeight: 1.7, marginBottom: '24px' }}>
              Create an ephemeral edge token to initiate a chaos proxy session.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
              <span style={{ background: '#166534', color: '#4ade80', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px' }}>POST</span>
              <code style={{ fontFamily: 'var(--font-mono), monospace', color: '#fff', fontSize: '1.1rem' }}>/api/tokens/create</code>
            </div>

            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '16px' }}>Request Body Schema</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333', color: '#a1a1aa' }}>
                  <th style={{ padding: '12px 0', fontWeight: 500 }}>Field</th>
                  <th style={{ padding: '12px 0', fontWeight: 500 }}>Type</th>
                  <th style={{ padding: '12px 0', fontWeight: 500 }}>Attributes</th>
                  <th style={{ padding: '12px 0', fontWeight: 500 }}>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '16px 0' }}><code style={codeStyle}>targetHost</code></td>
                  <td style={{ padding: '16px 0', color: '#60a5fa' }}>string</td>
                  <td style={{ padding: '16px 0', color: '#ef4444', fontSize: '0.8rem' }}>required</td>
                  <td style={{ padding: '16px 0', color: '#d4d4d8', lineHeight: 1.5 }}>The FQDN of your backend.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '16px 0' }}><code style={codeStyle}>fault</code></td>
                  <td style={{ padding: '16px 0', color: '#60a5fa' }}>string</td>
                  <td style={{ padding: '16px 0', color: '#ef4444', fontSize: '0.8rem' }}>required</td>
                  <td style={{ padding: '16px 0', color: '#d4d4d8', lineHeight: 1.5 }}>Fault pattern e.g., <code style={codeStyle}>latency_2000ms</code>.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (Code Snippets) */}
        <div style={{ position: 'relative' }}>
          <div style={{ 
            position: 'sticky', 
            top: '40px', 
            background: '#000000', 
            borderRadius: '16px', 
            border: '1px solid rgba(255,255,255,0.08)', 
            boxShadow: '0 0 30px rgba(0,255,204,0.03)',
            overflow: 'hidden'
          }}>
            <div style={{ background: '#111', padding: '12px 20px', borderBottom: '1px solid #222', display: 'flex', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
            </div>
            
            <div style={{ padding: '24px', fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem', color: '#d4d4d8', minHeight: '340px' }}>
              {activeSection === 'auth' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <div style={{ color: '#6b7280', marginBottom: '16px' }}># Standard HTTP Header</div>
                  <span style={{ color: '#38bdf8' }}>Authorization</span>: <span style={{ color: '#a78bfa' }}>Bearer</span> <span style={{ color: '#4ade80' }}>$PANIC_TOKEN</span>
                </div>
              )}

              {activeSection === 'injection' && (
                <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                  <div style={{ color: '#6b7280', marginBottom: '16px' }}># Python Requests Example</div>
                  <div style={{ lineHeight: 1.6 }}>
                    <span style={{ color: '#f472b6' }}>import</span> requests<br/><br/>
                    <span style={{ color: '#a78bfa' }}>payload</span> = {'{'}<br/>
                    &nbsp;&nbsp;<span style={{ color: '#38bdf8' }}>"targetHost"</span>: <span style={{ color: '#a3e635' }}>"api.yourbackend.com"</span>,<br/>
                    &nbsp;&nbsp;<span style={{ color: '#38bdf8' }}>"fault"</span>: <span style={{ color: '#a3e635' }}>"latency_500ms"</span><br/>
                    {'}'}<br/><br/>
                    <span style={{ color: '#a78bfa' }}>response</span> = requests.post(<br/>
                    &nbsp;&nbsp;<span style={{ color: '#a3e635' }}>"https://panic.andrewwangdev.com/api/tokens/create"</span>,<br/>
                    &nbsp;&nbsp;json=payload,<br/>
                    &nbsp;&nbsp;headers={'{"Authorization": "Bearer $PANIC_TOKEN"}'}<br/>
                    )<br/><br/>
                    <span style={{ color: '#6b7280' }}># Returns JSON</span><br/>
                    <span style={{ color: '#a78bfa' }}>print</span>(response.json())
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Full-width Section */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        
        {/* Edge Error Matrix */}
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', marginBottom: '32px' }}>3. Edge Error Matrix</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem', marginBottom: '80px', border: '1px solid #222' }}>
          <thead>
            <tr style={{ background: '#111', borderBottom: '1px solid #333' }}>
              <th style={{ padding: '16px 24px', fontWeight: 500, color: '#a1a1aa' }}>HTTP Status</th>
              <th style={{ padding: '16px 24px', fontWeight: 500, color: '#a1a1aa' }}>X-Panic-Error String</th>
              <th style={{ padding: '16px 24px', fontWeight: 500, color: '#a1a1aa' }}>Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '20px 24px', color: '#ef4444', fontWeight: 600 }}>403 Forbidden</td>
              <td style={{ padding: '20px 24px' }}><code style={codeStyle}>SECURITY_VIOLATION</code></td>
              <td style={{ padding: '20px 24px', color: '#d4d4d8', lineHeight: 1.5 }}>Invalid token or Turnstile challenge failed. Check token TTL.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #222' }}>
              <td style={{ padding: '20px 24px', color: '#f59e0b', fontWeight: 600 }}>429 Too Many Requests</td>
              <td style={{ padding: '20px 24px' }}><code style={codeStyle}>QUOTA_EXCEEDED</code></td>
              <td style={{ padding: '20px 24px', color: '#d4d4d8', lineHeight: 1.5 }}>Concurrent active token limit reached (Max 5). Wait for expiration.</td>
            </tr>
            <tr>
              <td style={{ padding: '20px 24px', color: '#ef4444', fontWeight: 600 }}>502 Bad Gateway</td>
              <td style={{ padding: '20px 24px' }}><code style={codeStyle}>EDGE_ROUTING_FAILED</code></td>
              <td style={{ padding: '20px 24px', color: '#d4d4d8', lineHeight: 1.5 }}>Simulated or real upstream failure during chaotic injection.</td>
            </tr>
          </tbody>
        </table>

        {/* Appendix */}
        <div style={{ background: '#111111', border: '1px solid #222', borderRadius: '16px', padding: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
            <Microscope size={32} color="#fff" />
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#fff', margin: 0 }}>Appendix: LGPA Engine</h2>
          </div>
          
          <p style={{ color: '#a1a1aa', marginBottom: '40px', lineHeight: 1.7, fontSize: '1.05rem' }}>
            The <strong style={{ color: '#fff' }}>Localized Geodesic Proximity Algorithm (LGPA)</strong> guarantees authentic physical displacement mapping across global proxy layers.
          </p>

          <div style={{ display: 'grid', gap: '24px' }}>
            {[
              { title: "Phase 1: Latency Calibration", desc: "Isolate Edge execution time. Derive pure single-trip Time-of-Flight (T1/T3)." },
              { title: "Phase 2: Geodesic Linear Interpolation", desc: "Compute virtual W2 coordinate via fractional latency alpha factor." },
              { title: "Phase 3: Distance Perimeter Check", desc: "Execute Haversine scan across 300+ edge cluster topology." },
              { title: "Phase 4: Vector Angle Arbitration", desc: "Calculate spherical Azimuth bearing to resolve equidistant data centers." },
              { title: "Phase 5: Mesh Dictionary Snapping", desc: "Snap to physical W2 infrastructure node for verified spatial telemetry." }
            ].map((phase, i) => (
              <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <CheckCircle2 size={24} color="#333" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: '6px', fontSize: '1.1rem' }}>{phase.title}</div>
                  <div style={{ color: '#888', fontSize: '0.95rem', lineHeight: 1.5 }}>{phase.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 7fr 5fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}} />
    </div>
  );
}

const codeStyle = {
  fontFamily: 'var(--font-mono), monospace',
  fontSize: '0.85rem',
  background: '#1f2937', // gray-800
  padding: '4px 8px',
  borderRadius: '4px',
  color: '#e5e7eb' // gray-200
};
