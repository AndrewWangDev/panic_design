"use client";

import React from 'react';
import { Activity, RotateCcw } from 'lucide-react';

export interface PostMortemStats {
  fastFailCount: number;
  mutilationCount: number;
  failOpenCount: number;
  t1Sum: number;
  t1Count: number;
  t3Sum: number;
  t3Count: number;
  totalRttSum: number;
  totalRttCount: number;
  packetDropCount: number;
  totalRequests: number;
  sentCount: number;
  receivedCount: number;
}

interface PostMortemPanelProps {
  stats: PostMortemStats;
  onClear: () => void;
}

export const PostMortemPanel: React.FC<PostMortemPanelProps> = ({ stats, onClear }) => {
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
    <div
      style={{
        marginTop: '8px',
        background: 'var(--dash-card-bg)',
        borderRadius: '8px',
        padding: '20px 24px',
        border: '1px solid var(--dash-card-border)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: 'var(--color-cyan, #0ea5e9)',
          textTransform: 'uppercase',
          letterSpacing: '1.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} /> INJECTION POST-MORTEM
        </div>
        <button
          onClick={onClear}
          style={{
            background: 'transparent',
            border: '1px solid var(--dash-input-border)',
            color: 'var(--text-secondary)',
            fontSize: '0.7rem',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
            fontWeight: 600
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--text-secondary)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--dash-input-border)';
          }}
        >
          <RotateCcw size={12} /> CLEAR
        </button>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--dash-table-border)',
            paddingBottom: '6px'
          }}
        >
          General
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Send Packets</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--color-cyan, #0ea5e9)', fontWeight: 500 }}>
            {stats.sentCount || 0} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>times</span>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Received Packets</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#10b981', fontWeight: 500 }}>
            {stats.receivedCount || 0} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>times</span>
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--dash-table-border)',
            paddingBottom: '6px'
          }}
        >
          L7 Application Faults
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gateway Fast-Fail</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: stats.fastFailCount > 0 ? '#f59e0b' : '#10b981', fontWeight: 500 }}>
            {stats.fastFailCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>times</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fail-Open Triggered</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: stats.failOpenCount > 0 ? '#f59e0b' : '#10b981', fontWeight: 500 }}>
            {stats.failOpenCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>times</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Payload Mutilation</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: stats.mutilationCount > 0 ? '#ef4444' : '#10b981', fontWeight: 500 }}>
            {stats.mutilationCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>times</span>
          </span>
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            borderBottom: '1px solid var(--dash-table-border)',
            paddingBottom: '6px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline'
          }}
        >
          L3/L4 Traffic Shaping
          <span style={{ fontSize: '0.6rem', color: '#475569', letterSpacing: '0' }}>*Excl. edge-terminated</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Edge Network RTT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: getLatencyColor(avgT1, 50, 100), fontWeight: 500 }}>
            {avgT1} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>ms</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Avg Upstream Backhaul</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: getLatencyColor(avgT3, 100, 300), fontWeight: 500 }}>
            {avgT3} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>ms</span>
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            background: 'var(--dash-input-bg)',
            border: '1px solid var(--dash-input-border)',
            padding: '10px 12px',
            borderRadius: '6px'
          }}
        >
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>Avg Total RTT</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: getLatencyColor(avgTotal, 200, 500), fontWeight: 600 }}>
            {avgTotal} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 400 }}>ms</span>
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Packet Loss Rate</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: dropColor, fontWeight: 500 }}>
            {dropRate}%{' '}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', marginLeft: '6px' }}>
              ({stats.packetDropCount} dropped)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
