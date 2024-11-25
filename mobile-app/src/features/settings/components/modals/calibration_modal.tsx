import { buttonStyles, modalStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlaceDeviceAnimation } from '../animations/place_device_animation';

// Possible states the modal can be in
type ModalState = 'initial' | 'inProgress' | 'failed' | 'success';

interface CalibrationModalProps {
  visible: boolean;
  type: 'quick' | 'full';
  calibrationState: {
    isCalibrating: boolean;
    status: string;
    progress: number;
  };
  startQuickCalibration: () => Promise<void>;
  startFullCalibration: () => Promise<void>;
  onAbort: () => Promise<void>;
  onClose: () => void;
}

export const CalibrationModal = ({
  visible,
  type,
  calibrationState,
  startQuickCalibration,
  startFullCalibration,
  onAbort,
  onClose,
}: CalibrationModalProps) => {
  // Determine current modal state based on calibration status
  const getModalState = (): ModalState => {
    if (calibrationState.status === 'failed') return 'failed';
    if (calibrationState.status === 'completed') return 'success';
    if (calibrationState.isCalibrating) return 'inProgress';
    return 'initial';
  };

  const handleStartCalibration = async () => {
    try {
      if (type === 'quick') {
        await startQuickCalibration();
      } else {
        await startFullCalibration();
      }
    } catch (error) {
      console.error('Error starting calibration:', error);
    }
  };

  const renderContent = () => {
    const modalState = getModalState();

    switch (modalState) {
      case 'failed':
        return (
          <View style={modalStyles.content}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="alert-circle" size={48} color={theme.colors.danger} />
            </View>
            <Text style={[modalStyles.text, styles.instructionText]}>
              Calibration failed. Make sure the device is on a stable surface.
            </Text>
            <View style={modalStyles.buttonRow}>
              <TouchableOpacity
                style={[buttonStyles.button, buttonStyles.cancel, modalStyles.buttonRowItem]}
                onPress={onClose}
              >
                <Text style={buttonStyles.text}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[buttonStyles.button, buttonStyles.primary, modalStyles.buttonRowItem]}
                onPress={handleStartCalibration}
              >
                <Text style={buttonStyles.text}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'success':
        return (
          <View style={modalStyles.content}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="check-circle" size={48} color={theme.colors.success} />
            </View>
            <Text style={modalStyles.text}>Calibration completed successfully!</Text>
            <View style={modalStyles.buttonRow}>
              <TouchableOpacity
                style={[buttonStyles.button, buttonStyles.cancel, modalStyles.buttonRowItem]}
                onPress={onClose}
              >
                <Text style={buttonStyles.text}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[buttonStyles.button, buttonStyles.primary, modalStyles.buttonRowItem]}
                onPress={handleStartCalibration}
              >
                <Text style={buttonStyles.text}>Calibrate Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'inProgress':
        return (
          <View style={modalStyles.content}>
            <View style={modalStyles.progressBar}>
              <View
                style={[modalStyles.progressFill, { width: `${calibrationState.progress}%` }]}
              />
            </View>
            <Text style={[modalStyles.text, styles.instructionText]}>
              Place the device on a flat surface and keep it still
            </Text>
            <TouchableOpacity
              style={[buttonStyles.button, buttonStyles.danger, modalStyles.buttonSingle]}
              onPress={onAbort}
            >
              <Text style={buttonStyles.text}>Abort</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <View style={modalStyles.content}>
            <PlaceDeviceAnimation />
            <Text style={[modalStyles.text, styles.instructionText]}>
              {type === 'full'
                ? 'Place the sensor on a flat, stable surface. The device will need to be moved to different positions during calibration.'
                : 'Place the sensor on a flat, stable surface with the display facing up'}
            </Text>
            <TouchableOpacity
              style={[buttonStyles.button, buttonStyles.primary, modalStyles.buttonSingle]}
              onPress={handleStartCalibration}
            >
              <Text style={buttonStyles.text}>Start Calibration</Text>
            </TouchableOpacity>
          </View>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={calibrationState.isCalibrating ? undefined : onClose}
    >
      <TouchableOpacity
        style={modalStyles.overlay}
        activeOpacity={1}
        onPress={calibrationState.isCalibrating ? undefined : onClose}
      >
        <View style={modalStyles.bottomSheet} onStartShouldSetResponder={() => true}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>
            {type === 'full' ? 'Full Calibration' : 'Quick Calibration'}
          </Text>
          {renderContent()}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    maxWidth: '90%',
    marginBottom: theme.spacing.lg,
  },
});
