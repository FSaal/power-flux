/**
 * live.tsx
 *
 * This component provides real-time visualization and recording of sensor data
 * from the M5Stack device. It displays accelerometer and gyroscope readings,
 * handles recording sessions, and manages data storage.
 */

import { MainDisplay } from '@/features/live/components/main_display';
import { SensorData, useBLE } from '@/shared/services/ble_context';
import { dbService } from '@/shared/services/database';
import { removeGravity } from '@/shared/utils/gravity_compensation';
import { OrientationFilter } from '@/shared/utils/orientation_filter';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

interface RecordingRef {
  isRecording: boolean;
  sessionId: string | null;
}

interface BlinkingRecordIndicatorProps {
  startTime: number;
}

const Logger = {
  error: (message: string, ...args: any[]) => {
    console.error(`[LiveScreen] ERROR: ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[LiveScreen] WARN: ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (__DEV__) {
      console.info(`[LiveScreen] INFO: ${message}`, ...args);
    }
  },
};
/**
 * Displays a blinking record indicator with elapsed time
 */
const BlinkingRecordIndicator: React.FC<BlinkingRecordIndicatorProps> = ({ startTime }) => {
  const [visible, setVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('0:00');

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setVisible((prev) => !prev);
    }, 500);

    const timeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(timeInterval);
    };
  }, [startTime]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {visible && <MaterialCommunityIcons name="record-circle" size={20} color="#EF4444" />}
      <Text style={{ color: '#FFFFFF', fontSize: 14 }}>{elapsedTime}</Text>
    </View>
  );
};

/**
 * Main LiveScreen component for displaying and recording sensor data
 */
const LiveScreen = () => {
  const { isConnected, sensorData, setOnDataReceived } = useBLE();
  const [isRecording, setIsRecording] = useState(false);
  const [measurementCount, setMeasurementCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [removeGravityEnabled, setRemoveGravityEnabled] = useState(false);
  const recordingRef = useRef<RecordingRef>({
    isRecording: false,
    sessionId: null,
  });
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [orientationFilter] = useState(new OrientationFilter());
  const [orientation, setOrientation] = useState<{ x: number; y: number; z: number } | undefined>();

  useEffect(() => {
    if (sensorData && sensorData.accX !== undefined && sensorData.gyrX !== undefined) {
      const newOrientation = orientationFilter.update(
        { x: sensorData.accX, y: sensorData.accY, z: sensorData.accZ },
        { x: sensorData.gyrX, y: sensorData.gyrY, z: sensorData.gyrZ },
        sensorData.timestamp,
      );
      setOrientation(newOrientation);
    }
  }, [sensorData]);

  /**
   * Calculates the magnitude of a 3D vector
   */
  const calculateMagnitude = (x: number, y: number, z: number): number => {
    return Math.sqrt(x * x + y * y + z * z);
  };

  /**
   * Handles incoming sensor data, storing it if recording is active
   */
  const handleSensorData = useCallback(async (data: SensorData) => {
    const { isRecording, sessionId } = recordingRef.current;

    if (isRecording && sessionId && data) {
      try {
        await dbService.storeMeasurement({
          accX: data.accX,
          accY: data.accY,
          accZ: data.accZ,
          gyrX: data.gyrX,
          gyrY: data.gyrY,
          gyrZ: data.gyrZ,
          timestamp: data.timestamp,
          sessionId: sessionId,
        });

        setMeasurementCount((prev) => prev + 1);
      } catch (error) {
        Logger.error('Failed to store measurement:', error);
        Alert.alert('Storage Error', 'Failed to save measurement data');
      }
    }
  }, []);

  // Use ref to maintain latest callback reference
  const handleSensorDataRef = useRef(handleSensorData);
  useEffect(() => {
    handleSensorDataRef.current = handleSensorData;
  }, [handleSensorData]);

  // Set up data handler
  useEffect(() => {
    const dataHandler = async (data: SensorData) => {
      await handleSensorDataRef.current(data);
    };

    setOnDataReceived(dataHandler);

    return () => {
      setOnDataReceived(undefined);
    };
  }, []);

  /**
   * Toggles recording state, handling session start/end
   */
  const toggleRecording = useCallback(async () => {
    try {
      if (!recordingRef.current.isRecording) {
        const startTime = Date.now();
        Logger.info('Starting new recording session');

        const sessionId = await dbService.startSession();
        Logger.info('Session created:', { sessionId, startTime });

        recordingRef.current = { isRecording: true, sessionId };
        setIsRecording(true);
        setRecordingStartTime(startTime);
        setMeasurementCount(0);
      } else if (recordingRef.current.sessionId) {
        const sessionId = recordingRef.current.sessionId;
        Logger.info('Ending recording session:', { sessionId });

        try {
          await dbService.endSession(sessionId);
          Logger.info('Session ended successfully');

          recordingRef.current = { isRecording: false, sessionId: null };
          setIsRecording(false);
        } catch (error) {
          Logger.error('Error ending session:', error);
          throw error;
        }
      }
    } catch (error) {
      Logger.error('Recording toggle error:', error);
      Alert.alert('Recording Error', 'Failed to toggle recording');
    }
  }, [measurementCount]);

  const processedAccel = sensorData
    ? removeGravityEnabled
      ? removeGravity({ x: sensorData.accX, y: sensorData.accY, z: sensorData.accZ })
      : { x: sensorData.accX, y: sensorData.accY, z: sensorData.accZ }
    : { x: 0, y: 0, z: 0 };

  const magnitude = sensorData
    ? calculateMagnitude(processedAccel.x, processedAccel.y, processedAccel.z)
    : 0;

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusIndicator}>
        <MaterialCommunityIcons
          name={isConnected ? 'bluetooth-connect' : 'bluetooth-off'}
          size={20}
          color={isConnected ? '#22C55E' : '#EF4444'}
        />
        {isRecording && <BlinkingRecordIndicator startTime={recordingStartTime} />}
      </View>

      {/* Main Display */}
      <MainDisplay
        magnitude={magnitude}
        processedAccel={processedAccel}
        sensorData={sensorData}
        showDetails={showDetails}
        measurementCount={measurementCount}
        isRecording={isRecording}
        orientation={orientation}
      />

      {/* Settings Section */}
      <View style={styles.settingsContainer}>
        <Text style={styles.settingsHeader}>Settings</Text>

        <View style={styles.settingsCard}>
          <View style={styles.settingsCardHeader}>
            <MaterialCommunityIcons name="signal" size={20} color="#9CA3AF" />
            <Text style={styles.settingsCardTitle}>Signal Processing</Text>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Remove Gravity</Text>
              <Text style={styles.settingDescription}>
                Compensate for gravitational acceleration
              </Text>
            </View>
            <Switch
              value={removeGravityEnabled}
              onValueChange={setRemoveGravityEnabled}
              trackColor={{ false: '#374151', true: '#6544C0' }}
              thumbColor={removeGravityEnabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Details</Text>
              <Text style={styles.settingDescription}>Display detailed sensor data</Text>
            </View>
            <Switch
              value={showDetails}
              onValueChange={setShowDetails}
              trackColor={{ false: '#374151', true: '#6544C0' }}
              thumbColor={showDetails ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            !isConnected && styles.buttonDisabled,
            isRecording && styles.stopButton,
          ]}
          onPress={toggleRecording}
          disabled={!isConnected}
        >
          <MaterialCommunityIcons
            name={isRecording ? 'stop-circle' : 'record-circle'}
            size={32}
            color="white"
          />
          <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Record'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 16,
  },
  statusIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  mainDisplay: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataLabel: {
    color: '#9CA3AF',
    fontSize: 18,
    marginBottom: 8,
  },
  dataValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
  },
  dataUnit: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  detailsContainer: {
    width: '100%',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    gap: 16,
  },
  detailsSection: {
    gap: 8,
  },
  detailsHeader: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  controls: {
    padding: 16,
    alignItems: 'center',
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    width: '100%',
    maxWidth: 300,
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  gravityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    flex: 1, // This helps with layout in the status bar
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  settingsContainer: {
    paddingHorizontal: 16,
    flex: 1,
  },
  settingsHeader: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingsCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  settingsCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  settingDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
});

export default LiveScreen;
