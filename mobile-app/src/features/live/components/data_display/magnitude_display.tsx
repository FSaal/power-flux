import { theme } from '@/shared/styles/theme';
import { StyleSheet, Text, View } from 'react-native';

interface MagnitudeDisplayProps {
  magnitude: number;
}

export const MagnitudeDisplay = ({ magnitude }: MagnitudeDisplayProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Acceleration Magnitude</Text>
      <Text style={styles.value}>
        {magnitude.toFixed(2)}
        <Text style={styles.unit}> m/s²</Text>
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    marginBottom: theme.spacing.sm,
  },
  value: {
    color: theme.colors.text,
    fontSize: 48,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 24,
    color: theme.colors.textSecondary,
  },
});
