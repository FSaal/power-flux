export interface SensorData {
  accX: number;
  accY: number;
  accZ: number;
  gyrX: number;
  gyrY: number;
  gyrZ: number;
  timestamp: number;
}

export interface ProcessedSensorData extends SensorData {
  magnitude: number;
}
