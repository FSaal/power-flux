import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  isConnected: boolean;
  onPress: () => void;
}

export const RecordButton = ({ isRecording, isConnected, onPress }: RecordButtonProps) => {
  return (
    <TouchableOpacity
      style={[styles.button, !isConnected && styles.disabled, isRecording && styles.recording]}
      onPress={onPress}
      disabled={!isConnected}
    >
      <MaterialCommunityIcons
        name={isRecording ? 'stop-circle' : 'record-circle'}
        size={32}
        color={theme.colors.text}
      />
      <Text style={styles.text}>{isRecording ? 'Stop' : 'Record'}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 8,
    width: '100%',
    maxWidth: 300,
  },
  recording: {
    backgroundColor: theme.colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
});
