import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { CalibrationState, RawAngles } from '../useSensor';

interface CalibrationModalProps {
  visible: boolean;
  calibrationState: CalibrationState;
  rawAngles: RawAngles;
  onStart: () => void;
  onCancel: () => void;
  onRecalibrate: () => void;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  visible,
  calibrationState,
  rawAngles,
  onStart,
  onCancel,
  onRecalibrate,
  onClose,
}) => {
  const [progressSec, setProgressSec] = useState(2);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (calibrationState === 'collecting') {
      setProgressSec(2);
      timer = setInterval(() => {
        setProgressSec(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [calibrationState]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <Text style={styles.title}>ZERO-DRIFT CALIBRATION</Text>
          <Text style={styles.subtitle}>
            Hold your device comfortably in your normal driving posture and keep still.
          </Text>

          {/* Current Readings Preview */}
          <View style={styles.readingsBox}>
            <View style={styles.readingCol}>
              <Text style={styles.readingLabel}>ROLL (STEER)</Text>
              <Text style={styles.readingVal}>{rawAngles.roll.toFixed(1)}°</Text>
            </View>
            <View style={styles.readingCol}>
              <Text style={styles.readingLabel}>PITCH (TILT)</Text>
              <Text style={styles.readingVal}>{rawAngles.pitch.toFixed(1)}°</Text>
            </View>
            <View style={styles.readingCol}>
              <Text style={styles.readingLabel}>YAW (HEADING)</Text>
              <Text style={styles.readingVal}>{rawAngles.yaw.toFixed(1)}°</Text>
            </View>
          </View>

          {/* Status Content */}
          {calibrationState === 'idle' && (
            <View style={styles.stateContainer}>
              <Text style={styles.statusPrompt}>
                Press below when ready. The app will record 2 seconds of stationary sensor readings to eliminate zero-point drift.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onStart}>
                <Text style={styles.primaryBtnText}>BEGIN CALIBRATION</Text>
              </TouchableOpacity>
            </View>
          )}

          {calibrationState === 'collecting' && (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color="#00ff88" style={{ marginBottom: 16 }} />
              <Text style={styles.statusPrompt}>
                SAMPLING HARDWARE IMU SENSORS... ({progressSec}s)
              </Text>
              <Text style={styles.hintText}>Keep device steady</Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          )}

          {calibrationState === 'unstable' && (
            <View style={styles.stateContainer}>
              <Text style={[styles.statusPrompt, { color: '#f43f5e' }]}>
                ⚠️ UNSTABLE POSITION DETECTED
              </Text>
              <Text style={styles.hintText}>
                The device was moving too much during calibration. Rest your hands against your lap or table and try again.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onRecalibrate}>
                <Text style={styles.primaryBtnText}>TRY AGAIN</Text>
              </TouchableOpacity>
            </View>
          )}

          {calibrationState === 'done' && (
            <View style={styles.stateContainer}>
              <Text style={[styles.statusPrompt, { color: '#00ff88' }]}>
                ✓ CALIBRATION APPLIED
              </Text>
              <Text style={styles.hintText}>
                Zero-point offset saved. Neutral steering is now locked to your natural posture.
              </Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>DONE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Dismiss button */}
          {calibrationState !== 'collecting' && calibrationState !== 'done' && (
            <TouchableOpacity style={styles.closeLink} onPress={onClose}>
              <Text style={styles.closeLinkText}>DISMISS</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#121824',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  readingsBox: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#0a0e17',
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  readingCol: {
    flex: 1,
    alignItems: 'center',
  },
  readingLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#64748b',
    marginBottom: 4,
  },
  readingVal: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stateContainer: {
    width: '100%',
    alignItems: 'center',
  },
  statusPrompt: {
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#00ff88',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#0a0e17',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelBtnText: {
    color: '#f43f5e',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  closeLink: {
    marginTop: 16,
  },
  closeLinkText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
