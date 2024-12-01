import { useBLE } from '@/shared/services/ble_context';
import { DeviceCalibrationState } from '@/shared/types/calibration';
import { useState } from 'react';
import { Alert } from 'react-native';

export const useDeviceSettings = () => {
  // State
  const { isConnected, isScanning, calibrationState } = useBLE();

  // Local state
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);

  // Actions
  const {
    startScan,
    stopScan,
    disconnect,
    setCalibrationState,
    startQuickCalibration,
    abortCalibration,
  } = useBLE();

  // Action handlers
  const handleStartCalibrationPress = async () => {
    try {
      await handleStartCalibration();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start calibration';
      Alert.alert('Calibration Error', errorMessage);
    }
  };

  const handleStartCalibration = async () => {
    if (!isConnected) {
      throw new Error('Device not connected');
    }

    setCalibrationState({
      isCalibrating: false,
      status: 'idle',
      progress: 0,
      deviceState: DeviceCalibrationState.IDLE,
    });
    setShowCalibrationModal(true);
  };

  const handleModalClose = () => {
    if (!calibrationState.isCalibrating) {
      setShowCalibrationModal(false);
      setCalibrationState({
        isCalibrating: false,
        status: 'idle',
        progress: 0,
        deviceState: DeviceCalibrationState.IDLE,
      });
    }
  };

  return {
    // State
    isConnected,
    isScanning,
    showCalibrationModal,
    calibrationState,

    // Actions
    startScan,
    stopScan,
    disconnect,
    handleStartCalibration,
    handleModalClose,
    startQuickCalibration,
    abortCalibration,
    handleStartCalibrationPress,
  };
};
