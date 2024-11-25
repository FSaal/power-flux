import { Canvas, useFrame } from '@react-three/fiber/native';
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Group, Quaternion, Vector3 } from 'three';
import { useBLE } from '../../shared/services/ble_context';

const M5Device = () => {
    const meshRef = useRef<Group>(null);
    const { sensorData } = useBLE();
    const orientation = useRef(new Quaternion());
    const gyroIntegration = useRef(new Quaternion());

    useFrame((state, delta) => {
        if (sensorData && meshRef.current) {
            const { accX, accY, accZ, gyrX, gyrY, gyrZ } = sensorData;

            // Accelerometer orientation
            const accelVector = new Vector3(accX, accY, accZ).normalize();
            const accelQuaternion = new Quaternion().setFromUnitVectors(
                new Vector3(0, 0, 1),
                accelVector
            );

            // Integrate gyroscope data with more strict thresholding
            const gyroVector = new Vector3(gyrX, gyrY, gyrZ);
            const gyroMagnitude = gyroVector.length() * delta;

            // Only integrate gyro if magnitude is significant but not too large
            if (gyroMagnitude > 0.01 && gyroMagnitude < 1.0) {
                const gyroQuaternion = new Quaternion().setFromAxisAngle(
                    gyroVector.normalize(),
                    gyroMagnitude
                );
                gyroIntegration.current.multiply(gyroQuaternion);
                gyroIntegration.current.normalize();
            }

            // Rely more on accelerometer due to gyro drift
            const alpha = 0.7; // Lower value = more accelerometer influence
            orientation.current.slerpQuaternions(
                accelQuaternion,
                gyroIntegration.current,
                alpha
            );

            // Reset gyro integration periodically to prevent drift
            if (Math.random() < 0.01) { // Reset roughly every 100 frames
                gyroIntegration.current.copy(accelQuaternion);
            }

            meshRef.current.quaternion.copy(orientation.current);
        }
    });

    return (
        <group ref={meshRef}>
            {/* Main body */}
            <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 2, 0.4]} />
                <meshStandardMaterial
                    color="#4f4f4f"  // Lighter color for better visibility
                    roughness={0.4}
                    metalness={0.6}
                />
            </mesh>

            {/* Screen */}
            <mesh position={[0, 0, 0.21]} receiveShadow>
                <boxGeometry args={[0.8, 1.6, 0.01]} />
                <meshStandardMaterial
                    color="#1f2937"  // Lighter screen color
                    roughness={0.2}
                    metalness={0.8}
                    emissive="#4f5d75"
                    emissiveIntensity={0.5}
                />
            </mesh>
        </group>
    );
};

const DeviceVisualization = () => {
    return (
        <View style={styles.container}>
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                {/* Main key light - brighter and repositioned */}
                <directionalLight
                    position={[5, 5, 5]}
                    intensity={5.5}  // Increased intensity
                    castShadow
                />

                {/* Fill light from front */}
                <directionalLight
                    position={[0, 0, 5]}
                    intensity={1.5}
                />

                {/* Fill light from back */}
                <directionalLight
                    position={[-5, 3, -5]}
                    intensity={1.0}
                />

                {/* Brighter ambient light */}
                <ambientLight intensity={0.8} />

                <color attach="background" args={['#111827']} />

                <M5Device />
            </Canvas>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827'
    }
});

export default DeviceVisualization;