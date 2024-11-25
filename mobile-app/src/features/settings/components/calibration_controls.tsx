import { buttonStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CalibrationControlsProps {
  isConnected: boolean;
  onStartQuickCalibration: () => void;
  onStartFullCalibration: () => void;
}

export const CalibrationControls = ({
  isConnected,
  onStartQuickCalibration,
  onStartFullCalibration,
}: CalibrationControlsProps) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[buttonStyles.button, buttonStyles.primary, !isConnected && buttonStyles.disabled]}
        onPress={onStartQuickCalibration}
        disabled={!isConnected}
      >
        <MaterialCommunityIcons name="tune" size={24} color={theme.colors.text} />
        <Text style={styles.buttonText}>Quick Calibrate</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[buttonStyles.button, buttonStyles.primary, !isConnected && buttonStyles.disabled]}
        onPress={onStartFullCalibration}
        disabled={!isConnected}
      >
        <MaterialCommunityIcons name="tune" size={24} color={theme.colors.text} />
        <Text style={styles.buttonText}>Full Calibrate</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
