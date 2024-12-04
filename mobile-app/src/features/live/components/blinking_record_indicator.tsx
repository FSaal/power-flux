import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface BlinkingRecordIndicatorProps {
  startTime: number;
}

export const BlinkingRecordIndicator = ({ startTime }: BlinkingRecordIndicatorProps) => {
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
      <Text style={styles.timeText}>{elapsedTime}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeText: {
    color: theme.colors.text,
    fontSize: 14,
  },
});
