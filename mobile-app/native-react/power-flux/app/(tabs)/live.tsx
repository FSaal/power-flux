import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { dbService } from '../../services/database';

const BLE_CONFIG = {
    DEVICE_NAME: 'PowerFlux',
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
};
interface RecordingRef {
    isRecording: boolean;
    sessionId: string | null;
}


interface SensorData {
    magnitude: number;
    timestamp: number;
}

const LiveScreen = () => {
    const [bleManager] = useState(() => new BleManager());
    const [isConnected, setIsConnected] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sensorData, setSensorData] = useState<SensorData>({
        magnitude: 0,
        timestamp: 0,
    });
    const recordingRef = useRef<RecordingRef>({
        isRecording: false,
        sessionId: null,
    });

    useEffect(() => {
        return () => {
            bleManager.destroy();
        };
    }, [bleManager]);

    const requestPermissions = async (): Promise<boolean> => {
        if (Platform.OS === 'android' && Platform.Version >= 23) {
            try {
                const permissions = [
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                ];

                const results = await Promise.all(
                    permissions.map(permission =>
                        PermissionsAndroid.request(permission)
                    )
                );

                return results.every(result => result === 'granted');
            } catch (err) {
                console.warn('Permission request error:', err);
                return false;
            }
        }
        return true;
    };

    const parseSensorData = (base64: string): SensorData => {
        const bytes = new Uint8Array(
            atob(base64)
                .split('')
                .map(c => c.charCodeAt(0))
        );
        const dataView = new DataView(bytes.buffer);

        return {
            magnitude: dataView.getFloat32(0, true),
            timestamp: dataView.getUint32(4, true)
        };
    };

    const handleSensorData = useCallback(async (data: SensorData) => {
        console.log('Received data:', data);
        setSensorData(data);

        // Use ref values instead of state
        const { isRecording, sessionId } = recordingRef.current;
        console.log('Current recording status (ref):', isRecording, 'Session ID:', sessionId);

        if (isRecording && sessionId) {
            console.log('Storing measurement for session:', sessionId);
            try {
                await dbService.storeMeasurement({
                    magnitude: data.magnitude,
                    timestamp: data.timestamp,
                    sessionId: sessionId
                });
                console.log('Measurement stored successfully');
            } catch (error) {
                console.error('Storage error details:', error);
                Alert.alert('Storage Error', 'Failed to store measurement');
            }
        }
    }, []);

    const toggleRecording = useCallback(async () => {
        try {
            if (!recordingRef.current.isRecording) {
                const sessionId = await dbService.startSession();
                // Update ref and state together
                recordingRef.current = { isRecording: true, sessionId };
                setIsRecording(true);
                setCurrentSessionId(sessionId);
                console.log('Starting recording with session:', sessionId);
            } else if (recordingRef.current.sessionId) {
                const currentSession = recordingRef.current.sessionId;
                // End the session first
                await dbService.endSession(currentSession);
                // Update ref and state together
                recordingRef.current = { isRecording: false, sessionId: null };
                setIsRecording(false);
                setCurrentSessionId(null);
                console.log('Ended recording session:', currentSession);
            }
        } catch (error) {
            console.error('Recording toggle error:', error);
            // Reset both ref and state on error
            recordingRef.current = { isRecording: false, sessionId: null };
            setIsRecording(false);
            setCurrentSessionId(null);
            Alert.alert('Recording Error', 'Failed to toggle recording');
        }
    }, []);

    useEffect(() => {
        console.log('Recording state changed:', isRecording, 'Session:', currentSessionId);
    }, [isRecording, currentSessionId]);

    const connectToDevice = async (device: Device) => {
        try {
            const connectedDevice = await device.connect();
            const deviceWithServices = await connectedDevice.discoverAllServicesAndCharacteristics();
            setIsConnected(true);

            deviceWithServices.monitorCharacteristicForService(
                BLE_CONFIG.SERVICE_UUID,
                BLE_CONFIG.CHARACTERISTIC_UUID,
                (error, characteristic) => {
                    if (error) {
                        console.error('Monitoring error:', error);
                        return;
                    }

                    if (characteristic?.value) {
                        try {
                            const newData = parseSensorData(characteristic.value);
                            handleSensorData(newData);
                        } catch (parseError) {
                            console.error('Error parsing data:', parseError);
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Connection error:', error);
            setIsConnected(false);
            Alert.alert('Connection Error', 'Failed to connect to device');
        }
    };

    const startScan = useCallback(async () => {
        if (isScanning) return;

        try {
            const permissionsGranted = await requestPermissions();
            if (!permissionsGranted) {
                Alert.alert('Permission Error', 'Required permissions not granted');
                return;
            }

            const state = await bleManager.state();
            if (state !== 'PoweredOn') {
                Alert.alert('Bluetooth Error', 'Please enable Bluetooth');
                return;
            }

            setIsScanning(true);

            bleManager.startDeviceScan(
                null,
                { allowDuplicates: false },
                async (error, device) => {
                    if (error) {
                        console.error('Scan error:', error);
                        setIsScanning(false);
                        return;
                    }

                    if (device?.name === BLE_CONFIG.DEVICE_NAME) {
                        bleManager.stopDeviceScan();
                        setIsScanning(false);
                        await connectToDevice(device);
                    }
                }
            );

            setTimeout(() => {
                if (isScanning) {
                    bleManager.stopDeviceScan();
                    setIsScanning(false);
                }
            }, 10000);

        } catch (error) {
            console.error('Scan error:', error);
            setIsScanning(false);
            Alert.alert('Scan Error', 'Failed to start scanning');
        }
    }, [bleManager, isScanning]);

    const exportData = async () => {
        try {
            const sessions = await dbService.getSessions();
            if (sessions.length === 0) {
                Alert.alert('No Data', 'No recorded sessions found');
                return;
            }

            const latestSession = sessions[0];
            const csvContent = await dbService.exportSessionToCSV(latestSession.id);

            const path = `${FileSystem.documentDirectory}powerflux_${latestSession.id}.csv`;
            await FileSystem.writeAsStringAsync(path, csvContent);

            await Sharing.shareAsync(path, {
                mimeType: 'text/csv',
                dialogTitle: 'Export PowerFlux Data'
            });
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Export Error', 'Failed to export data');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.statusContainer}>
                <View style={[
                    styles.statusDot,
                    { backgroundColor: isConnected ? '#22C55E' : '#EF4444' }
                ]} />
                <Text style={styles.statusText}>
                    {isConnected ? 'Connected' : isScanning ? 'Scanning...' : 'Disconnected'}
                </Text>
                {isRecording && (
                    <View style={[styles.recordingDot, styles.pulsingDot]} />
                )}
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.scanButton]}
                    onPress={startScan}
                    disabled={isScanning}
                >
                    <Text style={styles.buttonText}>
                        {isScanning ? 'Scanning...' : isConnected ? 'Reconnect' : 'Scan for Device'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.recordButton,
                        !isConnected && styles.buttonDisabled,
                        isRecording && styles.stopButton,
                    ]}
                    onPress={toggleRecording}
                    disabled={!isConnected}
                >
                    <Text style={styles.buttonText}>
                        {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.dataContainer}>
                <Text style={styles.dataText}>
                    Magnitude: {sensorData.magnitude.toFixed(2)} m/s²
                </Text>
                <Text style={styles.dataText}>
                    Time: {sensorData.timestamp} ms
                </Text>
            </View>
            <TouchableOpacity
                style={[styles.button, styles.exportButton]}
                onPress={exportData}
            >
                <Text style={styles.buttonText}>Export Latest Session</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 16,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: 8,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
        marginLeft: 8,
    },
    pulsingDot: {
        opacity: 0.8,
    },
    statusText: {
        fontSize: 16,
        color: '#ffffff',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    button: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 4,
    },
    scanButton: {
        backgroundColor: '#6544C0',
    },
    recordButton: {
        backgroundColor: '#22C55E',
    },
    stopButton: {
        backgroundColor: '#EF4444',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dataContainer: {
        backgroundColor: '#1F2937',
        padding: 16,
        borderRadius: 8,
    },
    dataText: {
        color: '#ffffff',
        fontSize: 18,
        marginBottom: 8,
    },
    exportButton: {
        backgroundColor: '#3B82F6',
        marginTop: 16,
    },
});

export default LiveScreen;