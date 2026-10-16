import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SteeringGaugeProps {
  steering: number;     // -1.0 to +1.0
  tiltDegrees: number;  // raw degrees
  deadzone?: number;    // e.g. 0.05
  profile?: string;
}

export const SteeringGauge: React.FC<SteeringGaugeProps> = ({
  steering,
  tiltDegrees,
  deadzone = 0.05,
  profile = 'smooth',
}) => {
  // Clamped steering percent: -100% to +100%
  const clamped = Math.max(-1, Math.min(1, steering));
  const percent = clamped * 50; // -50% to +50% offset from center

  const isDeadzone = Math.abs(clamped) < deadzone;
  const isHardLeft = clamped < -0.7;
  const isHardRight = clamped > 0.7;

  let accentColor = '#22c55e'; // Lime green
  if (isHardLeft || isHardRight) {
    accentColor = '#06b6d4'; // Cyan
  }

  return (
    <View style={styles.container}>
      {/* Top Labels */}
      <View style={styles.topRow}>
        <Text style={styles.label}>STEER ANGLE</Text>
        <Text style={[styles.angleText, { color: accentColor }]}>
          {tiltDegrees > 0 ? `+${tiltDegrees.toFixed(1)}°` : `${tiltDegrees.toFixed(1)}°`}
        </Text>
        <Text style={styles.profileBadge}>{profile.toUpperCase()}</Text>
      </View>

      {/* Gauge Track */}
      <View style={styles.track}>
        {/* Deadzone visual zone in center */}
        <View
          style={[
            styles.deadzoneBox,
            { width: `${deadzone * 100}%` },
          ]}
        />

        {/* Center Zero Line */}
        <View style={styles.centerLine} />

        {/* Dynamic Indicator Fill */}
        <View
          style={[
            styles.fillIndicator,
            percent >= 0
              ? { left: '50%', width: `${percent}%`, backgroundColor: accentColor }
              : { right: '50%', width: `${-percent}%`, backgroundColor: accentColor },
          ]}
        />

        {/* Steering Needle */}
        <View
          style={[
            styles.needle,
            { left: `${50 + percent}%`, borderColor: accentColor },
          ]}
        />
      </View>

      {/* Range Scale */}
      <View style={styles.scaleRow}>
        <Text style={styles.scaleText}>◀ LEFT</Text>
        <Text style={[styles.valText, { color: isDeadzone ? '#64748b' : accentColor }]}>
          {(clamped * 100).toFixed(0)}%
        </Text>
        <Text style={styles.scaleText}>RIGHT ▶</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121824',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94a3b8',
    letterSpacing: 1,
    fontWeight: '600',
  },
  angleText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  profileBadge: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00ff88',
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  track: {
    height: 24,
    backgroundColor: '#0a0e17',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
  },
  deadzoneBox: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -10 }],
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: '100%',
    backgroundColor: '#475569',
    zIndex: 2,
  },
  fillIndicator: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
    opacity: 0.8,
  },
  needle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    top: 4,
    marginLeft: -7,
    zIndex: 3,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  scaleText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    fontWeight: '600',
  },
  valText: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
});
