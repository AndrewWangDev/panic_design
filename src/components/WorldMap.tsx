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
  const height = 500;

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
    .scale(130)
    .translate([width / 2, height / 2 + 30]);

  const pathGenerator = d3Geo.geoPath().projection(projection);

  // Generate curves using LineString
  const renderCurve = (start: [number, number], end: [number, number], color: string, dash?: boolean) => {
    const lineString: any = { type: 'LineString', coordinates: [start, end] };
    const d = pathGenerator(lineString);
    if (!d) return null;
    return (
      <path 
        d={d} 
        fill="none" 
        stroke={color} 
        strokeWidth={1.5}
        strokeDasharray={dash ? "4,4" : "none"}
        className="map-curve"
        style={{
          filter: `drop-shadow(0px 0px 4px ${color})`,
        }}
      />
    );
  };

  const renderPoint = (coords: [number, number], label: string, color: string) => {
    const projected = projection(coords);
    if (!projected) return null;
    const [x, y] = projected;
    return (
      <g transform={`translate(${x},${y})`}>
        <circle r={3} fill={color} />
        <circle r={12} fill={color} opacity={0.2} style={{ filter: `blur(2px)` }} />
        <text 
          y={-12} 
          textAnchor="middle" 
          fill="#fff" 
          fontSize="10px" 
          fontFamily="var(--font-mono)"
          fontWeight={600}
        >{label}</text>
      </g>
    );
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <g className="countries">
          {geographies.map((geo, i) => (
            <path
              key={`geo-${i}`}
              d={pathGenerator(geo) || ''}
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={0.5}
            />
          ))}
        </g>
        
        <g className="routes">
          {/* Direct logical route (dashed) */}
          {w1 && w3 && renderCurve(w1, w3, "rgba(255,255,255,0.3)", true)}
          
          {/* Actual physical route */}
          {w1 && w2 && renderCurve(w1, w2, "#3b82f6")}
          {w2 && w3 && renderCurve(w2, w3, "#ef4444")}
        </g>

        <g className="points">
          {w1 && renderPoint(w1, "W1 (Control)", "#3b82f6")}
          {w2 && renderPoint(w2, "W2 (Data)", "#10b981")}
          {w3 && renderPoint(w3, "W3 (Target)", "#ef4444")}
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
