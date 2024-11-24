import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CalibrationModal } from '../../components/calibration_modal';
import { FullCalibrationModal } from '../../components/full_calibration_modal';
import { useBLE } from '../../services/BLEContext';

export default function SettingsScreen() {
    const {
        isConnected,
        isScanning,
        startScan,
        disconnect,
        calibrationState,
        setCalibrationState,
        startQuickCalibration,
        startFullCalibration,
        abortCalibration,
        confirmCalibrationPosition,
        isPositionCorrect,
        sensorData
    } = useBLE();

    const [showCalibrationModal, setShowCalibrationModal] = useState(false);
    const [showFullCalibrationModal, setShowFullCalibrationModal] = useState(false);
    const [calibrationType, setCalibrationType] = useState<"quick" | "full">("quick");

    // Handle starting calibration process
    const handleStartCalibration = async (type: 'quick' | 'full') => {
        if (!isConnected) {
            Alert.alert('Error', 'Please connect to device first');
            return;
        }
        try {
            setCalibrationType(type);
            // Reset state before showing modal
            setCalibrationState({
                isCalibrating: false,
                status: 'idle',
                type: 'none',
                progress: 0
            });
            if (type === 'quick') {
                setShowCalibrationModal(true);
            } else {
                setShowFullCalibrationModal(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ?
                error.message : 'Failed to start calibration';
            Alert.alert('Calibration Error', errorMessage);
            console.error('Calibration error:', error);
            setShowCalibrationModal(false);
            setShowFullCalibrationModal(false);
        }
    };

    // Handle modal close
    const handleModalClose = async () => {
        if (calibrationState.isCalibrating) {
            try {
                await abortCalibration();
            } catch (error) {
                console.error('Error aborting calibration:', error);
                Alert.alert('Error', 'Failed to abort calibration');
            }
        }
        setShowCalibrationModal(false);
        setShowFullCalibrationModal(false);
        // Reset calibration state
        setCalibrationState({
            isCalibrating: false,
            status: 'idle',
            type: 'none',
            progress: 0
        });
    };

    return (
        <View style={styles.container}>
            {/* Connection Status Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                        name={isConnected ? "bluetooth-connect" : "bluetooth-off"}
                        size={24}
                        color={isConnected ? "#22C55E" : "#EF4444"}
                    />
                    <Text style={styles.cardTitle}>Device Connection</Text>
                </View>
                <Text style={styles.statusText}>
                    Status: {isConnected ? "Connected" : isScanning ? "Scanning..." : "Disconnected"}
                </Text>
            </View>

            {/* Connection Controls */}
            <View style={styles.buttonContainer}>
                {isConnected ? (
                    <TouchableOpacity
                        style={[styles.button, styles.disconnectButton]}
                        onPress={disconnect}
                    >
                        <MaterialCommunityIcons
                            name="bluetooth-off"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>Disconnect</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.button, styles.connectButton]}
                        onPress={startScan}
                        disabled={isScanning}
                    >
                        <MaterialCommunityIcons
                            name="bluetooth-settings"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>
                            {isScanning ? "Scanning..." : "Scan for Device"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Quick Calibration Button */}
            <TouchableOpacity
                style={[
                    styles.button,
                    styles.calibrateButton,
                    !isConnected && styles.buttonDisabled
                ]}
                onPress={() => handleStartCalibration('quick')}
                disabled={!isConnected}
            >
                <MaterialCommunityIcons name="tune" size={24} color="white" />
                <Text style={styles.buttonText}>Quick Calibrate</Text>
            </TouchableOpacity>

            {/* Full Calibration Button */}
            <TouchableOpacity
                style={[
                    styles.button,
                    styles.fullCalibrateButton,
                    !isConnected && styles.buttonDisabled
                ]}
                onPress={() => handleStartCalibration('full')}
                disabled={!isConnected}
            >
                <MaterialCommunityIcons name="tune" size={24} color="white" />
                <Text style={styles.buttonText}>Full Calibrate</Text>
            </TouchableOpacity>

            {/* Quick Calibration Modal */}
            <CalibrationModal
                visible={showCalibrationModal}
                onClose={handleModalClose}
                type={calibrationType}
                startQuickCalibration={startQuickCalibration}
                startFullCalibration={startFullCalibration}
                calibrationState={calibrationState}
                onAbort={abortCalibration}
            />

            {/* Full Calibration Modal */}
            <FullCalibrationModal
                visible={showFullCalibrationModal}
                onClose={handleModalClose}
                onStartCalibration={startFullCalibration}
                onConfirmPosition={async () => {
                    try {
                        await confirmCalibrationPosition();
                    } catch (error) {
                        console.error('Failed to confirm position:', error);
                        Alert.alert('Error', 'Failed to confirm position');
                    }
                }}
                onAbort={async () => {
                    try {
                        await abortCalibration();
                        setShowFullCalibrationModal(false);
                    } catch (error) {
                        console.error('Failed to abort calibration:', error);
                        Alert.alert('Error', 'Failed to abort calibration');
                    }
                }}
                calibrationState={calibrationState}
                currentRotation={sensorData ? {
                    x: sensorData.accX,
                    y: sensorData.accY,
                    z: sensorData.accZ
                } : undefined}
                isPositionCorrect={isPositionCorrect}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 16,
        gap: 16,
    },
    card: {
        backgroundColor: '#1F2937',
        borderRadius: 16,
        padding: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    statusText: {
        fontSize: 16,
        color: '#9CA3AF',
        textTransform: 'capitalize',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        justifyContent: 'space-between',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
        marginTop: 12,
    },
    connectButton: {
        backgroundColor: '#22C55E',
    },
    disconnectButton: {
        backgroundColor: '#EF4444',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    calibrateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6544C0',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        gap: 8,
        width: '100%',
    },
    fullCalibrateButton: {
        backgroundColor: '#8B5CF6',
    },
});