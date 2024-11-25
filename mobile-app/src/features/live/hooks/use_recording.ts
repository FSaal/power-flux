import { dbService } from '@/shared/services/database';
import { SensorData } from '@/shared/types/sensor';
import { useCallback, useRef, useState } from 'react';

export interface RecordingRef {
  isRecording: boolean;
  sessionId: string | null;
}

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [measurementCount, setMeasurementCount] = useState(0);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const recordingRef = useRef<RecordingRef>({
    isRecording: false,
    sessionId: null,
  });

  const handleSensorData = useCallback(async (data: SensorData) => {
    const { isRecording, sessionId } = recordingRef.current;
    if (!isRecording || !sessionId) return;

    try {
      await dbService.storeMeasurement({
        accX: data.accX,
        accY: data.accY,
        accZ: data.accZ,
        gyrX: data.gyrX,
        gyrY: data.gyrY,
        gyrZ: data.gyrZ,
        timestamp: data.timestamp,
        sessionId,
      });
      setMeasurementCount((prev) => prev + 1);
    } catch (error) {
      console.error('Failed to store measurement:', error);
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    try {
      if (!recordingRef.current.isRecording) {
        const startTime = Date.now();
        const sessionId = await dbService.startSession();
        recordingRef.current = { isRecording: true, sessionId };
        setIsRecording(true);
        setRecordingStartTime(startTime);
        setMeasurementCount(0);
      } else if (recordingRef.current.sessionId) {
        await dbService.endSession(recordingRef.current.sessionId);
        recordingRef.current = { isRecording: false, sessionId: null };
        setIsRecording(false);
      }
    } catch (error) {
      console.error('Recording toggle error:', error);
      throw error;
    }
  }, []);

  return {
    isRecording,
    measurementCount,
    recordingStartTime,
    handleSensorData,
    toggleRecording,
  };
};
