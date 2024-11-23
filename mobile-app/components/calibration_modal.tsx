import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlaceDeviceAnimation } from './place_device_animation';

// Possible states the modal can be in
type ModalState = 'initial' | 'inProgress' | 'failed' | 'success';

interface CalibrationModalProps {
    visible: boolean;
    onClose: () => void;
    type: 'quick' | 'full';
    startQuickCalibration: () => Promise<void>;
    startFullCalibration: () => Promise<void>;
    calibrationState: {
        isCalibrating: boolean;
        status: string;
        progress: number;
    };
    onAbort: () => Promise<void>;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
    visible,
    onClose,
    type,
    startQuickCalibration,
    startFullCalibration,
    calibrationState,
    onAbort
}) => {
    // Determine current modal state based on calibration status
    const getModalState = (): ModalState => {
        if (calibrationState.status === 'failed') return 'failed';
        if (calibrationState.status === 'completed') return 'success';
        if (calibrationState.isCalibrating) return 'inProgress';
        return 'initial';
    };

    const handleStartCalibration = async () => {
        try {
            if (type === 'quick') {
                await startQuickCalibration();
            } else {
                await startFullCalibration();
            }
        } catch (error) {
            console.error('Error starting calibration:', error);
        }
    };

    const renderContent = () => {
        const modalState = getModalState();

        switch (modalState) {
            case 'failed':
                return (
                    <View style={styles.bottomSheetContent}>
                        <MaterialCommunityIcons
                            name="alert-circle"
                            size={48}
                            color="#EF4444"
                        />
                        <Text style={styles.bottomSheetText}>
                            Calibration failed. Make sure the device is on a stable surface.
                        </Text>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.closeButton]}
                                onPress={onClose}
                            >
                                <Text style={styles.buttonText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.calibrateButton]}
                                onPress={handleStartCalibration}
                            >
                                <Text style={styles.buttonText}>Try Again</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'success':
                return (
                    <View style={styles.bottomSheetContent}>
                        <MaterialCommunityIcons
                            name="check-circle"
                            size={48}
                            color="#22C55E"
                        />
                        <Text style={styles.bottomSheetText}>
                            Calibration completed successfully!
                        </Text>
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={[styles.button, styles.closeButton]}
                                onPress={onClose}
                            >
                                <Text style={styles.buttonText}>Close</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.button, styles.calibrateButton]}
                                onPress={handleStartCalibration}
                            >
                                <Text style={styles.buttonText}>Calibrate Again</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );

            case 'inProgress':
                return (
                    <View style={styles.bottomSheetContent}>
                        <View style={styles.progressBar}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${calibrationState.progress}%` }
                                ]}
                            />
                        </View>
                        <Text style={styles.bottomSheetText}>
                            Place the device on a flat surface and keep it still
                        </Text>
                        <TouchableOpacity
                            style={[styles.button, styles.abortButton]}
                            onPress={onAbort}
                        >
                            <Text style={styles.buttonText}>Abort</Text>
                        </TouchableOpacity>
                    </View>
                );

            default:
                return (
                    <View style={styles.bottomSheetContent}>
                        <PlaceDeviceAnimation />
                        <Text style={styles.bottomSheetText}>
                            {type === 'full'
                                ? 'Place the sensor on a flat, stable surface. The device will need to be moved to different positions during calibration.'
                                : 'Place the sensor on a flat, stable surface with the display facing up'
                            }
                        </Text>
                        <TouchableOpacity
                            style={[styles.button, styles.calibrateButtonMain]}
                            onPress={handleStartCalibration}
                        >
                            <Text style={styles.buttonText}>Start Calibration</Text>
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={calibrationState.isCalibrating ? undefined : onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={calibrationState.isCalibrating ? undefined : onClose}
            >
                <View
                    style={styles.bottomSheetContainer}
                    onStartShouldSetResponder={() => true}
                >
                    <View style={styles.bottomSheetHandle} />
                    <Text style={styles.bottomSheetTitle}>
                        {type === 'full' ? 'Full Calibration' : 'Quick Calibration'}
                    </Text>
                    {renderContent()}
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheetContainer: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 32,
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
        marginBottom: 24,
    },
    bottomSheetText: {
        fontSize: 16,
        color: '#E5E7EB',
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: '90%',
    },
    button: {
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calibrateButton: {
        backgroundColor: '#6544C0',
        flex: 1,
    },
    calibrateButtonMain: {
        backgroundColor: '#6544C0',
    },
    abortButton: {
        backgroundColor: '#EF4444',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#374151',
        borderRadius: 4,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#6544C0',
        borderRadius: 4,
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    closeButton: {
        backgroundColor: '#374151',
        flex: 1,
    },
});  