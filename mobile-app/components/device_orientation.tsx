import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

interface DeviceOrientationProps {
    position: 'z_up' | 'z_down' | 'y_up' | 'y_down' | 'x_up' | 'x_down';
    currentRotation: {
        x: number;
        y: number;
        z: number;
    };
    isCorrectPosition: boolean;
}

export const DeviceOrientation: React.FC<DeviceOrientationProps> = ({
    position,
    currentRotation,
    isCorrectPosition,
}) => {
    // Get rotation and color based on position
    const getTransformAndColor = () => {
        const baseColor = isCorrectPosition ? '#22C55E' : '#6544C0';

        switch (position) {
            case 'z_up':
                return { rotation: 0, color: baseColor };
            case 'z_down':
                return { rotation: 180, color: baseColor };
            case 'y_up':
                return { rotation: 90, color: baseColor };
            case 'y_down':
                return { rotation: -90, color: baseColor };
            case 'x_up':
                return { rotation: 90, color: baseColor };
            case 'x_down':
                return { rotation: -90, color: baseColor };
        }
    };

    const { rotation, color } = getTransformAndColor();

    return (
        <View style={styles.container}>
            <Svg viewBox="0 0 200 200" width={200} height={200}>
                {/* Device body */}
                <Rect
                    x={60} y={40}
                    width={80} height={120}
                    fill={color}
                    stroke="#000"
                    strokeWidth={2}
                    transform={`rotate(${rotation} 100 100)`}
                />
                {/* Screen */}
                <Rect
                    x={70} y={50}
                    width={60} height={80}
                    fill="#333"
                    transform={`rotate(${rotation} 100 100)`}
                />
                {/* Button */}
                <Circle
                    cx={100} cy={140}
                    r={5}
                    fill="#666"
                    transform={`rotate(${rotation} 100 100)`}
                />
                {/* USB Port */}
                <Rect
                    x={90} y={155}
                    width={20} height={5}
                    fill="#666"
                    transform={`rotate(${rotation} 100 100)`}
                />

                {/* Current rotation values */}
                <SvgText x="10" y="190" fill="#666" fontSize="12">
                    {`X: ${currentRotation.x.toFixed(1)}° Y: ${currentRotation.y.toFixed(1)}° Z: ${currentRotation.z.toFixed(1)}°`}
                </SvgText>
            </Svg>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
});