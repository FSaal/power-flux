import { CalibrationControls, CalibrationModal, ConnectionCard, ConnectionControls } from '@/features/settings/components';
import { useDeviceSettings } from '@/features/settings/hooks/use_device_settings';
import { theme } from '@/shared/styles/theme';
import { StyleSheet, View } from 'react-native';

export default function SettingsScreen() {
    const {
        // State
        isConnected,
        isScanning,
        showCalibrationModal,
        calibrationType,
        calibrationState,

        // Actions
        startScan,
        stopScan,
        disconnect,
        handleStartCalibration,
        startQuickCalibration,
        startFullCalibration,
        abortCalibration,
        handleModalClose,
    } = useDeviceSettings();

    return (
        <View style={styles.container}>
            <ConnectionCard
                isConnected={isConnected}
                isScanning={isScanning}
            />
            <ConnectionControls
                isConnected={isConnected}
                isScanning={isScanning}
                onStartScan={startScan}
                onStopScan={stopScan}
                onDisconnect={disconnect}
            />
            <CalibrationControls
                isConnected={isConnected}
                onStartQuickCalibration={() => handleStartCalibration('quick')}
                onStartFullCalibration={() => handleStartCalibration('full')}
            />
            <CalibrationModal
                visible={showCalibrationModal}
                onClose={handleModalClose}
                type={calibrationType}
                startQuickCalibration={startQuickCalibration}
                startFullCalibration={startFullCalibration}
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