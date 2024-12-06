import { SensorData } from '@/shared/services/ble_context';
import { cardStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface MainDisplayProps {
  magnitude: number;
  processedAccel: { x: number; y: number; z: number };
  sensorData: SensorData | null;
  showDetails: boolean;
  measurementCount?: number;
  isRecording?: boolean;
  orientation?: { x: number; y: number; z: number };
}

export const MainDisplay: React.FC<MainDisplayProps> = ({
  magnitude,
  processedAccel,
  sensorData,
  showDetails,
  measurementCount,
  isRecording,
  orientation,
}) => {
  // Convert radians to degrees for display
  const toDegrees = (rad: number): number => (rad * 180) / Math.PI;

  return (
    <View style={styles.container}>
      <Text style={styles.dataLabel}>Acceleration Magnitude</Text>
      <Text style={styles.dataValue}>
        {magnitude.toFixed(2)}
        <Text style={styles.dataUnit}> m/s²</Text>
      </Text>

      {showDetails && sensorData && (
        <ScrollView style={[cardStyles.container, cardStyles.elevated, styles.detailsContainer]}>
          <View style={styles.detailsSection}>
            <Text style={styles.detailsHeader}>Accelerometer (m/s²)</Text>
            <Text style={styles.detailsText}>X: {processedAccel.x.toFixed(2)}</Text>
            <Text style={styles.detailsText}>Y: {processedAccel.y.toFixed(2)}</Text>
            <Text style={styles.detailsText}>Z: {processedAccel.z.toFixed(2)}</Text>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailsHeader}>Gyroscope (rad/s)</Text>
            <Text style={styles.detailsText}>X: {sensorData.gyrX.toFixed(2)}</Text>
            <Text style={styles.detailsText}>Y: {sensorData.gyrY.toFixed(2)}</Text>
            <Text style={styles.detailsText}>Z: {sensorData.gyrZ.toFixed(2)}</Text>
          </View>

          {orientation && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsHeader}>Orientation (degrees)</Text>
              <Text style={styles.detailsText}>Roll: {toDegrees(orientation.x)?.toFixed(1)}°</Text>
              <Text style={styles.detailsText}>Pitch: {toDegrees(orientation.y)?.toFixed(1)}°</Text>
              <Text style={styles.detailsText}>Yaw: {toDegrees(orientation.z)?.toFixed(1)}°</Text>
            </View>
          )}

          {isRecording && measurementCount !== undefined && (
            <View style={styles.detailsSection}>
              <Text style={styles.detailsHeader}>Recording Stats</Text>
              <Text style={styles.detailsText}>Measurements: {measurementCount}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  dataLabel: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    marginBottom: theme.spacing.sm,
  },
  dataValue: {
    color: theme.colors.text,
    fontSize: 48,
    fontWeight: 'bold',
  },
  dataUnit: {
    fontSize: 24,
    color: theme.colors.textSecondary,
  },
  detailsContainer: {
    width: '100%',
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    maxHeight: 200, // Limit height and enable scrolling
  },
  detailsSection: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.md, // Add some spacing between sections
  },
  detailsHeader: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailsText: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
