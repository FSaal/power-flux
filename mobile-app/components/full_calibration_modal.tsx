import MaterialCommunityIcons from '@expo/vector-icons/build/MaterialCommunityIcons';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DeviceOrientation } from './device_orientation';

interface Position {
    rotationState: 'z_up' | 'z_down' | 'y_up' | 'y_down' | 'x_up' | 'x_down';
    instruction: string;
}

const POSITIONS: Position[] = [
    { rotationState: 'z_up', instruction: 'Place the device flat on table with screen facing up' },
    { rotationState: 'z_down', instruction: 'Turn device upside down' },
    { rotationState: 'y_up', instruction: 'Stand device on long edge with buttons up' },
    { rotationState: 'y_down', instruction: 'Stand device on long edge with buttons down' },
    { rotationState: 'x_up', instruction: 'Stand device on short edge with USB up' },
    { rotationState: 'x_down', instruction: 'Stand device on short edge with USB down' },
];
interface FullCalibrationModalProps {
    visible: boolean;
    onClose: () => void;
    onStartCalibration: () => Promise<void>;
    onConfirmPosition: () => Promise<void>;
    onAbort: () => Promise<void>;  // New abort handler
    calibrationState: {
        isCalibrating: boolean;
        status: string;
        progress: number;
        type: string;
    };
    currentRotation?: {
        x: number;
        y: number;
        z: number;
    };
    isPositionCorrect?: boolean;
}

export const FullCalibrationModal: React.FC<FullCalibrationModalProps> = ({
    visible,
    onClose,
    onStartCalibration,
    onConfirmPosition,
    calibrationState,
    currentRotation = { x: 0, y: 0, z: 0 },
    isPositionCorrect = false,
    onAbort
}) => {
    const [isPreview, setIsPreview] = useState(true);
    const [currentPositionIndex, setCurrentPositionIndex] = useState(0);

    // Reset state when modal is opened/closed
    useEffect(() => {
        if (visible) {
            setIsPreview(true);
            setCurrentPositionIndex(0);
        }
    }, [visible]);

    // Update position index based on calibration state
    useEffect(() => {
        if (calibrationState.isCalibrating) {
            // Map calibration status to position index
            // This assumes the calibration states are sequential from POSITION_Z_UP to POSITION_X_DOWN
            const statusNum = parseInt(calibrationState.status);
            if (statusNum >= 4 && statusNum <= 9) { // Position states are 4-9
                setCurrentPositionIndex(statusNum - 4);
            }
        }
    }, [calibrationState.status]);

    const handleStartCalibration = async () => {
        if (!isPositionCorrect) {
            // Show error message if position is wrong
            Alert.alert(
                "Incorrect Position",
                "Please place the device as shown in the diagram before starting calibration.",
                [{ text: "OK" }]
            );
            return;
        }

        setIsPreview(false);
        await onStartCalibration();
    };

    const handleClose = () => {
        setIsPreview(true);
        setCurrentPositionIndex(0);
        onClose();
    };

    const currentPosition = POSITIONS[currentPositionIndex];

    const renderPositionFeedback = () => {
        if (!isPositionCorrect) {
            return (
                <View style={styles.feedbackContainer}>
                    <MaterialCommunityIcons
                        name="alert"
                        size={24}
                        color="#EF4444"
                    />
                    <Text style={styles.feedbackText}>
                        Move device to match the shown position
                    </Text>
                </View>
            );
        }

        if (calibrationState.progress === 0) {
            return (
                <View style={styles.feedbackContainer}>
                    <MaterialCommunityIcons
                        name="check-circle"
                        size={24}
                        color="#22C55E"
                    />
                    <Text style={styles.feedbackText}>
                        Position correct - hold still
                    </Text>
                </View>
            );
        }

        return (
            <View style={styles.feedbackContainer}>
                <MaterialCommunityIcons
                    name="progress-check"
                    size={24}
                    color="#22C55E"
                />
                <Text style={styles.feedbackText}>
                    Keep device stable - Measuring...
                </Text>
            </View>
        );
    };

    const renderContent = () => {
        if (isPreview) {
            return (
                <View style={styles.contentContainer}>
                    <DeviceOrientation
                        position={currentPosition.rotationState}
                        currentRotation={currentRotation}
                        isCorrectPosition={isPositionCorrect}
                    />
                    <Text style={styles.instructionText}>
                        {currentPosition.instruction}
                    </Text>

                    {/* Add position status indicator */}
                    <View style={[
                        styles.positionStatus,
                        isPositionCorrect ? styles.positionCorrect : styles.positionIncorrect
                    ]}>
                        <MaterialCommunityIcons
                            name={isPositionCorrect ? "check-circle" : "alert"}
                            size={24}
                            color={isPositionCorrect ? "#22C55E" : "#EF4444"}
                        />
                        <Text style={styles.positionStatusText}>
                            {isPositionCorrect
                                ? "Position correct - Ready to start"
                                : "Adjust device position to match diagram"}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.startButton,
                            !isPositionCorrect && styles.startButtonDisabled
                        ]}
                        onPress={handleStartCalibration}
                    >
                        <Text style={styles.buttonText}>Start Calibration</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.contentContainer}>
                <DeviceOrientation
                    position={currentPosition.rotationState}
                    currentRotation={currentRotation}
                    isCorrectPosition={isPositionCorrect}
                />
                <Text style={[
                    styles.instructionText,
                    isPositionCorrect && styles.correctPositionText
                ]}>
                    {currentPosition.instruction}
                </Text>

                {/* Position progress indicator */}
                <Text style={styles.positionProgress}>
                    Position {currentPositionIndex + 1} of 6
                </Text>

                {renderPositionFeedback()}

                <View style={styles.controlsContainer}>
                    {/* Show progress bar when measuring */}
                    {calibrationState.progress > 0 && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        { width: `${calibrationState.progress}%` }
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>
                                {calibrationState.progress}%
                            </Text>
                        </View>
                    )}

                    {/* Always show abort button */}
                    <TouchableOpacity
                        style={styles.abortButton}
                        onPress={onAbort}
                    >
                        <Text style={styles.buttonText}>Abort Calibration</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={calibrationState.isCalibrating ? undefined : handleClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.bottomSheetContainer}>
                    <View style={styles.bottomSheetHandle} />
                    <View style={styles.headerContainer}>
                        <Text style={styles.bottomSheetTitle}>
                            Full Calibration
                        </Text>
                        {!isPreview && (
                            <Text style={styles.positionCounter}>
                                Position {currentPositionIndex + 1}/6
                            </Text>
                        )}
                    </View>
                    {renderContent()}
                </View>
            </View>
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
        minHeight: 500,
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
    headerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    bottomSheetTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    positionCounter: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    contentContainer: {
        alignItems: 'center',
        gap: 24,
    },
    instructionText: {
        fontSize: 18,
        color: '#E5E7EB',
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: '90%',
    },
    subInstructionText: {
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        maxWidth: '90%',
    },
    correctPositionText: {
        color: '#22C55E',
    },
    startButton: {
        backgroundColor: '#6544C0',
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButton: {
        backgroundColor: '#22C55E',
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    progressContainer: {
        width: '100%',
        alignItems: 'center',
        gap: 8,
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#374151',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#6544C0',
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    abortButton: {
        backgroundColor: '#EF4444',
        width: '100%',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedbackContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#374151',
        padding: 12,
        borderRadius: 8,
        marginVertical: 12,
        gap: 8,
    },
    feedbackText: {
        color: '#FFFFFF',
        fontSize: 14,
        flex: 1,
    },
    controlsContainer: {
        width: '100%',
        gap: 12,
        marginTop: 16,
    },
    confirmButtonDisabled: {
        opacity: 0.5,
        backgroundColor: '#4B5563',
    },
    positionProgress: {
        color: '#9CA3AF',
        fontSize: 14,
        marginTop: 8,
    },
    positionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
        gap: 8,
    },
    positionCorrect: {
        backgroundColor: '#22C55E20',
    },
    positionIncorrect: {
        backgroundColor: '#EF444420',
    },
    positionStatusText: {
        color: '#FFFFFF',
        fontSize: 14,
        flex: 1,
    },
    startButtonDisabled: {
        opacity: 0.5,
        backgroundColor: '#4B5563',
    },
}); 