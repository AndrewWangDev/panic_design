"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Activity, Play, Pause } from 'lucide-react';
import styles from './dashboard.module.css';
import CustomSelect from './CustomSelect';
import WorldMap from '@/components/WorldMap';

const MOCK_LOGS = [
  "[SYSTEM] Initiating global telemetry stream...",
  "[ANYCAST] Routing optimization complete. PoP instances: 24 active.",
  "[HEARTBEAT] Node FRA (Frankfurt): 12ms latency, Status: OK",
  "[HEARTBEAT] Node SJC (San Jose): 8ms latency, Status: OK",
  "[HEARTBEAT] Node NRT (Tokyo): 24ms latency, Status: OK",
  "[MESH] Edge Gateway online. Listening on 0.0.0.0:443",
  "[AUDIT] 0 active chaos rules in the current deployment.",
  "[TELEMETRY] Inbound traffic: 342 req/s. Fault injection rate: 0.00%",
  "[SYSTEM] Awaiting control plane commands...",
  "[SYSTEM] Syncing with Cloudflare D1 distributed database... OK."
];

const RollingLogs = () => {
  // Use objects with unique IDs for React keys to ensure smooth CSS animations on enter
  const [logs, setLogs] = useState<{id: string, text: string}[]>(
    MOCK_LOGS.slice(0, 5).map((text, i) => ({ id: `init-${i}`, text }))
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 5;
    const interval = setInterval(() => {
      setLogs(prev => {
        // push 1 or 2 lines
        const linesToAddCount = Math.random() > 0.5 ? 2 : 1;
        const newLines = [];
        for (let j = 0; j < linesToAddCount; j++) {
          newLines.push({
            id: `log-${Date.now()}-${j}`,
            text: MOCK_LOGS[(i + j) % MOCK_LOGS.length]
          });
        }
        i += linesToAddCount;
        
        const newLogs = [...prev, ...newLines];
        if (newLogs.length > 12) return newLogs.slice(newLogs.length - 12);
        return newLogs;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className={styles.rollingLogHeader}>Background Telemetry - View Only</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {logs.map((log) => {
          const match = log.text.match(/^(\[.*?\])(.*)$/);
          if (!match) return <div key={log.id} className={styles.logLine}>{log.text}</div>;
          return (
            <div key={log.id} className={styles.logLine}>
              <span className={styles.logPrefix}>{match[1]}</span>{match[2]}
            </div>
          );
        })}
      </div>
    </>
  );
};

const TypewriterPayload = ({ fullToken, targetHost, isSimulating, onSimulationStart, fault, t1, t2, t3 }: { fullToken: string, targetHost: string, isSimulating: boolean, onSimulationStart: () => void, fault: string, t1: number, t2: number, t3: number }) => {
  const [text, setText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'done'>('idle');
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      const container = bottomRef.current.parentElement;
      if (container) {
        // Find the closest scrollable container (the codeBlock)
        const scrollContainer = container.closest('[class*="codeBlock"]') || container;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [testLogs, testState]);

  // If simulation is cancelled from parent, reset testState
  useEffect(() => {
    if (!isSimulating && testState === 'testing') {
      setTestState('done');
      setTestLogs(prev => [...prev, '', '< Simulation Cancelled']);
    }
  }, [isSimulating, testState]);
  
  const tokenDisplay = fullToken.length > 12 
    ? fullToken.substring(0, 8) + '...' + fullToken.slice(-4) 
    : fullToken;
    
  const fullContent = `# Edge Token issued successfully.

export PANIC_TOKEN="${tokenDisplay}"

curl -i "https://gateway.andrewwangdev.com/?token=$PANIC_TOKEN"`;

  useEffect(() => {
    let i = 0;
    setText('');
    setTypingDone(false);
    setTestState('idle');
    setTestLogs([]);
    const interval = setInterval(() => {
      setText(fullContent.substring(0, i));
      i++;
      if (i > fullContent.length) {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 10);
    return () => clearInterval(interval);
  }, [fullContent]);

  const handleTest = async () => {
    onSimulationStart();
    setTestState('testing');
    setTestLogs([
      '> Initiating TLS handshake with gateway.andrewwangdev.com...',
      '> GET / HTTP/1.1',
      '> Host: gateway.andrewwangdev.com',
      '> '
    ]);
    
    try {
      const res = await fetch('/api/tokens/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fullToken })
      });
      const data = await res.json() as any;
      
      setTestLogs(prev => {
        const logs = [
          ...prev,
          `< HTTP/1.1 ${data.status} ${data.statusText || ''}`
        ];
        
        if (data.status >= 400 && data.responseBody) {
          logs.push(`< ${data.responseBody}`);
        }
        
        logs.push('');
        
        if (fault === 'latency') {
          logs.push(`[Telemetry] Edge Network RTT: ${t1}ms`);
          logs.push(`[Telemetry] Injected Latency: ${t2}ms`);
          logs.push(`[Telemetry] Upstream Backhaul: ${t3}ms`);
          logs.push(`[System] Target Host: ${targetHost || 'extracted from JWT'}`);
        } else if (fault === '502') {
          logs.push(`[Telemetry] Edge Network RTT: ${t1}ms`);
          logs.push(`[Telemetry] Upstream Backhaul: -- (ABORTED)`);
          logs.push(`[System] Target Unreachable. Edge payload delivered.`);
        } else if (fault === '504') {
          logs.push(`[Telemetry] Edge Network RTT: ${t1}ms`);
          logs.push(`[Telemetry] Upstream Backhaul: -- (TIMEOUT_EXCEEDED)`);
        }
        
        return logs;
      });
      setTestState('done');
    } catch (e: any) {
      setTestLogs(prev => [...prev, `< Error: ${e.message}`, `[System] Test Failed.`]);
      setTestState('done');
    }
  };

  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'flex', flexDirection: 'column' }}>
      <div>{text}</div>
      {typingDone && (
        <div style={{ marginTop: '24px' }}>
          <button 
            className={styles.runTestBtn} 
            onClick={handleTest} 
            disabled={testState === 'testing'}
          >
            <Activity size={14} /> {testState === 'testing' ? 'TEST IN PROGRESS...' : 'RUN CLOUD INJECTION'}
          </button>
        </div>
      )}
      {testLogs.length > 0 && (
        <div className={styles.testLogContainer}>
          {testLogs.map((l, i) => {
            let color = 'var(--text-secondary)';
            if (l.startsWith('< HTTP/1.1 5')) color = '#ef4444';
            else if (l.startsWith('< HTTP/1.1 2')) color = '#10b981';
            else if (l.startsWith('< HTTP/1.1 4')) color = '#f59e0b';
            else if (l.startsWith('[System]')) color = '#3b82f6';
            
            return <div key={i} style={{ marginBottom: '4px', color }}>{l}</div>;
          })}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
const getSliderColor = (value: number) => {
  if (value < 500) return '#10b981'; 
  if (value < 1000) return '#84cc16'; 
  if (value < 1500) return '#eab308'; 
  if (value < 2000) return '#f97316'; 
  return '#ef4444'; 
};

const RealTimeSimulationChart = ({ latency, jitter, distribution }: { latency: number, jitter: number, distribution: string }) => {
  const dataPoints = 40;
  const [points, setPoints] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const generatePoint = (baseLat: number, jit: number, dist: string) => {
    let val = baseLat;
    if (dist === 'Uniform') {
      val = baseLat + (Math.random() * 2 - 1) * jit;
    } else if (dist === 'Normal') {
      let u = 0, v = 0;
      while(u === 0) u = Math.random();
      while(v === 0) v = Math.random();
      let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      val = baseLat + num * (jit / 2);
    } else if (dist === 'Spikes') {
      val = baseLat + (Math.random() > 0.85 ? Math.random() * jit : 0);
    }
    return Math.max(0, val);
  };

  useEffect(() => {
    const saved = localStorage.getItem('panic_sim_playing');
    if (saved !== null) {
      setIsPlaying(saved === 'true');
    }
    const initial = [];
    for (let i = 0; i < dataPoints; i++) {
      initial.push(generatePoint(latency, jitter, distribution));
    }
    setPoints(initial);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPoints(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        next.shift();
        next.push(generatePoint(latency, jitter, distribution));
        return next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying, latency, jitter, distribution]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    localStorage.setItem('panic_sim_playing', String(nextState));
  };

  if (points.length === 0) return null;

  const maxVal = Math.max(latency + jitter + 50, 100);
  const w = 180;
  const h = 100;
  const paddingLeft = 35;
  const paddingBottom = 15;
  const paddingTop = 10;
  const paddingRight = 5;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  const scaleY = (val: number) => h - paddingBottom - (val / maxVal) * chartH;
  const scaleX = (idx: number) => paddingLeft + (idx / (dataPoints - 1)) * chartW;

  const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${scaleX(idx)},${scaleY(p)}`).join(' ');
  const color = getSliderColor(latency);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible', fontFamily: 'var(--font-mono)' }}>
        <line x1={paddingLeft} y1={scaleY(maxVal)} x2={w - paddingRight} y2={scaleY(maxVal)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
        <line x1={paddingLeft} y1={scaleY(maxVal/2)} x2={w - paddingRight} y2={scaleY(maxVal/2)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
        <line x1={paddingLeft} y1={scaleY(0)} x2={w - paddingRight} y2={scaleY(0)} stroke="rgba(255,255,255,0.1)" />
        
        <text x={paddingLeft - 5} y={scaleY(maxVal) + 3} fill="rgba(255,255,255,0.85)" fontSize="8" textAnchor="end" fontWeight="500">{Math.round(maxVal)}ms</text>
        <text x={paddingLeft - 5} y={scaleY(maxVal/2) + 3} fill="rgba(255,255,255,0.85)" fontSize="8" textAnchor="end" fontWeight="500">{Math.round(maxVal/2)}ms</text>
        <text x={paddingLeft - 5} y={scaleY(0) + 3} fill="rgba(255,255,255,0.85)" fontSize="8" textAnchor="end" fontWeight="500">0ms</text>

        <line x1={paddingLeft} y1={scaleY(latency)} x2={w - paddingRight} y2={scaleY(latency)} stroke="rgba(255,255,255,0.3)" strokeDasharray="4,2" />
        <text x={w - paddingRight - 2} y={scaleY(latency) - 4} fill="rgba(255,255,255,0.9)" fontSize="8" textAnchor="end" fontWeight="bold">Base</text>

        <path d={pathData} stroke={color} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={`${pathData} L${scaleX(dataPoints-1)},${scaleY(0)} L${scaleX(0)},${scaleY(0)} Z`} fill={color} opacity="0.1" />
      </svg>
      <button 
        onClick={togglePlay}
        style={{
          position: 'absolute',
          bottom: '-5px',
          right: '5px',
          background: 'rgba(0,0,0,0.8)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          padding: '6px',
          cursor: 'pointer',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          transition: 'all 0.2s'
        }}
        title={isPlaying ? "Pause Simulation" : "Play Simulation"}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>
    </div>
  );
};
export default function Dashboard() {
  const [targetHost, setTargetHost] = useState('');
  const [fault, setFault] = useState<'502' | '504' | 'latency' | null>(null);
  const [latency, setLatency] = useState(2500);
  const [jitter, setJitter] = useState(0);
  const [distribution, setDistribution] = useState<'Uniform' | 'Normal' | 'Spikes'>('Uniform');
  const [ttl, setTtl] = useState('15m');
  const [customTtl, setCustomTtl] = useState(24);

  const [isSimulating, setIsSimulating] = useState(false);

  const ttlOptions = [
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '12h', label: '12 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: 'custom', label: 'Custom...' }
  ];

  const distOptions = [
    { value: 'Uniform', label: 'Uniform' },
    { value: 'Normal', label: 'Normal' },
    { value: 'Spikes', label: 'Spikes' }
  ];

  const [generatedToken, setGeneratedToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [latestFullToken, setLatestFullToken] = useState('');
  
  const [activeTokens, setActiveTokens] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [isMounted, setIsMounted] = useState(false);
  const [enableAnimation, setEnableAnimation] = useState(false);

  // Load state from localStorage on initial render
  useEffect(() => {
    const saved = localStorage.getItem('panic-dashboard-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.targetHost !== undefined) setTargetHost(state.targetHost);
        if (state.fault !== undefined) setFault(state.fault);
        if (state.latency !== undefined) setLatency(state.latency);
        if (state.jitter !== undefined) setJitter(state.jitter);
        if (state.distribution !== undefined) setDistribution(state.distribution);
        if (state.ttl !== undefined) setTtl(state.ttl);
        if (state.customTtl !== undefined) setCustomTtl(state.customTtl);
      } catch (e) {
        // ignore
      }
    }
    setIsMounted(true);
    // Enable animations slightly after mount to prevent initial expand slide-downs
    const timer = setTimeout(() => setEnableAnimation(true), 150);
    return () => clearTimeout(timer);
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/tokens');
      if (res.ok) {
        const data = await res.json() as any;
        const formattedTokens = data.tokens.map((t: any) => {
          let config: any = { fault: 'unknown' };
          try { config = JSON.parse(t.config); } catch(e){}
          
          let faultPolicyStr = config.fault === 'latency' 
            ? `${config.latency}ms TCP Latency` 
            : `${config.fault} Bad Gateway`;
            
          if (config.fault === 'latency' && config.jitter > 0) {
            faultPolicyStr += ` (±${config.jitter}ms ${config.distribution})`;
          }

          return {
            id: t.id,
            tokenHint: t.tokenHint,
            target: t.targetHost,
            fault: faultPolicyStr,
            issuedAt: new Date(t.createdAt).toLocaleString(),
            issuedAtFull: new Date(t.createdAt).toLocaleString(),
            isRevoked: t.isRevoked,
            issuedWithSalt: t.issuedWithSalt,
            lastUsedAt: t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : 'Never'
          };
        });
        setActiveTokens(formattedTokens);
      }
    } catch (err) {
      console.error('Failed to fetch tokens', err);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // Save state to localStorage whenever form controls change
  useEffect(() => {
    const state = { targetHost, fault, latency, jitter, distribution, ttl, customTtl };
    localStorage.setItem('panic-dashboard-state', JSON.stringify(state));
  }, [targetHost, fault, latency, jitter, distribution, ttl, customTtl]);

  const [targetHostError, setTargetHostError] = useState('');

  const validateHost = (host: string) => {
    if (host && !/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(host)) {
      setTargetHostError('Invalid hostname format');
    } else {
      setTargetHostError('');
    }
  };

  const handleTargetHostChange = (val: string) => {
    const host = val.trim();
    setTargetHost(host);
    validateHost(host);
  };

  const handleTargetHostBlur = () => {
    let host = targetHost.trim();
    if (host.startsWith('http://') || host.startsWith('https://')) {
      try {
        const url = new URL(host);
        host = url.hostname;
      } catch(e) {}
    } else if (host.includes('/')) {
      host = host.split('/')[0];
    }
    setTargetHost(host);
    validateHost(host);
  };

  const handleTargetHostPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('Text');
    if (pasted.startsWith('http://') || pasted.startsWith('https://')) {
      e.preventDefault();
      let extracted = pasted;
      try {
        const url = new URL(pasted);
        extracted = url.hostname;
      } catch(err) {
        if (pasted.includes('/')) extracted = pasted.split('/')[0];
      }
      setTargetHost(extracted);
      validateHost(extracted);
    }
  };

  const isFormValid = targetHost.length > 0 && fault !== null && !targetHostError;

  const handleGenerate = async () => {
    if (!isFormValid) return;
    
    let ttlHours = 0.25;
    if (ttl === '1h') ttlHours = 1;
    if (ttl === '12h') ttlHours = 12;
    if (ttl === '24h') ttlHours = 24;
    if (ttl === 'custom') ttlHours = customTtl;

    try {
      const res = await fetch('/api/tokens/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHost,
          fault,
          latency,
          jitter,
          distribution,
          customTtl: ttlHours
        })
      });

      if (res.ok) {
        const data = await res.json() as any;
        const fullToken = data.jwt;
        setGeneratedToken(fullToken);
        setLatestFullToken(fullToken);
        setShowModal(true);
        fetchTokens();
      } else {
        alert('Failed to generate token');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating token');
    }
  };

  const handleCopy = (text: string, isModal: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isModal) {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 1000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    }
  };

  const handleRevoke = async (id: string) => {
    setActiveTokens(activeTokens.map(t => t.id === id ? { ...t, isRevoked: true } : t));
    
    try {
      await fetch('/api/tokens/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      // Optionally fetchTokens() to ensure state sync, but optimistic is fine for now
    } catch (err) {
      console.error('Failed to revoke token:', err);
      // Revert on failure
      fetchTokens();
    }
  };



  return (
    <div className={styles.dashboard}>
      <div className={styles.container} style={{ opacity: isMounted ? 1 : 0, transition: 'opacity 0.2s ease-out' }}>
        
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Welcome to the core console. Here you can generate new edge tokens, monitor chaos injection logs, and configure global routing rules.
          </p>
        </div>

        {/* Top Grid */}
        <div className={styles.gridTop}>
          
          {/* Left: Control Plane */}
          <div className={`${styles.card} ${styles.controlPlaneCard} ${isSimulating ? styles.controlPlaneCardSimulating : ''}`}>
            <div className={styles.cardHeader}>
              Control Plane <div className={styles.blinkDot} />
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.targetRow}>
                <div className={styles.targetHostWrap}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Target Hostname</span>
                    <span className={styles.labelHint}>HTTPS or HTTP2 Only</span>
                  </div>
                  <input 
                    type="text" 
                    className={`${styles.inputField} ${targetHostError ? styles.inputError : ''}`} 
                    placeholder="api.your-production.com"
                    value={targetHost}
                    onChange={(e) => handleTargetHostChange(e.target.value)}
                    onBlur={handleTargetHostBlur}
                    onPaste={handleTargetHostPaste}
                  />
                  {targetHostError && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {targetHostError}
                    </div>
                  )}
                </div>

                <div className={styles.ttlWrap}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Token TTL</span>
                  </div>
                  <div className={styles.ttlControl}>
                    <div style={{ flex: 1 }}>
                      <CustomSelect 
                        options={ttlOptions}
                        value={ttl}
                        onChange={(val) => setTtl(val)}
                      />
                    </div>
                    {ttl === 'custom' && (
                      <input 
                        type="number" 
                        min="1" max="168"
                        value={customTtl}
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (val > 168) val = 168;
                          if (val < 1) val = 1;
                          setCustomTtl(val);
                        }}
                        className={styles.ttlCustomInput}
                        title="Hours (1-168)"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.labelRow}>
                <span className={styles.label}>Blast Radius and Faults</span>
              </div>
              <div className={styles.capsuleGroup}>
                <button 
                  className={`${styles.capsuleBtn} ${fault === '502' ? styles.active : ''}`}
                  onClick={() => setFault('502')}
                >
                  502 Bad Gateway
                </button>
                <button 
                  className={`${styles.capsuleBtn} ${fault === '504' ? styles.active : ''}`}
                  onClick={() => setFault('504')}
                >
                  504 Gateway Timeout
                </button>
                <button 
                  className={`${styles.capsuleBtn} ${fault === 'latency' ? styles.active : ''}`}
                  onClick={() => setFault('latency')}
                >
                  Latency Injection
                </button>
              </div>

              {fault === 'latency' && (
                <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--dash-input-border)', animation: enableAnimation ? 'slideDown 0.3s ease-out' : 'none' }}>
                    <div className={styles.latencyPanel}>
                      <div className={styles.latencyCol}>
                        <div className={styles.latencyTitle}>Algorithm & Parameters</div>
                        
                        <div className={styles.latencyControlRow} style={{ alignItems: 'center' }}>
                          <div className={styles.latencyLabel}>Distribution</div>
                          <div style={{flex: 1}} />
                          <div style={{ width: '140px' }}>
                            <CustomSelect 
                              options={distOptions}
                              value={distribution}
                              onChange={(val) => setDistribution(val as any)}
                            />
                          </div>
                        </div>

                        <div className={styles.latencyControlRow} style={{ '--slider-color': getSliderColor(latency) } as React.CSSProperties}>
                          <div className={styles.latencyLabel}>Base Latency</div>
                          <div className={styles.latencySliderWrap}>
                            <input 
                              type="range" min="0" max="10000" step="100"
                              value={latency}
                              onChange={(e) => setLatency(Number(e.target.value))}
                              className={styles.slider}
                            />
                          </div>
                          <div className={styles.inputWithUnit}>
                            <input 
                              type="number" 
                              min="0" max="10000"
                              value={latency}
                              onChange={(e) => setLatency(Number(e.target.value))}
                              className={styles.latencyInput}
                            />
                            <span className={styles.unitLabel}>ms</span>
                          </div>
                        </div>

                        <div className={styles.latencyControlRow}>
                          <div className={styles.latencyLabel}>Network Jitter</div>
                          <div style={{flex: 1}} />
                          <div className={styles.inputWithUnit}>
                            <input 
                              type="number" 
                              min="0"
                              placeholder="± 0"
                              value={jitter || ''}
                              onChange={(e) => setJitter(Number(e.target.value))}
                              className={styles.latencyInput}
                            />
                            <span className={styles.unitLabel}>ms</span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.latencyCol}>
                        <div className={styles.latencyTitle}>Real-time Simulation</div>
                        <div className={styles.distChart} style={{ height: '140px', marginTop: '12px', overflow: 'hidden' }}>
                          <RealTimeSimulationChart latency={latency} jitter={jitter} distribution={distribution} />
                        </div>
                      </div>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.generateContainer}>
              <button 
                className={`${styles.generateBtn} ${isFormValid ? styles.ready : styles.disabled}`}
                disabled={!isFormValid}
                onClick={handleGenerate}
              >
                Generate Edge Token
              </button>
            </div>
          </div>

          {/* Right: Edge Payload */}
          <div className={`${styles.card} ${styles.edgePayloadCard} ${isSimulating ? styles.edgePayloadCardSimulating : ''}`}>
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Edge Payload {isSimulating && '- Global Telemetry'}</span>
              {isSimulating && (
                <button className={styles.cancelBtn} onClick={() => setIsSimulating(false)}>
                  Cancel Test
                </button>
              )}
            </div>
            
            <div className={styles.payloadContent}>
              {/* Map Container (Expands when simulating) */}
              <div className={`${styles.mapContainer} ${isSimulating ? styles.mapActive : ''}`}>
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isSimulating && (
                    <WorldMap 
                      w1={[-122.3933, 37.7697]} // Mock Control Plane (SF)
                      w2={[8.5706, 50.0333]} // Mock Data Plane (FRA)
                      w3={[114.1694, 22.3193]} // Mock Target (HKG)
                      t1={24}
                      t2={fault === 'latency' ? latency : 400} // Mock t2
                      t3={18}
                      fault={fault || 'latency'}
                      targetHost={targetHost}
                      latencyParams={{ base: latency, jitter: jitter, distribution: distribution }}
                    />
                  )}
                </div>
              </div>

              {/* Terminal Container */}
              <div className={`${styles.terminalContainer} ${isSimulating ? styles.terminalContainerSimulating : styles.terminalContainerNormal}`}>
                <div className={styles.codeBlock} style={{ overflowY: generatedToken ? 'auto' : 'hidden', height: '100%' }}>
                  {generatedToken && (
                    <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={() => handleCopy(`export PANIC_TOKEN="${generatedToken}"\ncurl -i "https://gateway.andrewwangdev.com/?token=$PANIC_TOKEN"`)}>
                      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  )}
                  
                  {generatedToken ? (
                    <TypewriterPayload 
                      fullToken={generatedToken} 
                      targetHost={targetHost} 
                      isSimulating={isSimulating}
                      onSimulationStart={() => setIsSimulating(true)}
                      fault={fault || 'latency'}
                      t1={24}
                      t2={latency}
                      t3={18}
                    />
                  ) : (
                    <RollingLogs />
                  )}
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Bottom Grid: Active Edge Tokens */}
        <div className={styles.gridBottom}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              Active Edge Tokens
            </div>
            
            {activeTokens.length > 0 ? (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Token Hint</th>
                      <th>Target Scope</th>
                      <th>Fault Policy</th>
                      <th>Issued At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((token) => (
                      <tr key={token.id} className={token.isRevoked ? styles.rowRevoked : ''}>
                        <td className={styles.tokenCell}>
                          {token.tokenHint}
                        </td>
                        <td className={styles.tokenCell} style={{ cursor: 'pointer' }} onClick={() => handleCopy(token.target, false)} title="Click to copy target">
                          {token.target}
                          <Copy size={12} style={{ opacity: 0.5, marginLeft: '6px' }} />
                        </td>
                        <td className={styles.faultCell}>{token.fault}</td>
                        <td title={`Last used: ${token.issuedAtFull}`}>{token.issuedAt}</td>
                        <td>
                          <button 
                            className={styles.revokeBtn}
                            onClick={() => handleRevoke(token.id)}
                            disabled={token.isRevoked}
                          >
                            {token.isRevoked ? '[ Revoked ]' : 'Revoke'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {Math.ceil(activeTokens.length / pageSize) > 1 && (
                  <div className={styles.pagination}>
                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      aria-label="Previous Page"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div className={styles.pageNumbers}>
                      {Array.from({ length: Math.ceil(activeTokens.length / pageSize) }).map((_, i) => (
                        <button 
                          key={i} 
                          className={`${styles.pageBtn} ${currentPage === i + 1 ? styles.pageActive : ''}`}
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === Math.ceil(activeTokens.length / pageSize)}
                      onClick={() => setCurrentPage(p => p + 1)}
                      aria-label="Next Page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.emptyState}>
                No active chaos tokens. Initiate a test from the control plane above.
              </div>
            )}
            
          </div>
        </div>

      </div>

      {/* Show Once Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalTitle}>Critical Payload</div>
            <div className={styles.modalWarning}>
              Make sure to copy your personal access token now.<br/>
              <strong>You won't be able to see it again!</strong>
            </div>
            
            <div className={styles.modalTokenBox}>
              <button className={`${styles.copyBtn} ${modalCopied ? styles.copied : ''}`} onClick={() => handleCopy(latestFullToken, true)}>
                {modalCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
              {latestFullToken}
            </div>

            <button className={styles.modalClose} onClick={() => setShowModal(false)}>
              I have copied it safely
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
