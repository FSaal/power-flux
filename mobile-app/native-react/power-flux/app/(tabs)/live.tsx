import React, { useCallback, useEffect, useState } from 'react';
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

// BLE Configuration
const BLE_CONFIG = {
    DEVICE_NAME: 'PowerFlux',
    SERVICE_UUID: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CHARACTERISTIC_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
} as const;

interface SensorData {
    magnitude: number;
    timestamp: number;
}

const MinimalLiveScreen: React.FC = () => {
    // Create BLE manager as a ref to persist between renders
    const [bleManager] = useState(() => new BleManager());
    const [isConnected, setIsConnected] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [sensorData, setSensorData] = useState<SensorData>({
        magnitude: 0,
        timestamp: 0,
    });

    // Cleanup BLE manager on component unmount
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
                        PermissionsAndroid.request(permission, {
                            title: `${permission.split('.').pop()} Permission`,
                            message: `App needs ${permission.split('.').pop()} permission`,
                            buttonNeutral: "Ask Me Later",
                            buttonNegative: "Cancel",
                            buttonPositive: "OK"
                        })
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

    const connectToDevice = async (device: Device) => {
        try {
            console.log('Connecting to device:', device.name);
            const connectedDevice = await device.connect();
            console.log('Connected, discovering services...');

            const deviceWithServices = await connectedDevice.discoverAllServicesAndCharacteristics();
            console.log('Services discovered');

            setIsConnected(true);

            // Subscribe to notifications
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
                            setSensorData(newData);
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
        if (isScanning) {
            console.log('Already scanning...');
            return;
        }

        try {
            // Check permissions first
            const permissionsGranted = await requestPermissions();
            if (!permissionsGranted) {
                Alert.alert('Permission Error', 'Required permissions not granted');
                return;
            }

            // Check if Bluetooth is powered on
            const state = await bleManager.state();
            console.log('Bluetooth state:', state);

            if (state !== 'PoweredOn') {
                Alert.alert('Bluetooth Error', 'Please enable Bluetooth and try again');
                return;
            }

            setIsScanning(true);
            console.log('Starting scan...');

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
                        console.log('Found device:', device.name);
                        bleManager.stopDeviceScan();
                        setIsScanning(false);
                        await connectToDevice(device);
                    }
                }
            );

            // Stop scan after 10 seconds
            setTimeout(() => {
                if (isScanning) {
                    console.log('Scan timeout, stopping...');
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
            </View>

            <TouchableOpacity
                style={styles.scanButton}
                onPress={startScan}
                disabled={isScanning}
            >
                <Text style={styles.buttonText}>
                    {isScanning ? 'Scanning...' : isConnected ? 'Reconnect' : 'Scan for Device'}
                </Text>
            </TouchableOpacity>

            <View style={styles.dataContainer}>
                <Text style={styles.dataText}>
                    Magnitude: {sensorData.magnitude.toFixed(2)} m/s²
                </Text>
                <Text style={styles.dataText}>
                    Time: {sensorData.timestamp} ms
                </Text>
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
    statusText: {
        fontSize: 16,
        color: '#ffffff',
    },
    scanButton: {
        backgroundColor: '#6544C0',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
        opacity: 1,
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
});

export default MinimalLiveScreen;