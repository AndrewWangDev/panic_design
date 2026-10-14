"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';
import { Sparkles } from 'lucide-react';

interface WorldMapProps {
  w1?: [number, number] | null; // [lon, lat]
  w2?: [number, number] | null;
  w3?: [number, number] | null;
  t1?: number;
  t2?: number;
  t3?: number;
  fault?: string;
  targetHost?: string;
  latencyParams?: { base: number, jitter: number, distribution: string };
  mutilationStrategy?: string;
  isPending?: boolean;
  animKey?: number;
  colo?: string;
  w1Colo?: string;
  aiMapData?: any;
  isNxDomain?: boolean;
}

function getLatencyColor(ms: number) {
  if (ms < 50) return "#10b981"; // green
  if (ms < 150) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export default function WorldMap({ w1, w2, w3, t1, t2, t3, fault = 'latency', targetHost, latencyParams, mutilationStrategy, isPending = false, animKey = 0, colo = 'UNKNOWN', w1Colo = 'UNKNOWN', aiMapData, isNxDomain = false }: WorldMapProps) {
  const [geographies, setGeographies] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const width = 800;
  const height = 450;

  // t3 === 0 when Packet Loss triggers for a 'latency' fault
  const isPacketLoss = fault === 'latency' && t3 === 0 && !isPending;
  const isAbort = fault === '502' || fault === '504' || fault === '429' || isPacketLoss;



  useEffect(() => {
    fetch('/world-110m.json')
      .then(res => res.json())
      .then((data: any) => {
        const parsed = topojson.feature(data, data.objects.countries) as any;
        setGeographies(parsed.features);
      })
      .catch(err => console.error("Failed to load map data", err));
  }, []);

  // Mock Anycast W3 to central US if it's placed near Equator [0,0]
  const visualW3 = useMemo(() => {
    return w3 && Math.abs(w3[0]) < 1 && Math.abs(w3[1]) < 1 
      ? [-97.822, 37.751] as [number, number] 
      : w3;
  }, [w3]);

  const projection = d3Geo.geoEquirectangular()
    .scale(140)
    .translate([width / 2 - 45, height / 2 + 70]);

  const viewport = useMemo(() => {
    if (!isPending && w1 && w2 && visualW3) {
      const p1 = projection(w1);
      const p2 = projection(w2);
      const p3 = projection(visualW3);
      if (p1 && p2 && p3) {
        const xs = [p1[0], p2[0], p3[0]];
        const ys = [p1[1], p2[1], p3[1]];
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const dx = maxX - minX;
        const dy = maxY - minY;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;

        const padX = 150;
        const padY = 100;
        const targetW = width - padX * 2;
        const targetH = height - padY * 2;

        let k = 1;
        if (dx > 0 && dy > 0) {
          k = Math.min(targetW / dx, targetH / dy);
        } else if (dx > 0) {
          k = targetW / dx;
        } else if (dy > 0) {
          k = targetH / dy;
        } else {
          k = 3.5;
        }

        k = Math.max(1, Math.min(k, 3.5)); // max zoom 3.5x

        const tx = width / 2 - cx * k;
        const ty = height / 2 - cy * k;

        return { x: tx, y: ty, k };
      }
    }
    return { x: 0, y: 0, k: 1 };
  }, [isPending, w1, w2, visualW3, projection, width, height]);

  const pathGenerator = d3Geo.geoPath().projection(projection);

  const getBezierParams = (start: [number, number], end: [number, number], isDetour: boolean = false) => {
    const p1 = projection(start);
    const p2 = projection(end);
    if (!p1 || !p2) return null;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.1) {
      return { p1, p2, cx: p1[0], cy: p1[1] - 20, dist }; // Tiny loop if same point
    }

    // Normal vector (always points to the 'left' of the directed segment)
    const nx = -dy / dist;
    const ny = dx / dist;

    // Arc height (15% of distance normally, 45% for detour)
    const arcHeight = dist * (isDetour ? 0.45 : 0.15);
    
    const cx = (p1[0] + p2[0]) / 2 + nx * arcHeight;
    const cy = (p1[1] + p2[1]) / 2 + ny * arcHeight;

    return { p1, p2, cx, cy, nx, ny, dist };
  };

  const renderCurve = (start: [number, number], end: [number, number], color: string, id: string, dash?: boolean, isDetour?: boolean) => {
    const params = getBezierParams(start, end, isDetour);
    if (!params) return null;
    const { p1, p2, cx, cy } = params;
    const d = `M ${p1[0]},${p1[1]} Q ${cx},${cy} ${p2[0]},${p2[1]}`;

    return (
      <path 
        id={id}
        d={d} 
        fill="none" 
        stroke={color} 
        strokeWidth={dash ? 1.5 : 2.5}
        strokeDasharray={dash ? "4,4" : "none"}
        vectorEffect="non-scaling-stroke"
        className="map-curve"
        style={{ filter: dash ? 'none' : `drop-shadow(0px 0px 4px ${color})` }}
      />
    );
  };

  const renderCurveLabel = (start: [number, number], end: [number, number], ms: number, color: string, dy: number = -8, isDetour?: boolean) => {
    const params = getBezierParams(start, end, isDetour);
    if (!params) return null;
    const { p1, p2, cx, cy, nx, ny } = params;

    // Midpoint of quadratic bezier at t=0.5
    const midX = 0.25 * p1[0] + 0.5 * cx + 0.25 * p2[0];
    const midY = 0.25 * p1[1] + 0.5 * cy + 0.25 * p2[1];

    // Push label outwards along the normal vector by 16px instead of hardcoded UP
    const labelOffsetX = nx !== undefined ? nx * 16 : 0;
    const labelOffsetY = ny !== undefined ? ny * 16 : dy;

    const text = `${ms} ms`;
    const width = text.length * 7.5 + 16;
    const height = 20;

    return (
      <g style={{ transform: `translate(${midX + labelOffsetX}px, ${midY + labelOffsetY}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <rect 
          x={-width/2} 
          y={-height/2} 
          width={width} 
          height={height} 
          rx={height/2} 
          fill="var(--dash-bg, #000)" 
          opacity={0.85}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
        <text 
          x={0}
          y={4} 
          textAnchor="middle" 
          fill={color} 
          fontSize="12px" 
          fontWeight="bold"
          fontFamily="var(--font-mono)"
        >{text}</text>
      </g>
    );
  };

  const renderPinText = (dx: number, dy: number, text: string, color: string, isSubLabel: boolean = false) => {
    const width = text.length * (isSubLabel ? 7.5 : 6.5) + 16;
    const height = isSubLabel ? 20 : 18;
    return (
      <g>
        <rect 
          x={dx - width/2} 
          y={dy - (isSubLabel ? 14 : 12)} 
          width={width} 
          height={height} 
          rx={height/2} 
          fill="var(--dash-bg, #000)" 
          opacity={0.85}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
        <text 
          x={dx}
          y={dy} 
          textAnchor="middle" 
          fill={color} 
          fontSize={isSubLabel ? "12px" : "11px"} 
          fontFamily="var(--font-mono)"
          fontWeight={600}
        >{text}</text>
      </g>
    );
  };

  type PinAnchor = 'top' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom';

  const renderPin = (coords: [number, number], label: string, color: string, isDimmed: boolean = false, subLabel?: string, anchor: PinAnchor = 'top', forceRedSubLabel: boolean = false) => {
    const projected = projection(coords);
    if (!projected) return null;
    const [x, y] = projected;

    let lblDx = 0;
    let lblDy = -30;
    const subDx = 0;
    let subDy = 20;

    if (anchor === 'top-left') {
      lblDx = -65;
      lblDy = -40;
    } else if (anchor === 'top-right') {
      lblDx = 65;
      lblDy = -40;
    } else if (anchor === 'bottom-right') {
      lblDx = 65;
      lblDy = 15;
      subDy = 35; // Push sublabel lower
    } else if (anchor === 'bottom-left') {
      lblDx = -65;
      lblDy = 15;
      subDy = 35;
    } else if (anchor === 'bottom') {
      lblDx = 0;
      lblDy = 25;
      subDy = 45;
    }

    return (
      <g style={{ transform: `translate(${x}px,${y}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)', opacity: isDimmed ? 0.4 : 1 }}>
        <path 
          d="M0 -24 C -6 -24, -10 -19.5, -10 -14 C -10 -6, 0 0, 0 0 C 0 0, 10 -6, 10 -14 C 10 -19.5, 6 -24, 0 -24 Z"
          fill={color}
          style={{ filter: `drop-shadow(0px 4px 4px rgba(0,0,0,0.5))` }}
        />
        <circle cx="0" cy="-14" r="3" fill={isDimmed ? "#888" : "#fff"} />
        {renderPinText(lblDx, lblDy, label, isDimmed ? "#aaa" : "var(--text-primary, #fff)")}
        {subLabel && renderPinText(subDx, subDy, subLabel, (isDimmed || forceRedSubLabel) ? "#ef4444" : "#eab308", true)}
      </g>
    );
  };

  // Effective overrides from AI
  const effW1 = aiMapData?.W1 || w1;
  const effW2 = aiMapData?.W2 || w2;
  const effW3 = aiMapData?.W3 || visualW3;
  const effT1 = aiMapData?.T1 !== undefined ? aiMapData.T1 : t1;
  const effT2 = aiMapData?.T2 !== undefined ? aiMapData.T2 : t2;
  const effT3 = aiMapData?.T3 !== undefined ? aiMapData.T3 : t3;

  const flag_1 = aiMapData?.flag_1 || effT1 === 0 || false;
  const flag_2 = aiMapData ? (aiMapData.flag_2 || effT3 === 0) : (fault === '502' || fault === '504' || fault === '429' || isPacketLoss || effT3 === 0);

  // Dynamic visual timings scaled by actual latency with reasonable caps
  const baseScale = 4; // 1ms real = 4ms animation
  const dur1 = Math.min(Math.max((effT1 || 0) * baseScale, 400), 1200); // 400ms min, 1200ms max
  const dur2 = (effT2 && effT2 > 0) ? Math.min(Math.max(effT2 * baseScale, 200), 2000) : 0;
  const dur3 = (effT3 && effT3 > 0) ? Math.min(Math.max(effT3 * baseScale, 400), 1200) : 0;
  
  const totalCycle = Math.min(Math.max(dur1 + dur2 + dur3 + 200, 800), 4000); // Cap total cycle to 4s
  
  // Ratios for keyTimes (must be strictly monotonically increasing)
  const p1End = Number((dur1 / totalCycle).toFixed(4));
  const p1EndHalf = Number(((dur1 / 2) / totalCycle).toFixed(4));
  const p2Start = Number(((dur1 + dur2) / totalCycle).toFixed(4));
  const p2End = Number(((dur1 + dur2 + Math.max(dur3, 10)) / totalCycle).toFixed(4));

  const t1Color = isPending ? "#cbd5e1" : getLatencyColor(t1 || 0);
  const t3Color = getLatencyColor(t3 || 0);
  const pinColor = "#cbd5e1"; // Neutral slate-300
  const flag_route_1 = aiMapData?.flag_route_1 || effT1 === 0 || false;
  const flag_route_2 = aiMapData?.flag_route_2 || effT3 === 0 || false;

  const w1LabelOverride = aiMapData?.W1_label;
  
  let defaultW2Label: string | undefined = undefined;
  if (fault === '502') defaultW2Label = "502 Bad Gateway";
  else if (fault === '504') defaultW2Label = "504 Gateway Timeout";
  else if (fault === '429') defaultW2Label = "429 Too Many Requests";
  else if (isPacketLoss) defaultW2Label = "Packet Loss";
  else if (t2 && t2 > 0) defaultW2Label = `Latency +${t2}ms`;
  
  const w2LabelOverride = aiMapData?.W2_label || defaultW2Label;
  const w3LabelOverride = aiMapData?.W3_label;

  const getAbortPath = (start: [number, number], end: [number, number], isDetour: boolean = false) => {
    const params = getBezierParams(start, end, isDetour);
    if (!params) return null;
    const { p1, p2, cx, cy } = params;
    const t = 0.66;
    const mt = 1 - t;
    const wx = mt*mt*p1[0] + 2*mt*t*cx + t*t*p2[0];
    const wy = mt*mt*p1[1] + 2*mt*t*cy + t*t*p2[1];
    const cx1 = p1[0] + t * (cx - p1[0]);
    const cy1 = p1[1] + t * (cy - p1[1]);
    return { path: `M ${p1[0]},${p1[1]} Q ${cx1},${cy1} ${wx},${wy}`, wx, wy };
  };

  const abort1Data = (flag_1 && effW1 && effW2) ? getAbortPath(effW1, effW2, flag_route_1) : null;
  const abort2Data = (flag_2 && effW2 && effW3) ? getAbortPath(effW2, effW3, flag_route_2) : null;
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Top HUD */}
      <div style={{ padding: '24px', display: 'flex', gap: '64px', justifyContent: 'flex-start', zIndex: 10, pointerEvents: 'none' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>TARGET HOSTNAME</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary, #fff)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{targetHost || 'N/A'}</div>
          </div>
          
          {fault === 'latency' && latencyParams && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>PARAMS</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary, #fff)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                Base: {latencyParams.base}ms | Jitter: {latencyParams.jitter}ms {latencyParams.distribution ? `| Dist: ${latencyParams.distribution}` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>CHAOS POLICY</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f59e0b', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              {fault === 'latency' ? 'Traffic Degradation' : fault === '502' ? 'Bad Gateway (502)' : fault === '429' ? 'Rate Limit (429)' : 'Gateway Timeout (504)'}
            </div>
          </div>

          {fault === 'latency' && mutilationStrategy && mutilationStrategy !== 'None' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', alignItems: 'flex-start', width: '100%' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>MUTILATION STRATEGY</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#ef4444', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                {mutilationStrategy}
              </div>
            </div>
          )}
        </div>

      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {aiMapData && (
          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 12px', borderRadius: '20px', zIndex: 10, backdropFilter: 'blur(4px)' }}>
            <Sparkles size={14} color="#38bdf8" />
            <span style={{ color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase' }}>AI SIMULATED</span>
          </div>
        )}
        <svg width="100%" height="100%" viewBox="0 0 800 450" style={{ display: 'block', pointerEvents: 'none', position: 'absolute', inset: 0 }}>
          <g style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <g className="geographies">
            {geographies.map((geo, i) => (
              <path
                key={`geo-${i}`}
                d={pathGenerator(geo) || ''}
                fill="#333"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        
        <g className="routes" key={`routes-${animKey}`}>
          {/* Actual physical route 1 */}
          {!isPending && effW1 && effW2 && !flag_1 && renderCurve(effW1, effW2, t1Color, "route-1", false, flag_route_1)}
          {/* Abort Wall Route 1 */}
          {!isPending && effW1 && effW2 && flag_1 && abort1Data && (
            <g>
              <path 
                id="route-abort-1"
                d={abort1Data.path} 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth={2} 
                strokeDasharray="4,4"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0px 0px 4px #ef4444)` }}
              />
              {abort1Data.wx && abort1Data.wy && (
                <g style={{ transform: `translate(${abort1Data.wx}px, ${abort1Data.wy}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <line x1="-10" y1="-10" x2="10" y2="10" stroke="#ef4444" strokeWidth={3} />
                  <line x1="-10" y1="10" x2="10" y2="-10" stroke="#ef4444" strokeWidth={3} />
                </g>
              )}
            </g>
          )}

          {/* Actual physical route 2 */}
          {!isPending && effW2 && effW3 && !flag_2 && renderCurve(effW2, effW3, t3Color, "route-2", false, flag_route_2)}
          {/* Abort Wall Route 2 */}
          {!isPending && effW2 && effW3 && flag_2 && abort2Data && (
            <g>
              <path 
                id="route-abort-2"
                d={abort2Data.path} 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth={2} 
                strokeDasharray="4,4"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0px 0px 4px #ef4444)` }}
              />
              {abort2Data.wx && abort2Data.wy && (
                <g style={{ transform: `translate(${abort2Data.wx}px, ${abort2Data.wy}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <line x1="-10" y1="-10" x2="10" y2="10" stroke="#ef4444" strokeWidth={3} />
                  <line x1="-10" y1="10" x2="10" y2="-10" stroke="#ef4444" strokeWidth={3} />
                </g>
              )}
            </g>
          )}
        </g>

        <g className="labels" key={`labels-${animKey}`}>
          {!isPending && effW1 && effW2 && effT1 !== undefined && renderCurveLabel(effW1, effW2, effT1, t1Color, -16, flag_route_1)}
          {!isPending && effW2 && effW3 && effT3 !== undefined && !flag_2 && renderCurveLabel(effW2, effW3, effT3, t3Color, -16, flag_route_2)}
        </g>

        {/* Packets and W2 Pulse */}
        <g className="packets" key={`packets-${animKey}`}>
          {/* Packet 1 */}
          {!isPending && effW1 && effW2 && !flag_1 && (
            <g>
              <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${t1Color})`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;1;1;1" keyTimes={`0;${p1End};${p1End+0.001};1`} calcMode="linear">
                  <mpath href="#route-1" />
                </animateMotion>
                <animate attributeName="opacity" values="1;1;0;0" keyTimes={`0;${p1End-0.001};${p1End};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
            </g>
          )}
          
          {/* Packet 1 Abort Shatter */}
          {flag_1 && abort1Data && (
            <g>
              <circle r={5} fill="#fff" filter={`drop-shadow(0 0 6px #ef4444)`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p1EndHalf};${p1End};1`} calcMode="linear">
                  <mpath href="#route-abort-1" />
                </animateMotion>
                <animate attributeName="opacity" values={`0;0;1;0;0`} keyTimes={`0;${p1EndHalf-0.001};${p1EndHalf};${p1End};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
              {abort1Data.wx && abort1Data.wy && (
                <g style={{ transform: `translate(${abort1Data.wx}px, ${abort1Data.wy}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <circle cx={0} cy={0} r={2} fill="#ef4444" opacity="0">
                    <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={`0;${p1End-0.001};${p1End};${Math.min(p1End+0.1, 1)};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                    <animate attributeName="r" values="2;2;16;16;2" keyTimes={`0;${p1End-0.001};${p1End};${Math.min(p1End+0.1, 1)};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </g>
          )}

          {/* Packet 2 */}
          {!isPending && effW2 && effW3 && !flag_2 && effT3 > 0 && (
            <g>
              <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${t3Color})`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p2Start};${p2End};1`} calcMode="linear">
                  <mpath href="#route-2" />
                </animateMotion>
                <animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes={`0;${p2Start-0.001};${p2Start};${p2End-0.001};${p2End};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
            </g>
          )}
          
          {/* Packet 2 Abort Shatter */}
          {flag_2 && abort2Data && (
            <g>
              <circle r={5} fill="#fff" filter={`drop-shadow(0 0 6px #ef4444)`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p2Start};${(p2Start + p2End)/2};1`} calcMode="linear">
                  <mpath href="#route-abort-2" />
                </animateMotion>
                <animate attributeName="opacity" values={`0;0;1;0;0`} keyTimes={`0;${p2Start-0.001};${p2Start};${(p2Start + p2End)/2};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
              {abort2Data.wx && abort2Data.wy && (
                <g style={{ transform: `translate(${abort2Data.wx}px, ${abort2Data.wy}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <circle cx={0} cy={0} r={2} fill="#ef4444" opacity="0">
                    <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={`0;${((p2Start + p2End)/2)-0.001};${(p2Start + p2End)/2};${Math.min(((p2Start + p2End)/2)+0.1, 1)};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                    <animate attributeName="r" values="2;2;16;16;2" keyTimes={`0;${((p2Start + p2End)/2)-0.001};${(p2Start + p2End)/2};${Math.min(((p2Start + p2End)/2)+0.1, 1)};1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </g>
          )}
          
          {/* W2 processing pulse */}
          {!isPending && effW2 && !flag_2 && projection(effW2) && (
            <g style={{ transform: `translate(${projection(effW2)?.[0]}px, ${projection(effW2)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <circle cx={0} cy={0} r={5} fill="none" stroke={t3Color} strokeWidth={2}>
                <animate attributeName="r" values="0;25" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
          
          {/* Abort Pulse */}
          {!isPending && effW2 && flag_2 && projection(effW2) && (
            <g style={{ transform: `translate(${projection(effW2)?.[0]}px, ${projection(effW2)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <circle cx={0} cy={0} r={5} fill="none" stroke="#ef4444" strokeWidth={2}>
                <animate attributeName="r" values="0;40" dur={`${totalCycle}ms`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </g>

        <g className="points" key={`points-${animKey}`}>
          {(() => {
            let anchorW1: PinAnchor = 'top';
            let anchorW2: PinAnchor = 'top';
            let anchorW3: PinAnchor = 'top';
            
            if (effW1 && effW2 && effW3) {
              const d12 = Math.sqrt(Math.pow(effW1[0]-effW2[0], 2) + Math.pow(effW1[1]-effW2[1], 2));
              const d23 = Math.sqrt(Math.pow(effW2[0]-effW3[0], 2) + Math.pow(effW2[1]-effW3[1], 2));
              const d13 = Math.sqrt(Math.pow(effW1[0]-effW3[0], 2) + Math.pow(effW1[1]-effW3[1], 2));
              
              if (d12 < 2 && d23 < 2 && d13 < 2) {
                anchorW1 = 'top-left';
                anchorW3 = 'top-right';
                anchorW2 = 'bottom';
              } else if (d12 < 2) {
                anchorW1 = 'top-left';
                anchorW2 = 'bottom-right';
              } else if (d23 < 2) {
                anchorW2 = 'bottom-right';
                anchorW3 = 'top-right';
              } else if (d13 < 2) {
                anchorW1 = 'top-left';
                anchorW3 = 'top-right';
              }
            } else if (effW1 && effW2) {
              const dx = effW1[0] - effW2[0];
              const dy = effW1[1] - effW2[1];
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < 2) {
                anchorW1 = 'top-left';
                anchorW2 = 'bottom-right';
              }
            }

            return (
              <>
                {effW1 && !isNxDomain && renderPin(effW1, w1Colo !== 'UNKNOWN' ? `Cloud Runner (${w1Colo})` : "Cloud Runner", pinColor, false, undefined, anchorW1)}
                
                {(isPending || isNxDomain) && effW1 && projection(effW1) && (
                  <g style={{ transform: `translate(${projection(effW1)?.[0]}px, ${projection(effW1)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                    <circle cx={0} cy={0} r={20} fill="none" stroke={isNxDomain ? "#ef4444" : "#10b981"} strokeWidth={1.5} opacity="0">
                      <animate attributeName="r" values="0;40" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* Removed visual jitter offsets to prevent map lines and pins from detaching */}
                {!isPending && !isNxDomain && effW1 && renderPin(effW1, w1Colo !== 'UNKNOWN' ? `Cloud Runner (${w1Colo})` : "Cloud Runner", t1Color, false, w1LabelOverride, anchorW1)}
                {!isPending && !isNxDomain && effW2 && renderPin(effW2, `Edge Gateway (${colo})`, pinColor, false, w2LabelOverride, anchorW2)}
                {!isPending && !isNxDomain && effW3 && renderPin(effW3, "Upstream Target", (flag_2 || isAbort) ? "#444" : pinColor, (flag_2 || isAbort), w3LabelOverride, anchorW3)}

                {isNxDomain && effW1 && renderPin(effW1, w1Colo !== 'UNKNOWN' ? `Cloud Runner (${w1Colo})` : "Cloud Runner", "#ef4444", false, "[ NULL DESTINATION ]", anchorW1, true)}
              </>
            );
          })()}
        </g>
        </g>
      </svg>
      </div>
    </div>
  );
}
