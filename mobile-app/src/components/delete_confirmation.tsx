import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// Component that slides up from bottom for delete confirmation
const DeleteConfirmation = ({
  isVisible,
  onConfirm,
  onCancel,
  message = 'Are you sure you want to delete this session?',
}) => {
  // Using shared value for smooth animations
  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0);
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(200);
    }
  }, [isVisible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <TouchableOpacity style={styles.dismissArea} onPress={onCancel} activeOpacity={1} />
      <Animated.View style={[styles.confirmationSheet, sheetStyle]}>
        <View style={styles.handle} />

        <MaterialCommunityIcons name="alert-circle-outline" size={32} color="#EF4444" />

        <Text style={styles.title}>Delete Session</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={onConfirm}>
            <MaterialCommunityIcons name="delete" size={20} color="white" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  dismissArea: {
    flex: 1,
  },
  confirmationSheet: {
    backgroundColor: '#1F2937',
    padding: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: 'center',
    zIndex: 1001,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#6B7280',
    borderRadius: 2,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginVertical: 12,
  },
  message: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#374151',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default DeleteConfirmation;
