import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { sensorProcessor, ControlProfile } from '../sensorProcessing';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const [profile, setProfile] = useState<ControlProfile>(sensorProcessor.getProfile());
  const [invert, setInvert] = useState<boolean>(sensorProcessor.getCalibration().invertSteering);
  const [deadzone, setDeadzone] = useState<number>(sensorProcessor.getCalibration().deadzone);
  const [sensitivity, setSensitivity] = useState<number>(sensorProcessor.getCalibration().sensitivity);

  const handleProfileSelect = (p: ControlProfile) => {
    setProfile(p);
    sensorProcessor.setProfile(p);
    setDeadzone(sensorProcessor.getCalibration().deadzone);
    setSensitivity(sensorProcessor.getCalibration().sensitivity);
  };

  const handleInvertChange = (val: boolean) => {
    setInvert(val);
    sensorProcessor.setInvertSteering(val);
  };

  const handleDeadzoneSelect = (dz: number) => {
    setDeadzone(dz);
    const cal = sensorProcessor.getCalibration();
    cal.deadzone = dz;
  };

  const handleSensitivitySelect = (sens: number) => {
    setSensitivity(sens);
    const cal = sensorProcessor.getCalibration();
    cal.sensitivity = sens;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>STEERING & MOTION SETTINGS</Text>
          <Text style={styles.subtitle}>Fine-tune your mobile gyro response curve</Text>

          {/* Profile Selector */}
          <Text style={styles.sectionHeader}>DRIVING PROFILE</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.profileBtn,
                profile === 'smooth' && styles.profileBtnActive,
              ]}
              onPress={() => handleProfileSelect('smooth')}
            >
              <Text
                style={[
                  styles.profileBtnText,
                  profile === 'smooth' && styles.profileBtnTextActive,
                ]}
              >
                SMOOTH
              </Text>
              <Text style={styles.profileDesc}>Low-pass filtered, relaxed 30° roll</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.profileBtn,
                profile === 'precision' && styles.profileBtnActive,
              ]}
              onPress={() => handleProfileSelect('precision')}
            >
              <Text
                style={[
                  styles.profileBtnText,
                  profile === 'precision' && styles.profileBtnTextActive,
                ]}
              >
                PRECISION
              </Text>
              <Text style={styles.profileDesc}>Snappy response, tight 22° roll</Text>
            </TouchableOpacity>
          </View>

          {/* Invert Steering */}
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>INVERT STEERING</Text>
              <Text style={styles.settingSub}>Tilt right to turn left</Text>
            </View>
            <Switch
              value={invert}
              onValueChange={handleInvertChange}
              trackColor={{ false: '#334155', true: '#059669' }}
              thumbColor={invert ? '#00ff88' : '#94a3b8'}
            />
          </View>

          {/* Deadzone Buttons */}
          <Text style={styles.sectionHeader}>CENTER DEADZONE</Text>
          <View style={styles.optionsRow}>
            {[0.03, 0.05, 0.08, 0.12].map(dz => (
              <TouchableOpacity
                key={dz}
                style={[
                  styles.optionPill,
                  Math.abs(deadzone - dz) < 0.01 && styles.optionPillActive,
                ]}
                onPress={() => handleDeadzoneSelect(dz)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    Math.abs(deadzone - dz) < 0.01 && styles.optionPillTextActive,
                  ]}
                >
                  {(dz * 100).toFixed(0)}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sensitivity Buttons */}
          <Text style={styles.sectionHeader}>STEERING SENSITIVITY</Text>
          <View style={styles.optionsRow}>
            {[0.8, 1.0, 1.2, 1.5].map(sens => (
              <TouchableOpacity
                key={sens}
                style={[
                  styles.optionPill,
                  Math.abs(sensitivity - sens) < 0.05 && styles.optionPillActive,
                ]}
                onPress={() => handleSensitivitySelect(sens)}
              >
                <Text
                  style={[
                    styles.optionPillText,
                    Math.abs(sensitivity - sens) < 0.05 && styles.optionPillTextActive,
                  ]}
                >
                  {sens.toFixed(1)}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Close button */}
          <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveBtnText}>APPLY & CLOSE</Text>
          </TouchableOpacity>
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
    padding: 22,
  },
  title: {
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  profileBtn: {
    flex: 1,
    backgroundColor: '#0a0e17',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  profileBtnActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
  },
  profileBtnText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  profileBtnTextActive: {
    color: '#00ff88',
  },
  profileDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#1e293b',
    marginTop: 6,
  },
  settingLabel: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  settingSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  optionPill: {
    flex: 1,
    backgroundColor: '#0a0e17',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  optionPillActive: {
    borderColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
  },
  optionPillText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  optionPillTextActive: {
    color: '#00ff88',
  },
  saveBtn: {
    backgroundColor: '#00ff88',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
  },
  saveBtnText: {
    color: '#0a0e17',
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
