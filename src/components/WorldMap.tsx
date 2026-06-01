"use client";

import React, { useEffect, useState, useRef } from 'react';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';

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
  isPending?: boolean;
  animKey?: number;
  colo?: string;
}

function getLatencyColor(ms: number) {
  if (ms < 50) return "#10b981"; // green
  if (ms < 150) return "#eab308"; // yellow
  return "#ef4444"; // red
}

export default function WorldMap({ w1, w2, w3, t1, t2, t3, fault = 'latency', targetHost, latencyParams, isPending = false, animKey = 0, colo = 'UNKNOWN' }: WorldMapProps) {
  const [geographies, setGeographies] = useState<any[]>([]);
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const width = 800;
  const height = 450;

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
  const visualW3 = w3 && Math.abs(w3[0]) < 1 && Math.abs(w3[1]) < 1 
    ? [-97.822, 37.751] as [number, number] 
    : w3;

  const projection = d3Geo.geoEquirectangular()
    .scale(140)
    .translate([width / 2 - 30, height / 2 + 70]);

  useEffect(() => {
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

        setViewport({ x: tx, y: ty, k });
      }
    } else {
      setViewport({ x: 0, y: 0, k: 1 });
    }
  }, [isPending, w1, w2, visualW3]);

  const pathGenerator = d3Geo.geoPath().projection(projection);

  // Helper to get bezier parameters
  const getBezierParams = (start: [number, number], end: [number, number]) => {
    const p1 = projection(start);
    const p2 = projection(end);
    if (!p1 || !p2) return null;

    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 0.1) {
      return { p1, p2, cx: p1[0], cy: p1[1] - 20, dist }; // Tiny loop if same point
    }

    // Normal vector
    let nx = -dy / dist;
    let ny = dx / dist;

    // Force the normal vector to point UP in SVG (negative Y)
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }

    // Arc height (15% of distance)
    const arcHeight = dist * 0.15;
    
    const cx = (p1[0] + p2[0]) / 2 + nx * arcHeight;
    const cy = (p1[1] + p2[1]) / 2 + ny * arcHeight;

    return { p1, p2, cx, cy, dist };
  };

  const renderCurve = (start: [number, number], end: [number, number], color: string, id: string, dash?: boolean) => {
    const params = getBezierParams(start, end);
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

  const renderCurveLabel = (start: [number, number], end: [number, number], ms: number, color: string, dy: number = -8) => {
    const params = getBezierParams(start, end);
    if (!params) return null;
    const { p1, p2, cx, cy } = params;

    // Midpoint of quadratic bezier at t=0.5
    const midX = 0.25 * p1[0] + 0.5 * cx + 0.25 * p2[0];
    const midY = 0.25 * p1[1] + 0.5 * cy + 0.25 * p2[1];

    const text = `${ms} ms`;
    const width = text.length * 7.5 + 16;
    const height = 20;

    return (
      <g style={{ transform: `translate(${midX}px, ${midY}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        <rect 
          x={-width/2} 
          y={dy - 14} 
          width={width} 
          height={height} 
          rx={height/2} 
          fill="var(--dash-bg, #000)" 
          opacity={0.85}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
        <text 
          x={0}
          y={dy} 
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

  type PinAnchor = 'top' | 'top-left' | 'bottom-right' | 'bottom';

  const renderPin = (coords: [number, number], label: string, color: string, isDimmed: boolean = false, subLabel?: string, anchor: PinAnchor = 'top') => {
    const projected = projection(coords);
    if (!projected) return null;
    const [x, y] = projected;

    let lblDx = 0;
    let lblDy = -30;
    let subDx = 0;
    let subDy = 20;

    if (anchor === 'top-left') {
      lblDx = -25;
      lblDy = -35;
    } else if (anchor === 'bottom-right') {
      lblDx = 30;
      lblDy = -15;
      subDy = 25; // Push sublabel lower
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
        {subLabel && renderPinText(subDx, subDy, subLabel, isAbort ? "#ef4444" : "#eab308", true)}
      </g>
    );
  };

  // Fixed visual timings
  const totalCycle = 2000; // 800ms + 400ms + 800ms
  const p1End = 0.4; // 800 / 2000
  const p2Start = 0.6; // 1200 / 2000

  const t1Color = isPending ? "#cbd5e1" : getLatencyColor(t1 || 0);
  const t3Color = getLatencyColor(t3 || 0);
  const pinColor = "#cbd5e1"; // Neutral slate-300

  const isAbort = fault === '502' || fault === '504';
  
  let wallX = 0, wallY = 0;
  let abortPath = '';
  
  if (isAbort && w2 && visualW3) {
    const params = getBezierParams(w2, visualW3);
    if (params) {
      const { p1, p2, cx, cy } = params;
      const t = 0.33;
      const mt = 1 - t;
      // End point of partial curve
      wallX = mt*mt*p1[0] + 2*mt*t*cx + t*t*p2[0];
      wallY = mt*mt*p1[1] + 2*mt*t*cy + t*t*p2[1];
      // New control point for partial curve (De Casteljau's)
      const cx1 = p1[0] + t * (cx - p1[0]);
      const cy1 = p1[1] + t * (cy - p1[1]);
      
      abortPath = `M ${p1[0]},${p1[1]} Q ${cx1},${cy1} ${wallX},${wallY}`;
    }
  }
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 800 450" style={{ display: 'block', pointerEvents: 'none' }}>
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
          {/* Actual physical route */}
          {!isPending && w1 && w2 && renderCurve(w1, w2, t1Color, "route-1")}
          {!isPending && w2 && visualW3 && !isAbort && renderCurve(w2, visualW3, t3Color, "route-2")}
          
          {/* Abort Wall Route */}
          {isAbort && abortPath && (
            <g>
              <path 
                id="route-abort"
                d={abortPath} 
                fill="none" 
                stroke="#ef4444" 
                strokeWidth={2} 
                strokeDasharray="4,4"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0px 0px 4px #ef4444)` }}
              />
              <circle r={5} fill="#fff" filter={`drop-shadow(0 0 6px #ef4444)`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p2Start};0.8;1`} calcMode="linear">
                  <mpath href="#route-abort" />
                </animateMotion>
              </circle>
              {wallX && wallY && (
                <g style={{ transform: `translate(${wallX}px, ${wallY}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <line x1="-10" y1="-10" x2="10" y2="10" stroke="#ef4444" strokeWidth={3} />
                  <line x1="-10" y1="10" x2="10" y2="-10" stroke="#ef4444" strokeWidth={3} />
                </g>
              )}
            </g>
          )}
        </g>

        <g className="labels" key={`labels-${animKey}`}>
          {!isPending && w1 && w2 && t1 !== undefined && renderCurveLabel(w1, w2, t1, t1Color, -16)}
          {!isPending && w2 && visualW3 && t3 !== undefined && !isAbort && renderCurveLabel(w2, visualW3, t3, t3Color, -16)}
        </g>

        {/* Packets and W2 Pulse */}
        <g className="packets" key={`packets-${animKey}`}>
          {/* Packet 1 */}
          {!isPending && w1 && w2 && (
            <g>
              <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${t1Color})`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur="1s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                  <mpath href="#route-1" />
                </animateMotion>
              </circle>
            </g>
          )}
          {/* Packet 2 */}
          {!isPending && w2 && visualW3 && !isAbort && (
            <g>
              <circle r={3} fill="#fff" filter={`drop-shadow(0 0 6px ${t3Color})`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p2Start};0.8;1`} calcMode="linear">
                  <mpath href="#route-2" />
                </animateMotion>
              </circle>
            </g>
          )}
          
          {isAbort && abortPath && (
            <g>
              <circle r={5} fill="#fff" filter={`drop-shadow(0 0 6px #ef4444)`} style={{ transform: `scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                <animateMotion dur={`${totalCycle}ms`} repeatCount="indefinite" keyPoints="0;0;1;1" keyTimes={`0;${p2Start};0.8;1`} calcMode="linear">
                  <mpath href="#route-abort" />
                </animateMotion>
                <animate attributeName="opacity" values={`0;0;1;0;0`} keyTimes={`0;${p2Start-0.01};${p2Start};0.8;1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
              </circle>
              {/* Shatter effect */}
              {wallX && wallY && (
                <g style={{ transform: `translate(${wallX}px, ${wallY}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <circle cx={0} cy={0} r={2} fill="#ef4444" opacity="0">
                    <animate attributeName="opacity" values="0;0;1;0;0" keyTimes={`0;0.79;0.8;0.9;1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                    <animate attributeName="r" values="2;2;16;16;2" keyTimes={`0;0.79;0.8;0.9;1`} dur={`${totalCycle}ms`} repeatCount="indefinite" />
                  </circle>
                </g>
              )}
            </g>
          )}
          
          {/* W2 processing pulse */}
          {!isPending && w2 && !isAbort && projection(w2) && (
            <g style={{ transform: `translate(${projection(w2)?.[0]}px, ${projection(w2)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              <circle cx={0} cy={0} r={5} fill="none" stroke={t3Color} strokeWidth={2}>
                <animate attributeName="r" values="0;25" dur="1.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
          
          {/* Abort Pulse */}
          {!isPending && w2 && isAbort && projection(w2) && (
            <g style={{ transform: `translate(${projection(w2)?.[0]}px, ${projection(w2)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
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
            if (w1 && w2) {
              const dx = w1[0] - w2[0];
              const dy = w1[1] - w2[1];
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (dist < 20) {
                anchorW1 = 'top-left';
                anchorW2 = 'bottom-right';
              }
            }

            return (
              <>
                {w1 && renderPin(w1, "Cloud Runner", pinColor, false, undefined, anchorW1)}
                
                {isPending && w1 && projection(w1) && (
                  <g style={{ transform: `translate(${projection(w1)?.[0]}px, ${projection(w1)?.[1]}px) scale(${1 / viewport.k})`, transition: 'transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                    <circle cx={0} cy={0} r={20} fill="none" stroke="#10b981" strokeWidth={1.5} opacity="0">
                      <animate attributeName="r" values="0;40" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {!isPending && w2 && renderPin(w2, `Edge Gateway (${colo})`, pinColor, false, fault === 'latency' ? `${t2} ms` : fault === '502' ? '502 Bad Gateway' : '504 Gateway Timeout', anchorW2)}
                {!isPending && visualW3 && renderPin(visualW3, "Upstream Target", isAbort ? "#444" : pinColor, isAbort)}
              </>
            );
          })()}
        </g>
        </g>
      </svg>
      
      {/* Top HUD */}
      <div style={{ position: 'absolute', top: 24, left: 24, right: 24, background: 'rgba(0,0,0,0.6)', padding: '16px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start', backdropFilter: 'blur(4px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>TARGET HOSTNAME</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{targetHost || 'N/A'}</div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>CHAOS POLICY</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: fault === 'latency' ? '#eab308' : '#ef4444', whiteSpace: 'nowrap' }}>
            {fault === 'latency' ? 'Latency Injection' : fault === '502' ? 'Bad Gateway (502)' : 'Gateway Timeout (504)'}
          </div>
        </div>

        {fault === 'latency' && latencyParams && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginBottom: '4px' }}>PARAMS</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              Base: {latencyParams.base}ms | Jitter: {latencyParams.jitter}ms {latencyParams.distribution ? `| Dist: ${latencyParams.distribution}` : ''}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
