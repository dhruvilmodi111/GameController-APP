import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import type { RawAngles, SensorAvailability } from '../useSensor';
import type { ProcessedOutput } from '../sensorProcessing';

interface PairingScreenProps {
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  onConnect: (roomId: string) => void;
  isConnecting: boolean;
  connectionError: string | null;
  sensorAvailability: SensorAvailability;
  rawAngles: RawAngles;
  sensorOutput: ProcessedOutput;
}

export const PairingScreen: React.FC<PairingScreenProps> = ({
  serverUrl,
  onServerUrlChange,
  onConnect,
  isConnecting,
  connectionError,
  sensorAvailability,
  rawAngles,
  sensorOutput,
}) => {
  const [roomId, setRoomId] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);

  const handleRoomIdChange = (text: string) => {
    setRoomId(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
  };

  const handleConnectPress = () => {
    if (!roomId.trim()) return;
    onConnect(roomId.trim());
  };

  const isSensorActive = sensorAvailability === 'available';

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      {/* Branding */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>GYRO<Text style={{ color: '#00ff88' }}>//</Text>PLAY</Text>
          <View
            style={[
              styles.sensorPill,
              isSensorActive ? styles.sensorPillActive : styles.sensorPillInactive,
            ]}
          >
            <View
              style={[
                styles.sensorDot,
                { backgroundColor: isSensorActive ? '#00ff88' : '#eab308' },
              ]}
            />
            <Text
              style={[
                styles.sensorPillText,
                { color: isSensorActive ? '#00ff88' : '#eab308' },
              ]}
            >
              {isSensorActive ? 'REAL GYRO ACTIVE' : 'INITIALIZING IMU'}
            </Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          Your phone is <Text style={{ color: '#00ff88' }}>the wheel.</Text>
        </Text>
        <Text style={styles.heroSub}>
          Real hardware IMU tilt streaming with sub-20ms latency. Pair with your desktop game below.
        </Text>
      </View>

      {/* Live Motion Signature (Proves hardware IMU is active) */}
      <View style={styles.motionPreviewCard}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>HARDWARE SENSOR TELEMETRY</Text>
          <Text style={styles.previewHz}>60 Hz STREAM</Text>
        </View>

        <View style={styles.previewGrid}>
          <View style={styles.previewItem}>
            <Text style={styles.previewLabel}>STEER (ROLL)</Text>
            <Text style={styles.previewVal}>
              {rawAngles.roll > 0 ? `+${rawAngles.roll.toFixed(1)}°` : `${rawAngles.roll.toFixed(1)}°`}
            </Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={styles.previewLabel}>TILT (PITCH)</Text>
            <Text style={styles.previewVal}>
              {rawAngles.pitch > 0 ? `+${rawAngles.pitch.toFixed(1)}°` : `${rawAngles.pitch.toFixed(1)}°`}
            </Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={styles.previewLabel}>NORMALIZED</Text>
            <Text style={[styles.previewVal, { color: '#00ff88' }]}>
              {sensorOutput.steering.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Dynamic Tilt Bar */}
        <View style={styles.miniGaugeTrack}>
          <View style={styles.miniCenterMark} />
          <View
            style={[
              styles.miniGaugeBar,
              sensorOutput.steering >= 0
                ? { left: '50%', width: `${Math.min(50, sensorOutput.steering * 50)}%` }
                : { right: '50%', width: `${Math.min(50, -sensorOutput.steering * 50)}%` },
            ]}
          />
        </View>
        <Text style={styles.tiltPrompt}>
          Tilt phone left/right to verify sensor response
        </Text>
      </View>

      {/* Pairing Card */}
      <View style={styles.pairingCard}>
        <Text style={styles.inputLabel}>ENTER 6-DIGIT ROOM CODE</Text>
        <TextInput
          style={styles.roomInput}
          value={roomId}
          onChangeText={handleRoomIdChange}
          placeholder="e.g. 8K2M9P"
          placeholderTextColor="#475569"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
        />

        {connectionError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {connectionError}</Text>
          </View>
        )}

        {/* Connect Action Button */}
        <TouchableOpacity
          style={[
            styles.connectBtn,
            (!roomId.trim() || isConnecting) && styles.connectBtnDisabled,
          ]}
          onPress={handleConnectPress}
          disabled={!roomId.trim() || isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator size="small" color="#0a0e17" />
          ) : (
            <Text style={styles.connectBtnText}>CONNECT CONTROLLER ▶</Text>
          )}
        </TouchableOpacity>

        {/* Advanced Server IP toggle */}
        <TouchableOpacity
          style={styles.serverConfigToggle}
          onPress={() => setShowServerConfig(!showServerConfig)}
        >
          <Text style={styles.serverConfigToggleText}>
            {showServerConfig ? '▲ HIDE SERVER HOST' : '▼ CONFIGURE SERVER IP / LAN URL'}
          </Text>
        </TouchableOpacity>

        {showServerConfig && (
          <View style={styles.serverConfigBox}>
            <Text style={styles.serverConfigLabel}>BACKEND SOCKET.IO SERVER</Text>
            <TextInput
              style={styles.serverInput}
              value={serverUrl}
              onChangeText={onServerUrlChange}
              placeholder="http://192.168.1.100:3001"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.serverConfigHint}>
              Enter the laptop IP displayed on your desktop GYRO//PLAY screen (e.g. http://192.168.x.x:3001).
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    maxWidth: 420,
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'monospace',
    color: '#ffffff',
    letterSpacing: 2,
  },
  sensorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  sensorPillActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  sensorPillInactive: {
    borderColor: '#eab308',
    backgroundColor: 'rgba(234, 179, 8, 0.08)',
  },
  sensorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sensorPillText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 34,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
  },
  motionPreviewCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121824',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 18,
    marginBottom: 20,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  previewHz: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#00ff88',
    fontWeight: 'bold',
  },
  previewGrid: {
    flexDirection: 'row',
    backgroundColor: '#0a0e17',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  previewItem: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#64748b',
    marginBottom: 2,
  },
  previewVal: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  miniGaugeTrack: {
    height: 10,
    backgroundColor: '#0a0e17',
    borderRadius: 5,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniCenterMark: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: '100%',
    backgroundColor: '#64748b',
    zIndex: 2,
  },
  miniGaugeBar: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 2,
  },
  tiltPrompt: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pairingCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#121824',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#94a3b8',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  roomInput: {
    width: '100%',
    backgroundColor: '#0a0e17',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    fontSize: 22,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 6,
    paddingVertical: 14,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 12,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  connectBtn: {
    width: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  connectBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  connectBtnText: {
    color: '#0a0e17',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  serverConfigToggle: {
    marginTop: 18,
    alignItems: 'center',
  },
  serverConfigToggleText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  serverConfigBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#1e293b',
  },
  serverConfigLabel: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: '#0a0e17',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  serverConfigHint: {
    fontSize: 10,
    color: '#475569',
    lineHeight: 14,
  },
});
