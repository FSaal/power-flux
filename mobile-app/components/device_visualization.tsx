import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Rect, Text } from 'react-native-svg';

interface DeviceVisualizationProps {
    rotationState: 'z-up' | 'z-down' | 'y-up' | 'y-down' | 'x-up' | 'x-down';
    isCorrectPosition: boolean;
}

const DeviceVisualization: React.FC<DeviceVisualizationProps> = ({
    rotationState,
    isCorrectPosition,
}) => {
    // Calculate device orientation based on state
    const getTransform = () => {
        switch (rotationState) {
            case 'z-up': return '';
            case 'z-down': return 'rotate(180 150 150)';
            case 'y-up': return 'rotate(90 150 150)';
            case 'y-down': return 'rotate(-90 150 150)';
            case 'x-up': return 'rotate(90 150 150) rotate(90 150 150)';
            case 'x-down': return 'rotate(90 150 150) rotate(-90 150 150)';
            default: return '';
        }
    };

    return (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <Svg width="300" height="300" viewBox="0 0 300 300">
                {/* Device body */}
                <Rect
                    x="100"
                    y="100"
                    width="100"
                    height="150"
                    fill={isCorrectPosition ? '#22C55E' : '#6544C0'}
                    transform={getTransform()}
                />

                {/* Screen */}
                <Rect
                    x="110"
                    y="110"
                    width="80"
                    height="100"
                    fill="#1F2937"
                    transform={getTransform()}
                />

                {/* Buttons */}
                <Circle
                    cx="150"
                    cy="230"
                    r="8"
                    fill="#374151"
                    transform={getTransform()}
                />

                {/* USB Port */}
                <Rect
                    x="135"
                    y="245"
                    width="30"
                    height="5"
                    fill="#374151"
                    transform={getTransform()}
                />

                {/* Orientation indicators */}
                <Line
                    x1="150"
                    y1="40"
                    x2="150"
                    y2="60"
                    stroke="#22C55E"
                    strokeWidth="2"
                />
                <Text
                    x="160"
                    y="50"
                    fill="#FFFFFF"
                    fontSize="12"
                >
                    Up
                </Text>
            </Svg>
        </View>
    );
};

export default DeviceVisualization;