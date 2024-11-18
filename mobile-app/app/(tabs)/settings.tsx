import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useBLE } from '../../services/BLEContext';

interface CalibrationModalProps {
    visible: boolean;
    onClose: () => void;
    onStartCalibration: () => void;
}

export default function SettingsScreen() {
    const {
        isConnected,
        isScanning,
        startScan,
        disconnect,
        calibrationState,
        startCalibration,
        abortCalibration
    } = useBLE();

    const [showCalibrationModal, setShowCalibrationModal] = useState(false);

    const handleStartCalibration = async () => {
        if (!isConnected) {
            Alert.alert('Error', 'Please connect to device first');
            return;
        }
        setShowCalibrationModal(true);
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

            {/* Calibration Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                        name="tune-vertical"
                        size={24}
                        color="#FFFFFF"
                    />
                    <Text style={styles.cardTitle}>Device Calibration</Text>
                </View>
                <Text style={styles.statusText}>
                    Status: {calibrationState.status.replace('_', ' ')}
                </Text>

                {calibrationState.isCalibrating ? (
                    <TouchableOpacity
                        style={[styles.button, styles.abortButton]}
                        onPress={abortCalibration}
                    >
                        <MaterialCommunityIcons
                            name="close-circle"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>Abort Calibration</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.calibrateButton,
                            !isConnected && styles.buttonDisabled
                        ]}
                        onPress={handleStartCalibration}
                        disabled={!isConnected}
                    >
                        <MaterialCommunityIcons
                            name="tune"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>Start Calibration</Text>
                    </TouchableOpacity>
                )}
            </View>

            <CalibrationModal
                visible={showCalibrationModal}
                onClose={() => setShowCalibrationModal(false)}
                onStartCalibration={startCalibration}
            />
        </View>
    );
}

const PlaceDeviceAnimation = () => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            {
                translateY: withRepeat(
                    withSequence(
                        withTiming(-25, { duration: 1500 }),
                        withTiming(0, { duration: 1500 }),
                    ),
                    -1, true
                )
            },
            {
                rotateZ: withRepeat(
                    withSequence(
                        withTiming('-30deg', { duration: 1500 }),
                        withTiming('0deg', { duration: 1500 }),
                    ),
                    -1, true
                )
            }
        ]
    }));

    return (
        <Animated.View style={[styles.animationContainer, animatedStyle]}>
            <MaterialCommunityIcons
                name="cellphone-text"
                size={48}
                color="#6544C0"
            />
        </Animated.View>
    );
};

const CalibrationModal: React.FC<CalibrationModalProps> = ({
    visible,
    onClose,
    onStartCalibration
}) => {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View
                    style={styles.bottomSheetContainer}
                    onStartShouldSetResponder={() => true}
                    onResponderRelease={(evt) => {
                        evt.stopPropagation();
                    }}
                >
                    <View style={styles.bottomSheetHandle} />

                    <Text style={styles.bottomSheetTitle}>Device Calibration</Text>

                    <View style={styles.bottomSheetContent}>
                        <PlaceDeviceAnimation />

                        <Text style={styles.bottomSheetText}>
                            Place the sensor on a flat, stable surface with the display facing up
                        </Text>

                        <TouchableOpacity
                            style={styles.calibrateButton}
                            onPress={() => {
                                onStartCalibration();
                                onClose();
                            }}
                        >
                            <MaterialCommunityIcons
                                name="tune"
                                size={24}
                                color="white"
                            />
                            <Text style={styles.buttonText}>Start Calibration</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

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
        gap: 12,
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
    abortButton: {
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheetContainer: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        minHeight: 300,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    bottomSheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#6B7280',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 20,
    },
    bottomSheetTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 20,
    },
    bottomSheetContent: {
        alignItems: 'center',
        gap: 24,
    },
    bottomSheetText: {
        fontSize: 16,
        color: '#9CA3AF',
        textAlign: 'center',
        lineHeight: 24,
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
    animationContainer: {
        padding: 20,
    },
});