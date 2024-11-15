import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
interface SensorData {
    magnitude: number;
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

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [bleManager] = useState(() => new BleManager());
    const [isConnected, setIsConnected] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [sensorData, setSensorData] = useState<SensorData | null>(null);
    const [onDataReceived, setOnDataReceived] = useState<((data: SensorData) => void) | undefined>(undefined);

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

                            // Subscribe to notifications
                            const service = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
                            const characteristic = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

                            connectedDevice.monitorCharacteristicForService(
                                service,
                                characteristic,
                                (error, characteristic) => {
                                    if (error) {
                                        console.error('Monitoring error:', error);
                                        return;
                                    }

                                    if (characteristic?.value) {
                                        // Convert base64 to array buffer
                                        const base64 = characteristic.value;
                                        const binaryString = atob(base64);
                                        const bytes = new Uint8Array(binaryString.length);
                                        for (let i = 0; i < binaryString.length; i++) {
                                            bytes[i] = binaryString.charCodeAt(i);
                                        }

                                        // Use DataView to read the values
                                        const dataView = new DataView(bytes.buffer);
                                        const magnitude = dataView.getFloat32(0, true); // true for little-endian
                                        const timestamp = dataView.getUint32(4, true); // true for little-endian

                                        const data = { magnitude, timestamp };
                                        setSensorData(data);
                                        if (onDataReceived) {
                                            onDataReceived(data);
                                        }
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