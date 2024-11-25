import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface RecordingIndicatorProps {
  startTime: number;
}

export const RecordingIndicator = ({ startTime }: RecordingIndicatorProps) => {
  const [visible, setVisible] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('0:00');

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setVisible((prev) => !prev);
    }, 500);

    const timeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    // Cleanup subscriptions to prevent memory leaks
    return () => {
      clearInterval(blinkInterval);
      clearInterval(timeInterval);
    };
  }, [startTime]);

  return (
    <View style={styles.container}>
      {visible && (
        <MaterialCommunityIcons name="record-circle" size={20} color={theme.colors.danger} />
      )}
      <Text style={styles.time}>{elapsedTime}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  time: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
