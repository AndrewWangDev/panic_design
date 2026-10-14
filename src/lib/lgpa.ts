/**
 * LGPA (Latency-Guided Proximity Arbitration) Topology & Geodesic Math Utilities
 */

export interface ColoCoordinates {
  lat: number;
  lng: number;
}

export interface LgpaArbitrationResult {
  name: string;
  distance: number;
  isArbitrated: boolean;
}

export const EDGE_TOPOLOGY: Record<string, ColoCoordinates> = {
  'SFO': { lat: 37.7697, lng: -122.3933 },
  'SJC': { lat: 37.3382, lng: -121.8863 },
  'LAX': { lat: 34.0522, lng: -118.2437 },
  'FRA': { lat: 50.1109, lng: 8.6821 },
  'HKG': { lat: 22.3964, lng: 114.1095 },
  'NRT': { lat: 35.6895, lng: 139.6917 },
  'LHR': { lat: 51.5074, lng: -0.1278 },
  'CDG': { lat: 48.8566, lng: 2.3522 },
  'SIN': { lat: 1.3521, lng: 103.8198 },
  'SYD': { lat: -33.8688, lng: 151.2093 },
  'IAD': { lat: 38.9072, lng: -77.0369 },
  'EWR': { lat: 40.6895, lng: -74.1745 },
  'AMS': { lat: 52.3676, lng: 4.9041 },
  'BOM': { lat: 19.0760, lng: 72.8777 },
  'GRU': { lat: -23.5505, lng: -46.6333 }
};

/**
 * Calculates great-circle distance between two points on the Earth using Haversine formula (in km)
 */
export function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates forward azimuth / bearing between two coordinates (0 - 360 degrees)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const l1 = (lat1 * Math.PI) / 180;
  const l2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(l2);
  const x = Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return ((brng * 180) / Math.PI + 360) % 360;
}

/**
 * Deterministically finds and arbitrates the optimal Cloudflare Edge Colo based on distance and vector alignment
 */
export function findBestColo(
  w2Lat: number,
  w2Lng: number,
  w1Lat?: number,
  w1Lng?: number,
  w3Lat?: number,
  w3Lng?: number
): LgpaArbitrationResult {
  const candidates: { name: string; distance: number; lat: number; lng: number }[] = [];

  for (const [colo, coords] of Object.entries(EDGE_TOPOLOGY)) {
    const d = haversineDist(w2Lat, w2Lng, coords.lat, coords.lng);
    candidates.push({ name: colo, distance: d, lat: coords.lat, lng: coords.lng });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const top1 = candidates[0];
  const top2 = candidates[1];

  if (w1Lat !== undefined && w1Lng !== undefined && w3Lat !== undefined && w3Lng !== undefined && top2) {
    const w1w3Dist = haversineDist(w1Lat, w1Lng, w3Lat, w3Lng);
    if (w1w3Dist > 200 && Math.abs(top1.distance - top2.distance) < 50) {
      const bearingTarget = calculateBearing(w1Lat, w1Lng, w3Lat, w3Lng);
      const bearingTop1 = calculateBearing(w1Lat, w1Lng, top1.lat, top1.lng);
      const bearingTop2 = calculateBearing(w1Lat, w1Lng, top2.lat, top2.lng);

      const diff1 = Math.min(Math.abs(bearingTarget - bearingTop1), 360 - Math.abs(bearingTarget - bearingTop1));
      const diff2 = Math.min(Math.abs(bearingTarget - bearingTop2), 360 - Math.abs(bearingTarget - bearingTop2));

      if (diff2 < diff1) {
        return { name: top2.name, distance: top2.distance, isArbitrated: true };
      }
    }
  }

  return { name: top1.name, distance: top1.distance, isArbitrated: false };
}

/**
 * Generates deterministic mock JWT signature for UI preview
 */
export function generateMockSignature(payloadObj: unknown): string {
  const str = JSON.stringify(payloadObj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  const deterministicString = `panic_v2_${hexHash}_edje_signature_payload`;
  return btoa(deterministicString).replace(/=/g, '').padEnd(43, 'A').substring(0, 43);
}
