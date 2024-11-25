export type CalibrationModalType = 'quick' | 'full';

export type CalibrationStatus = 'idle' | 'in_progress' | 'completed' | 'failed';

export interface CalibrationState {
  isCalibrating: boolean;
  status: CalibrationStatus;
  type: CalibrationModalType | 'none';
  progress: number;
  error?: string;
}
