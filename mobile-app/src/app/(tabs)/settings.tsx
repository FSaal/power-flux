import {
  CalibrationControls,
  CalibrationModal,
  ConnectionCard,
  ConnectionControls,
  useDeviceSettings,
} from '@/features/settings';
import { theme } from '@/shared/styles/theme';
import { StyleSheet, View } from 'react-native';

export default function SettingsScreen() {
  const {
    // State
    isConnected,
    isScanning,
    showCalibrationModal,
    calibrationState,

    // Actions
    startScan,
    stopScan,
    disconnect,
    handleStartCalibration,
    startQuickCalibration,
    abortCalibration,
    handleModalClose,
  } = useDeviceSettings();

  return (
    <View style={styles.container}>
      <ConnectionCard isConnected={isConnected} isScanning={isScanning} />
      <ConnectionControls
        isConnected={isConnected}
        isScanning={isScanning}
        onStartScan={startScan}
        onStopScan={stopScan}
        onDisconnect={disconnect}
      />
      <CalibrationControls
        isConnected={isConnected}
        onStartQuickCalibration={() => handleStartCalibration()}
      />
      <CalibrationModal
        visible={showCalibrationModal}
        onClose={handleModalClose}
        startQuickCalibration={startQuickCalibration}
        calibrationState={calibrationState}
        onAbort={abortCalibration}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
});
