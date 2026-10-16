import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { NetworkInterfaceInfo } from '@gyro-play/shared';

export function getActiveTunnelUrl(): string | null {
  if (process.env.TUNNEL_URL) return process.env.TUNNEL_URL.trim();
  const candidates = [
    path.resolve(process.cwd(), 'tunnel_url.txt'),
    path.resolve(process.cwd(), '../tunnel_url.txt'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8').trim();
      if (content.startsWith('http://') || content.startsWith('https://')) {
        return content.replace(/\/$/, '');
      }
    }
  }
  return null;
}

/**
 * Returns all non-internal IPv4 interfaces available on the machine.
 */
export function getAllAvailableIps(): NetworkInterfaceInfo[] {
  const interfaces = os.networkInterfaces();
  const results: NetworkInterfaceInfo[] = [];

  const tunnelUrl = getActiveTunnelUrl();
  if (tunnelUrl) {
    results.push({
      name: 'Cloudflare Tunnel (Any Network / HTTPS)',
      address: tunnelUrl,
      family: 'IPv4',
      isInternal: false,
    });
  }

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;

    for (const net of iface) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({
          name,
          address: net.address,
          family: net.family,
          isInternal: net.internal,
        });
      }
    }
  }

  return results;
}

/**
 * Discovers the active local network IPv4 address or active tunnel.
 */
export function getLocalIpAddress(): string {
  // 1. Explicit environment variable override takes precedence
  if (process.env.HOST_IP) {
    return process.env.HOST_IP;
  }

  const tunnelUrl = getActiveTunnelUrl();
  if (tunnelUrl) {
    return tunnelUrl;
  }

  const allIps = getAllAvailableIps();
  if (allIps.length === 0) {
    return 'localhost';
  }

  // 2. Filter out virtual/container bridges
  const physicalIps = allIps.filter((item) => {
    const lower = item.name.toLowerCase();
    return (
      !lower.startsWith('docker') &&
      !lower.startsWith('veth') &&
      !lower.startsWith('br-') &&
      !lower.startsWith('vmnet') &&
      !lower.startsWith('virbr')
    );
  });

  const candidates = physicalIps.length > 0 ? physicalIps : allIps;

  // 3. Prioritize active Wi-Fi (wl..., wifi, wlan) since phones and laptops on the same Wi-Fi use this
  const wifiAdapter = candidates.find((item) => {
    const lower = item.name.toLowerCase();
    return lower.startsWith('wl') || lower.includes('wifi') || lower.includes('wlan');
  });

  if (wifiAdapter) {
    return wifiAdapter.address;
  }

  // 4. Query system routing table for active default outbound route
  try {
    if (process.platform === 'linux') {
      const out = execSync('ip route get 1.1.1.1 2>/dev/null', { encoding: 'utf8', timeout: 800 });
      const match = out.match(/src\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1]) {
        const routeIp = match[1];
        if (allIps.some(item => item.address === routeIp)) {
          return routeIp;
        }
      }
    }
  } catch {
    // Ignore route detection errors and proceed to heuristics
  }

  // 5. Prioritize phone USB tethering (enx..., usb..., rndis...)
  const tetherAdapter = candidates.find((item) => {
    const lower = item.name.toLowerCase();
    return lower.startsWith('enx') || lower.startsWith('usb') || lower.includes('rndis');
  });

  if (tetherAdapter) {
    return tetherAdapter.address;
  }

  // 6. Fallback to first candidate
  return candidates[0].address;
}
