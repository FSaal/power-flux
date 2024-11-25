import {
  ConnectionStatus,
  MagnitudeDisplay,
  RecordButton,
  RecordingIndicator,
  SensorDetails,
  useRecording,
  useSensorData,
} from '@/features/live';
import { useBLE } from '@/shared/services/ble_context';
import { theme } from '@/shared/styles/theme';
import { StyleSheet, View } from 'react-native';

export default function LiveScreen() {
  const { isConnected } = useBLE();
  const { sensorData, magnitude, showDetails, toggleDetails } = useSensorData();

  const { isRecording, measurementCount, recordingStartTime, handleSensorData, toggleRecording } =
    useRecording();

  if (!sensorData) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusBar}>
        <ConnectionStatus isConnected={isConnected} />
        {isRecording && <RecordingIndicator startTime={recordingStartTime} />}
      </View>

      <View style={styles.mainDisplay}>
        <MagnitudeDisplay magnitude={magnitude} />
        {showDetails && (
          <SensorDetails
            data={sensorData}
            measurementCount={measurementCount}
            isRecording={isRecording}
            onToggleVisibility={toggleDetails}
          />
        )}
      </View>

      <View style={styles.controls}>
        <RecordButton
          isRecording={isRecording}
          isConnected={isConnected}
          onPress={toggleRecording}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainDisplay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
});
