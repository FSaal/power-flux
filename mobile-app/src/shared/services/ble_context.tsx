import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { BleManager, Characteristic, Device } from 'react-native-ble-plx';
import { CalibrationState } from '../types/calibration';
import { SensorData } from '../types/sensor';

// Configuration constants
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHAR_ACC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CHAR_GYR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';
const CHAR_CALIB_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26aa';
const DEVICE_NAME = 'PowerFlux';
const SCAN_TIMEOUT = 10000;

export interface CalibrationProgress {
  state: number;
  progress: number;
  temperature: number;
  positionIndex: number;
  reserved: number;
}

export enum CalibrationCommand {
  START = 1,
  ABORT = 2,
  START_FULL = 3,
  START_QUICK = 4,
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

const BLEContext = createContext<BLEContextType | undefined>(undefined);

// Static instances
const bleManager = new BleManager();
const dataCallbackRef = { current: undefined as ((data: SensorData) => void) | undefined };
const latestData = { current: {} as Partial<SensorData> };

const Logger = {
  error: (message: string, ...args: any[]) => {
    console.error(`[BLE] ERROR: ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[BLE] WARN: ${message}`, ...args);
  },
  info: (message: string, ...args: any[]) => {
    if (__DEV__) console.info(`[BLE] INFO: ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (__DEV__) console.debug(`[BLE] DEBUG: ${message}`, ...args);
  },
};

const getConnectedDevice = async (): Promise<Device | null> => {
  try {
    const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);
    return connectedDevices.length > 0 ? connectedDevices[0] : null;
  } catch (error) {
    Logger.error('Error getting connected device:', error);
    return null;
  }
};

const findCalibrationCharacteristic = async (device: Device): Promise<Characteristic | null> => {
  try {
    const services = await device.services();
    const service = services.find((s) => s.uuid === SERVICE_UUID);

    if (!service) {
      throw new Error('Service not found');
    }

    const characteristics = await service.characteristics();
    return characteristics.find((c) => c.uuid === CHAR_CALIB_UUID) || null;
  } catch (error) {
    Logger.error('Error finding calibration characteristic:', error);
    return null;
  }
};

export const BLEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [calibrationState, setCalibrationState] = useState<CalibrationState>({
    isCalibrating: false,
    status: 'idle',
    type: 'none',
    progress: 0,
  });

  const cleanupRef = useRef<(() => void)[]>([]);

  const setOnDataReceived = useCallback((callback: ((data: SensorData) => void) | undefined) => {
    Logger.debug(`Setting data callback: ${callback ? 'Provided' : 'Undefined'}`);
    dataCallbackRef.current = callback;
  }, []);

  const updateSensorData = useCallback((newData: Partial<SensorData>) => {
    latestData.current = { ...latestData.current, ...newData };
    const { accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp } = latestData.current;

    if (
      accX !== undefined &&
      accY !== undefined &&
      accZ !== undefined &&
      gyrX !== undefined &&
      gyrY !== undefined &&
      gyrZ !== undefined &&
      timestamp !== undefined
    ) {
      const completeData: SensorData = {
        accX,
        accY,
        accZ,
        gyrX,
        gyrY,
        gyrZ,
        timestamp,
      };

      setSensorData(completeData);

      if (dataCallbackRef.current) {
        dataCallbackRef.current(completeData);
        latestData.current = {};
      }
    }
  }, []);

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

            const cleanupFunctions: (() => void)[] = [];

            // Monitor accelerometer
            const accSubscription = connectedDevice.monitorCharacteristicForService(
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
                    timestamp: dataView.getUint32(12, true),
                  });
                }
              },
            );
            cleanupFunctions.push(() => accSubscription.remove());

            // Monitor gyroscope
            const gyroSubscription = connectedDevice.monitorCharacteristicForService(
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
                    timestamp: dataView.getUint32(12, true),
                  });
                }
              },
            );
            cleanupFunctions.push(() => gyroSubscription.remove());

            // Monitor calibration progress
            const calibSubscription = connectedDevice.monitorCharacteristicForService(
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
                    reserved: dataView.getUint8(7),
                  };

                  handleCalibrationProgress(progress);
                }
              },
            );
            cleanupFunctions.push(() => calibSubscription.remove());

            // Store cleanup functions
            cleanupRef.current = cleanupFunctions;

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

      // Clean up monitoring subscriptions
      if (cleanupRef.current.length > 0) {
        cleanupRef.current.forEach((cleanup) => cleanup());
        cleanupRef.current = [];
      }

      const connectedDevices = await bleManager.connectedDevices([SERVICE_UUID]);

      await Promise.all(
        connectedDevices.map(async (device) => {
          Logger.info(`Disconnecting from device: ${device.id}`);
          try {
            await device.cancelConnection();
            Logger.info(`Successfully disconnected from device: ${device.id}`);
          } catch (error) {
            Logger.error(`Error disconnecting from device ${device.id}:`, error);
            throw error;
          }
        }),
      );

      // Reset state
      setIsConnected(false);
      setSensorData(null);
      setCalibrationState({
        isCalibrating: false,
        status: 'idle',
        type: 'none',
        progress: 0,
      });
      Logger.info('Disconnect complete');
    } catch (error) {
      Logger.error('Disconnect error:', error);
      Alert.alert('Disconnect Error', 'Failed to disconnect from device');
      setIsConnected(false);
    }
  }, []);

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
        error: undefined,
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
        error: errorMessage,
      });

      throw error;
    }
  }, []);

  const startFullCalibration = useCallback(async () => {
    try {
      const device = await getConnectedDevice();
      if (!device) throw new Error('No device connected');

      setCalibrationState({
        isCalibrating: true,
        status: 'in_progress',
        type: 'full',
        progress: 0,
      });

      const characteristic = await findCalibrationCharacteristic(device);
      if (!characteristic) throw new Error('Calibration characteristic not found');

      const command = new Uint8Array([3]);
      const base64Command = btoa(String.fromCharCode.apply(null, command));

      await characteristic.writeWithResponse(base64Command);
    } catch (error: unknown) {
      setCalibrationState((prev) => ({
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }));
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
        type: 'none',
        progress: 0,
      });
    } catch (error) {
      Logger.error('Abort calibration error:', error);
      throw error;
    }
  }, []);

  const handleCalibrationProgress = useCallback((progress: CalibrationProgress) => {
    setCalibrationState((prev) => ({
      ...prev,
      isCalibrating: ![11, 12, 15].includes(progress.state),
      status:
        progress.state === 15
          ? 'completed' // QUICK_COMPLETE
          : progress.state === 11
            ? 'completed' // COMPLETED (full calibration)
            : progress.state === 12
              ? 'failed' // FAILED
              : progress.state === 0
                ? 'idle' // IDLE
                : 'in_progress',
      progress: progress.progress,
      error: progress.state === 12 ? 'Calibration failed' : undefined,
      type: prev.type,
    }));
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
        startFullCalibration,
        abortCalibration,
        setOnDataReceived,
        onCalibrationProgress: handleCalibrationProgress,
      }}
    >
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
