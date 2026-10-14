"use client";

import React, { useState, useEffect } from 'react';
import styles from '@/app/dashboard/dashboard.module.css';

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

export const RollingLogs = () => {
  // Use objects with unique IDs for React keys to ensure smooth CSS animations on enter
  const [logs, setLogs] = useState<{ id: string; text: string }[]>(
    MOCK_LOGS.slice(0, 5).map((text, i) => ({ id: `init-${i}`, text }))
  );

  useEffect(() => {
    let i = 5;
    const interval = setInterval(() => {
      setLogs((prev) => {
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
              <span className={styles.logPrefix}>{match[1]}</span>
              {match[2]}
            </div>
          );
        })}
      </div>
    </>
  );
};
