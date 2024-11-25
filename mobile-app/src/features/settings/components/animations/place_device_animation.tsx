import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export const PlaceDeviceAnimation = () => {
  // Animated styles for the device
  const deviceAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(
            withTiming(-40, {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0, {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming(0, { duration: 1000 }),
          ),
          -1,
          true,
        ),
      },
      {
        rotateX: withRepeat(
          withSequence(
            withTiming('45deg', {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming('0deg', {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming('0deg', { duration: 1000 }),
          ),
          -1,
          true,
        ),
      },
      {
        rotateZ: withRepeat(
          withSequence(
            withTiming('10deg', {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming('0deg', {
              duration: 2000,
              easing: Easing.inOut(Easing.ease),
            }),
            withTiming('0deg', { duration: 1000 }),
          ),
          -1,
          true,
        ),
      },
    ],
  }));

  // Animated styles for the shadow/surface indicator
  const shadowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.2, { duration: 2000 }),
        withTiming(0.5, { duration: 2000 }),
        withTiming(0.5, { duration: 1000 }), // Hold position
      ),
      -1,
      true,
    ),
    transform: [
      {
        scaleX: withRepeat(
          withSequence(
            withTiming(0.7, { duration: 2000 }),
            withTiming(1, { duration: 2000 }),
            withTiming(1, { duration: 1000 }), // Hold position
          ),
          -1,
          true,
        ),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.deviceContainer,
          { transform: [{ rotateX: '45deg' }, { rotateZ: '10deg' }] }, // Initial tilt
          deviceAnimatedStyle,
        ]}
      >
        <MaterialCommunityIcons name="cellphone-text" size={48} color="#6544C0" />
      </Animated.View>
      <Animated.View style={[styles.surface, shadowAnimatedStyle]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    perspective: 500,
  },
  deviceContainer: {
    marginBottom: 20,
  },
  surface: {
    position: 'absolute',
    bottom: 20,
    width: 60,
    height: 3,
    backgroundColor: '#6544C0',
    borderRadius: 2,
  },
});
