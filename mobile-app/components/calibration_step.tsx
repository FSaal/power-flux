import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Using string literals for state names to match the BLE context
type CalibrationStateType =
    | 'IDLE'
    | 'WARMUP'
    | 'TEMP_CHECK'
    | 'BIAS_ESTIMATION'
    | 'POSITION_Z_UP'
    | 'POSITION_Z_DOWN'
    | 'POSITION_Y_UP'
    | 'POSITION_Y_DOWN'
    | 'POSITION_X_UP'
    | 'POSITION_X_DOWN'
    | 'MOVEMENT_CHECK'
    | 'COMPLETED'
    | 'FAILED'
    | 'QUICK_STATIC'
    | 'QUICK_VALIDATION'
    | 'QUICK_COMPLETE';

const CALIBRATION_STEPS: Record<CalibrationStateType, {
    title: string;
    description: string;
    instruction?: string;
    primaryColor: string;
}> = {
    IDLE: {
        title: 'Ready to Start',
        description: 'Place device on a flat surface to begin',
        primaryColor: '#6544C0'
    },
    WARMUP: {
        title: 'Preparing Device',
        description: 'Please wait while the sensor warms up...',
        primaryColor: '#6544C0'
    },
    TEMP_CHECK: {
        title: 'Temperature Check',
        description: 'Checking sensor temperature stability...',
        primaryColor: '#6544C0'
    },
    BIAS_ESTIMATION: {
        title: 'Initial Calibration',
        description: 'Keep device still on a flat surface...',
        primaryColor: '#6544C0'
    },
    POSITION_Z_UP: {
        title: 'Position 1 of 6',
        description: 'Place device flat on table with screen facing up',
        instruction: 'Ensure device is on a stable, level surface',
        primaryColor: '#22C55E'
    },
    POSITION_Z_DOWN: {
        title: 'Position 2 of 6',
        description: 'Turn device upside down',
        instruction: 'Flip the device 180° so screen faces down',
        primaryColor: '#22C55E'
    },
    POSITION_Y_UP: {
        title: 'Position 3 of 6',
        description: 'Stand device on long edge with buttons up',
        instruction: 'Place on its side with buttons facing the ceiling',
        primaryColor: '#22C55E'
    },
    POSITION_Y_DOWN: {
        title: 'Position 4 of 6',
        description: 'Stand device on long edge with buttons down',
        instruction: 'Rotate 180° so buttons face the table',
        primaryColor: '#22C55E'
    },
    POSITION_X_UP: {
        title: 'Position 5 of 6',
        description: 'Stand device on short edge with USB up',
        instruction: 'Stand vertically with USB port at top',
        primaryColor: '#22C55E'
    },
    POSITION_X_DOWN: {
        title: 'Position 6 of 6',
        description: 'Stand device on short edge with USB down',
        instruction: 'Rotate 180° so USB port faces down',
        primaryColor: '#22C55E'
    },
    MOVEMENT_CHECK: {
        title: 'Movement Validation',
        description: 'Rotate device around each axis when prompted',
        instruction: 'Follow the on-screen rotation instructions',
        primaryColor: '#6544C0'
    },
    COMPLETED: {
        title: 'Calibration Complete',
        description: 'Device has been successfully calibrated',
        primaryColor: '#22C55E'
    },
    FAILED: {
        title: 'Calibration Failed',
        description: 'Please try again, ensuring device remains stable',
        primaryColor: '#EF4444'
    },
    QUICK_STATIC: {
        title: 'Quick Calibration',
        description: 'Keep device still on a flat surface',
        instruction: 'Ensure the device remains completely stable',
        primaryColor: '#6544C0'
    },
    QUICK_VALIDATION: {
        title: 'Validating',
        description: 'Validating calibration data...',
        primaryColor: '#6544C0'
    },
    QUICK_COMPLETE: {
        title: 'Quick Calibration Complete',
        description: 'Basic calibration has been completed',
        primaryColor: '#22C55E'
    }
};

interface CalibrationStepProps {
    state: CalibrationStateType;
    progress: number;
    isPositionCorrect?: boolean;
}

const CalibrationStep: React.FC<CalibrationStepProps> = ({
    state,
    progress,
    isPositionCorrect
}) => {
    const step = CALIBRATION_STEPS[state];
    if (!step) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>

            {step.instruction && (
                <View style={[
                    styles.instructionBox,
                    { backgroundColor: isPositionCorrect ? '#22C55E20' : '#6544C020' }
                ]}>
                    <Text style={[
                        styles.instruction,
                        { color: isPositionCorrect ? '#22C55E' : '#6544C0' }
                    ]}>
                        {step.instruction}
                    </Text>
                </View>
            )}

            {progress > 0 && (
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress}%` }
                            ]}
                        />
                    </View>
                    <Text style={styles.progressText}>{progress}%</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        alignItems: 'center',
        gap: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#E5E7EB',
        textAlign: 'center',
        lineHeight: 24,
    },
    instructionBox: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        marginTop: 8,
    },
    instruction: {
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
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
        borderRadius: 4,
    },
    progressText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
});

export default CalibrationStep;