import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    SlideInRight,
    SlideOutRight,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { CalibrationModal } from '../../components/calibration_modal';
import { useBLE } from '../../services/BLEContext';

const AnimatedMaterialIcon = Animated.createAnimatedComponent(MaterialCommunityIcons);

export default function SettingsScreen() {
    const {
        isConnected,
        isScanning,
        startScan,
        stopScan,
        disconnect,
        calibrationState,
        setCalibrationState,
        startQuickCalibration,
        startFullCalibration,
        abortCalibration
    } = useBLE();

    const [showCalibrationModal, setShowCalibrationModal] = useState(false);
    const [calibrationType, setCalibrationType] = useState<"quick" | "full">("quick");

    // Animation values
    const scanningRotation = useSharedValue(0);
    const connectionScale = useSharedValue(1);

    // Start rotating animation when scanning
    React.useEffect(() => {
        if (isScanning) {
            scanningRotation.value = withRepeat(
                withTiming(360, {
                    duration: 2000,
                    easing: Easing.linear,
                }),
                -1, // Infinite repetitions
                false // Don't reverse animation
            );
        } else {
            scanningRotation.value = withTiming(0, {
                duration: 300,
            });
        }
    }, [isScanning]);

    // Connection status icon animation
    React.useEffect(() => {
        connectionScale.value = withSequence(
            withSpring(1.3),
            withSpring(1)
        );
    }, [isConnected]);

    // Animated styles
    const rotatingStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${scanningRotation.value}deg` }],
    }));

    const connectionIconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: connectionScale.value }],
    }));

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
            setShowCalibrationModal(true);
        } catch (error) {
            const errorMessage = error instanceof Error ?
                error.message : 'Failed to start calibration';
            Alert.alert('Calibration Error', errorMessage);
            console.error('Calibration error:', error);
            setShowCalibrationModal(false);
        }
    };

    // Handle modal close
    const handleModalClose = () => {
        if (!calibrationState.isCalibrating) {
            setShowCalibrationModal(false);
            // Reset ALL calibration state when modal is closed
            setCalibrationState({
                isCalibrating: false,
                status: 'idle',
                type: 'none',
                progress: 0
            });
        }
    };

    return (
        <View style={styles.container}>
            {/* Connection Status Card */}
            <Animated.View
                style={styles.card}
                entering={FadeIn.duration(500)}
            >
                <View style={styles.cardHeader}>
                    <AnimatedMaterialIcon
                        style={connectionIconStyle}
                        name={isConnected ? "bluetooth-connect" : "bluetooth-off"}
                        size={24}
                        color={isConnected ? "#22C55E" : "#EF4444"}
                    />
                    <Text style={styles.cardTitle}>Device Connection</Text>
                </View>
                <Text style={styles.statusText}>
                    Status: {isConnected ? "Connected" : isScanning ? "Scanning..." : "Disconnected"}
                </Text>
            </Animated.View>

            {/* Connection Controls */}
            <View style={styles.buttonContainer}>
                {isConnected ? (
                    <Animated.View
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(300)}
                    >
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
                    </Animated.View>
                ) : (
                    <View style={styles.scanButtonContainer}>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.connectButton,
                                isScanning && styles.scanningButton
                            ]}
                            onPress={startScan}
                            disabled={isScanning}
                        >
                            <AnimatedMaterialIcon
                                style={[rotatingStyle]}
                                name={isScanning ? "loading" : "bluetooth-settings"}
                                size={24}
                                color="white"
                            />
                            <Text style={styles.buttonText}>
                                {isScanning ? "Scanning..." : "Scan for Device"}
                            </Text>
                        </TouchableOpacity>

                        {isScanning && (
                            <Animated.View
                                entering={SlideInRight.duration(300)}
                                exiting={SlideOutRight.duration(300)}
                            >
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton]}
                                    onPress={stopScan}
                                >
                                    <MaterialCommunityIcons
                                        name="close-circle"
                                        size={24}
                                        color="white"
                                    />
                                    <Text style={styles.buttonText}>Cancel</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
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

            {/* Calibration Modal */}
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
        overflow: 'hidden', // For icon animations
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
    scanButtonContainer: {
        gap: 12,
        width: '100%',
        overflow: 'hidden', // Important for slide animations
    },
    scanningButton: {
        backgroundColor: '#4B5563', // More muted color while scanning
    },
    cancelButton: {
        backgroundColor: '#EF4444', // Red cancel button
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
});