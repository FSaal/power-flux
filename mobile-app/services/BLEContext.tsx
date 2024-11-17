/**
 * BLEContext.tsx
 * 
 * This module provides a React Context for managing Bluetooth Low Energy (BLE) connections
 * and data handling for the PowerFlux application. It manages the connection to the M5Stack
 * device and processes IMU (accelerometer and gyroscope) data.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

// Configuration constants
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_ACC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CHAR_GYR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const CHAR_CALIB_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
const DEVICE_NAME = 'PowerFlux';
const SCAN_TIMEOUT = 10000; // 10 seconds

/**
 * Represents a complete set of sensor data from both accelerometer and gyroscope
 */
export interface SensorData {
    accX: number;
    accY: number;
    accZ: number;
    gyrX: number;
    gyrY: number;
    gyrZ: number;
    timestamp: number;
}

export interface CalibrationState {
    isCalibrating: boolean;
    status: 'idle' | 'in_progress' | 'completed' | 'failed';
}


interface BLEContextType {
    bleManager: BleManager;
    isConnected: boolean;
    isScanning: boolean;
    startScan: () => Promise<void>;
    disconnect: () => Promise<void>;
    calibrationState: CalibrationState;
    startCalibration: () => Promise<void>;
    abortCalibration: () => Promise<void>;
    sensorData: SensorData | null;
    setOnDataReceived: (callback: ((data: SensorData) => void) | undefined) => void;
}

// Create Context with undefined initial value
const BLEContext = createContext<BLEContextType | undefined>(undefined);

// Create static instances
const bleManager = new BleManager();
const dataCallbackRef = { current: undefined as ((data: SensorData) => void) | undefined };
const latestData = { current: {} as Partial<SensorData> };

/**
 * Logging utility for consistent log formatting
 */
const Logger = {
    error: (message: string, ...args: any[]) => {
        console.error(`[BLE] ERROR: ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.warn(`[BLE] WARN: ${message}`, ...args);
    },
    info: (message: string, ...args: any[]) => {
        if (__DEV__) {
            console.info(`[BLE] INFO: ${message}`, ...args);
        }
    },
    debug: (message: string, ...args: any[]) => {
        if (__DEV__) {
            console.debug(`[BLE] DEBUG: ${message}`, ...args);
        }
    }
};

/**
 * BLE Provider Component
 * Manages BLE connection and data processing for the application
 */
export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [sensorData, setSensorData] = useState<SensorData | null>(null);
    const [calibrationState, setCalibrationState] = useState<CalibrationState>({
        isCalibrating: false,
        status: 'idle'
    });

    /**
     * Sets callback for handling received sensor data
     */
    const setOnDataReceived = useCallback((callback: ((data: SensorData) => void) | undefined) => {
        Logger.debug(`Setting data callback: ${callback ? 'Provided' : 'Undefined'}`);
        dataCallbackRef.current = callback;
    }, []);

    /**
     * Updates sensor data state and triggers callbacks when complete data set is available
     */
    const updateSensorData = useCallback((newData: Partial<SensorData>) => {
        latestData.current = { ...latestData.current, ...newData };
        const { accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp } = latestData.current;

        // Check if we have a complete data set
        if (accX !== undefined && accY !== undefined && accZ !== undefined &&
            gyrX !== undefined && gyrY !== undefined && gyrZ !== undefined &&
            timestamp !== undefined) {

            const completeData: SensorData = {
                accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp
            };

            setSensorData(completeData);

            if (dataCallbackRef.current) {
                // Logger.debug('Processing complete data set', { timestamp });
                dataCallbackRef.current(completeData);
                latestData.current = {}; // Clear latest data after processing
            }
        }
    }, []);

    /**
     * Initiates BLE device scanning
     */
    const startScan = useCallback(async () => {
        if (isScanning) {
            Logger.warn('Scan already in progress');
            return;
        }

        try {
            setIsScanning(true);
            Logger.info('Starting device scan');

            bleManager.startDeviceScan(
                null,
                { allowDuplicates: false },
                async (error, device) => {
                    if (error) {
                        Logger.error('Scan error:', error);
                        setIsScanning(false);
                        Alert.alert('Scan Error', error.message);
                        return;
                    }

                    if (device?.name === DEVICE_NAME) {
                        Logger.info('PowerFlux device found:', device.id);
                        bleManager.stopDeviceScan();

                        try {
                            const connectedDevice = await device.connect();
                            await connectedDevice.discoverAllServicesAndCharacteristics();
                            Logger.info('Device connected and services discovered');

                            // Monitor accelerometer data
                            connectedDevice.monitorCharacteristicForService(
                                SERVICE_UUID,
                                CHAR_ACC_UUID,
                                (error, characteristic) => {
                                    if (error) {
                                        Logger.error('Accelerometer monitoring error:', error);
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
                                        updateSensorData({
                                            accX: dataView.getFloat32(0, true),
                                            accY: dataView.getFloat32(4, true),
                                            accZ: dataView.getFloat32(8, true),
                                            timestamp: dataView.getUint32(12, true)
                                        });
                                    }
                                }
                            );

                            // Monitor gyroscope data
                            connectedDevice.monitorCharacteristicForService(
                                SERVICE_UUID,
                                CHAR_GYR_UUID,
                                (error, characteristic) => {
                                    if (error) {
                                        Logger.error('Gyroscope monitoring error:', error);
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
                                        updateSensorData({
                                            gyrX: dataView.getFloat32(0, true),
                                            gyrY: dataView.getFloat32(4, true),
                                            gyrZ: dataView.getFloat32(8, true),
                                            timestamp: dataView.getUint32(12, true)
                                        });
                                    }
                                }
                            );

                            setIsConnected(true);
                            setIsScanning(false);
                            Logger.info('Device setup complete');

                        } catch (error) {
                            Logger.error('Connection error:', error);
                            Alert.alert('Connection Error', 'Failed to connect to device');
                            setIsConnected(false);
                            setIsScanning(false);
                        }
                    }
                }
            );

            // Stop scan after timeout
            setTimeout(() => {
                if (isScanning) {
                    Logger.warn('Scan timeout - stopping scan');
                    bleManager.stopDeviceScan();
                    setIsScanning(false);
                }
            }, SCAN_TIMEOUT);

        } catch (error) {
            Logger.error('Scan startup error:', error);
            setIsScanning(false);
            Alert.alert('Scan Error', 'Failed to start scanning');
        }
    }, [isScanning, updateSensorData]);

    /**
     * Disconnects from currently connected BLE device
     */
    const disconnect = useCallback(async () => {
        try {
            Logger.info('Initiating disconnect');
            const connectedDevices = await bleManager.connectedDevices([]);
            await Promise.all(connectedDevices.map(device => device.connect()));
            setIsConnected(false);
            Logger.info('Disconnect complete');
        } catch (error) {
            Logger.error('Disconnect error:', error);
            Alert.alert('Disconnect Error', 'Failed to disconnect from device');
        }
    }, []);

    const startCalibration = useCallback(async () => {
        try {
            Logger.info('Starting calibration');
            const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);
            const device = connectedDevices[0];

            if (!device) {
                setIsConnected(false);
                throw new Error('No device connected - Please reconnect');
            }

            const services = await device.services();
            const service = services.find(s => s.uuid === SERVICE_UUID);

            if (!service) {
                throw new Error('Service not found - Please reconnect');
            }

            const characteristics = await service.characteristics();
            const characteristic = characteristics.find(c => c.uuid === CHAR_CALIB_UUID);

            if (!characteristic) {
                throw new Error('Calibration characteristic not found');
            }

            // Start monitoring calibration status before sending command
            await characteristic.monitor((error, char) => {
                if (error) {
                    Logger.error('Calibration monitoring error:', error);
                    return;
                }

                if (char?.value) {
                    // Convert base64 to number directly without using Buffer
                    const status = Number(atob(char.value).charCodeAt(0));
                    Logger.info('Received calibration status:', status);
                    switch (status) {
                        case 1:
                            setCalibrationState({ isCalibrating: true, status: 'in_progress' });
                            break;
                        case 2:
                            setCalibrationState({ isCalibrating: false, status: 'completed' });
                            break;
                        case 3:
                            setCalibrationState({ isCalibrating: false, status: 'failed' });
                            break;
                        default:
                            setCalibrationState({ isCalibrating: false, status: 'idle' });
                    }
                }
            });

            // Create command byte array and convert to base64
            const commandByte = new Uint8Array([1]); // Start calibration command
            const base64Command = btoa(String.fromCharCode(...commandByte));
            await characteristic.writeWithResponse(base64Command);

            setCalibrationState({ isCalibrating: true, status: 'in_progress' });

        } catch (error) {
            Logger.error('Start calibration error:', error);
            setIsConnected(false);
            throw error;
        }
    }, [bleManager]);

    const abortCalibration = useCallback(async () => {
        try {
            Logger.info('Aborting calibration');
            const connectedDevices = await bleManager.connectedDevices([]);
            const device = connectedDevices[0];

            if (!device) {
                throw new Error('No device connected');
            }

            const service = await device.services().then(services =>
                services.find(s => s.uuid === SERVICE_UUID)
            );

            if (!service) {
                throw new Error('Service not found');
            }

            const characteristic = await service.characteristics().then(chars =>
                chars.find(c => c.uuid === CHAR_CALIB_UUID)
            );

            if (!characteristic) {
                throw new Error('Calibration characteristic not found');
            }

            // Send abort command (2)
            await characteristic.writeWithResponse(Buffer.from([2]).toString('base64'));
            setCalibrationState({ isCalibrating: false, status: 'idle' });

        } catch (error) {
            Logger.error('Abort calibration error:', error);
            Alert.alert('Calibration Error', 'Failed to abort calibration');
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
            calibrationState,
            startCalibration,
            abortCalibration,
            setOnDataReceived
        }}>
            {children}
        </BLEContext.Provider>
    );
};

/**
 * Custom hook to use BLE context
 * @throws Error if used outside of BLEProvider
 */
export const useBLE = () => {
    const context = useContext(BLEContext);
    if (context === undefined) {
        throw new Error('useBLE must be used within a BLEProvider');
    }
    return context;
};