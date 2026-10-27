"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, ChevronLeft, ChevronRight, Activity, Play, Pause, Zap, Search, Lock, MonitorSmartphone, Sparkles, Send, RotateCcw, X } from 'lucide-react';
import styles from './dashboard.module.css';
import CustomSelect from './CustomSelect';
import WorldMap from '@/components/WorldMap';
import dynamic from 'next/dynamic';

const Turnstile = dynamic(
  () => import('@marsidev/react-turnstile').then(mod => mod.Turnstile),
  { ssr: false }
);

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
import { EDGE_TOPOLOGY, haversineDist, calculateBearing, findBestColo, generateMockSignature } from '@/lib/lgpa';

const syntaxHighlight = (json: string) => {
  const sanitized = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return sanitized.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'color: #38bdf8;'; // string color
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'color: #f472b6;'; // key color
      }
    } else if (/true|false/.test(match)) {
      cls = 'color: #a78bfa;'; // boolean
    } else if (/null/.test(match)) {
      cls = 'color: #a78bfa;'; // null
    } else {
      cls = 'color: #fb923c;'; // number
    }
    return `<span style="${cls}">${match}</span>`;
  });
};

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
  
  const faultName = config.fault === '429' ? '429 Rate Limit'
                : config.fault === '504' ? '504 Gateway Timeout'
                : `${config.fault} Bad Gateway`;
                
  return <span className={getBadgeClass(styles.badgeRed)}>{faultName}</span>;
};

import { RollingLogs } from '@/components/dashboard/RollingLogs';
import { PostMortemPanel } from '@/components/dashboard/PostMortemPanel';

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

const LoadingCycleText = () => {
  const steps = [
    "Parsing intent...",
    "Scanning candidates...",
    "Pruning routing vectors...",
    "Generating payload...",
    "Awaiting telemetry..."
  ];
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx(prev => (prev + 1) % steps.length);
    }, 1500); // rotate every 1.5s
    return () => clearInterval(timer);
  }, [steps.length]);

  return <span>{steps[stepIdx]}</span>;
};

const TypewriterPayload = ({ fullToken, targetHost, isSimulating, onSimulationStart, onTelemetryReceived, fault, t1, t2, t3, isInvalid }: { fullToken: string, targetHost: string, isSimulating: boolean, onSimulationStart: (isFirst: boolean) => void, onTelemetryReceived?: (data: any) => void, fault: string, t1: number, t2: number, t3: number, isInvalid?: boolean }) => {
  const [text, setText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'done'>('idle');
  const [testLogs, setTestLogs] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTestIdRef = useRef<number>(0);

  const baselineT1Ref = useRef<number | null>(null);
  const baselineW2Ref = useRef<[number, number] | null>(null);
  const baselineW2ColoRef = useRef<string | null>(null);
  const baselineW2DistRef = useRef<number | null>(null);

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
      activeTestIdRef.current = 0;
      setTestState('idle');
      setTestLogs([]);
    }
  }, [isSimulating]);

  const handleTest = async () => {
    const isFirst = testState === 'idle';
    if (isFirst) {
      baselineT1Ref.current = null;
      baselineW2Ref.current = null;
      baselineW2ColoRef.current = null;
      baselineW2DistRef.current = null;
    }
    const testId = Date.now();
    activeTestIdRef.current = testId;

    onSimulationStart(isFirst);
    setTestState('testing');
    setTestLogs([
      '> Initiating TLS handshake with gateway.andrewwangdev.com...',
      '> GET / HTTP/1.1',
      '> Host: gateway.andrewwangdev.com'
    ]);
    
    try {
      const res = await fetch('/api/tokens/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: fullToken })
      });
      const data = await res.json() as any;
      const isNxDomain = data.resolvedIp === 'Unresolved';
      
      let realTelemetry = data.telemetry || { t1: t1, t2: t2, t3: t3 };
      let estimatedColo = data.telemetry?.colo || 'UNKNOWN';

      if (data.telemetry) {
        const T1 = data.telemetry.t1 * 2; 
        const T3 = data.telemetry.t3 * 2;
        const w1 = data.telemetry.w1;
        const w3 = data.telemetry.w3;

        let alpha = 0;
        if (T3 > 0) {
          alpha = T1 / (T1 + T3);
        } else {
          alpha = 0.05; // Fallback if T3 is 0 (e.g. 502/504)
        }
        alpha = Math.max(0.02, Math.min(0.98, alpha)); // Bound it

        let minDistance = 0;
        let isHysteresisTriggered = false;
        let t1DeltaPercent = 0;
        let t1DeltaSign = '+';

        if (!isFirst && baselineT1Ref.current !== null && baselineW2Ref.current) {
          const delta = T1 - baselineT1Ref.current;
          t1DeltaPercent = Math.abs(delta / Math.max(1, baselineT1Ref.current)) * 100;
          t1DeltaSign = delta >= 0 ? '+' : '-';
          
          if (t1DeltaPercent < 40) {
            isHysteresisTriggered = true;
          }
        }

        if (isHysteresisTriggered) {
          data.telemetry.w2 = baselineW2Ref.current;
          estimatedColo = baselineW2ColoRef.current || 'UNKNOWN';
          minDistance = baselineW2DistRef.current || 0;
        } else {
          if (w1 && w3 && w1.length === 2 && w3.length === 2 && (w3[0] !== 0 || w3[1] !== 0)) {
            const w2Lng = (1 - alpha) * w1[0] + alpha * w3[0];
            const w2Lat = (1 - alpha) * w1[1] + alpha * w3[1];
            data.telemetry.w2 = [w2Lng, w2Lat];
            const result = findBestColo(w2Lat, w2Lng, w1[1], w1[0], w3[1], w3[0]);
            estimatedColo = result.name;
            minDistance = result.distance;
          } else {
            // If no W3, offset W2 slightly from W1
            data.telemetry.w2 = [w1[0] + 1.5, w1[1] - 1.5];
            estimatedColo = data.telemetry.colo;
          }
          // Update baseline
          baselineT1Ref.current = T1;
          baselineW2Ref.current = data.telemetry.w2;
          baselineW2ColoRef.current = estimatedColo;
          baselineW2DistRef.current = minDistance;
        }
        
        data.telemetry.w2_colo = estimatedColo;
        data.telemetry.w2_distance = minDistance;
        data.telemetry.alpha_weight = alpha;
        data.telemetry.isHysteresisTriggered = isHysteresisTriggered;
        data.telemetry.t1DeltaPercent = t1DeltaPercent;
        data.telemetry.t1DeltaSign = t1DeltaSign;
        realTelemetry = data.telemetry;
      }
      
      const isGatewayRejection = data.isAuthError || data.status === 401 || data.status === 403;
      const isGatewayOffline = data.status === 503 || (!data.telemetry && !isNxDomain && !isGatewayRejection);

      if (isGatewayRejection || isGatewayOffline) {
        if (onTelemetryReceived) {
          onTelemetryReceived({
            w1: [-118.2437, 34.0522],
            w2: null,
            w3: null,
            w1_colo: 'UNKNOWN',
            status: data.status,
            isAuthError: isGatewayRejection,
            isNxDomain: false
          });
        }
      } else if (onTelemetryReceived && data.telemetry) {
        onTelemetryReceived({
          ...data.telemetry,
          totalLatency: data.totalLatency,
          status: data.status,
          responseBody: data.responseBody,
          chaosReason: data.chaosReason,
          isNxDomain
        });
      } else if (onTelemetryReceived && isNxDomain) {
        onTelemetryReceived({
          w1: [-118.2437, 34.0522],
          w2: null,
          w3: null,
          w1_colo: 'UNKNOWN',
          isNxDomain: true
        });
      }
      
      const t1_latency = Math.round(realTelemetry.t1 * 2);
      const t3_latency = Math.round(realTelemetry.t3 * 2);
      const w1_colo = realTelemetry.w1_colo || 'UNKNOWN';
      const w2_colo = realTelemetry.w2_colo || 'UNKNOWN';
      const w3_colo = data.resolvedIp || 'Target';
      const alpha_weight = realTelemetry.alpha_weight !== undefined ? realTelemetry.alpha_weight.toFixed(3) : 'N/A';
      const snap_error_km = realTelemetry.w2_distance !== undefined ? Math.round(realTelemetry.w2_distance) : 0;
      
      const isHys = realTelemetry.isHysteresisTriggered;
      const t1DeltaStr = realTelemetry.t1DeltaPercent ? realTelemetry.t1DeltaPercent.toFixed(1) : '0.0';
      const t1Sign = realTelemetry.t1DeltaSign || '+';
      const baseT1 = baselineT1Ref.current ? Math.round(baselineT1Ref.current) : t1_latency;

      let lgpaLogs: string[] = [];
      if (!isFirst && isHys) {
        lgpaLogs = [
          `> [Telemetry] Payload received. Extracting routing metrics...`,
          `> [Network] Activating LGPA (Latency-Guided Proximity Anchoring) Engine...`,
          `> [Network] ├─ [Step 1] Latency Computation  : T1 = ${t1_latency}ms (Δ ${t1Sign}${t1DeltaStr}% vs Baseline ${baseT1}ms)`,
          `> [Network] ├─ [Step 2] Hysteresis Check     : ΔT1 < 40%. Spatial Drift Inhibited.`,
          `> [Network] └─ [Step 3] Proximity Anchoring  : Sticky Anchor enforced at [${w2_colo}]`,
          `> `,
          `> [Chaos] Fault Engine Engaged at Intermediary Node [${w2_colo}]`,
          `> [Telemetry] SPATIAL TOPOLOGY: ${w1_colo} ➔ ${w2_colo} ➔ ${w3_colo}`
        ];
      } else if (!isFirst && !isHys && baselineT1Ref.current !== null) {
        lgpaLogs = [
          `> [Telemetry] Payload received. Extracting routing metrics...`,
          `> [Network] Activating LGPA (Latency-Guided Proximity Anchoring) Engine...`,
          `> [Network] ├─ [Step 1] Latency Computation  : T1 = ${t1_latency}ms (Δ ${t1Sign}${t1DeltaStr}% vs Baseline ${baseT1}ms)`,
          `> [Network] ├─ [Step 2] Hysteresis Check     : Threshold Broken! Topology Drift Detected.`,
          `> [Network] ├─ [Step 3] Spatial Interpolation: Recalculating Absolute Displacement...`,
          `> [Network] └─ [Step 4] Proximity Anchoring  : Anchor re-snapped to [${w2_colo}] (Δd ≈ ${snap_error_km}km)`,
          `> `,
          `> [Chaos] Fault Engine Engaged at Intermediary Node [${w2_colo}]`,
          `> [Telemetry] SPATIAL TOPOLOGY: ${w1_colo} ➔ ${w2_colo} ➔ ${w3_colo}`
        ];
      } else {
        lgpaLogs = [
          `> [Telemetry] Payload received. Extracting routing metrics...`,
          `> [Network] Activating LGPA (Latency-Guided Proximity Anchoring) Engine...`,
          `> [Network] ├─ [Step 1] Latency Computation  : T1 = ${t1_latency}ms, T3 = ${t3_latency}ms`,
          `> [Network] ├─ [Step 2] Spatial Interpolation: Weight α ≈ ${alpha_weight} (Virtual Coordinate Derived)`,
          `> [Network] ├─ [Step 3] Haversine Matrix Scan: Calculating surface distances to topology...`,
          `> [Network] └─ [Step 4] Proximity Anchoring  : Snapped to [${w2_colo}] (Δd ≈ ${snap_error_km}km)`,
          `> `,
          `> [Chaos] Fault Engine Engaged at Intermediary Node [${w2_colo}]`,
          `> [Telemetry] SPATIAL TOPOLOGY: ${w1_colo} ➔ ${w2_colo} ➔ ${w3_colo}`
        ];
      }

      const lines = [
        `[System] Target Host: ${targetHost || 'extracted from JWT'}`,
        `[System] DNS Resolved: ${targetHost || 'Target'} -> ${data.resolvedIp || 'Unknown'}`,
      ];
      
      if (isNxDomain) {
        lines.push(`[Fatal] ❌ NXDOMAIN: Target host unresolvable.`);
      } else if (isGatewayRejection) {
        lines.push(`> [Gateway] Ingress Gatekeeper: Verifying Chaos JWT & Cryptographic Signature...`);
        lines.push(`> [Security] ❌ Authentication Rejected (${data.status} ${data.statusText || 'Unauthorized'})`);
        lines.push(`> [Security] Reason: ${data.responseBody || 'Invalid or Expired Chaos Token'}`);
        lines.push(`> [Security] Pipeline Aborted: Fault injection bypassed due to invalid or expired credentials.`);
        lines.push(`< HTTP/1.1 ${data.status} ${data.statusText || 'Unauthorized'}`);
        if (data.responseBody) {
          lines.push(`< ${data.responseBody}`);
        }
        lines.push('');
        lines.push(`[System] Ingress Verification: FAILED (Token rejected at Edge boundary)`);
        lines.push(`[System] Total Round-Trip Time: ${Math.round(data.totalLatency || 0)}ms`);
      } else if (isGatewayOffline) {
        lines.push(`> [Gateway] ❌ Data Plane Gateway offline or unreachable.`);
        lines.push(`> [Gateway] Host: gateway.andrewwangdev.com`);
        lines.push(`< HTTP/1.1 503 Service Unavailable`);
        if (data.responseBody) {
          lines.push(`< ${data.responseBody}`);
        }
        lines.push('');
        lines.push(`[System] Total Round-Trip Time: ${Math.round(data.totalLatency || 0)}ms`);
      } else {
        lines.push(...lgpaLogs);
        
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
          lines.push(`[Telemetry] Edge Network RTT (T1): ${t1_rtt}ms`);
          lines.push(`[Telemetry] Upstream Backhaul (T3): -- (PACKET_DROP)`);
          lines.push(`[System] Target Unreachable. Edge payload dropped.`);
        } else if (fault === 'latency') {
          lines.push(`[Telemetry] Edge Network RTT (T1): ${t1_rtt}ms`);
          lines.push(`[Telemetry] Injected Latency (T2): ${t2_rtt}ms`);
          lines.push(`[Telemetry] Upstream Backhaul (T3): ${t3_rtt}ms`);
        } else if (fault === '502') {
          lines.push(`[Telemetry] Edge Network RTT (T1): ${t1_rtt}ms`);
          lines.push(`[Telemetry] Upstream Backhaul (T3): -- (ABORTED)`);
          lines.push(`[System] Target Unreachable. Edge payload delivered.`);
        } else if (fault === '504') {
          lines.push(`[Telemetry] Edge Network RTT (T1): ${t1_rtt}ms`);
          lines.push(`[Telemetry] Edge Processing (T2): ${t2_rtt}ms (Timeout Wait)`);
          lines.push(`[Telemetry] Upstream Backhaul (T3): -- (TIMEOUT_EXCEEDED)`);
        } else if (fault === '429') {
          lines.push(`[Telemetry] Edge Network RTT (T1): ${t1_rtt}ms`);
          lines.push(`[Telemetry] Upstream Backhaul (T3): -- (ABORTED)`);
          lines.push(`[System] Target Unreachable. Edge payload delivered.`);
        }
        
        lines.push('');
        lines.push(`[System] Total Round-Trip Time: ${Math.round(data.totalLatency)}ms`);
      }

      // Simulate line by line stream
      for (const line of lines) {
        if (activeTestIdRef.current !== testId) break;
        await new Promise(resolve => setTimeout(resolve, 300));
        if (activeTestIdRef.current !== testId) break;
        setTestLogs(prev => [...prev, line]);
      }
      
      if (activeTestIdRef.current === testId) {
        setTestState('done');
      }
    } catch (e: any) {
      if (activeTestIdRef.current === testId) {
        setTestLogs(prev => [...prev, `< Error: ${e.message}`, `[System] Test Failed.`]);
        setTestState('done');
      }
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
            disabled={testState === 'testing' || isInvalid}
            style={{ opacity: isInvalid ? 0.5 : 1, cursor: isInvalid ? 'not-allowed' : 'pointer' }}
          >
            <Activity size={14} /> {testState === 'testing' ? 'TEST IN PROGRESS...' : (isInvalid ? 'INVALID CONFIGURATION' : 'RUN CLOUD INJECTION')}
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
              if (l.startsWith('< HTTP/1.1 5') || l.includes('ABORTED') || l.includes('TIMEOUT_EXCEEDED') || l.includes('Target Unreachable') || l.startsWith('< Error') || l.startsWith('[Fatal]')) color = '#ef4444';
              else if (l.startsWith('< HTTP/1.1 2')) color = '#10b981';
              else if (l.startsWith('< HTTP/1.1 4')) color = '#f59e0b';
              else if (l.startsWith('[System]')) color = '#38bdf8';
              else if (l.startsWith('[Telemetry]') || l.startsWith('> [Telemetry]')) color = '#10b981';
              else if (l.startsWith('> [Network]')) color = '#c084fc'; // Purple for Network LGPA Engine
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
      const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
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
  
  const scaleY = (val: number) => Math.max(0, h - paddingBottom - (val / maxVal) * chartH);
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
          className={styles.pauseBtn}
          title={isPlaying ? "Pause Simulation" : "Play Simulation"}
        >
          {isPlaying ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Play</>}
        </button>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%', overflow: 'visible', fontFamily: 'var(--font-mono)' }}>
          <line x1={paddingLeft} y1={scaleY(maxVal)} x2={w - paddingRight} y2={scaleY(maxVal)} stroke="var(--dash-table-row-border)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal * 0.75)} x2={w - paddingRight} y2={scaleY(maxVal * 0.75)} stroke="var(--dash-table-row-border)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal/2)} x2={w - paddingRight} y2={scaleY(maxVal/2)} stroke="var(--dash-table-row-border)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(maxVal * 0.25)} x2={w - paddingRight} y2={scaleY(maxVal * 0.25)} stroke="var(--dash-table-row-border)" strokeDasharray="2,2" />
          <line x1={paddingLeft} y1={scaleY(0)} x2={w - paddingRight} y2={scaleY(0)} stroke="var(--dash-table-border)" />
          
          <text x={paddingLeft - 8} y={scaleY(maxVal) + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">{Math.round(maxVal)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal * 0.75) + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">{Math.round(maxVal * 0.75)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal/2) + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">{Math.round(maxVal/2)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(maxVal * 0.25) + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">{Math.round(maxVal * 0.25)}ms</text>
          <text x={paddingLeft - 8} y={scaleY(0) + 3} fill="var(--text-secondary)" fontSize="9" textAnchor="end">0ms</text>

          <line x1={paddingLeft} y1={scaleY(latency)} x2={w - paddingRight} y2={scaleY(latency)} stroke="var(--text-secondary)" strokeDasharray="4,2" style={{ opacity: 0.5 }} />
          <text x={w - paddingRight - 2} y={scaleY(latency) - 4} fill="var(--text-primary)" fontSize="8" textAnchor="end" fontWeight="bold">Base</text>

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

const AiAutofillModal = ({ 
  isOpen, 
  onClose, 
  currentFormState, 
  onApply,
  requestTurnstileToken
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  currentFormState: any, 
  onApply: (data: any) => void,
  requestTurnstileToken: () => Promise<string>
}) => {
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState<'idle' | 'turnstile' | 'loading' | 'success' | 'warning' | 'error'>('idle');
  const [aiData, setAiData] = useState<any>(null);
  const typingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInstruction('');
      setStatus('idle');
      setAiData(null);
    }
    return () => {
      // Cleanup to prevent Fast Refresh memory leaks
      typingIntervalRef.current = null;
    };
  }, [isOpen]);

  const simulateTyping = async (text: string) => {
    const runId = Date.now();
    typingIntervalRef.current = runId;
    
    let currentText = '';
    setInstruction('');
    
    for (let i = 0; i < text.length; i++) {
      if (typingIntervalRef.current !== runId) return; // Abort if a new typing session started or component unmounted
      currentText += text.charAt(i);
      setInstruction(currentText);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!instruction.trim()) return;

    setStatus('turnstile');
    setAiData(null);

    // Yield to let React paint the static 'turnstile' UI before blocking the main/GPU thread
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          let currentToken: string | null = null;
          if (process.env.NODE_ENV !== 'development') {
            try {
              currentToken = await requestTurnstileToken();
            } catch {
              setStatus('error');
              setAiData({ error_message: "Security verification failed. Please check your network and try again." });
              return;
            }
          }

          setStatus('loading');

          const res = await fetch('/api/aiops/autofill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction, currentFormState, turnstileToken: currentToken })
          });
          const data = await res.json();
          
          if (data.status) {
            setStatus(data.status);
            setAiData(data);
          } else if (data.error) {
            setStatus('error');
            setAiData({ error_message: data.error });
          } else {
            setStatus('error');
            setAiData({ error_message: 'Failed to parse AI output structure.' });
          }
        } catch (e: any) {
          setStatus('error');
          setAiData({ error_message: e.message || 'Network error occurred.' });
        }
      }, 50);
    });
  };

  const handleApply = () => {
    if (aiData?.data) {
      onApply(aiData.data);
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}>
      <div style={{ width: '500px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} color="#38bdf8" /> AI Control Plane Autofill</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => simulateTyping("We are simulating a major trans-Pacific submarine cable fault. Please inject an 'unexpected EOF' payload mutation. Forcefully drop the connection for 30% of the traffic. For the remaining traffic, inject a base latency of 1200ms with a Normal distribution (and Network Jitter 300ms).")} 
              style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s ease' }}
            >
              <Zap size={14} color="#22c55e" fill="#22c55e" /> Quick Demo
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          <textarea
            placeholder="E.g., Inject 200ms latency and 5% packet loss for Asia region..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={status === 'loading' || status === 'turnstile'}
            style={{ width: '100%', height: '100px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '12px', color: '#f8fafc', fontFamily: 'var(--font-sans)', fontSize: '14px', resize: 'none', marginBottom: '16px' }}
          />

          {status === 'turnstile' && (
            <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Lock size={16} />
              <div style={{ fontWeight: 'bold' }}>Verifying Security Clearance...</div>
            </div>
          )}

          {status === 'loading' && (
            <div style={{ padding: '16px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', color: '#38bdf8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className={styles.spinner} style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              <LoadingCycleText />
            </div>
          )}

          {status === 'success' && aiData && (
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#10b981', fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>[ ✓ CONFIGURATION COMPILED ]</div>
              <div>Intent matched perfectly. Extracted {aiData.data?.faultType === 'latency' ? 'Traffic Degradation' : aiData.data?.faultType} metrics. Ready to patch Control Plane.</div>
            </div>
          )}

          {status === 'warning' && aiData && (
            <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', color: '#f59e0b', fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>[ ⚠️ LOGIC RECALIBRATED ]</div>
              <div style={{ marginBottom: '8px' }}><strong>Conflict detected:</strong> {aiData.conflict_reason}</div>
              <div><strong>Resolution:</strong> {aiData.resolution}</div>
            </div>
          )}

          {status === 'error' && aiData && (
            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>[ 🛑 PARSING FAILED ]</div>
              <div>{aiData.error_message}</div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#020617' }}>
          {status === 'idle' || status === 'loading' ? (
            <button 
              onClick={handleSubmit} 
              disabled={status === 'loading'}
              style={{ background: '#38bdf8', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.7 : 1 }}
            >
              GENERATE
            </button>
          ) : status === 'success' ? (
            <button onClick={handleApply} style={{ background: '#10b981', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              APPLY & CLOSE
            </button>
          ) : status === 'warning' ? (
            <button onClick={handleApply} style={{ background: '#f59e0b', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              ACKNOWLEDGE & APPLY
            </button>
          ) : status === 'error' ? (
            <button onClick={onClose} style={{ background: '#ef4444', color: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
              ABORT & MANUAL ENTRY
            </button>
          ) : null}
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

  const [isAiAutofillOpen, setIsAiAutofillOpen] = useState(false);
  const [highlightAutofill, setHighlightAutofill] = useState(false);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationKey, setSimulationKey] = useState(0);

  const turnstileTokenRef = useRef<string | null>(null);
  const turnstileRef = useRef<any>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const turnstileResolveRef = useRef<((token: string) => void) | null>(null);

  // Defer Turnstile mount — only loads iframe skeleton, NO PoW computation
  useEffect(() => {
    const timer = setTimeout(() => setShowTurnstile(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Called by Turnstile onSuccess — resolves pending Promise if any
  const handleTurnstileSuccess = useCallback((token: string) => {
    if (turnstileResolveRef.current) {
      turnstileResolveRef.current(token);
      turnstileResolveRef.current = null;
      // Reset after a delay to prepare for the next request without breaking the current one
      setTimeout(() => turnstileRef.current?.reset(), 500);
    } else {
      turnstileTokenRef.current = token;
    }
  }, []);

  // On-demand: triggers .execute() and returns a Promise<string> for the token
  const requestTurnstileToken = useCallback((): Promise<string> => {
    // If we already have a valid token waiting (spontaneous solve), consume it
    if (turnstileTokenRef.current) {
      const t = turnstileTokenRef.current;
      turnstileTokenRef.current = null;
      setTimeout(() => turnstileRef.current?.reset(), 500);
      return Promise.resolve(t);
    }
    
    // Otherwise trigger execution and wait for onSuccess callback
    return new Promise<string>((resolve, reject) => {
      turnstileResolveRef.current = resolve;
      if (turnstileRef.current) {
        // DO NOT call reset() here! It destroys the iframe and causes execute() to hang!
        turnstileRef.current.execute();
      } else {
        reject(new Error('Turnstile not mounted'));
      }
      
      // Timeout safety: reject after 10s
      setTimeout(() => {
        if (turnstileResolveRef.current === resolve) {
          turnstileResolveRef.current = null;
          reject(new Error('Turnstile verification timeout'));
        }
      }, 10000);
    });
  }, []);

  const activeTokensRef = useRef<HTMLDivElement>(null);

  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<{title: string, message: string} | null>(null);
  const [showConcurrentModal, setShowConcurrentModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const ttlOptions = [
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '12h', label: '12 Hours' },
    { value: '24h', label: '24 Hours' },
    { value: 'custom', label: 'Custom...' }
  ];

  const scopeOptions = [
    { value: 'Global', label: 'Global', icon: '🌍' },
    { value: 'Cloud ASNs', label: 'Cloud ASNs', icon: '☁️' },
    { value: 'Cellular', label: 'Cellular', icon: '📱' },
    { value: 'Cross-Region', label: 'Cross-Region', icon: '🌉' },
    { value: 'Bots Only', label: 'Bots Only', icon: '🤖' }
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
  const [nxDomainTriggered, setNxDomainTriggered] = useState(false);
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
  
  const handleAiApply = (data: any) => {
    if (data.targetHostname !== undefined) setTargetHost(data.targetHostname);
    if (data.scope !== undefined) setScope(data.scope);
    if (data.tokenTtl !== undefined) {
      setTtl('custom');
      setCustomTtl(data.tokenTtl);
    }
    if (data.faultType !== undefined) setFault(data.faultType);
    if (data.distribution !== undefined && data.distribution !== null) setDistribution(data.distribution);
    if (data.baseLatency !== undefined && data.baseLatency !== null) setLatency(Number(data.baseLatency));
    if (data.jitter !== undefined && data.jitter !== null) setJitter(Number(data.jitter));
    if (data.packetLoss !== undefined && data.packetLoss !== null) setPacketLoss(Number(data.packetLoss));
    if (data.mutilationStrategy !== undefined && data.mutilationStrategy !== null) setMutilationStrategy(data.mutilationStrategy);
    
    setHighlightAutofill(true);
    setTimeout(() => setHighlightAutofill(false), 2000);
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
    failOpenCount: 0,
    t1Sum: 0,
    t1Count: 0,
    t3Sum: 0,
    t3Count: 0,
    totalRttSum: 0,
    totalRttCount: 0,
    packetDropCount: 0,
    totalRequests: 0,
    sentCount: 0,
    receivedCount: 0
  });
  const [isTestPending, setIsTestPending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTurnstile, setIsGeneratingTurnstile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [enableAnimation, setEnableAnimation] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  const [aiInputValue, setAiInputValue] = useState('');
  const [showAiOutput, setShowAiOutput] = useState(false);
  const typeWriterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);

  const handleAiopsClick = (text: string) => {
    if (typeWriterIntervalRef.current) clearInterval(typeWriterIntervalRef.current);
    setAiInputValue('');
    setShowAiOutput(false);
    if (aiInputRef.current) {
      aiInputRef.current.style.height = 'auto';
    }
    let i = 0;
    typeWriterIntervalRef.current = setInterval(() => {
      setAiInputValue(text.substring(0, i + 1));
      if (aiInputRef.current) {
        aiInputRef.current.style.height = 'auto';
        aiInputRef.current.style.height = `${Math.min(aiInputRef.current.scrollHeight, 120)}px`;
      }
      i++;
      if (i >= text.length) {
        clearInterval(typeWriterIntervalRef.current!);
      }
    }, 20);
  };

  const [aiState, setAiState] = useState<{ isLoading: boolean, isTurnstile?: boolean, data: any, baseline?: any }>({ isLoading: false, isTurnstile: false, data: null });

  const handleAiSubmit = async () => {
    if (!aiInputValue.trim() || !isSimulating) return;
    
    setShowAiOutput(true);
    setAiState(prev => ({ ...prev, isLoading: true, isTurnstile: true, data: null }));

    // Yield to allow React to paint the static UI before Turnstile blocks the GPU thread
    requestAnimationFrame(() => {
      setTimeout(async () => {
        // Use theoretical UI values for the Baseline to prevent issues when Post-Mortem is cleared
        const theoreticalPacketLoss = Number(packetLoss) || 0;
        const actualPacketLossRate = theoreticalPacketLoss.toFixed(2) + '%';

        let statusCodeBreakdown = '';
        if (fault === '502') {
          statusCodeBreakdown = `502: 100%`;
        } else if (fault === '504') {
          statusCodeBreakdown = `504: 100%`;
        } else if (fault === '429') {
          statusCodeBreakdown = `429: 100%`;
        } else if (theoreticalPacketLoss > 0) {
          statusCodeBreakdown = `200: ${(100 - theoreticalPacketLoss).toFixed(0)}%, 444: ${theoreticalPacketLoss.toFixed(0)}%`;
        } else {
          statusCodeBreakdown = `200: 100%`;
        }

        const baseline = {
          targetHost,
          fault,
          latency,
          jitter,
          distribution,
          packetLoss,
          actualPacketLossRate,
          statusCodeBreakdown,
          resolvedIp: telemetryData?.resolvedIp && telemetryData.resolvedIp !== 'Unknown IP' ? telemetryData.resolvedIp : targetHost,
          telemetry: telemetryData,
          w1_colo: telemetryData?.w1_colo || 'UNKNOWN',
          w2_colo: telemetryData?.w2_colo || telemetryData?.colo || 'UNKNOWN',
          t1_rtt: telemetryData?.t1 ? Math.round(telemetryData.t1 * 2) : 0,
          t2: fault === 'latency' ? latency : 0,
          t3_rtt: telemetryData?.t3 ? Math.round(telemetryData.t3 * 2) : 0,
          w1: telemetryData?.w1,
          w2: telemetryData?.w2,
          w3: telemetryData?.w3
        };

        try {
          let currentToken: string | null = null;
          if (process.env.NODE_ENV !== 'development') {
            try {
              currentToken = await requestTurnstileToken();
            } catch {
              alert('Security verification failed. Please try again.');
              setAiState({ isLoading: false, isTurnstile: false, data: null, baseline });
              return;
            }
          }
          
          setAiState(prev => ({ ...prev, isTurnstile: false }));

      const res = await fetch('/api/aiops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: aiInputValue,
          baseline,
          turnstileToken: currentToken
        })
      });

      const textResponse = await res.text();
      let data;
      try {
        data = JSON.parse(textResponse);
      } catch (parseError) {
        throw new Error(textResponse || 'Unknown Error');
      }

      if (res.status === 429) {
        setQuotaError(data.error_message || 'Rate limit exceeded');
        setAiState(prev => ({ ...prev, isLoading: false, data: null }));
        return;
      }

      if (!res.ok) {
        const errorMsg = data?.error ? `${data.error}\nRaw AI Output:\n${data.raw || 'None'}` : (data || 'Unknown Error');
        throw new Error(errorMsg);
      }

      setAiState(prev => ({ ...prev, isLoading: false, data }));
    } catch (e: any) {
      setAiState({ isLoading: false, isTurnstile: false, data: null });
      setGlobalError({ title: 'AIOps Error', message: e.message || 'Simulation failed' });
    }
      }, 50);
    });
  };

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
      if (res.status === 401) {
        setIsLoggedIn(false);
        return;
      }
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
            isExpired: t.isExpired,
            status: t.status,
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
    if (!isLoggedIn) {
      setShowAuthModal(true);
      return;
    }
    if (!isFormValid || isGenerating) return;

    setIsGenerating(true);
    setIsGeneratingTurnstile(true);

    let ttlHours = 0.25;
    if (ttl === '1h') ttlHours = 1;
    if (ttl === '12h') ttlHours = 12;
    if (ttl === '24h') ttlHours = 24;
    if (ttl === 'custom') ttlHours = customTtl;

    // Yield to let React paint the static 'turnstile' UI before blocking the main/GPU thread
    requestAnimationFrame(() => {
      setTimeout(async () => {
        try {
          let currentToken: string | null = null;
          if (process.env.NODE_ENV !== 'development') {
            try {
              currentToken = await requestTurnstileToken();
            } catch {
              setGlobalError({
                title: 'SECURITY CHECK FAILED',
                message: 'The anti-bot verification failed or timed out. Please check your network connection, disable ad-blockers, and try again.'
              });
              setIsGenerating(false);
              setIsGeneratingTurnstile(false);
              return;
            }
          }
          
          setIsGeneratingTurnstile(false);

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
          customTtl: ttlHours,
          turnstileToken: currentToken
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
        const errData = await res.json() as any;
        if (res.status === 429 || errData.error === 'QUOTA_EXCEEDED') {
          setQuotaError(errData.message || 'Rate limit exceeded');
        } else if (errData.error === 'CONCURRENT_CAP_EXCEEDED') {
          setShowConcurrentModal(true);
        } else {
          setGlobalError({
            title: 'GENERATION FAILED',
            message: 'Failed to generate token: ' + (errData.error || 'Unknown error')
          });
        }
      }
    } catch (err) {
      console.error(err);
      setGlobalError({
        title: 'GENERATION FAILED',
        message: 'A network or internal error occurred while generating the token.'
      });
    } finally {
      setIsGenerating(false);
    }
      }, 50);
    });
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
      <div>
        {showTurnstile && (
          <Turnstile
            ref={turnstileRef}
            siteKey="0x4AAAAAADgKGlhfvExJwp8F"
            onSuccess={handleTurnstileSuccess}
            onExpire={() => {
              turnstileTokenRef.current = null;
            }}
            onError={() => {
              turnstileTokenRef.current = null;
              if (turnstileResolveRef.current) {
                turnstileResolveRef.current = null;
              }
              setTimeout(() => turnstileRef.current?.reset(), 2000);
            }}
            options={{ theme: 'auto', size: 'invisible', execution: 'execute' }}
          />
        )}
      </div>

      {quotaError && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,165,0,0.5)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffa500', fontSize: '1.25rem', margin: '0 0 16px 0' }}>
              ⚠️ QUOTA EXCEEDED
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Your Edge Compute Quota has been exhausted. To prevent abuse, the free tier has been restricted.<br/><br/>
              Reason: {quotaError}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setQuotaError(null)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,165,0,0.1)', color: '#ffa500', border: '1px solid rgba(255,165,0,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {globalError && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,165,0,0.5)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffa500', fontSize: '1.25rem', margin: '0 0 16px 0' }}>
              ⚠️ {globalError.title}
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              {globalError.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setGlobalError(null)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,165,0,0.1)', color: '#ffa500', border: '1px solid rgba(255,165,0,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {showConcurrentModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(255,165,0,0.5)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffa500', fontSize: '1.25rem', margin: '0 0 16px 0' }}>
              ⚠️ CONCURRENT TOKEN CAP EXCEEDED
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              Maximum active threshold reached. To maintain edge network stability and prevent proxy abuse, a single developer account cannot sustain more than 5 concurrently active chaos tokens. Please revoke dormant configurations below before provisioning a new payload.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => {
                setShowConcurrentModal(false);
                activeTokensRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(255,165,0,0.1)', color: '#ffa500', border: '1px solid rgba(255,165,0,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                MANAGE ACTIVE TOKENS
              </button>
            </div>
          </div>
        </div>
      )}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: '#111', border: '1px solid rgba(56,189,248,0.5)', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#38bdf8', fontSize: '1.25rem', margin: '0 0 16px 0' }}>
              <Lock size={20} /> Authentication Required
            </h2>
            <p style={{ color: '#a1a1aa', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px' }}>
              You are viewing the read-only sandbox. Sign in via GitHub to generate live chaos tokens and orchestrate physical edge networks.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAuthModal(false)} style={{ padding: '10px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #333', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={() => window.location.href = '/api/auth/signin'} style={{ padding: '10px 16px', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                Continue with GitHub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid Layout */}
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
          <div 
            className={`${styles.card} ${styles.controlPlaneCard} ${isSimulating ? styles.controlPlaneCardSimulating : ''}`}
            style={highlightAutofill ? { boxShadow: '0 0 20px 4px rgba(16, 185, 129, 0.6)', transition: 'box-shadow 0.3s ease-in-out' } : { transition: 'box-shadow 0.5s ease-in-out' }}
          >
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                Control Plane <div className={styles.blinkDot} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className={styles.quickDemoBtn} onClick={() => setIsAiAutofillOpen(true)}>
                  <Sparkles size={14} fill="currentColor" /> AI AutoFill
                </button>
                <button className={styles.quickDemoBtn} onClick={handleQuickDemo}>
                  <Zap size={14} fill="currentColor" /> Quick Demo
                </button>
              </div>
            </div>

            <AiAutofillModal 
              isOpen={isAiAutofillOpen} 
              onClose={() => setIsAiAutofillOpen(false)} 
              currentFormState={{ targetHostname: targetHost, scope, tokenTtl: customTtl, faultType: fault, distribution, baseLatency: latency, jitter, packetLoss }} 
              onApply={handleAiApply}
              requestTurnstileToken={requestTurnstileToken}
            />

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
                      iconOnlyTrigger={true}
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
                          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--dash-input-border)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 500 }}>Hours:</span>
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
                          <div className={styles.inputWithUnit} style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                style={{ width: '110px', textAlign: 'left', color: (jitter < 0 || jitter > latency) ? '#ef4444' : undefined, borderColor: (jitter < 0 || jitter > latency) ? '#ef4444' : undefined }}
                              />
                              <span className={styles.unitLabel} style={{ display: 'inline-block', width: '20px' }}>ms</span>
                            </div>
                            {(jitter < 0 || jitter > latency) && (
                              <div style={{ color: '#ef4444', fontSize: '0.65rem', marginTop: '4px', marginRight: '24px' }}>
                                Invalid: [0, {latency}ms]
                              </div>
                            )}
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
                className={`${styles.generateBtn} ${isFormValid && !isGenerating ? styles.ready : styles.disabled}`}
                disabled={!isFormValid || isGenerating}
                onClick={handleGenerate}
              >
                {isGeneratingTurnstile ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '8px', textTransform: 'uppercase' }}>
                    <Lock size={16} />
                    Verifying Security...
                  </span>
                ) : isGenerating ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '8px', textTransform: 'uppercase' }}>
                    <div className={styles.spinner} />
                    Compiling...
                  </span>
                ) : 'Deploy Chaos Token'}
              </button>
            </div>
          </div>

          {/* Right: Edge Payload */}
          <div className={`${styles.card} ${styles.edgePayloadCard} ${isSimulating ? styles.edgePayloadCardSimulating : ''}`}>
            <div className={styles.cardHeader} style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Edge Payload {isSimulating && '- Global Telemetry'}</span>
              {isSimulating && (
                <button className={styles.cancelBtn} onClick={() => {
                  setIsSimulating(false);
                  setAiInputValue('');
                  setShowAiOutput(false);
                  setNxDomainTriggered(false);
                }}>
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
                        t3={telemetryData ? Math.round(telemetryData.t3 * 2) : 0}
                        colo={aiState.data?.insight?.w2Colo || (telemetryData ? (telemetryData.w2_colo || telemetryData.colo) : 'UNKNOWN')}
                        w1Colo={aiState.data?.insight?.w1Colo || (telemetryData ? telemetryData.w1_colo : 'UNKNOWN')}
                        fault={telemetryData?.chaosReason ? 'latency' : (fault || 'latency')}
                        targetHost={targetHost}
                        latencyParams={{ base: latency, jitter: jitter, distribution: distribution }}
                        mutilationStrategy={mutilationStrategy}
                        aiMapData={aiState.data?.map_data}
                        isNxDomain={nxDomainTriggered}
                    />
                  )}
                </div>
              </div>

              {/* Terminal Container */}
              <div className={`${styles.terminalContainer} ${isSimulating ? styles.terminalContainerSimulating : styles.terminalContainerNormal}`}>
                <div className={styles.codeBlock} style={{ overflowY: generatedToken ? 'auto' : 'hidden', color: nxDomainTriggered ? '#f87171' : '#94a3b8' }}>
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
                      isInvalid={jitter < 0 || jitter > latency}
                      onSimulationStart={(isFirst) => {
                        setIsSimulating(true);
                        setIsTestPending(true);
                        setSimulationKey(prev => prev + 1);
                        setAiState({ isLoading: false, data: null });
                        setPostMortemStats(prev => ({ ...prev, sentCount: prev.sentCount + 1 }));
                      }}
                      onTelemetryReceived={(data) => {
                        setTelemetryData(data);
                        setIsTestPending(false);
                        setNxDomainTriggered(data.isNxDomain || false);
                        setSimulationKey(prev => prev + 1);

                        setPostMortemStats(prev => {
                          const next = { ...prev };
                          next.totalRequests++;
                          next.receivedCount++;
                          
                          if ([502, 504, 429].includes(data.status)) {
                            next.fastFailCount++;
                          }

                          if (data.chaosReason) {
                            next.failOpenCount++;
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
            {/* Compiled Chaos Token Preview */}
            {(!isTestPending && !isSimulating) && (
              <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--dash-card-border)' }}>
                <div className={styles.cardHeader} style={{ justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span>Compiled Token</span>
                  <div style={{ fontSize: '0.9rem', color: generatedToken ? '#10b981' : '#eab308', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: generatedToken ? '#10b981' : '#eab308', boxShadow: `0 0 8px ${generatedToken ? '#10b981' : '#eab308'}` }} />
                    {generatedToken ? 'PENDING INJECTION' : 'PENDING SIGNATURE'}
                  </div>
                </div>
                <div className={styles.codeBlock} style={{ maxHeight: '220px', overflowY: 'auto', background: 'var(--dash-code-bg)', border: '1px solid var(--dash-code-border, rgba(255,255,255,0.05))', borderRadius: '12px', padding: '16px', fontSize: '12px', color: 'var(--dash-code-text, #94a3b8)' }}>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)' }} dangerouslySetInnerHTML={{
                    __html: (() => {
                      const payloadObj = {
                        target: {
                          hostname: targetHost || 'pending...',
                          scope: scope,
                          ttl: ttl === 'custom' ? `${customTtl}h` : ttl,
                          compliance_domain: "RFC-9110-COMPLIANT"
                        },
                        fault_profile: {
                          category: fault === 'latency' ? 'Network Latency' : (fault === '502' ? 'Bad Gateway' : (fault === '504' ? 'Gateway Timeout' : (fault === '429' ? 'Rate Limit' : 'None'))),
                          mutilation_strategy: mutilationStrategy !== 'None' ? mutilationStrategy : 'Type Poisoning',
                          interception_layer: "L7_PROXY_W2"
                        },
                        algorithm_parameters: {
                          distribution: distribution,
                          packet_loss: `${packetLoss}%`,
                          base_latency: `${latency}ms`,
                          network_jitter: `${jitter}ms`,
                          drift_tolerance: "40%"
                        },
                        engine_state: {
                          real_time_simulation: "Active",
                          telemetry_mode: "LGPA_ANALYTICS",
                          fail_safe: "TRANSPARENT_BYPASS"
                        },
                        metadata: {
                          nonce: "a7f2-88d4-991c",
                          trace_origin: "CHENGDU_CONTROL_CENTER"
                        }
                      };
                      return syntaxHighlight(JSON.stringify({
                        header: {
                          alg: "HS256",
                          typ: "JWT",
                          kid: "panic-sign-v1-primary/",
                          iss: "panic.andrewwangdev.com/cp"
                        },
                        payload: payloadObj,
                        signature: generateMockSignature({ payload: payloadObj })
                      }, null, 2));
                    })()
                  }} />
                </div>
              </div>
            )}

            {/* AIOps Sandbox UI */}
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--dash-card-border)' }}>
              <div style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '16px' }}>
                    AIOps What-If Simulation
                  </div>

                  {/* AI Instruction Input */}
                  <div className={styles.tooltipWrapper} style={{ width: '100%' }}>
                    <div className={`${styles.aiInputWrapper} ${!isSimulating ? styles.disabled : ''}`} style={nxDomainTriggered ? { filter: 'grayscale(1)', opacity: 0.5, pointerEvents: 'none', width: '100%', boxSizing: 'border-box' } : { width: '100%', boxSizing: 'border-box' }}>
                      <Sparkles size={16} color="var(--color-cyan, #06b6d4)" />
                      <textarea 
                        ref={aiInputRef}
                        className={styles.aiInput} 
                        placeholder="Describe a disaster scenario, e.g., Drop 20% traffic from Asia..."
                        disabled={!isSimulating}
                        value={aiInputValue}
                        rows={1}
                        onChange={(e) => {
                          setAiInputValue(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleAiSubmit();
                          }
                        }}
                        style={{ maxHeight: '120px', overflowY: 'auto' }}
                      />
                      <button 
                        className={styles.aiSendBtn} 
                        disabled={!isSimulating || aiInputValue.trim().length === 0 || aiState.isLoading}
                        onClick={handleAiSubmit}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                    {!isSimulating && !nxDomainTriggered && (
                      <div className={styles.tooltipContent} style={{ zIndex: 10 }}>
                        Run Cloud Injection First
                      </div>
                    )}
                    {nxDomainTriggered && (
                      <div className={styles.tooltipContent} style={{ width: '250px', zIndex: 10, whiteSpace: 'normal' }}>
                        <strong style={{ display: 'block', marginBottom: '4px' }}>STRICT MODE</strong>
                        Invalid FQDN structure. Production target required.
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div className={styles.tooltipWrapper}>
                      <button 
                        className={`${styles.aiopsChip} ${styles.aiopsChipBgp}`}
                        disabled={!isSimulating}
                        style={{ pointerEvents: !isSimulating ? 'none' : 'auto' }}
                        onClick={() => handleAiopsClick("Simulate a catastrophic BGP route leak. Drop 50% of packets globally.")}
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
                        onClick={() => handleAiopsClick("Trigger a massive edge node failure. Hijack all responses with 502 Bad Gateway and apply 'Empty Shell' mutation to strip all payload contents.")}
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
                        onClick={() => handleAiopsClick("Simulate severe trans-Pacific cable congestion. Degrade traffic with 1000ms base latency, 3ms jitter, and apply Type Poisoning to simulate data corruption during transit.")}
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

                  {/* AI Conversation Output */}
                  {showAiOutput && isSimulating && (
                    <>
                    <style>{`
                      @keyframes shakeCritical {
                        0%, 100% { transform: translateX(0); }
                        20% { transform: translateX(-5px); }
                        40% { transform: translateX(5px); }
                        60% { transform: translateX(-5px); }
                        80% { transform: translateX(5px); }
                      }
                    `}</style>
                    <div 
                      style={{ 
                        marginTop: '20px', 
                        padding: '16px', 
                        background: 'var(--dash-code-bg)', 
                        borderRadius: '12px', 
                        border: `1px solid ${aiState.data?.error_code === 'INCOMPLETE_PARAM' ? '#f59e0b' : aiState.data?.error_code === 'SECURITY_VIOLATION' ? '#ef4444' : aiState.data?.error_code === 'OUT_OF_SCOPE' ? '#64748b' : 'var(--dash-code-border)'}`,
                        animation: aiState.data?.error_code === 'SECURITY_VIOLATION' ? 'shakeCritical 0.4s ease-in-out' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: 'var(--color-cyan, #06b6d4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        💡 COPILOT INSIGHT
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {aiState.isLoading ? (
                          aiState.isTurnstile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-cyan)' }}>
                              <Lock size={14} />
                              <span style={{ fontWeight: 600 }}>Verifying Security Clearance...</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className={styles.spinner} style={{ width: '12px', height: '12px', borderTopColor: 'var(--color-cyan)' }} />
                              <LoadingCycleText />
                            </div>
                          )
                        ) : aiState.data ? (
                          <div style={{ lineHeight: 1.5 }}>
                            {aiState.data.error ? (
                              <span style={{ color: '#ef4444' }}>{aiState.data.error}</span>
                            ) : aiState.data.error_code ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>
                                {aiState.data.error_code === 'INCOMPLETE_PARAM' && (
                                  <>
                                    <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.95rem' }}>⚠️ PARAMETER MISSING</div>
                                    <div style={{ color: '#e2e8f0' }}>Chaos injection intent detected, but required physical parameters are missing.</div>
                                    <div style={{ color: '#f87171' }}>Missing Entity: [ {aiState.data.error_message} ]</div>
                                    <div style={{ color: '#94a3b8' }}>The engine refuses to execute blind faults. Please specify the exact blast radius or injection target.</div>
                                  </>
                                )}
                                {aiState.data.error_code === 'SECURITY_VIOLATION' && (
                                  <>
                                    <div style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.95rem' }}>🛑 SECURITY OVERRIDE ENGAGED</div>
                                    <div style={{ color: '#f87171' }}>FATAL: Outbound attack or unauthorized escalation detected.</div>
                                    <div style={{ color: '#94a3b8' }}>{aiState.data.error_message}</div>
                                    <div style={{ color: '#94a3b8' }}>The panic.design engine is strictly constrained to internal resilience testing within the authorized topology.</div>
                                  </>
                                )}
                                {aiState.data.error_code === 'OUT_OF_SCOPE' && (
                                  <>
                                    <div style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.95rem' }}>⏸️ UNKNOWN DIRECTIVE</div>
                                    <div style={{ color: '#e2e8f0' }}>Input exceeds the semantic boundaries of L4-L7 chaos network orchestration.</div>
                                    <div style={{ color: '#64748b' }}>{aiState.data.error_message}</div>
                                    <div style={{ color: '#64748b' }}>The Edge Copilot rejects general conversational queries, coding requests, or non-topological commands. Please input a valid network blackhole, routing leak, or application-layer degradation directive.</div>
                                  </>
                                )}
                              </div>
                            ) : (
                              <>
                                {aiState.data.warning_code === 'LOGICAL_CONFLICT' && (
                                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                                    <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>⚡ LOGIC RECALIBRATED</div>
                                    <div style={{ color: '#e2e8f0', marginBottom: '4px' }}>OSI model layer conflict detected.</div>
                                    <div style={{ color: '#94a3b8' }}>{aiState.data.warning_message}</div>
                                    <div style={{ color: '#94a3b8', marginTop: '4px' }}>Automatically stripped unreachable L7 status assertions. Enforcing L4 physical layer blockade. Geodesic topology simulation and secondary risk predictions have been updated accordingly.</div>
                                  </div>
                                )}
                                {typeof aiState.data.insight === 'object' && aiState.data.insight !== null ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                    <div style={{ color: '#f87171', marginBottom: '4px', paddingBottom: '4px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                                      <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>SLO Budget Impact:</span> {aiState.data.insight.sloBudgetImpact}
                                    </div>
                                    <div style={{ color: '#38bdf8', marginBottom: '4px' }}>
                                      {aiState.data.insight.w1Colo || (aiState.baseline?.w1_colo !== 'UNKNOWN' ? aiState.baseline?.w1_colo : null) || 'Client (Pending)'} ➔ {aiState.data.insight.w2Colo || (aiState.baseline?.w2_colo !== 'UNKNOWN' ? aiState.baseline?.w2_colo : null) || 'Gateway (Pending)'} ➔ {aiState.data.insight.w3Ip || aiState.baseline?.resolvedIp || 'Target Host'}
                                    </div>
                                    
                                    <div><span style={{ color: '#94a3b8' }}>Packet Loss Rate:</span> {aiState.baseline?.actualPacketLossRate || '0.00%'} ➔ {aiState.data.insight.packetLoss}</div>
                                    
                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                      <div style={{ color: '#f59e0b', fontWeight: 600, marginBottom: '4px' }}>Influence:</div>
                                      {aiState.data.insight.influence?.map((inf: any, idx: number) => (
                                        <div key={idx} style={{ paddingLeft: '8px', marginBottom: '4px' }}>
                                          ► <span style={{ color: '#cbd5e1' }}>{inf.object}:</span> {inf.severity} {inf.content}
                                        </div>
                                      ))}
                                    </div>

                                    {aiState.data.insight.secondaryRisks && (
                                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                        <span style={{ color: '#ec4899', fontWeight: 600 }}>Secondary Risks:</span> {aiState.data.insight.secondaryRisks}
                                      </div>
                                    )}

                                    {aiState.data.insight.suggestion && (
                                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.1)', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>Suggestion:</span> {aiState.data.insight.suggestion}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    </>
                  )}
                </div>

                {/* Post Mortem Panel */}
                {isSimulating && (
                  <div style={{ width: '400px', flexShrink: 0 }}>
                    <PostMortemPanel stats={postMortemStats} onClear={() => setPostMortemStats({
                      fastFailCount: 0,
                      mutilationCount: 0,
                      failOpenCount: 0,
                      t1Sum: 0,
                      t1Count: 0,
                      t3Sum: 0,
                      t3Count: 0,
                      totalRttSum: 0,
                      totalRttCount: 0,
                      packetDropCount: 0,
                      totalRequests: 0,
                      sentCount: 0,
                      receivedCount: 0
                    })} />
                  </div>
                )}
              </div>
            </div>
            
          </div>
          
        </div>

        {/* Bottom Grid: Active Edge Tokens */}
        {!isSimulating && (
          <div className={styles.gridBottom} ref={activeTokensRef}>
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
                    {filteredTokens.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((token) => {
                      const isInactive = token.isRevoked || token.isExpired;
                      return (
                      <tr key={token.id} className={isInactive ? styles.rowRevoked : ''}>
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
                        <td className={styles.faultCell}>{renderFaultBadges(token.fault, isInactive)}</td>
                        <td title={`Last used: ${token.issuedAtFull}`}>{token.issuedAt}</td>
                        <td>
                          <button 
                            className={styles.revokeBtn}
                            onClick={() => handleRevoke(token.id)}
                            disabled={isInactive}
                          >
                            {token.isRevoked ? 'Revoked' : (token.isExpired ? 'Expired' : 'Revoke')}
                          </button>
                        </td>
                      </tr>
                    );})}
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
              </button>{latestFullToken}
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
