/**
 * BLEContext.tsx
 * 
 * This module provides a React Context for managing Bluetooth Low Energy (BLE) connections
 * and data handling for the PowerFlux application. It manages the connection to the M5Stack
 * device and processes IMU (accelerometer and gyroscope) data.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';

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
    temperature?: number;
    timestamp: number;
}

export interface CalibrationState {
    isCalibrating: boolean;
    status: 'idle' | 'in_progress' | 'completed' | 'failed';
    type: 'none' | 'quick' | 'full';
    progress: number;
    error?: string;
}

export interface CalibrationProgress {
    state: number;      // uint8_t
    progress: number;   // uint8_t
    temperature: number;// float
    positionIndex: number; // uint8_t
    reserved: number;   // uint8_t
}

export enum CalibrationCommand {
    START = 1,
    ABORT = 2,
    START_FULL = 3,
    START_QUICK = 4
}


export interface BLEContextType {
    bleManager: BleManager;
    isConnected: boolean;
    isScanning: boolean;
    startScan: () => Promise<void>;
    stopScan: () => void;
    disconnect: () => Promise<void>;
    calibrationState: CalibrationState;
    startQuickCalibration: () => Promise<void>;
    startFullCalibration: () => Promise<void>;
    abortCalibration: () => Promise<void>;
    sensorData: SensorData | null;
    setOnDataReceived: (callback: ((data: SensorData) => void) | undefined) => void;
    onCalibrationProgress: (progress: CalibrationProgress) => void;
    setCalibrationState: React.Dispatch<React.SetStateAction<CalibrationState>>;
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

const getConnectedDevice = async (): Promise<Device | null> => {
    try {
        const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);
        if (connectedDevices.length === 0) {
            return null;
        }
        return connectedDevices[0];
    } catch (error) {
        Logger.error('Error getting connected device:', error);
        return null;
    }
};

const findCalibrationCharacteristic = async (device: Device): Promise<Characteristic | null> => {
    try {
        console.log('[DEBUG] Starting to find calibration characteristic');
        const services = await device.services();
        console.log('[DEBUG] Found services:', services.length);

        const service = services.find(s => s.uuid === SERVICE_UUID);
        console.log('[DEBUG] Found service:', !!service);

        if (!service) {
            console.error('[DEBUG] Service not found');
            throw new Error('Service not found');
        }

        const characteristics = await service.characteristics();
        console.log('[DEBUG] Found characteristics:', characteristics.length);

        const calibChar = characteristics.find(c => c.uuid === CHAR_CALIB_UUID);
        console.log('[DEBUG] Found calibration characteristic:', !!calibChar);

        return calibChar || null;

    } catch (error) {
        console.error('[DEBUG] Error finding calibration characteristic:', error);
        return null;
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
        status: 'idle',
        type: 'none',
        progress: 0
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

        if (accX !== undefined && accY !== undefined && accZ !== undefined &&
            gyrX !== undefined && gyrY !== undefined && gyrZ !== undefined &&
            timestamp !== undefined) {

            const completeData: SensorData = {
                accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp
            };

            setSensorData(completeData);

            if (dataCallbackRef.current) {
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

                            // Monitor calibration progress
                            connectedDevice.monitorCharacteristicForService(
                                SERVICE_UUID,
                                CHAR_CALIB_UUID,
                                (error, characteristic) => {
                                    if (error) {
                                        Logger.error('Calibration monitoring error:', error);
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
                                        const progress: CalibrationProgress = {
                                            state: dataView.getUint8(0),
                                            progress: dataView.getUint8(1),
                                            temperature: dataView.getFloat32(2, true),
                                            positionIndex: dataView.getUint8(6),
                                            reserved: dataView.getUint8(7)
                                        };

                                        handleCalibrationProgress(progress);
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

    const stopScan = useCallback(() => {
        if (isScanning) {
            Logger.info('Manually stopping device scan');
            bleManager.stopDeviceScan();
            setIsScanning(false);
        }
    }, [isScanning]);

    /**
     * Disconnects from currently connected BLE device
     */
    const disconnect = useCallback(async () => {
        try {
            Logger.info('Initiating disconnect');
            const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);

            // Properly disconnect from each device and wait for all to complete
            await Promise.all(connectedDevices.map(async device => {
                Logger.info(`Disconnecting from device: ${device.id}`);
                try {
                    // Cancel all notifications/monitors first
                    await device.cancelConnection();
                    Logger.info(`Successfully disconnected from device: ${device.id}`);
                } catch (error) {
                    Logger.error(`Error disconnecting from device ${device.id}:`, error);
                    throw error;
                }
            }));

            // Reset all state
            setIsConnected(false);
            setSensorData(null);
            setCalibrationState({
                isCalibrating: false,
                status: 'idle',
                type: 'none',
                progress: 0
            });
            Logger.info('Disconnect complete');
        } catch (error) {
            Logger.error('Disconnect error:', error);
            Alert.alert('Disconnect Error', 'Failed to disconnect from device');
            // Even if there's an error, we should reset our connection state
            setIsConnected(false);
        }
    }, []);

    /**
     * Starts quick calibration procedure
     */
    const startQuickCalibration = useCallback(async () => {
        try {
            console.log('[DEBUG] Starting quick calibration');
            const device = await getConnectedDevice();
            console.log('[DEBUG] Connected device:', device?.id);

            if (!device) {
                console.error('[DEBUG] No device connected');
                throw new Error('No device connected');
            }

            setCalibrationState({
                isCalibrating: true,
                status: 'in_progress',
                type: 'quick',
                progress: 0,
                error: undefined
            });
            console.log('[DEBUG] Calibration state set to in_progress');

            const characteristic = await findCalibrationCharacteristic(device);
            console.log('[DEBUG] Found characteristic:', !!characteristic);

            if (!characteristic) {
                console.error('[DEBUG] Calibration characteristic not found');
                throw new Error('Calibration characteristic not found');
            }

            // Create a Uint8Array instead of using Buffer
            const command = new Uint8Array([4]);
            // Convert to base64
            const base64Command = btoa(String.fromCharCode.apply(null, command));

            console.log('[DEBUG] Sending quick calibration command');
            await characteristic.writeWithResponse(base64Command);
            console.log('[DEBUG] Command sent successfully');

        } catch (error) {
            console.error('[DEBUG] Error in startQuickCalibration:', error);
            console.error('[DEBUG] Error type:', typeof error);
            console.error('[DEBUG] Is Error instance:', error instanceof Error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown calibration error';
            console.error('[DEBUG] Error message:', errorMessage);

            setCalibrationState({
                isCalibrating: false,
                status: 'failed',
                type: 'none',
                progress: 0,
                error: errorMessage
            });

            throw error;
        }
    }, []);

    /**
     * Starts full calibration procedure
     */
    const startFullCalibration = useCallback(async () => {
        try {
            const device = await getConnectedDevice();
            if (!device) throw new Error('No device connected');

            setCalibrationState({
                isCalibrating: true,
                status: 'in_progress',
                type: 'full',
                progress: 0
            });

            const characteristic = await findCalibrationCharacteristic(device);
            if (!characteristic) throw new Error('Calibration characteristic not found');

            const command = new Uint8Array([3]);
            const base64Command = btoa(String.fromCharCode.apply(null, command));

            await characteristic.writeWithResponse(base64Command);
        } catch (error: unknown) {
            setCalibrationState(prev => ({
                ...prev,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            }));
            throw error;
        }
    }, []);

    /**
     * Aborts ongoing calibration
     */
    const abortCalibration = useCallback(async () => {
        try {
            const device = await getConnectedDevice();
            if (!device) throw new Error('No device connected');

            const characteristic = await findCalibrationCharacteristic(device);
            if (!characteristic) throw new Error('Calibration characteristic not found');

            const command = new Uint8Array([2]); // 2 is ABORT command
            const base64Command = btoa(String.fromCharCode.apply(null, command));

            await characteristic.writeWithResponse(base64Command);
            setCalibrationState({
                isCalibrating: false,
                status: 'idle',
                type: 'none',
                progress: 0
            });
        } catch (error) {
            Logger.error('Abort calibration error:', error);
            throw error;
        }
    }, []);

    /**
     * Handles calibration progress updates from device
     */
    const handleCalibrationProgress = useCallback((progress: CalibrationProgress) => {
        setCalibrationState(prev => ({
            ...prev,
            isCalibrating: !([11, 12, 15].includes(progress.state)), // Not calibrating if completed, failed, or quick complete
            status: progress.state === 15 ? 'completed' : // QUICK_COMPLETE
                progress.state === 11 ? 'completed' : // COMPLETED (full calibration)
                    progress.state === 12 ? 'failed' :    // FAILED
                        progress.state === 0 ? 'idle' :      // IDLE
                            'in_progress',
            progress: progress.progress,
            error: progress.state === 12 ? 'Calibration failed' : undefined,
            type: prev.type // Maintain the current calibration type
        }));
    }, []);

    return (
        <BLEContext.Provider value={{
            bleManager,
            isConnected,
            isScanning,
            startScan,
            stopScan,
            disconnect,
            sensorData,
            calibrationState,
            setCalibrationState,
            startQuickCalibration,
            startFullCalibration,
            abortCalibration,
            setOnDataReceived,
            onCalibrationProgress: handleCalibrationProgress,
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