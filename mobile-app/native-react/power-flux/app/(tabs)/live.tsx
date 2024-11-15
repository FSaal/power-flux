import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useBLE } from '../../services/BLEContext';
import { dbService } from '../../services/database';


interface RecordingRef {
    isRecording: boolean;
    sessionId: string | null;
}

interface SensorData {
    magnitude: number;
    timestamp: number;
}

const LiveScreen = () => {
    const { isConnected, sensorData, setOnDataReceived } = useBLE();
    const [isRecording, setIsRecording] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [measurementCount, setMeasurementCount] = useState(0);
    const recordingRef = useRef<RecordingRef>({
        isRecording: false,
        sessionId: null,
    });

    const handleSensorData = useCallback(async (data: SensorData) => {
        const { isRecording, sessionId } = recordingRef.current;

        if (isRecording && sessionId) {
            try {
                await dbService.storeMeasurement({
                    magnitude: data.magnitude,
                    timestamp: data.timestamp,
                    sessionId: sessionId
                });
                setMeasurementCount(prev => prev + 1);
            } catch (error) {
                console.error('Storage error:', error);
                Alert.alert('Storage Error', 'Failed to store measurement');
            }
        }
    }, []);

    // Set up data handler
    useEffect(() => {
        setOnDataReceived(handleSensorData);

        return () => {
            setOnDataReceived(undefined);
        };
    }, [handleSensorData, setOnDataReceived]);

    const toggleRecording = useCallback(async () => {
        try {
            if (!recordingRef.current.isRecording) {
                setMeasurementCount(0);
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
                    <View style={styles.recordingIndicator}>
                        <MaterialCommunityIcons
                            name="record-circle"
                            size={20}
                            color="#EF4444"
                        />
                        <Text style={styles.measurementCount}>
                            {measurementCount} samples
                        </Text>
                    </View>
                )}
            </View>

            {/* Main Data Display */}
            <View style={styles.mainDisplay}>
                <Text style={styles.dataLabel}>Acceleration</Text>
                <Text style={styles.dataValue}>
                    {(sensorData?.magnitude ?? 0).toFixed(2)}
                    <Text style={styles.dataUnit}> m/s²</Text>
                </Text>
            </View>

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