export type CalibrationStatus = 'idle' | 'in_progress' | 'completed' | 'failed';

export enum DeviceCalibrationState {
  IDLE = 0,
  QUICK_STATIC_FLAT = 1,
  QUICK_WAITING_ROTATION = 2,
  QUICK_STABILIZING = 3,
  QUICK_STATIC_SIDE = 4,
  QUICK_COMPLETE = 5,
  FAILED = 6,
}

export interface CalibrationState {
  isCalibrating: boolean;
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  error?: string;
  deviceState: DeviceCalibrationState;
}
