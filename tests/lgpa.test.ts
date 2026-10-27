import { describe, it, expect } from 'vitest';
import { haversineDist, calculateBearing, findBestColo, EDGE_TOPOLOGY } from '../src/lib/lgpa';

describe('LGPA Algorithm: Geodesic & Arbitration', () => {
  it('haversineDist should calculate realistic distance between coordinates', () => {
    // SFO (37.7697, -122.3933) to LAX (34.0522, -118.2437) is approx 540-560 km
    const sfo = EDGE_TOPOLOGY['SFO'];
    const lax = EDGE_TOPOLOGY['LAX'];
    const dist = haversineDist(sfo.lat, sfo.lng, lax.lat, lax.lng);
    expect(dist).toBeGreaterThan(500);
    expect(dist).toBeLessThan(600);
  });

  it('calculateBearing should compute compass bearings accurately', () => {
    // SFO to LAX is heading roughly South-East (approx 120-150 degrees)
    const sfo = EDGE_TOPOLOGY['SFO'];
    const lax = EDGE_TOPOLOGY['LAX'];
    const bearing = calculateBearing(sfo.lat, sfo.lng, lax.lat, lax.lng);
    expect(bearing).toBeGreaterThan(120);
    expect(bearing).toBeLessThan(150);
  });

  it('findBestColo should identify closest edge point', () => {
    // A client in Silicon Valley (near SJC)
    const sjcResult = findBestColo(37.3382, -121.8863);
    expect(sjcResult.name).toBe('SJC');
    expect(sjcResult.distance).toBeLessThan(5);
  });

  it('findBestColo should arbitrate between nearby candidates based on target trajectory', () => {
    // Point roughly midway between SFO and SJC, heading towards Tokyo (NRT)
    const midLat = 37.5;
    const midLng = -122.1;
    const nrt = EDGE_TOPOLOGY['NRT'];
    const result = findBestColo(midLat, midLng, midLat, midLng, nrt.lat, nrt.lng);
    expect(['SFO', 'SJC']).toContain(result.name);
  });
});
