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
}

export default function WorldMap({ w1, w2, w3, t1, t2, t3 }: WorldMapProps) {
  const [geographies, setGeographies] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dimensions for SVG viewBox. It scales responsively while preserving aspect ratio.
  const width = 800;
  const height = 450;

  useEffect(() => {
    fetch('/world-110m.json')
      .then(res => res.json())
      .then((data: any) => {
        // We use objects.countries for 110m map
        const parsed = topojson.feature(data, data.objects.countries) as any;
        setGeographies(parsed.features);
      })
      .catch(err => console.error("Failed to load map data", err));
  }, []);

  // geoEquirectangular or geoMercator work well for dashboards
  const projection = d3Geo.geoEquirectangular()
    .scale(140)
    .translate([width / 2, height / 2 + 20]);

  const pathGenerator = d3Geo.geoPath().projection(projection);

  // Generate curves using LineString
  const renderCurve = (start: [number, number], end: [number, number], color: string, id: string, dash?: boolean) => {
    const lineString: any = { type: 'LineString', coordinates: [start, end] };
    const d = pathGenerator(lineString);
    if (!d) return null;
    return (
      <path 
        id={id}
        d={d} 
        fill="none" 
        stroke={color} 
        strokeWidth={dash ? 1.5 : 2.5}
        strokeDasharray={dash ? "4,4" : "none"}
        className="map-curve"
        style={{ filter: `drop-shadow(0px 0px 4px ${color})` }}
      />
    );
  };

  const renderPin = (coords: [number, number], label: string, color: string) => {
    const projected = projection(coords);
    if (!projected) return null;
    const [x, y] = projected;
    return (
      <g transform={`translate(${x},${y})`}>
        {/* Map Pin SVG (centered at bottom tip) */}
        <path 
          d="M0 -24 C -6 -24, -10 -19.5, -10 -14 C -10 -6, 0 0, 0 0 C 0 0, 10 -6, 10 -14 C 10 -19.5, 6 -24, 0 -24 Z"
          fill={color}
          style={{ filter: `drop-shadow(0px 4px 4px rgba(0,0,0,0.5))` }}
        />
        <circle cx="0" cy="-14" r="3" fill="#fff" />
        
        {/* Ripple effect at the base */}
        <circle r={16} fill={color} opacity={0.2}>
          <animate attributeName="r" values="8;24" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0" dur="2s" repeatCount="indefinite" />
        </circle>
        
        {/* Label */}
        <text 
          y={-30} 
          textAnchor="middle" 
          fill="var(--text-primary, #fff)" 
          fontSize="11px" 
          fontFamily="var(--font-mono)"
          fontWeight={600}
          style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
        >{label}</text>
      </g>
    );
  };

  const totalRealTime = (t1 || 0) + (t2 || 0) + (t3 || 0);
  const visualMultiplier = totalRealTime > 0 ? Math.max(2, 4000 / totalRealTime) : 1;
  const cycleTime = totalRealTime > 0 ? totalRealTime * visualMultiplier : 4000;
  
  const p1_end = totalRealTime > 0 ? (t1 || 0) / totalRealTime : 0.3;
  const p2_start = totalRealTime > 0 ? ((t1 || 0) + (t2 || 0)) / totalRealTime : 0.7;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: '100%', display: 'block', color: 'var(--text-primary, #fff)' }}
      >
        <g className="countries">
          {geographies.map((geo, i) => (
            <path
              key={`geo-${i}`}
              d={pathGenerator(geo) || ''}
              fill="currentColor"
              fillOpacity={0.15}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={0.5}
            />
          ))}
        </g>
        
        <g className="routes">
          {/* Direct logical route (dashed) */}
          {w1 && w3 && renderCurve(w1, w3, "rgba(255,255,255,0.3)", "route-direct", true)}
          
          {/* Actual physical route */}
          {w1 && w2 && renderCurve(w1, w2, "#3b82f6", "route-1")}
          {w2 && w3 && renderCurve(w2, w3, "#ef4444", "route-2")}
        </g>

        {/* Packets */}
        <g className="packets">
          {w1 && w2 && t1 !== undefined && (
            <circle r={5} fill="#fff" filter="drop-shadow(0 0 6px #3b82f6)">
              <animateMotion 
                dur={`${cycleTime}ms`} 
                repeatCount="indefinite"
                keyPoints="0;1;1;1"
                keyTimes={`0;${p1_end};${p2_start};1`}
                calcMode="linear"
              >
                <mpath href="#route-1" />
              </animateMotion>
              <animate attributeName="opacity" values={`1;1;0;0`} keyTimes={`0;${p1_end};${Math.min(p1_end+0.01, 1)};1`} dur={`${cycleTime}ms`} repeatCount="indefinite" />
            </circle>
          )}

          {w2 && w3 && t3 !== undefined && (
            <circle r={5} fill="#fff" filter="drop-shadow(0 0 6px #ef4444)">
              <animateMotion 
                dur={`${cycleTime}ms`} 
                repeatCount="indefinite"
                keyPoints="0;0;1"
                keyTimes={`0;${p2_start};1`}
                calcMode="linear"
              >
                <mpath href="#route-2" />
              </animateMotion>
              <animate attributeName="opacity" values={`0;0;1;1`} keyTimes={`0;${Math.max(p2_start-0.01, 0)};${p2_start};1`} dur={`${cycleTime}ms`} repeatCount="indefinite" />
            </circle>
          )}
        </g>

        <g className="points">
          {w1 && renderPin(w1, "W1 (Control)", "#3b82f6")}
          {w2 && renderPin(w2, "W2 (Data)", "#10b981")}
          {w3 && renderPin(w3, "W3 (Target)", "#ef4444")}
        </g>
      </svg>
      
      {/* Legend overlay */}
      {(t1 !== undefined || t2 !== undefined || t3 !== undefined) && (
        <div style={{ 
          position: 'absolute', 
          bottom: 24, 
          left: 24, 
          background: 'rgba(0,0,0,0.6)', 
          padding: '16px', 
          borderRadius: '8px', 
          border: '1px solid rgba(255,255,255,0.1)', 
          fontSize: '12px',
          fontFamily: 'var(--font-mono)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: '#fff', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '6px', marginBottom: '4px' }}>TELEMETRY</div>
            {t1 !== undefined && <div style={{ color: '#3b82f6' }}>T1 (W1→W2): {t1}ms</div>}
            {t2 !== undefined && <div style={{ color: '#10b981' }}>T2 (Injected): {t2}ms</div>}
            {t3 !== undefined && <div style={{ color: '#ef4444' }}>T3 (W2→W3): {t3}ms</div>}
          </div>
        </div>
      )}
    </div>
  );
}
