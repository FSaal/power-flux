/**
 * BLEContext.tsx
 *
 * This module provides a React Context for managing Bluetooth Low Energy (BLE) connections
 * and data handling for the PowerFlux application. It manages the connection to the M5Stack
 * device and processes IMU (accelerometer and gyroscope) data.
 */

import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert } from 'react-native';
import { BleError, BleManager, Characteristic, Device } from 'react-native-ble-plx';
import { CalibrationState, CalibrationStatus, DeviceCalibrationState } from '../types/calibration';

// Configuration constants
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_ACC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CHAR_GYR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const CHAR_CALIB_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
const DEVICE_NAME = 'PowerFlux';
const SCAN_TIMEOUT = 10000; // 10 seconds
export const BATCH_SIZE = 2;

// Type definitions and interfaces
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

export interface BLEContextType {
  bleManager: BleManager;
  isConnected: boolean;
  isScanning: boolean;
  startScan: () => Promise<void>;
  stopScan: () => void;
  disconnect: () => Promise<void>;
  calibrationState: CalibrationState;
  startQuickCalibration: () => Promise<void>;
  abortCalibration: () => Promise<void>;
  sensorData: SensorData | null;
  setOnDataReceived: (callback: ((data: SensorData) => void) | undefined) => void;
  onCalibrationProgress: (progress: CalibrationProgress) => void;
  setCalibrationState: React.Dispatch<React.SetStateAction<CalibrationState>>;
}

export enum CalibrationCommand {
  ABORT = 2,
  START_QUICK = 1,
}

export interface CalibrationProgress {
  state: number; // uint8_t
  progress: number; // uint8_t
}

// Static instances
const bleManager = new BleManager();
const BLEContext = createContext<BLEContextType | undefined>(undefined);
const dataCallbackRef = { current: undefined as ((data: SensorData) => void) | undefined };
const latestData = { current: {} as Partial<SensorData> };

// Helper functions
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
  },
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
    // Cache the discovered services and characteristics
    if (!device._services) {
      // TypeScript might complain about _services, but it's an internal cache
      console.log('[DEBUG] Discovering services...');
      const services = await device.services();
      console.log('[DEBUG] Found services:', services.length);
      device._services = services;
    }

    const service = device._services.find((s) => s.uuid === SERVICE_UUID);
    if (!service) {
      console.error('[DEBUG] Service not found');
      throw new Error('Service not found');
    }

    if (!service._characteristics) {
      console.log('[DEBUG] Discovering characteristics...');
      const characteristics = await service.characteristics();
      console.log('[DEBUG] Found characteristics:', characteristics.length);
      service._characteristics = characteristics;
    }

    return service._characteristics.find((c) => c.uuid === CHAR_CALIB_UUID) || null;
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
  // State definitions
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>({
    isCalibrating: false,
    status: 'idle',
    progress: 0,
    deviceState: DeviceCalibrationState.IDLE,
  });

  // Callback handlers
  const setOnDataReceived = useCallback((callback: ((data: SensorData) => void) | undefined) => {
    Logger.debug(`Setting data callback: ${callback ? 'Provided' : 'Undefined'}`);
    dataCallbackRef.current = callback;
  }, []);

  const updateSensorData = useCallback(
    (data: { type: 'acc' | 'gyr'; timestamp: number; x: number; y: number; z: number }) => {
      const measurement: Partial<SensorData> = {
        timestamp: data.timestamp,
        ...(data.type === 'acc'
          ? { accX: data.x, accY: data.y, accZ: data.z }
          : { gyrX: data.x, gyrY: data.y, gyrZ: data.z }),
      };

      if (latestData.current.timestamp === measurement.timestamp) {
        const completeData: SensorData = {
          ...latestData.current,
          ...measurement,
        } as SensorData;

        if (dataCallbackRef.current) {
          dataCallbackRef.current(completeData);
        }
      } else {
        latestData.current = measurement;
      }

      setSensorData((prev) => ({ ...prev, ...measurement }) as SensorData);
    },
    [],
  );

  const createCharacteristicHandler =
    (type: 'acc' | 'gyr') => (error: BleError | null, characteristic: Characteristic | null) => {
      if (error) {
        Logger.error(`${type} monitoring error:`, error);
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
        const x = dataView.getFloat32(0, true);
        const y = dataView.getFloat32(4, true);
        const z = dataView.getFloat32(8, true);
        const timestamp = dataView.getUint32(12, true);

        updateSensorData({ type, timestamp, x, y, z });
      }
    };

  const handleCalibrationProgress = useCallback((progress: CalibrationProgress) => {
    const getStatus = (state: DeviceCalibrationState): CalibrationStatus => {
      switch (state) {
        case DeviceCalibrationState.QUICK_COMPLETE:
          return 'completed';
        case DeviceCalibrationState.FAILED:
          return 'failed';
        case DeviceCalibrationState.IDLE:
          return 'idle';
        default:
          return 'in_progress';
      }
    };

    setCalibrationState((prev) => ({
      ...prev,
      isCalibrating:
        progress.state !== DeviceCalibrationState.QUICK_COMPLETE &&
        progress.state !== DeviceCalibrationState.FAILED,
      status: getStatus(progress.state),
      progress: progress.progress,
      deviceState: progress.state,
      error: progress.state === DeviceCalibrationState.FAILED ? 'Calibration failed' : undefined,
    }));
  }, []);

  const setupCalibrationMonitoring = (device: Device) => {
    // Initialize prevState outside callback to persist between calls
    let prevState: DeviceCalibrationState = DeviceCalibrationState.IDLE;

    device.monitorCharacteristicForService(
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
          };

          Logger.info('[CALIB] Parsed progress:', progress);

          // Handle state transition
          if (prevState !== progress.state) {
            Logger.info(`[CALIB] State changed from ${prevState} to ${progress.state}`);
            prevState = progress.state;
          }

          handleCalibrationProgress(progress);
        }
      },
    );
  };

  // BLE operations
  const startScan = useCallback(async () => {
    if (isScanning) {
      Logger.warn('Scan already in progress');
      return;
    }

    try {
      setIsScanning(true);
      Logger.info('Starting device scan');

      bleManager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
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

            // Monitor both accelerometer and gyroscope data with single processing logic
            connectedDevice.monitorCharacteristicForService(
              SERVICE_UUID,
              CHAR_ACC_UUID,
              createCharacteristicHandler('acc'),
            );

            connectedDevice.monitorCharacteristicForService(
              SERVICE_UUID,
              CHAR_GYR_UUID,
              createCharacteristicHandler('gyr'),
            );

            // Monitor calibration progress
            setupCalibrationMonitoring(connectedDevice);

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
      });

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

  const disconnect = useCallback(async () => {
    try {
      Logger.info('Initiating disconnect');
      const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);

      // Properly disconnect from each device and wait for all to complete
      await Promise.all(
        connectedDevices.map(async (device) => {
          Logger.info(`Disconnecting from device: ${device.id}`);
          try {
            // Cancel all notifications/monitors first
            await device.cancelConnection();
            Logger.info(`Successfully disconnected from device: ${device.id}`);
          } catch (error) {
            Logger.error(`Error disconnecting from device ${device.id}:`, error);
            throw error;
          }
        }),
      );

      // Reset all state
      setIsConnected(false);
      setSensorData(null);
      setCalibrationState({
        isCalibrating: false,
        status: 'idle',
        progress: 0,
        deviceState: DeviceCalibrationState.FAILED,
      });
      Logger.info('Disconnect complete');
    } catch (error) {
      Logger.error('Disconnect error:', error);
      Alert.alert('Disconnect Error', 'Failed to disconnect from device');
      // Even if there's an error, we should reset our connection state
      setIsConnected(false);
    }
  }, []);

  // Calibration operations
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
        progress: 0,
        error: undefined,
        deviceState: DeviceCalibrationState.QUICK_STABILIZING,
      });
      console.log('[DEBUG] Calibration state set to in_progress');

      const characteristic = await findCalibrationCharacteristic(device);
      console.log('[DEBUG] Found characteristic:', !!characteristic);

      if (!characteristic) {
        console.error('[DEBUG] Calibration characteristic not found');
        throw new Error('Calibration characteristic not found');
      }

      // Create a Uint8Array instead of using Buffer
      const command = new Uint8Array([CalibrationCommand.START_QUICK]);
      const base64Command = btoa(String.fromCharCode.apply(null, command));

      console.log('[DEBUG] Sending quick calibration command');
      await characteristic.writeWithResponse(base64Command);
      console.log('[DEBUG] Command sent successfully');

      // Verify the write - properly decode base64
      const response = await characteristic.read();
      if (response?.value) {
        const bytes = atob(response.value)
          .split('')
          .map((c) => c.charCodeAt(0));
        console.log('[DEBUG] Read back value (bytes):', bytes);
      }
    } catch (error) {
      console.error('[DEBUG] Error in startQuickCalibration:', error);
      console.error('[DEBUG] Error type:', typeof error);
      console.error('[DEBUG] Is Error instance:', error instanceof Error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown calibration error';
      console.error('[DEBUG] Error message:', errorMessage);

      setCalibrationState({
        isCalibrating: false,
        status: 'failed',
        progress: 0,
        error: errorMessage,
        deviceState: DeviceCalibrationState.FAILED,
      });

      throw error;
    }
  }, []);

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
        progress: 0,
        deviceState: DeviceCalibrationState.IDLE,
      });
    } catch (error) {
      Logger.error('Abort calibration error:', error);
      throw error;
    }
  }, []);

  return (
    <BLEContext.Provider
      value={{
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
        abortCalibration,
        setOnDataReceived,
        onCalibrationProgress: handleCalibrationProgress,
      }}
    >
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
