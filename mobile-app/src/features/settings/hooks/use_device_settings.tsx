import { useBLE } from '@/shared/services/ble_context';
import { useState } from 'react';
import { Alert } from 'react-native';

export const useDeviceSettings = () => {
  // State
  const { isConnected, isScanning, calibrationState } = useBLE();

  // Local state
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationType, setCalibrationType] = useState<'quick' | 'full'>('quick');

  // Actions
  const {
    startScan,
    stopScan,
    disconnect,
    setCalibrationState,
    startQuickCalibration,
    startFullCalibration,
    abortCalibration,
  } = useBLE();

  // Action handlers
  const handleStartCalibrationPress = async (type: 'quick' | 'full') => {
    try {
      await handleStartCalibration(type);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start calibration';
      Alert.alert('Calibration Error', errorMessage);
    }
  };

  const handleStartCalibration = async (type: 'quick' | 'full') => {
    if (!isConnected) {
      throw new Error('Device not connected');
    }

    setCalibrationType(type);
    setCalibrationState({
      isCalibrating: false,
      status: 'idle',
      type: 'none',
      progress: 0,
    });
    setShowCalibrationModal(true);
  };

  const handleModalClose = () => {
    if (!calibrationState.isCalibrating) {
      setShowCalibrationModal(false);
      setCalibrationState({
        isCalibrating: false,
        status: 'idle',
        type: 'none',
        progress: 0,
      });
    }
  };

  return {
    // State
    isConnected,
    isScanning,
    showCalibrationModal,
    calibrationType,
    calibrationState,

    // Actions
    startScan,
    stopScan,
    disconnect,
    handleStartCalibration,
    handleModalClose,
    startQuickCalibration,
    startFullCalibration,
    abortCalibration,
    handleStartCalibrationPress,
  };
};
