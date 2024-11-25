import { theme } from '@/shared/styles/theme';
import { SensorData } from '@/shared/types/sensor';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface SensorDetailsProps {
  data: SensorData;
  measurementCount?: number;
  isRecording: boolean;
  onToggleVisibility: () => void;
}

export const SensorDetails = ({
  data,
  measurementCount,
  isRecording,
  onToggleVisibility,
}: SensorDetailsProps) => {
  return (
    <Pressable onPress={onToggleVisibility}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.header}>Accelerometer (m/s²)</Text>
          <Text style={styles.value}>X: {data.accX.toFixed(2)}</Text>
          <Text style={styles.value}>Y: {data.accY.toFixed(2)}</Text>
          <Text style={styles.value}>Z: {data.accZ.toFixed(2)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.header}>Gyroscope (rad/s)</Text>
          <Text style={styles.value}>X: {data.gyrX.toFixed(2)}</Text>
          <Text style={styles.value}>Y: {data.gyrY.toFixed(2)}</Text>
          <Text style={styles.value}>Z: {data.gyrZ.toFixed(2)}</Text>
        </View>

        {isRecording && measurementCount !== undefined && (
          <View style={styles.section}>
            <Text style={styles.header}>Recording Stats</Text>
            <Text style={styles.value}>Measurements: {measurementCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.md,
  },
  section: {
    gap: theme.spacing.sm,
  },
  header: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  value: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
