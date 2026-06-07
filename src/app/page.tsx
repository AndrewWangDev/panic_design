"use client";

import React, { useState, useEffect } from 'react';
import { Zap, ShieldAlert, Globe2, ArrowRight } from 'lucide-react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { Turnstile } from '@marsidev/react-turnstile';

const AnimatedCounter = ({ end, duration = 2000, prefix = "", suffix = "", isFloat = false, initial = 0 }: any) => {
  const [count, setCount] = useState(initial);
  
  useEffect(() => {
    let startTimestamp: number | null = null;
    let animationFrame: number;
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = initial + (end - initial) * ease;
      setCount(current);
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(step);
      }
    };
    animationFrame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [end, duration, initial]);

  return <span>{prefix}{isFloat ? count.toFixed(1) : Math.floor(count)}{suffix}</span>;
};

function HomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [terminalStep, setTerminalStep] = useState(0);
  const isLoggedIn = !!session;

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  useEffect(() => {
    if (searchParams?.get('error') === 'EnrollmentFull') {
      setShowLimitModal(true);
    }
  }, [searchParams]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    if (!turnstileToken) {
      // If we don't have a token, we might have to wait for it or just fail gracefully if in dev
      if (process.env.NODE_ENV !== 'development') {
        alert('Security verification pending. Please wait a second and try again.');
        setIsLoggingIn(false);
        return;
      }
    }

    if (turnstileToken) {
      try {
        const res = await fetch('/api/turnstile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: turnstileToken })
        });
        const data = await res.json();
        if (!data.success) {
          alert('Security verification failed.');
          setIsLoggingIn(false);
          return;
        }
      } catch (e) {
        setIsLoggingIn(false);
        return;
      }
    }

    signIn('github', { callbackUrl: '/dashboard' });
  };

  useEffect(() => {
    // Typewriter effect sequence with pauses
    const sequence = [
      { step: 1, delay: 1000 },
      { step: 2, delay: 800 },
      { step: 3, delay: 600 },
      { step: 4, delay: 2000 }, // The 2-second pause before 502
    ];
    let currentStep = 0;
    let initialTimer: NodeJS.Timeout;

    const runSequence = () => {
      if (currentStep >= sequence.length) return;
      initialTimer = setTimeout(() => {
        setTerminalStep(sequence[currentStep].step);
        currentStep++;
        runSequence();
      }, sequence[currentStep].delay);
    };

    initialTimer = setTimeout(() => runSequence(), 500);
    return () => clearTimeout(initialTimer);
  }, []);

  return (
    <div className={styles.main}>
      {showLimitModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,59,48,0.5)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ff3b30', fontSize: '1.25rem', margin: '0 0 16px 0' }}>
              <ShieldAlert size={24} /> 🛑 BETA ENROLLMENT LIMIT REACHED
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              The panic.design sandbox has reached its maximum compliance allocation. Current platform access is restricted to 100 total participants to enforce strict network infrastructure sandboxing.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowLimitModal(false)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                DISMISS
              </button>
              <a href="mailto:support@andrewwangdev.com?subject=panic.design Beta Access Request" style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}>
                CONTACT ADMINISTRATOR
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Screen 1: Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGlow} />
        
        <div className={styles.heroContainer}>
          <div className={styles.heroLeft}>
            <div className={styles.betaTag}>[ Beta ] Edge-Native Chaos Gateway</div>
            <h1 className={styles.heroTitle}>Design the <span className="glow-text">Panic.</span></h1>
            <p className={styles.heroSubtitle}>
              Don't wait for routing anomalies. Engineer them.<br/>
              A serverless control plane to inject precise network degradation across global edge nodes.
            </p>
            <div className={styles.heroActions}>
              {status === 'loading' ? (
                <button className={styles.btnGithub} disabled style={{ opacity: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                  Loading...
                </button>
              ) : isLoggedIn ? (
                <button className="btn-primary" onClick={() => router.push('/dashboard')}>
                  Start New Chaos Test <ArrowRight size={16} />
                </button>
              ) : (
                <button className={styles.btnGithub} onClick={handleLogin} disabled={isLoggingIn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                  {isLoggingIn ? 'Redirecting...' : 'Authenticate with GitHub'}
                </button>
              )}
              {/* Invisible Turnstile */}
              <div>
                <Turnstile
                  siteKey="0x4AAAAAADgKGlhfvExJwp8F"
                  onSuccess={(token) => setTurnstileToken(token)}
                  options={{ theme: 'dark' }}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.heroRight}>
            <div className={styles.terminal}>
              <div className={styles.terminalHeader}>
                <div className={`${styles.macBtn} ${styles.close}`} />
                <div className={`${styles.macBtn} ${styles.min}`} />
                <div className={`${styles.macBtn} ${styles.max}`} />
              </div>
              <div className={styles.terminalBody}>
                {terminalStep < 4 ? (
                  <>
                    {terminalStep >= 0 && (
                      <div className={styles.typingLine}>
                        <span className={styles.commandPrompt} />
                        curl -i "https://proxy.panic.design/?token=eyJhbGciOiJI..."
                      </div>
                    )}
                    {terminalStep >= 1 && (
                      <>
                        <div className={styles.outputLine}>* Connected to proxy.panic.design (104.18.2.161) port 443</div>
                        <div className={styles.outputLine}>* SSL connection using TLSv1.3 / AEAD-CHACHA20-POLY1305-SHA256</div>
                      </>
                    )}
                    {terminalStep >= 2 && (
                      <>
                        <div className={styles.outputLine}>&gt; GET /?token=eyJhbGciOiJI... HTTP/2</div>
                        <div className={styles.outputLine}>&gt; Host: proxy.panic.design</div>
                        <div className={styles.outputLine}>&gt;</div>
                      </>
                    )}
                    {terminalStep >= 3 && (
                      <>
                        <div className={styles.outputLine}>&lt; [Edge Node SJC] Intercepting request to api.your-app.com...</div>
                        <div className={styles.outputLine}>
                          &lt; [Chaos Engine] Auth success: 0.4ms. Rule matched: 2000ms TCP Latency.
                          <span className={styles.blinkingCursor}>_</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className={styles.errorLine}>&lt; HTTP/2 502 Bad Gateway</div>
                    <div className={styles.outputLine}>&lt; x-panic-auth-latency: 0.4ms</div>
                    <div className={styles.outputLine}>&lt; x-panic-trace-id: panic_req_9f8a7b6c</div>
                    <div className={styles.outputLine}>&lt; x-panic-action: latency_2000ms, status_502_override</div>
                    <div className={styles.outputLine}>&lt;</div>
                    <div className={styles.typingLine}>&#123;"panic_status": "Outage Successfully Executed at Edge Node SJC"&#125;</div>
                    <span className={styles.blinkingCursor}>_</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Screen 2: The Bento Box */}
      <section className={styles.bento}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>The Edge Advantage</h2>
        </div>
        
        <div className={styles.bentoGrid}>
          {/* Card 1: Zero-Intrusion (Large) */}
          <div className={`${styles.bentoCard} ${styles.large}`}>
            <div>
              <Zap size={32} className={styles.bentoIcon} />
              <h3 className={styles.bentoTitle}>Absolute Zero-Intrusion</h3>
              <p className={styles.bentoDesc}>
                No SDKs. No code changes to your backend business logic. Route your API traffic through our Serverless Gateway and control chaos directly at the network layer.
              </p>
            </div>
            {/* Minimal CSS Network Topology Vector */}
            <div style={{ flex: 1, minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <div style={{ position: 'relative', width: '240px', height: '140px' }}>
                <svg width="100%" height="100%" viewBox="0 0 240 140" style={{ position: 'absolute', top: 0, left: 0 }}>
                  <path d="M40 70 L120 30 L200 70 L120 110 Z" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="40" y1="70" x2="120" y2="70" stroke="rgba(255,59,48,0.8)" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="120" y1="70" x2="200" y2="70" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                </svg>
                <div style={{ position: 'absolute', left: '25px', top: '55px', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, fontSize: '12px' }}>💻</div>
                <div style={{ position: 'absolute', left: '105px', top: '55px', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: '0 0 20px rgba(255,59,48,0.4)' }}><Zap size={16} color="#fff" /></div>
                <div style={{ position: 'absolute', right: '25px', top: '55px', width: '30px', height: '30px', borderRadius: '8px', background: 'var(--surface)', border: '2px solid var(--surface-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, fontSize: '12px' }}>🗄️</div>
              </div>
            </div>
          </div>

          {/* Card 2: Stateless Tokens */}
          <div className={styles.bentoCard}>
            <ShieldAlert size={32} className={styles.bentoIcon} />
            <h3 className={styles.bentoTitle}>Stateless Cryptography</h3>
            <p className={styles.bentoDesc}>
              Built exclusively for edge networks. Every request is verified via HMAC-SHA256 JWT signatures for instant abuse prevention and O(1) revocation.
            </p>
          </div>

          {/* Card 3: Global Network */}
          <div className={styles.bentoCard}>
            <Globe2 size={32} className={styles.bentoIcon} />
            <h3 className={styles.bentoTitle}>Global Network</h3>
            <p className={styles.bentoDesc}>
              Simulate realistic BGP routing anomalies and packet loss across 300+ global edge locations.
            </p>
          </div>
        </div>
      </section>

      {/* Screen 3: The Code Integration */}
      <section className={styles.codeSection}>
        <h2 className={styles.sectionTitle}>One line of code. Infinite chaos.</h2>
        <div className={styles.codeBlock}>
          <span className={styles.highlight}>const</span> apiClient = new ApiClient(&#123;<br/>
          {'  '}baseUrl: process.env.NODE_ENV === <span className={styles.string}>'test'</span> <br/>
          {'    '}? <span className={styles.string}>'https://proxy.panic.design'</span> <br/>
          {'    '}: <span className={styles.string}>'https://api.production.com'</span>,<br/>
          {'  '}headers: &#123;<br/>
          {'    '}<span className={styles.string}>'Authorization'</span>: <span className={styles.string}>`Bearer $&#123;process.env.PANIC_TOKEN&#125;`</span><br/>
          {'  '}&#125;<br/>
          &#125;);
        </div>
      </section>

      {/* Screen 4: Metrics & Footer */}
      <div>
        <div className={styles.metrics}>
          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              <AnimatedCounter end={300} suffix="+" />
            </div>
            <div className={styles.metricLabel}>Edge Locations</div>
          </div>
          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              <AnimatedCounter end={1.4} isFloat={true} suffix="M" />
            </div>
            <div className={styles.metricLabel}>Outages Injected</div>
          </div>
          <div className={styles.metricItem}>
            <div className={styles.metricValue}>
              <AnimatedCounter initial={10} end={5} prefix="< " suffix="ms" duration={1500} />
            </div>
            <div className={styles.metricLabel}>Auth Latency</div>
          </div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.footerLinks}>
            <a href="#" className={styles.footerLink}>© 2026 Panic.Design</a>
            <a href="https://github.com/AndrewWangDev/panic_design" className={styles.footerLink}>GitHub</a>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
          </div>
          <div>
            <span className={styles.footerLink} style={{ cursor: 'pointer' }}>English (US)</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <HomeContent />
    </React.Suspense>
  );
}
