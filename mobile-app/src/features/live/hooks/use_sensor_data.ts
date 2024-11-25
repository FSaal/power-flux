import { useBLE } from '@/shared/services/ble_context';
import type { SensorData } from '@/shared/types/sensor';
import { useState } from 'react';

export const useSensorData = () => {
  const { sensorData, setOnDataReceived } = useBLE();
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => setShowDetails((prev) => !prev);

  const calculateMagnitude = (data: SensorData) => {
    const { accX, accY, accZ } = data;
    return Math.sqrt(accX * accX + accY * accY + accZ * accZ);
  };

  const magnitude = sensorData ? calculateMagnitude(sensorData) : 0;

  return {
    sensorData,
    magnitude,
    showDetails,
    toggleDetails,
    setOnDataReceived,
  };
};
