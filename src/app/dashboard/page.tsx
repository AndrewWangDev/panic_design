"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Activity, Play, Pause, Zap, Search, Lock, MonitorSmartphone } from 'lucide-react';
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

const renderFaultBadges = (config: any, isRevoked?: boolean) => {
  if (!config || config.fault === 'unknown') return <span className={styles.badgeNeutral}>Unknown</span>;
  
  const getBadgeClass = (defaultClass: string) => isRevoked ? styles.badgeNeutral : defaultClass;

  if (config.fault === 'latency') {
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <span className={getBadgeClass(styles.badgeAmber)}>Lat: {config.latency}ms</span>
        {config.jitter > 0 && <span className={getBadgeClass(styles.badgeAmber)}>Jit: ±{config.jitter}ms</span>}
        {config.packetLoss > 0 && <span className={getBadgeClass(styles.badgeRed)}>Drop: {config.packetLoss}%</span>}
        {config.distribution && <span className={styles.badgeNeutral}>{config.distribution}</span>}
        {config.mutilationStrategy && config.mutilationStrategy !== 'None' && (
          <span className={getBadgeClass(styles.badgeRed)}>{config.mutilationStrategy}</span>
        )}
      </div>
    );
  }
  
  let faultName = config.fault === '429' ? '429 Rate Limit'
                : config.fault === '504' ? '504 Gateway Timeout'
                : `${config.fault} Bad Gateway`;
                
  return <span className={getBadgeClass(styles.badgeRed)}>{faultName}</span>;
};

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

const ExpandablePayload = ({ payload }: { payload: string }) => {
  const [expanded, setExpanded] = useState(false);
  const lines = payload.split('\n');
  const showLines = expanded ? lines : lines.slice(0, 5);
  const hasMore = lines.length > 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {showLines.map((l, i) => (
        <div key={i} style={{ color: '#94a3b8', whiteSpace: 'pre' }}>{`< ${l}`}</div>
      ))}
      {!expanded && hasMore && (
        <div style={{ color: '#94a3b8' }}>{`< ...`}</div>
      )}
      {hasMore && (
        <div 
          onClick={() => setExpanded(!expanded)}
          style={{
            cursor: 'pointer',
            color: '#38bdf8',
            marginTop: '4px',
            marginBottom: '4px',
            userSelect: 'none',
            display: 'inline-block',
            textShadow: '0 0 5px rgba(56, 189, 248, 0.4)',
            transition: 'opacity 0.2s',
            opacity: 0.8
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
        >
          {expanded ? '> [ - Hide payload ]' : '> [ + Click to expand full payload ]'}
        </div>
      )}
    </div>
  );
};

const TypewriterPayload = ({ fullToken, targetHost, isSimulating, onSimulationStart, onTelemetryReceived, fault, t1, t2, t3 }: { fullToken: string, targetHost: string, isSimulating: boolean, onSimulationStart: (isFirst: boolean) => void, onTelemetryReceived?: (data: any) => void, fault: string, t1: number, t2: number, t3: number }) => {
  const [text, setText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'done'>('idle');
  const [testLogs, setTestLogs] = useState<any[]>([]);
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
# Scope: ${targetHost || 'extracted from JWT'}
# Ready for edge network injection.

export PANIC_TOKEN="${tokenDisplay}"
curl -i "https://gateway.andrewwangdev.com/?token=$PANIC_TOKEN"

# [System] Awaiting trigger...`;

  useEffect(() => {
    setText('');
    setTypingDone(false);
    let i = 0;
    const interval = setInterval(() => {
      setText(fullContent.slice(0, i));
      i++;
      if (i > fullContent.length) {
        clearInterval(interval);
        setTypingDone(true);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [fullContent]);

  useEffect(() => {
    if (!isSimulating) {
      setTestState('idle');
      setTestLogs([]);
    }
  }, [isSimulating]);

  const handleTest = async () => {
    const isFirst = testState === 'idle';
    onSimulationStart(isFirst);
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
      
      const realTelemetry = data.telemetry || { t1: t1, t2: t2, t3: t3 };
      
      if (onTelemetryReceived && data.telemetry) {
        onTelemetryReceived({
          ...data.telemetry,
          totalLatency: data.totalLatency,
          status: data.status,
          responseBody: data.responseBody,
          chaosReason: data.chaosReason
        });
      }
      
      const lines = [
        `> [Chaos] Fault Engine Engaged: ${fault === 'latency' ? 'Traffic Degradation' : `HTTP ${fault}`}`,
        `[System] Target Host: ${targetHost || 'extracted from JWT'}`,
        `[System] DNS Resolved: ${targetHost || 'Target'} -> ${data.resolvedIp || 'Unknown'}`,
      ];
      
      if (data.chaosReason) {
        lines.push(`> [Security] ⚠️ INJECTION ABORTED (FAIL-OPEN TRIGGERED)`);
        lines.push(`> [Security] Reason: ${data.chaosReason}`);
        lines.push(`> [Security] Control Plane Identity: ${data.chaosClientContext || 'Unknown'}`);
      }
      
      lines.push(`< HTTP/1.1 ${data.status} ${data.statusText || ''}`);
      if (data.responseBody) {
        // Try to format JSON if possible
        let formattedBody = data.responseBody;
        try {
          const parsed = JSON.parse(data.responseBody);
          formattedBody = JSON.stringify(parsed, null, 2);
          lines.push(`< Content-Type: application/json`);
          lines.push(`<`);
        } catch(e) {}
        lines.push({ type: 'payload', content: formattedBody } as any);
      }
      lines.push('');
      
      const t1_rtt = Math.round(realTelemetry.t1 * 2);
      const t2_rtt = Math.round(realTelemetry.t2);
      const t3_rtt = Math.round(realTelemetry.t3 * 2);

      if (data.status === 444) {
        lines.push(`[Telemetry] Edge Network RTT: ${t1_rtt}ms`);
        lines.push(`[Telemetry] Upstream Backhaul: -- (PACKET_DROP)`);
        lines.push(`[System] Target Unreachable. Edge payload dropped.`);
      } else if (fault === 'latency') {
        lines.push(`[Telemetry] Edge Network RTT: ${t1_rtt}ms`);
        lines.push(`[Telemetry] Injected Latency: ${t2_rtt}ms`);
        lines.push(`[Telemetry] Upstream Backhaul: ${t3_rtt}ms`);
      } else if (fault === '502') {
        lines.push(`[Telemetry] Edge Network RTT: ${Math.round(data.totalLatency)}ms`);
        lines.push(`[Telemetry] Upstream Backhaul: -- (ABORTED)`);
        lines.push(`[System] Target Unreachable. Edge payload delivered.`);
      } else if (fault === '504') {
        lines.push(`[Telemetry] Edge Network RTT: ${t1_rtt}ms`);
        lines.push(`[Telemetry] Edge Processing: ${t2_rtt}ms (Timeout Wait)`);
        lines.push(`[Telemetry] Upstream Backhaul: -- (TIMEOUT_EXCEEDED)`);
      } else if (fault === '429') {
        lines.push(`[Telemetry] Edge Network RTT: ${Math.round(data.totalLatency)}ms`);
        lines.push(`[Telemetry] Upstream Backhaul: -- (ABORTED)`);
        lines.push(`[System] Target Unreachable. Edge payload delivered.`);
      }
      
      lines.push('');
      lines.push(`[System] Total Round-Trip Time: ${Math.round(data.totalLatency)}ms`);

      // Simulate line by line stream
      for (const line of lines) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setTestLogs(prev => [...prev, line]);
      }
      
      setTestState('done');
    } catch (e: any) {
      setTestLogs(prev => [...prev, `< Error: ${e.message}`, `[System] Test Failed.`]);
      setTestState('done');
    }
  };

  return (
    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', display: 'flex', flexDirection: 'column' }}>
      <div>{text}</div>
      {typingDone && testState !== 'done' && (
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
            if (typeof l === 'object' && l.type === 'payload') {
              return <ExpandablePayload key={i} payload={l.content} />;
            }
            let color = 'var(--text-secondary)';
            if (typeof l === 'string') {
              if (l.startsWith('< HTTP/1.1 5') || l.includes('ABORTED') || l.includes('TIMEOUT_EXCEEDED') || l.includes('Target Unreachable') || l.startsWith('< Error')) color = '#ef4444';
              else if (l.startsWith('< HTTP/1.1 2')) color = '#10b981';
              else if (l.startsWith('< HTTP/1.1 4')) color = '#f59e0b';
              else if (l.startsWith('[System]')) color = '#38bdf8';
              else if (l.startsWith('[Telemetry]')) color = '#10b981';
              else if (l.startsWith('> [Chaos]')) color = '#eab308';
              else if (l.startsWith('>')) color = '#38bdf8';
            }
            
            return <div key={i} style={{ marginBottom: '4px', color }}>{l}</div>;
          })}
        </div>
      )}
      {testState === 'done' && (
        <div style={{ marginTop: '24px' }}>
          <button 
            className={styles.runTestBtn} 
            onClick={handleTest} 
          >
            <Activity size={14} /> RUN INJECTION AGAIN
          </button>
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

const RealTimeSimulationChart = ({ latency, jitter, distribution, packetLoss }: { latency: number, jitter: number, distribution: string, packetLoss: number }) => {
  const dataPoints = 80;
  const [points, setPoints] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  const generatePoint = (baseLat: number, jit: number, dist: string, dropRate: number) => {
    if (dropRate > 0 && Math.random() < (dropRate / 100)) {
      return -1; // Dropped packet
    }
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
      initial.push(generatePoint(latency, jitter, distribution, packetLoss));
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
        next.push(generatePoint(latency, jitter, distribution, packetLoss));
        return next;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying, latency, jitter, distribution, packetLoss]);

  const togglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    localStorage.setItem('panic_sim_playing', String(nextState));
  };

  if (points.length === 0) return null;

  const rawMax = Math.max(latency + jitter + 50, 100);
  let maxVal = 100;
  if (rawMax <= 100) maxVal = 100;
  else if (rawMax <= 500) maxVal = Math.ceil(rawMax / 100) * 100;
  else if (rawMax <= 2000) maxVal = Math.ceil(rawMax / 500) * 500;
  else maxVal = Math.ceil(rawMax / 1000) * 1000;
  const w = 600;
  const h = 180;
  const paddingLeft = 45;
  const paddingBottom = 15;
  const paddingTop = 10;
  const paddingRight = 10;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  const scaleY = (val: number) => h - paddingBottom - (val / maxVal) * chartH;
  const scaleX = (idx: number) => paddingLeft + (idx / (dataPoints - 1)) * chartW;

  let pathData = '';
  let isFirst = true;
  points.forEach((p, idx) => {
    if (p === -1) {
      isFirst = true;
    } else {
      pathData += `${isFirst ? 'M' : 'L'}${scaleX(idx)},${scaleY(p)} `;
      isFirst = false;
    }
  });

  const color = getSliderColor(latency);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Real-time Simulation
        </div>
        <button 
          onClick={togglePlay}
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            transition: 'all 0.2s'
          }}
          title={isPlaying ? "Pause Simulation" : "Play Simulation"}
        >
          {isPlaying ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible', fontFamily: 'var(--font-mono)' }}>
          <line x1={paddingLeft} y1={scaleY(maxVal)} x2={w - paddingRight} y2={scaleY(maxVal)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal * 0.75)} x2={w - paddingRight} y2={scaleY(maxVal * 0.75)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal/2)} x2={w - paddingRight} y2={scaleY(maxVal/2)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal * 0.25)} x2={w - paddingRight} y2={scaleY(maxVal * 0.25)} stroke="rgba(255,255,255,0.05)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(0)} x2={w - paddingRight} y2={scaleY(0)} stroke="rgba(255,255,255,0.1)" />
          
          <text x={paddingLeft - 8} y={scaleY(maxVal) + 3} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">{Math.round(maxVal)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal * 0.75) + 3} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">{Math.round(maxVal * 0.75)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal/2) + 3} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">{Math.round(maxVal/2)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal * 0.25) + 3} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">{Math.round(maxVal * 0.25)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(0) + 3} fill="rgba(255,255,255,0.6)" fontSize="9" textAnchor="end">0ms</text>

          <line x1={paddingLeft} y1={scaleY(latency)} x2={w - paddingRight} y2={scaleY(latency)} stroke="rgba(255,255,255,0.3)" strokeDasharray="4,2" />
          <text x={w - paddingRight - 2} y={scaleY(latency) - 4} fill="rgba(255,255,255,0.9)" fontSize="8" textAnchor="end" fontWeight="bold">Base</text>

          {pathData && <path d={pathData} stroke={color} fill="none" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />}
          
          {/* Draw neon red bars for dropped packets with solid top border */}
          {points.map((p, idx) => {
            if (p === -1) {
              const cx = scaleX(idx);
              const barW = Math.max(2, chartW / dataPoints);
              return (
                <g key={idx}>
                  <rect x={cx - barW/2} y={scaleY(maxVal)} width={barW} height={chartH} fill="rgba(255, 40, 40, 0.3)" />
                  <line x1={cx - barW/2} y1={scaleY(maxVal)} x2={cx + barW/2} y2={scaleY(maxVal)} stroke="rgba(255, 40, 40, 1)" strokeWidth="2" />
                </g>
              );
            }
            return null;
          })}
        </svg>
      </div>
    </div>
  );
};
const PostMortemPanel = ({ stats }: { stats: any }) => {
  if (stats.totalRequests === 0) return null;

  const getLatencyColor = (val: number, threshold1: number = 200, threshold2: number = 500) => {
    if (val < threshold1) return '#10b981'; // Green
    if (val < threshold2) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const avgT1 = stats.t1Count > 0 ? Math.round(stats.t1Sum / stats.t1Count) : 0;
  const avgT3 = stats.t3Count > 0 ? Math.round(stats.t3Sum / stats.t3Count) : 0;
  const avgTotal = stats.totalRttCount > 0 ? Math.round(stats.totalRttSum / stats.totalRttCount) : 0;
  
  const dropRate = stats.totalRequests > 0 ? ((stats.packetDropCount / stats.totalRequests) * 100).toFixed(2) : '0.00';
  const dropColor = stats.packetDropCount > 0 ? '#ef4444' : '#10b981';

  return (
    <div style={{ 
      marginTop: '8px', 
      background: 'rgba(15, 23, 42, 0.6)', 
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: '8px', 
      padding: '20px 24px', 
      border: '1px solid rgba(56, 189, 248, 0.15)',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
    }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity size={16} /> INJECTION POST-MORTEM
      </div>
      
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600, letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>L7 Application Faults</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Gateway Fast-Fail</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: stats.fastFailCount > 0 ? '#f59e0b' : '#10b981', fontWeight: 500 }}>{stats.fastFailCount} <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-sans)' }}>times</span></span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Payload Mutilation</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: stats.mutilationCount > 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>{stats.mutilationCount} <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-sans)' }}>times</span></span>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 600, letterSpacing: '0.5px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          L3/L4 Traffic Shaping
          <span style={{ fontSize: '0.6rem', color: '#475569', letterSpacing: '0' }}>*Excl. edge-terminated</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Avg Edge Network RTT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: getLatencyColor(avgT1, 50, 100), fontWeight: 500 }}>{avgT1} <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-sans)' }}>ms</span></span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Avg Upstream Backhaul</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: getLatencyColor(avgT3, 100, 300), fontWeight: 500 }}>{avgT3} <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'var(--font-sans)' }}>ms</span></span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.1)', padding: '10px 12px', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: '#e2e8f0', fontWeight: 500 }}>Avg Total RTT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: getLatencyColor(avgTotal, 200, 500), fontWeight: 600 }}>{avgTotal} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-sans)', fontWeight: 400 }}>ms</span></span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Packet Loss Rate</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: dropColor, fontWeight: 500 }}>
            {dropRate}% 
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'var(--font-sans)', marginLeft: '6px' }}>
              ({stats.packetDropCount} dropped)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [targetHost, setTargetHost] = useState('');
  const [fault, setFault] = useState<'502' | '504' | '429' | 'latency' | null>(null);
  const [latency, setLatency] = useState(2500);
  const [jitter, setJitter] = useState(0);
  const [distribution, setDistribution] = useState<'Uniform' | 'Normal' | 'Spikes'>('Uniform');
  const [packetLoss, setPacketLoss] = useState<string | number>(0);
  const [mutilationStrategy, setMutilationStrategy] = useState<'None' | 'Unexpected EOF' | 'Type Poisoning' | 'Empty Shell'>('None');
  const [scope, setScope] = useState('Global');
  const [ttl, setTtl] = useState('15m');
  const [customTtl, setCustomTtl] = useState(24);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationKey, setSimulationKey] = useState(0);

  const ttlOptions = [
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '12h', label: '12 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: 'custom', label: 'Custom...' }
  ];

  const scopeOptions = [
    { value: 'Global', label: '🌍 Global' },
    { value: 'Cloud ASNs', label: '☁️ Cloud ASNs' },
    { value: 'Cellular', label: '📱 Cellular' },
    { value: 'Cross-Region', label: '🌉 Cross-Region' },
    { value: 'Bots Only', label: '🤖 Bots Only' }
  ];

  const distOptions = [
    { value: 'Uniform', label: 'Uniform' },
    { value: 'Normal', label: 'Normal' },
    { value: 'Spikes', label: 'Spikes' }
  ];

  const [generatedToken, setGeneratedToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [latestFullToken, setLatestFullToken] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [copiedTargetId, setCopiedTargetId] = useState<string | null>(null);
  
  const topGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTokenModal && generatedToken && topGridRef.current) {
      setTimeout(() => {
        topGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showTokenModal, generatedToken]);

  const handleQuickDemo = () => {
    setIsFlashing(true);
    setTargetHost('jsonplaceholder.typicode.com');
    setScope('Global');
    setTtl('12h');
    setFault('latency');
    setDistribution('Uniform');
    setLatency(1000);
    setJitter(3);
    setMutilationStrategy('Type Poisoning');
    setPacketLoss(0);
    
    setTimeout(() => {
      setIsFlashing(false);
    }, 400); 
  };
  
  // Clear generated token when form inputs change, resetting terminal to MOCK_LOGS
  useEffect(() => {
    setGeneratedToken('');
  }, [targetHost, scope, fault, latency, jitter, distribution, packetLoss, mutilationStrategy, ttl, customTtl]);
  
  const [activeTokens, setActiveTokens] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [postMortemStats, setPostMortemStats] = useState({
    fastFailCount: 0,
    mutilationCount: 0,
    t1Sum: 0,
    t1Count: 0,
    t3Sum: 0,
    t3Count: 0,
    totalRttSum: 0,
    totalRttCount: 0,
    packetDropCount: 0,
    totalRequests: 0
  });
  const [isTestPending, setIsTestPending] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [enableAnimation, setEnableAnimation] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // Load state from localStorage on initial render
  useEffect(() => {
    const saved = localStorage.getItem('panic-dashboard-state');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.targetHost !== undefined) setTargetHost(state.targetHost);
        if (state.scope !== undefined) setScope(state.scope);
        if (state.fault !== undefined) setFault(state.fault);
        if (state.latency !== undefined) setLatency(state.latency);
        if (state.jitter !== undefined) setJitter(state.jitter);
        if (state.distribution !== undefined) setDistribution(state.distribution);
        if (state.packetLoss !== undefined) setPacketLoss(state.packetLoss);
        if (state.mutilationStrategy !== undefined) setMutilationStrategy(state.mutilationStrategy);
        if (state.ttl !== undefined) setTtl(state.ttl);
        if (state.customTtl !== undefined) setCustomTtl(state.customTtl);
      } catch (e) {
        // ignore
      }
    }
    
    if (window.innerWidth < 1024) {
      const warningDismissed = localStorage.getItem('panic-mobile-warning-dismissed');
      if (warningDismissed !== 'true') {
        setShowMobileWarning(true);
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
          
          return {
            id: t.id,
            tokenHint: t.tokenHint,
            target: t.targetHost,
            fault: config,
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
    if (isMounted) {
      localStorage.setItem('panic-dashboard-state', JSON.stringify({
        targetHost, scope, fault, latency, jitter, distribution, packetLoss, mutilationStrategy, ttl, customTtl
      }));
    }
  }, [targetHost, scope, fault, latency, jitter, distribution, packetLoss, mutilationStrategy, ttl, customTtl, isMounted]);

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

  const isFormValid = targetHost.length > 0 && !targetHostError && fault !== null && (fault !== 'latency' || (packetLoss === '' || (Number.isInteger(Number(packetLoss)) && Number(packetLoss) >= 0 && Number(packetLoss) <= 100)));

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
          scope,
          fault,
          latency,
          jitter,
          distribution,
          packetLoss: Number(packetLoss) || 0,
          mutilationStrategy,
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

  const handleCopyTarget = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTargetId(id);
    setTimeout(() => setCopiedTargetId(null), 1000);
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

  const filteredTokens = activeTokens.filter(t => {
    const q = (searchQuery || '').toLowerCase();
    const targetMatch = (t.target || '').toLowerCase().includes(q);
    
    let faultString = '';
    try {
      faultString = typeof t.fault === 'string' ? t.fault : JSON.stringify(t.fault || {});
    } catch(e) {}
    
    const faultMatch = faultString.toLowerCase().includes(q);
    return targetMatch || faultMatch;
  });
  const totalPages = Math.ceil(filteredTokens.length / pageSize);

  return (
    <div className={styles.dashboard}>
      {showMobileWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px', padding: '32px', textAlign: 'center', maxWidth: '400px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <MonitorSmartphone size={48} color="#94a3b8" style={{ margin: '0 auto 16px auto' }} />
            <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', letterSpacing: '1px', textTransform: 'uppercase' }}>Desktop Recommended</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
              This core console is highly optimized for desktop wide-screen interfaces. While you can continue on a mobile device, the layout and advanced configuration panels will be heavily compressed.
            </p>
            <button 
              onClick={() => {
                localStorage.setItem('panic-mobile-warning-dismissed', 'true');
                setShowMobileWarning(false);
              }}
              style={{
                background: '#1e293b', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.1)',
                padding: '12px 24px', borderRadius: '8px', fontWeight: 600, width: '100%',
                cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px'
              }}
            >
              Continue Anyway
            </button>
          </div>
        </div>
      )}
      <div className={styles.container} style={{ opacity: isMounted ? 1 : 0, transition: 'opacity 0.2s ease-out' }}>
        
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>
            Welcome to the core console. Here you can generate new edge tokens, monitor chaos injection logs, and configure global routing rules.
          </p>
        </div>

        {/* Top Grid */}
        <div className={styles.gridTop} ref={topGridRef}>
          
          {/* Left: Control Plane */}
          <div className={`${styles.card} ${styles.controlPlaneCard} ${isSimulating ? styles.controlPlaneCardSimulating : ''}`}>
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                Control Plane <div className={styles.blinkDot} />
              </div>
              <button className={styles.quickDemoBtn} onClick={handleQuickDemo}>
                <Zap size={14} fill="currentColor" /> Quick Demo
              </button>
            </div>

            <div className={styles.inputGroup}>
              <div className={styles.targetRow}>
                <div className={styles.targetHostWrap}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Target Hostname & Scope</span>
                    <span className={styles.labelHint}>HTTPS or HTTP2 Only</span>
                  </div>
                  <div className={styles.prefixInputWrap}>
                    <CustomSelect 
                      options={scopeOptions}
                      value={scope}
                      onChange={(val) => setScope(val)}
                      className={styles.prefixSelect}
                      size="large"
                    />
                    <input 
                      type="text" 
                      className={`${styles.inputField} ${targetHostError ? styles.inputError : ''} ${isFlashing ? styles.inputFlash : ''}`} 
                      placeholder="api.your-production.com"
                      value={targetHost}
                      onChange={(e) => handleTargetHostChange(e.target.value)}
                      onBlur={handleTargetHostBlur}
                      onPaste={handleTargetHostPaste}
                    />
                  </div>
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
                        className={isFlashing ? styles.inputFlash : ''}
                        size="large"
                      >
                        {ttl === 'custom' && (
                          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Hours:</span>
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
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                      </CustomSelect>
                    </div>
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
                  className={`${styles.capsuleBtn} ${fault === '429' ? styles.active : ''}`}
                  onClick={() => setFault('429')}
                >
                  429 Rate Limit
                </button>
                <button 
                  className={`${styles.capsuleBtn} ${fault === 'latency' ? styles.active : ''} ${isFlashing ? styles.inputFlash : ''}`}
                  onClick={() => setFault('latency')}
                >
                  Traffic Degradation
                </button>
              </div>

              <div style={{ position: 'relative', marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--dash-input-border)' }}>
                <div 
                  className={fault !== 'latency' ? styles.disabledConfigArea : ''}
                  style={{ animation: enableAnimation ? 'slideDown 0.3s ease-out' : 'none' }}
                >
                    <div style={{ marginBottom: '24px' }}>
                      <div className={styles.labelRow}>
                        <span className={styles.label}>Payload Mutilation Strategy</span>
                      </div>
                      <div className={styles.capsuleGroup} style={{ marginTop: '12px' }}>
                        {['None', 'Unexpected EOF', 'Type Poisoning', 'Empty Shell'].map(strat => (
                          <button 
                            key={strat}
                            className={`${styles.capsuleBtn} ${mutilationStrategy === strat ? styles.active : ''} ${isFlashing && strat === 'Unexpected EOF' ? styles.inputFlash : ''}`}
                            onClick={() => setMutilationStrategy(strat as any)}
                          >
                            {strat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.latencyPanel}>
                      <div className={styles.latencyCol}>
                        <div className={styles.latencyTitle}>Algorithm & Parameters</div>
                        <div style={{ maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '4px' }}>
                          <div className={styles.latencyControlRow} style={{ alignItems: 'center' }}>
                          <div className={styles.latencyLabel} style={{ minWidth: '85px' }}>Distribution</div>
                          <div style={{ width: '110px' }}>
                            <CustomSelect 
                              options={distOptions}
                              value={distribution}
                              onChange={(val) => setDistribution(val as any)}
                              className={isFlashing ? styles.inputFlash : ''}
                            />
                          </div>

                          <div style={{ flex: 1 }} />

                          <div className={styles.latencyLabel} style={{ minWidth: 'auto', whiteSpace: 'nowrap', marginRight: '8px' }}>Packet Loss</div>
                          <div className={styles.inputWithUnit}>
                            <input 
                              type="number" 
                              min="0" max="100"
                              value={packetLoss}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPacketLoss(val === '' ? '' : Number(val));
                              }}
                              className={`${styles.latencyInput} ${isFlashing ? styles.inputFlash : ''}`}
                              style={{ width: '110px', textAlign: 'left', borderColor: (packetLoss !== '' && (!Number.isInteger(Number(packetLoss)) || Number(packetLoss) < 0 || Number(packetLoss) > 100)) ? '#ef4444' : undefined }}
                            />
                            <span className={styles.unitLabel} style={{ display: 'inline-block', width: '20px' }}>%</span>
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
                              className={`${styles.latencyInput} ${isFlashing ? styles.inputFlash : ''}`}
                              style={{ width: '110px', textAlign: 'left' }}
                            />
                            <span className={styles.unitLabel} style={{ display: 'inline-block', width: '20px' }}>ms</span>
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
                              value={jitter === 0 ? '' : jitter}
                              onChange={(e) => {
                                const val = e.target.value;
                                setJitter(val === '' ? 0 : Number(val));
                              }}
                              className={`${styles.latencyInput} ${isFlashing ? styles.inputFlash : ''}`}
                              style={{ width: '110px', textAlign: 'left' }}
                            />
                            <span className={styles.unitLabel} style={{ display: 'inline-block', width: '20px' }}>ms</span>
                          </div>
                        </div>
                      </div>
                    </div>

                      <div className={styles.latencyCol}>
                        <div className={styles.distChart} style={{ height: '210px', marginTop: '0', overflow: 'hidden' }}>
                          <RealTimeSimulationChart latency={latency} jitter={jitter} distribution={distribution} packetLoss={Number(packetLoss) || 0} />
                        </div>
                      </div>
                  </div>
                </div>

                {fault !== 'latency' && (
                  <div className={styles.disabledOverlayMessage}>
                    <div className={styles.disabledMessageContent}>
                      <span style={{ color: '#6b7280', marginBottom: '8px', display: 'inline-block' }}>
                        <Lock size={24} fill="currentColor" />
                      </span>
                      <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        L4 Parameters Locked
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Fast-fail L7 policies (502/504/429) terminate the connection at the edge proxy.<br/>
                        Transport layer degradation is physically inapplicable.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.generateContainer}>
              <button 
                className={`${styles.generateBtn} ${isFormValid ? styles.ready : styles.disabled}`}
                disabled={!isFormValid}
                onClick={handleGenerate}
              >
                Deploy Chaos Token
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
                        animKey={simulationKey}
                        isPending={isTestPending || !telemetryData}
                        w1={telemetryData ? telemetryData.w1 : [-122.3933, 37.7697]}
                        w2={telemetryData ? telemetryData.w2 : null}
                        w3={telemetryData ? telemetryData.w3 : null}
                        t1={['429', '502'].includes(fault || '') && !telemetryData?.chaosReason ? Math.round(telemetryData?.totalLatency || 0) : Math.round((telemetryData?.t1 || 0) * 2)}
                        t2={telemetryData ? telemetryData.t2 : 0}
                        t3={telemetryData ? telemetryData.t3 : 0}
                        colo={telemetryData ? telemetryData.colo : 'UNKNOWN'}
                        fault={telemetryData?.chaosReason ? 'latency' : (fault || 'latency')}
                        targetHost={targetHost}
                        latencyParams={{ base: latency, jitter: jitter, distribution: distribution }}
                    />
                  )}
                </div>
              </div>

              {/* Terminal Container */}
              <div className={`${styles.terminalContainer} ${isSimulating ? styles.terminalContainerSimulating : styles.terminalContainerNormal}`}>
                <div className={styles.codeBlock} style={{ overflowY: generatedToken ? 'auto' : 'hidden' }}>
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
                      onSimulationStart={(isFirst) => {
                        setIsSimulating(true);
                        setIsTestPending(true);
                        setSimulationKey(prev => prev + 1);
                        if (isFirst) {
                          setPostMortemStats({
                            fastFailCount: 0,
                            mutilationCount: 0,
                            t1Sum: 0,
                            t1Count: 0,
                            t3Sum: 0,
                            t3Count: 0,
                            totalRttSum: 0,
                            totalRttCount: 0,
                            packetDropCount: 0,
                            totalRequests: 0
                          });
                        }
                      }}
                      onTelemetryReceived={(data) => {
                        setTelemetryData(data);
                        setIsTestPending(false);
                        setSimulationKey(prev => prev + 1);

                        setPostMortemStats(prev => {
                          const next = { ...prev };
                          next.totalRequests++;
                          
                          if ([502, 504, 429].includes(data.status)) {
                            next.fastFailCount++;
                          }
                          
                          if (data.status === 444) {
                            next.packetDropCount++;
                          }
                          
                          if (data.responseBody && (data.responseBody.includes('Unexpected EOF') || data.responseBody.includes('Type Poisoning') || data.responseBody.includes('Empty Shell') || data.responseBody.includes('MUTILATED_PAYLOAD'))) {
                            next.mutilationCount++;
                          }

                          if (data.t1 !== undefined) {
                            next.t1Sum += data.t1 * 2;
                            next.t1Count++;
                          }

                          if (data.t3 > 0 && ![502, 504, 429, 444].includes(data.status)) {
                            next.t3Sum += data.t3 * 2;
                            next.t3Count++;
                          }

                          if (data.totalLatency !== undefined) {
                            next.totalRttSum += data.totalLatency;
                            next.totalRttCount++;
                          }

                          return next;
                        });
                      }}
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

            {/* AIOps Sandbox UI */}
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--dash-card-border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '16px' }}>
                AIOps What-If Simulation
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div className={styles.tooltipWrapper}>
                  <button 
                    className={`${styles.aiopsChip} ${styles.aiopsChipBgp}`}
                    disabled={!isSimulating}
                    style={{ pointerEvents: !isSimulating ? 'none' : 'auto' }}
                  >
                    BGP Route Leak
                  </button>
                  {!isSimulating && (
                    <div className={styles.tooltipContent}>
                      Run Cloud Injection First
                    </div>
                  )}
                </div>
                <div className={styles.tooltipWrapper}>
                  <button 
                    className={`${styles.aiopsChip} ${styles.aiopsChipEdge}`}
                    disabled={!isSimulating}
                    style={{ pointerEvents: !isSimulating ? 'none' : 'auto' }}
                  >
                    Edge Node Outage
                  </button>
                  {!isSimulating && (
                    <div className={styles.tooltipContent}>
                      Run Cloud Injection First
                    </div>
                  )}
                </div>
                <div className={styles.tooltipWrapper}>
                  <button 
                    className={`${styles.aiopsChip} ${styles.aiopsChipCable}`}
                    disabled={!isSimulating}
                    style={{ pointerEvents: !isSimulating ? 'none' : 'auto' }}
                  >
                    Trans-Pacific Congestion
                  </button>
                  {!isSimulating && (
                    <div className={styles.tooltipContent}>
                      Run Cloud Injection First
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
          
        </div>

        {/* Post Mortem Panel placed right-aligned */}
        {isSimulating && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', marginBottom: '16px' }}>
            <div style={{ width: '400px', marginRight: '40px' }}>
              <PostMortemPanel stats={postMortemStats} />
            </div>
          </div>
        )}

        {/* Bottom Grid: Active Edge Tokens */}
        {!isSimulating && (
          <div className={styles.gridBottom}>
            <div className={styles.card}>
              <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Active Edge Tokens</span>
                <div className={styles.searchBox}>
                  <Search size={14} className={styles.searchIcon} />
                  <input 
                    type="text" 
                    placeholder="Search targets or faults..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              </div>
              
              {filteredTokens.length > 0 ? (
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
                    {filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((token) => (
                      <tr key={token.id} className={token.isRevoked ? styles.rowRevoked : ''}>
                        <td className={styles.tokenCell}>
                          {token.tokenHint}
                        </td>
                        <td className={styles.tokenCell} style={{ cursor: 'pointer' }} onClick={() => handleCopyTarget(token.id, token.target)} title="Click to copy target">
                          {token.target}
                          {copiedTargetId === token.id ? (
                            <Check size={12} color="#10b981" style={{ marginLeft: '6px' }} />
                          ) : (
                            <Copy size={12} style={{ opacity: 0.5, marginLeft: '6px' }} />
                          )}
                        </td>
                        <td className={styles.faultCell}>{renderFaultBadges(token.fault, token.isRevoked)}</td>
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
                
                {totalPages > 1 && (
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
                      {Array.from({ length: totalPages })
                        .map((_, i) => i + 1)
                        .filter(pageNum => {
                          const total = totalPages;
                          if (total <= 5) return true;
                          if (currentPage <= 3) return pageNum <= 5;
                          if (currentPage >= total - 2) return pageNum >= total - 4;
                          return pageNum >= currentPage - 2 && pageNum <= currentPage + 2;
                        })
                        .map((pageNum) => (
                          <button 
                            key={pageNum} 
                            className={`${styles.pageBtn} ${currentPage === pageNum ? styles.pageActive : ''}`}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                      ))}
                    </div>

                    <button 
                      className={styles.pageBtn} 
                      disabled={currentPage === totalPages}
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
        )}

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
