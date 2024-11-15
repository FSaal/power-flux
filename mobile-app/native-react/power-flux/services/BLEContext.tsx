import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
export interface SensorData {
    accX: number;
    accY: number;
    accZ: number;
    gyrX: number;
    gyrY: number;
    gyrZ: number;
    timestamp: number;
}
interface BLEContextType {
    bleManager: BleManager;
    isConnected: boolean;
    isScanning: boolean;
    startScan: () => Promise<void>;
    disconnect: () => Promise<void>;
    sensorData: SensorData | null;
    onDataReceived?: (data: SensorData) => void;
    setOnDataReceived: (callback: ((data: SensorData) => void) | undefined) => void;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_ACC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CHAR_GYR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [bleManager] = useState(() => new BleManager());
    const [isConnected, setIsConnected] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [sensorData, setSensorData] = useState<SensorData | null>(null);
    const [onDataReceived, setOnDataReceived] = useState<((data: SensorData) => void) | undefined>(undefined);
    const [accData, setAccData] = useState({ accX: 0, accY: 0, accZ: 0, timestamp: 0 });
    const [gyrData, setGyrData] = useState({ gyrX: 0, gyrY: 0, gyrZ: 0, timestamp: 0 });

    const startScan = useCallback(async () => {
        if (isScanning) return;

        try {
            setIsScanning(true);
            bleManager.startDeviceScan(
                null,
                { allowDuplicates: false },
                async (error, device) => {
                    if (error) {
                        setIsScanning(false);
                        Alert.alert('Scan Error', error.message);
                        return;
                    }

                    if (device?.name === 'PowerFlux') {
                        bleManager.stopDeviceScan();
                        try {
                            const connectedDevice = await device.connect();
                            await connectedDevice.discoverAllServicesAndCharacteristics();

                            // Subscribe to accelerometer notifications
                            connectedDevice.monitorCharacteristicForService(
                                '4fafc201-1fb5-459e-8fcc-c5c9c331914b',  // SERVICE_UUID
                                'beb5483e-36e1-4688-b7f5-ea07361b26a8',  // CHAR_ACC_UUID
                                (error, characteristic) => {
                                    if (error) {
                                        console.error('Acc monitoring error:', error);
                                        return;
                                    }

                                    if (characteristic?.value) {
                                        const base64 = characteristic.value;
                                        const binaryString = atob(base64);
                                        const bytes = new Uint8Array(binaryString.length);

                                        for (let i = 0; i < binaryString.length; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                        }

                                        const dataView = new DataView(bytes.buffer);
                                        const accX = dataView.getFloat32(0, true);
                                        const accY = dataView.getFloat32(4, true);
                                        const accZ = dataView.getFloat32(8, true);
                                        const timestamp = dataView.getUint32(12, true);

                                        setAccData({ accX, accY, accZ, timestamp });
                                        setSensorData(prev => ({
                                            ...prev,  // Keep existing gyroscope data
                                            accX,
                                            accY,
                                            accZ,
                                            gyrX: prev?.gyrX || 0,
                                            gyrY: prev?.gyrY || 0,
                                            gyrZ: prev?.gyrZ || 0,
                                            timestamp: Math.max(prev?.timestamp || 0, timestamp)
                                        }));
                                    }
                                }
                            );

                            // Subscribe to gyroscope notifications
                            connectedDevice.monitorCharacteristicForService(
                                '4fafc201-1fb5-459e-8fcc-c5c9c331914b',  // SERVICE_UUID
                                'beb5483e-36e1-4688-b7f5-ea07361b26a9',  // CHAR_GYR_UUID
                                (error, characteristic) => {
                                    if (error) {
                                        console.error('Gyr monitoring error:', error);
                                        return;
                                    }

                                    if (characteristic?.value) {
                                        const base64 = characteristic.value;
                                        const binaryString = atob(base64);
                                        const bytes = new Uint8Array(binaryString.length);

                                        for (let i = 0; i < binaryString.length; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                        }

                                        const dataView = new DataView(bytes.buffer);
                                        const gyrX = dataView.getFloat32(0, true);
                                        const gyrY = dataView.getFloat32(4, true);
                                        const gyrZ = dataView.getFloat32(8, true);
                                        const timestamp = dataView.getUint32(12, true);

                                        setGyrData({ gyrX, gyrY, gyrZ, timestamp });
                                        setSensorData(prev => ({
                                            accX: prev?.accX || 0,
                                            accY: prev?.accY || 0,
                                            accZ: prev?.accZ || 0,
                                            gyrX,
                                            gyrY,
                                            gyrZ,
                                            timestamp: Math.max(prev?.timestamp || 0, timestamp)
                                        }));
                                    }
                                }
                            );

                            setIsConnected(true);
                            setIsScanning(false);
                        } catch (error) {
                            Alert.alert('Connection Error', 'Failed to connect to device');
                            setIsConnected(false);
                            setIsScanning(false);
                        }
                    }
                }
            );

            // Stop scan after 10 seconds
            setTimeout(() => {
                if (isScanning) {
                    bleManager.stopDeviceScan();
                    setIsScanning(false);
                }
            }, 10000);

        } catch (error) {
            setIsScanning(false);
            Alert.alert('Scan Error', 'Failed to start scanning');
        }
    }, [bleManager, isScanning]);

    const disconnect = useCallback(async () => {
        try {
            // Disconnect from all devices
            const connectedDevices = await bleManager.connectedDevices([]);
            await Promise.all(connectedDevices.map(device => device.connect()));
            setIsConnected(false);
        } catch (error) {
            Alert.alert('Disconnect Error', 'Failed to disconnect from device');
        }
    }, [bleManager]);

    return (
        <BLEContext.Provider value={{
            bleManager,
            isConnected,
            isScanning,
            startScan,
            disconnect,
            sensorData,
            onDataReceived,
            setOnDataReceived
        }}>
            {children}
        </BLEContext.Provider>
    );
};

export const useBLE = () => {
    const context = useContext(BLEContext);
    if (context === undefined) {
        throw new Error('useBLE must be used within a BLEProvider');
    }
    return context;
};

