"use client";

import React from 'react';

const releases = [
  {
    version: "v1.4.0 - Compliance Architecture & Telemetry UX Polish",
    date: "June 6, 2026",
    changes: [
      { type: "Feature", text: "Enforced CCPA/CPRA-compliant Privacy Policy and Terms of Service, strictly adhering to the Data Minimization architecture." },
      { type: "Feature", text: "Introduced a highly customizable real-time telemetry panel within the User Center dropdown to intuitively track quota consumption and reset heartbeats." },
      { type: "Feature", text: "Designed a unified, cyberpunk-themed Global Interceptor (Error Modal) to gracefully handle network exceptions, rate-limiting warnings, and critical credential exposures." },
      { type: "Bugfix", text: "Resolved Next.js SSR hydration mismatches with browser contexts, ensuring flawless rendering of complex interactive components within the Edge Runtime." },
      { type: "Bugfix", text: "Unified the control plane testing state machine and flushed deprecated instruction caches, guaranteeing absolute timing precision for \"RUN INJECTION AGAIN\" triggers." }
    ]
  },
  {
    version: "v1.3.0 - Enterprise Risk Control & Edge Quota Scheduler",
    date: "June 4, 2026",
    changes: [
      { type: "Feature", text: "Integrated Cloudflare Turnstile (Invisible Mode), establishing an absolute zero-trust defense against automated bot abuse with zero user friction." },
      { type: "Feature", text: "Deployed multi-tiered edge compute quotas (Hourly/Daily) to precisely throttle proxy tunnel concurrency and safeguard core compute resources." },
      { type: "Feature", text: "Established a strict concurrency cap for Active Tokens (Max 5 per account) and introduced granular Custom TTL validation for JWT expiration." },
      { type: "Bugfix", text: "Refactored the Turnstile communication lifecycle with an underlying heartbeat retry mechanism, gracefully mitigating intermittent loading failures caused by local DNS blackholing." },
      { type: "Bugfix", text: "Precisely decoupled quota deduction logic, strictly isolating free \"configuration generation\" from compute-heavy \"Edge Injection (RUN CLOUD INJECTION)\" executions." }
    ]
  },
  {
    version: "v1.2.0 - Introducing AIOps Copilot & Semantic Guardrails",
    date: "June 2, 2026",
    changes: [
      { type: "Feature", text: "Deeply integrated Cloudflare Workers AI (llama-3.1-8b-instruct) to power the AIOps Copilot, enabling complex network fault orchestration via natural language directives." },
      { type: "Feature", text: "Forged strict AI Semantic Guardrails to proactively intercept and nullify malicious network attack intents, such as DDoS or privilege escalation attempts, at the source." },
      { type: "Feature", text: "Launched the Copilot Insight module, automatically generating comprehensive \"Pre- vs. Post-Injection\" qualitative assessments and network state post-mortems." },
      { type: "Bugfix", text: "Fortified underlying JSON Schema validation and T1/T3 routing constraints, categorically eliminating AI state hallucinations when processing conflicting fault parameters." },
      { type: "Bugfix", text: "Optimized the AI Autofill rendering lifecycle, ensuring seamless UI state resets and rollbacks during terminal suspension or request interruptions." }
    ]
  },
  {
    version: "v1.1.0 - Global Topology Visualization & LGPA Telemetry Engine",
    date: "May 31, 2026",
    changes: [
      { type: "Feature", text: "Integrated a 3D TopoJSON rendering engine to provide real-time, spatial visual projection of cloud injection routing trajectories (W1 ➔ W2 ➔ W3)." },
      { type: "Feature", text: "Engineered the Localized Geodesic Proximity Algorithm (LGPA) to dynamically calculate authentic edge RTT and spatial network topology displacement." },
      { type: "Feature", text: "Forged an immersive Terminal Panel where map packet animation rates are now strictly synchronized with real-time injection latency parameters." },
      { type: "Bugfix", text: "Refactored map data label rendering logic with dynamic collision detection, ensuring pristine visual clarity under high-concurrency topology rendering." },
      { type: "Bugfix", text: "Calibrated data-plane telemetry extraction logic, leveraging Cloudflare Edge-native Contexts to achieve absolute physical geolocation of the user's ingress node (W1)." }
    ]
  },
  {
    version: "v1.0.0 - Core Architecture & Control Plane Genesis",
    date: "May 29, 2026",
    changes: [
      { type: "Feature", text: "Architected a stateless JWT infrastructure and leveraged lucide-react with d3-geo to construct a high-performance dashboard, drastically reducing traditional DB I/O latency and Control Plane TTFB." },
      { type: "Feature", text: "Integrated Prisma as the ORM layer to architect a highly scalable and robust backend data model." },
      { type: "Feature", text: "Initialized Control Plane and Data Plane logic, firmly establishing the core operational boundary and isolation model." },
      { type: "Feature", text: "Implemented NextAuth.js for GitHub OAuth integration, delivering a secure, frictionless, and developer-centric authentication flow." },
      { type: "Feature", text: "Standardized baseline chaos injection policies, comprehensively covering both L3 network routing and L7 application layer degradation." },
      { type: "Feature", text: "Officially migrated the platform to the cloud via @opennextjs/cloudflare, leveraging global edge nodes to guarantee ultra-low latency responses." }
    ]
  }
];

export default function Changelog() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#ededed', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ marginBottom: '64px' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 16px 0', letterSpacing: '-0.02em', color: '#fff' }}>About panic.design</h1>
          <p style={{ color: '#a1a1aa', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
            Built for engineering teams who understand that failure is not an option—it is a guarantee.
          </p>
        </div>

        <div style={{ position: 'relative', paddingLeft: '32px' }}>
          {/* Vertical Timeline Line */}
          <div style={{ position: 'absolute', top: '12px', bottom: '0', left: '7px', width: '2px', background: 'linear-gradient(to bottom, #333 0%, #333 90%, transparent 100%)' }} />

          {releases.map((release, index) => (
            <div key={index} style={{ position: 'relative', paddingBottom: index === releases.length - 1 ? '0' : '56px' }}>
              {/* Timeline Dot */}
              <div style={{ position: 'absolute', top: '8px', left: '-30px', width: '12px', height: '12px', borderRadius: '50%', background: '#000', border: '2px solid #fff', zIndex: 1 }} />
              
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0', color: '#fff', letterSpacing: '-0.01em' }}>
                {release.version}
              </h2>
              <div style={{ color: '#a1a1aa', fontSize: '0.85rem', marginBottom: '20px', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {release.date}
              </div>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px 28px', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {release.changes.map((change, cIndex) => (
                    <li key={cIndex} style={{ display: 'flex', gap: '12px', lineHeight: 1.6 }}>
                      <span style={{ 
                        color: change.type === 'Feature' ? '#10b981' : '#f59e0b', 
                        fontWeight: 600, 
                        fontSize: '0.85rem',
                        marginTop: '2px',
                        whiteSpace: 'nowrap'
                      }}>
                        [{change.type}]
                      </span>
                      <span style={{ color: '#d4d4d8', fontSize: '0.95rem' }}>
                        {change.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
