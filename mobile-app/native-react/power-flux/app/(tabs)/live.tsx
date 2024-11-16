import { useBLE } from '@/services/BLEContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SensorData } from '../../services/BLEContext';
import { dbService } from '../../services/database';

interface RecordingRef {
    isRecording: boolean;
    sessionId: string | null;
}
interface BlinkingRecordIndicatorProps {
    startTime: number;
}

interface BlinkingRecordIndicatorProps {
    startTime: number;
}

const BlinkingRecordIndicator: React.FC<BlinkingRecordIndicatorProps> = ({ startTime }) => {
    const [visible, setVisible] = useState(true);
    const [elapsedTime, setElapsedTime] = useState('0:00');

    useEffect(() => {
        // Blink effect
        const blinkInterval = setInterval(() => {
            setVisible(prev => !prev);
        }, 500);

        // Time update effect
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
            {visible && (
                <MaterialCommunityIcons
                    name="record-circle"
                    size={20}
                    color="#EF4444"
                />
            )}
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                {elapsedTime}
            </Text>
        </View>
    );
};

const LiveScreen = () => {
    const { isConnected, sensorData, setOnDataReceived } = useBLE();
    const [isRecording, setIsRecording] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [measurementCount, setMeasurementCount] = useState(0);
    const [showDetails, setShowDetails] = useState(false);
    const recordingRef = useRef<RecordingRef>({
        isRecording: false,
        sessionId: null,
    });
    const [recordingStartTime, setRecordingStartTime] = useState<number>(0);

    // Calculate magnitude from acceleration components
    const calculateMagnitude = (x: number, y: number, z: number): number => {
        return Math.sqrt(x * x + y * y + z * z);
    };

    const handleSensorData = useCallback(async (data: SensorData) => {
        const { isRecording, sessionId } = recordingRef.current;

        if (isRecording && sessionId) {
            try {
                await dbService.storeMeasurement({
                    accX: data.accX,
                    accY: data.accY,
                    accZ: data.accZ,
                    gyrX: data.gyrX,
                    gyrY: data.gyrY,
                    gyrZ: data.gyrZ,
                    timestamp: data.timestamp,
                    sessionId: sessionId
                });
                setMeasurementCount(prevCount => prevCount + 1);
            } catch (error) {
                console.error('Storage error:', error);
                Alert.alert('Storage Error', 'Failed to store measurement');
            }
        }
    }, []);

    // Set up data handler
    useEffect(() => {
        setOnDataReceived(handleSensorData);
        return () => setOnDataReceived(undefined);
    }, [handleSensorData, setOnDataReceived]);

    const toggleRecording = useCallback(async () => {
        try {
            if (!recordingRef.current.isRecording) {
                setRecordingStartTime(Date.now());
                const sessionId = await dbService.startSession();
                recordingRef.current = { isRecording: true, sessionId };
                setIsRecording(true);
                setCurrentSessionId(sessionId);
            } else if (recordingRef.current.sessionId) {
                await dbService.endSession(recordingRef.current.sessionId);
                recordingRef.current = { isRecording: false, sessionId: null };
                setIsRecording(false);
                setCurrentSessionId(null);
            }
        } catch (error) {
            console.error('Recording error:', error);
            Alert.alert('Recording Error', 'Failed to toggle recording');
        }
    }, []);

    // Calculate current magnitude
    const magnitude = sensorData
        ? calculateMagnitude(sensorData.accX, sensorData.accY, sensorData.accZ)
        : 0;

    return (
        <View style={styles.container}>
            {/* Status Indicator */}
            <View style={styles.statusIndicator}>
                <MaterialCommunityIcons
                    name={isConnected ? "bluetooth-connect" : "bluetooth-off"}
                    size={20}
                    color={isConnected ? "#22C55E" : "#EF4444"}
                />
                {isRecording && (
                    <BlinkingRecordIndicator startTime={recordingStartTime} />
                )}
            </View>

            {/* Main Data Display */}
            <Pressable
                style={styles.mainDisplay}
                onPress={() => setShowDetails(!showDetails)}
            >
                <Text style={styles.dataLabel}>Acceleration Magnitude</Text>
                <Text style={styles.dataValue}>
                    {magnitude.toFixed(2)}
                    <Text style={styles.dataUnit}> m/s²</Text>
                </Text>

                {showDetails && sensorData && (
                    <View style={styles.detailsContainer}>
                        <View style={styles.detailsSection}>
                            <Text style={styles.detailsHeader}>Accelerometer (m/s²)</Text>
                            <Text style={styles.detailsText}>X: {sensorData.accX.toFixed(2)}</Text>
                            <Text style={styles.detailsText}>Y: {sensorData.accY.toFixed(2)}</Text>
                            <Text style={styles.detailsText}>Z: {sensorData.accZ.toFixed(2)}</Text>
                        </View>

                        <View style={styles.detailsSection}>
                            <Text style={styles.detailsHeader}>Gyroscope (rad/s)</Text>
                            <Text style={styles.detailsText}>X: {sensorData.gyrX.toFixed(2)}</Text>
                            <Text style={styles.detailsText}>Y: {sensorData.gyrY.toFixed(2)}</Text>
                            <Text style={styles.detailsText}>Z: {sensorData.gyrZ.toFixed(2)}</Text>
                        </View>
                    </View>
                )}
            </Pressable>

            {/* Recording Control */}
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
                        name={isRecording ? "stop-circle" : "record-circle"}
                        size={32}
                        color="white"
                    />
                    <Text style={styles.buttonText}>
                        {isRecording ? "Stop" : "Record"}
                    </Text>
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
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    measurementCount: {
        color: '#FFFFFF',
        fontSize: 14,
    },
    mainDisplay: {
        flex: 1,
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
});

export default LiveScreen;