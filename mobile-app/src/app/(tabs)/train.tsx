import { useBLE } from '@/shared/services/ble_context';
import { OrientationFilter } from '@/shared/utils/orientation_filter';
import { Canvas } from '@react-three/fiber/native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Group } from 'three';

// M5Device model component
const M5Device = () => {
  const meshRef = useRef<Group>(null);
  const { sensorData } = useBLE();
  const [orientationFilter] = useState(() => new OrientationFilter());

  useEffect(() => {
    if (sensorData && sensorData.accX !== undefined && sensorData.gyrX !== undefined) {
      const orientation = orientationFilter.update(
        { x: sensorData.accX, y: sensorData.accY, z: sensorData.accZ },
        { x: sensorData.gyrX, y: sensorData.gyrY, z: sensorData.gyrZ },
        sensorData.timestamp,
      );

      if (meshRef.current) {
        meshRef.current.rotation.x = orientation.x;
        meshRef.current.rotation.y = orientation.y;
        meshRef.current.rotation.z = orientation.z;
      }
    }
  }, [sensorData]);

  return (
    <group ref={meshRef}>
      {/* Main body */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[2, 4, 0.8]} />
        <meshPhongMaterial color="#FDB900" shininess={30} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0.5, 0.41]} receiveShadow>
        <boxGeometry args={[1.6, 2.4, 0.02]} />
        <meshPhongMaterial color="#000000" shininess={50} />
      </mesh>

      {/* M5 Logo area */}
      <mesh position={[0, -1.5, 0.41]}>
        <boxGeometry args={[1.2, 0.6, 0.02]} />
        <meshPhongMaterial color="#E5A700" shininess={20} />
      </mesh>

      {/* Side button */}
      <mesh position={[1.1, 1, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshPhongMaterial color="#1a1a1a" shininess={40} />
      </mesh>

      {/* USB-C Port */}
      <mesh position={[0, -2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.2]} />
        <meshPhongMaterial color="#111111" shininess={60} />
      </mesh>
    </group>
  );
};

const DeviceVisualization = () => {
  return (
    <View style={styles.container}>
      <Canvas camera={{ position: [0, 0, 10], fov: 45 }} style={styles.canvas}>
        {/* Main light */}
        <directionalLight position={[5, 5, 5]} intensity={1.5} />
        {/* Fill light */}
        <directionalLight position={[-5, 3, 2]} intensity={0.5} />
        {/* Ambient light */}
        <ambientLight intensity={0.4} />

        <M5Device />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  canvas: {
    flex: 1,
  },
});

export default DeviceVisualization;
