import React, { useState } from 'react';
import { Settings2, X, RefreshCw, Check } from 'lucide-react';
import type { CalibrationData } from '@shared/types';
import { sensorProcessor } from '../../logic/sensors/sensorProcessing';

interface CalibrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCalibrateZero: () => void;
  onCalibrationChange?: (data: CalibrationData) => void;
}

export const CalibrationDialog: React.FC<CalibrationDialogProps> = ({
  isOpen,
  onClose,
  onCalibrateZero,
  onCalibrationChange,
}) => {
  const [config, setConfig] = useState<CalibrationData>(sensorProcessor.getCalibration());

  if (!isOpen) return null;

  const handleSensitivityChange = (val: number) => {
    const updated = { ...config, sensitivity: val };
    setConfig(updated);
    sensorProcessor.setCalibration(updated);
    onCalibrationChange?.(updated);
  };

  const handleDeadzoneChange = (val: number) => {
    const updated = { ...config, deadzone: val };
    setConfig(updated);
    sensorProcessor.setCalibration(updated);
    onCalibrationChange?.(updated);
  };

  const handleInvertToggle = () => {
    const updated = { ...config, invertSteering: !config.invertSteering };
    setConfig(updated);
    sensorProcessor.setCalibration(updated);
    onCalibrationChange?.(updated);
  };

  const handleResetZero = () => {
    onCalibrateZero();
    setConfig(sensorProcessor.getCalibration());
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 13, 12, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
    >
      <div
        className="elevated-panel"
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={16} color="var(--accent-lime)" />
            <h3 className="font-display" style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
              SENSOR CALIBRATION
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{ padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Zero-Position Calibration */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Hold phone in your natural resting grip and press:
          </div>
          <button
            onClick={handleResetZero}
            className="btn-secondary"
            style={{ width: '100%', padding: '10px', fontSize: '0.82rem', borderColor: 'var(--border-lime)' }}
          >
            <RefreshCw size={14} color="var(--accent-lime)" />
            Set Current Angle as Center (0°)
          </button>
        </div>

        {/* Sensitivity Slider */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Steering Sensitivity</span>
            <span className="font-mono text-lime">{config.sensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={config.sensitivity}
            onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-lime)', cursor: 'pointer' }}
          />
        </div>

        {/* Deadzone Slider */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Center Deadzone</span>
            <span className="font-mono text-lime">{(config.deadzone * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="0.2"
            step="0.01"
            value={config.deadzone}
            onChange={(e) => handleDeadzoneChange(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-lime)', cursor: 'pointer' }}
          />
        </div>

        {/* Anti-Jitter Smoothing Slider */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Jitter Filter Smoothing</span>
            <span className="font-mono text-lime">
              {sensorProcessor.getAlphaFilter() < 0.25 ? 'High (Smooth)' : sensorProcessor.getAlphaFilter() < 0.45 ? 'Balanced' : 'Low (Snappy)'}
            </span>
          </div>
          <input
            type="range"
            min="0.10"
            max="0.60"
            step="0.02"
            value={sensorProcessor.getAlphaFilter()}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              sensorProcessor.setAlphaFilter(val);
              setConfig({ ...config });
            }}
            style={{ width: '100%', accentColor: 'var(--accent-lime)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            <span>Silky Smooth</span>
            <span>Ultra Snappy</span>
          </div>
        </div>

        {/* Invert Steering */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderTop: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}
        >
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Invert Steering Axis</span>
          <button
            onClick={handleInvertToggle}
            className="btn-secondary"
            style={{
              padding: '4px 12px',
              fontSize: '0.75rem',
              backgroundColor: config.invertSteering ? 'var(--accent-lime-dim)' : 'transparent',
              color: config.invertSteering ? 'var(--accent-lime)' : 'var(--text-secondary)',
              borderColor: config.invertSteering ? 'var(--border-lime)' : 'var(--border-subtle)',
            }}
          >
            {config.invertSteering ? 'ON' : 'OFF'}
          </button>
        </div>

        <button
          onClick={onClose}
          className="btn-primary"
          style={{ width: '100%', padding: '12px' }}
        >
          <Check size={16} />
          Done
        </button>
      </div>
    </div>
  );
};
