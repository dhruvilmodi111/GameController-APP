/**
 * GYRO//PLAY — Mobile Controller App (React Native)
 *
 * Real hardware gyroscope & accelerometer motion controller for the GYRO//PLAY
 * desktop racing game. Streams normalized steering, tilt throttle, braking,
 * and nitro commands over low-latency Socket.IO.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { PairingScreen } from './src/components/PairingScreen';
import { ControllerScreen } from './src/components/ControllerScreen';
import { socketService } from './src/socketService';
import { useSensor } from './src/useSensor';
import type { JoinRoomResponse } from './src/types';

// Default server port used by GYRO//PLAY
const DEFAULT_SERVER_PORT = 3001;

function App(): React.JSX.Element {
  // Navigation: 'pairing' | 'controller'
  const [screen, setScreen] = useState<'pairing' | 'controller'>('pairing');
  const [serverUrl, setServerUrl] = useState(`http://10.186.174.37:${DEFAULT_SERVER_PORT}`);
  const [activeRoomId, setActiveRoomId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Real-time network health
  const [latency, setLatency] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'reconnecting' | 'disconnected'
  >('disconnected');

  // Real hardware sensor hook
  const sensor = useSensor();

  // Listen to network status and latency
  useEffect(() => {
    const unsubStatus = socketService.onStatusChange(status => {
      setConnectionStatus(status);
      if (status === 'disconnected' && screen === 'controller') {
        // If server forcibly disconnects, we stay on controller screen to attempt auto-reconnect
      }
    });

    const unsubLatency = socketService.onLatencyUpdate(ms => {
      setLatency(ms);
    });

    return () => {
      unsubStatus();
      unsubLatency();
    };
  }, [screen]);

  // Handle Room Connection
  const handleConnect = useCallback((roomId: string) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      socketService.connect(serverUrl.trim());

      socketService.joinRoom(roomId, undefined, (res: JoinRoomResponse) => {
        setIsConnecting(false);
        if (res && res.success) {
          setActiveRoomId(roomId);
          setScreen('controller');
        } else {
          setConnectionError(res?.error || 'Could not join room. Check code and try again.');
        }
      });

      // Safety timeout if server doesn't respond in 6s
      setTimeout(() => {
        setIsConnecting(prev => {
          if (prev) {
            setConnectionError('Connection timed out. Ensure phone and desktop are on same Wi-Fi.');
            return false;
          }
          return false;
        });
      }, 6000);
    } catch (err: any) {
      setIsConnecting(false);
      setConnectionError(err?.message || 'Failed to connect to server.');
    }
  }, [serverUrl]);

  // Handle Leave / Disconnect
  const handleDisconnect = useCallback(() => {
    socketService.leaveRoom();
    setScreen('pairing');
    setActiveRoomId('');
    setConnectionError(null);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e17" />
      <View style={styles.inner}>
        {screen === 'pairing' ? (
          <PairingScreen
            serverUrl={serverUrl}
            onServerUrlChange={setServerUrl}
            onConnect={handleConnect}
            isConnecting={isConnecting}
            connectionError={connectionError}
            sensorAvailability={sensor.availability}
            rawAngles={sensor.rawAngles}
            sensorOutput={sensor.output}
          />
        ) : (
          <ControllerScreen
            roomId={activeRoomId}
            latency={latency}
            connectionStatus={connectionStatus}
            sensor={sensor}
            onDisconnect={handleDisconnect}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
  inner: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
});

export default App;
