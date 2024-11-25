import { buttonStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface ConnectionControlsProps {
  isConnected: boolean;
  isScanning: boolean;
  onStartScan: () => void;
  onStopScan: () => void;
  onDisconnect: () => void;
}

const LoadingSpinner = () => {
  const rotation = useSharedValue(0);

  React.useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 1000,
      }),
      -1,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <MaterialCommunityIcons name="loading" size={24} color={theme.colors.text} />
    </Animated.View>
  );
};

export const ConnectionControls = ({
  isConnected,
  isScanning,
  onStartScan,
  onStopScan,
  onDisconnect,
}: ConnectionControlsProps) => {
  if (isConnected) {
    return (
      <TouchableOpacity style={[buttonStyles.button, buttonStyles.danger]} onPress={onDisconnect}>
        <MaterialCommunityIcons name="bluetooth-off" size={24} color={theme.colors.text} />
        <Text style={buttonStyles.text}>Disconnect</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.scanRow}>
      <TouchableOpacity
        style={[buttonStyles.button, styles.scanButton, isScanning && styles.scanning]}
        onPress={onStartScan}
        disabled={isScanning}
      >
        {isScanning ? (
          <LoadingSpinner />
        ) : (
          <MaterialCommunityIcons name="bluetooth-settings" size={24} color={theme.colors.text} />
        )}
        <Text style={buttonStyles.text}>{isScanning ? 'Scanning...' : 'Scan for M5'}</Text>
      </TouchableOpacity>

      {isScanning && (
        <TouchableOpacity style={[buttonStyles.button, styles.cancelButton]} onPress={onStopScan}>
          <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
          <Text style={buttonStyles.text}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scanRow: {
    flexDirection: 'row',
    gap: 8,
    height: 56,
  },
  scanButton: {
    flex: 1,
    backgroundColor: theme.colors.success,
    height: '100%',
  },
  scanning: {
    backgroundColor: theme.colors.surface,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.danger,
    height: '100%',
  },
});
