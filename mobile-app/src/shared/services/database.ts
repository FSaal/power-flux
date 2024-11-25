import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

interface IMeasurement {
  id?: number;
  accX: number;
  accY: number;
  accZ: number;
  gyrX: number;
  gyrY: number;
  gyrZ: number;
  timestamp: number;
  sessionId: string;
}

interface ISession {
  id: string;
  startTime: number;
  endTime: number | null;
  exerciseType: string | null;
  comments: string | null;
}

interface MeasurementBuffer {
  data: IMeasurement[];
  lastWrite: number;
}

export interface SessionUpdate {
  exerciseType?: string;
  comments?: string;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbInitPromise: Promise<void>;
  private measurementBuffer: MeasurementBuffer = {
    data: [],
    lastWrite: Date.now(),
  };
  private readonly BATCH_SIZE = 50;
  private readonly WRITE_INTERVAL = 1000;

  constructor() {
    if (Platform.OS === 'web') {
      throw new Error('SQLite is not supported on web platform');
    }
    this.dbInitPromise = this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    try {
      this.db = SQLite.openDatabaseSync('powerflux.db');

      await this.db.execAsync(`
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    startTime INTEGER,
                    endTime INTEGER,
                    exerciseType TEXT,
                    comments TEXT
                );
                CREATE TABLE IF NOT EXISTS measurements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    accX REAL NOT NULL,
                    accY REAL NOT NULL,
                    accZ REAL NOT NULL,
                    gyrX REAL NOT NULL,
                    gyrY REAL NOT NULL,
                    gyrZ REAL NOT NULL,
                    timestamp INTEGER NOT NULL,
                    sessionId TEXT,
                    FOREIGN KEY (sessionId) REFERENCES sessions (id)
                );
            `);
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async ensureDbInitialized() {
    await this.dbInitPromise;
    if (!this.db) throw new Error('Database not initialized');
  }

  private async flushBuffer(): Promise<void> {
    if (this.measurementBuffer.data.length === 0) return;

    const measurements = [...this.measurementBuffer.data];
    this.measurementBuffer.data = [];
    this.measurementBuffer.lastWrite = Date.now();

    try {
      // Execute without transaction wrapper since it might be called within another transaction
      const placeholders = measurements.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');

      const values = measurements.flatMap((m) => [
        m.accX,
        m.accY,
        m.accZ,
        m.gyrX,
        m.gyrY,
        m.gyrZ,
        m.timestamp,
        m.sessionId,
      ]);

      await this.db!.runAsync(
        `INSERT INTO measurements 
             (accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp, sessionId)
             VALUES ${placeholders}`,
        values,
      );
    } catch (error) {
      console.error('Batch insert error:', error);
      throw error;
    }
  }

  async startSession(): Promise<string> {
    await this.ensureDbInitialized();
    const sessionId = new Date().toISOString();
    const startTime = Date.now();

    try {
      await this.db!.withTransactionAsync(async () => {
        await this.db!.runAsync(
          `INSERT INTO sessions (id, startTime, endTime) VALUES (?, ?, NULL)`,
          [sessionId, startTime],
        );
      });
      return sessionId;
    } catch (error) {
      console.error('Error starting session:', error);
      throw error;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    await this.ensureDbInitialized();

    try {
      // First flush any remaining measurements
      if (this.measurementBuffer.data.length > 0) {
        await this.flushBuffer();
      }

      // Then update session end time
      const endTime = Date.now();
      await this.db!.runAsync(`UPDATE sessions SET endTime = ? WHERE id = ?`, [endTime, sessionId]);
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }

  async storeMeasurement(measurement: IMeasurement): Promise<void> {
    await this.ensureDbInitialized();
    this.measurementBuffer.data.push(measurement);

    const shouldWrite =
      this.measurementBuffer.data.length >= this.BATCH_SIZE ||
      Date.now() - this.measurementBuffer.lastWrite > this.WRITE_INTERVAL;

    if (shouldWrite) {
      await this.flushBuffer();
    }
  }

  async updateSession(sessionId: string, updates: SessionUpdate): Promise<void> {
    await this.ensureDbInitialized();
    try {
      const setClause = Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(', ');
      const values = [...Object.values(updates), sessionId];

      await this.db!.runAsync(`UPDATE sessions SET ${setClause} WHERE id = ?`, values);
    } catch (error) {
      console.error('Error updating session:', error);
      throw error;
    }
  }

  async getSessionMetaData(sessionId: string): Promise<ISession | null> {
    await this.ensureDbInitialized();
    try {
      return await this.db!.getFirstAsync<ISession>('SELECT * FROM sessions WHERE id = ?', [
        sessionId,
      ]);
    } catch (error) {
      console.error('Error getting session metadata:', error);
      throw error;
    }
  }

  async getSessionMeasurements(sessionId: string): Promise<IMeasurement[]> {
    await this.ensureDbInitialized();
    try {
      return await this.db!.getAllAsync<IMeasurement>(
        `SELECT * FROM measurements WHERE sessionId = ? ORDER BY timestamp ASC`,
        [sessionId],
      );
    } catch (error) {
      console.error('Error getting measurements:', error);
      throw error;
    }
  }

  async getSessions(): Promise<ISession[]> {
    await this.ensureDbInitialized();
    try {
      return await this.db!.getAllAsync<ISession>('SELECT * FROM sessions ORDER BY startTime DESC');
    } catch (error) {
      console.error('Error getting sessions:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureDbInitialized();
    try {
      await this.db!.withTransactionAsync(async () => {
        await this.db!.runAsync('DELETE FROM measurements WHERE sessionId = ?', [sessionId]);
        await this.db!.runAsync('DELETE FROM sessions WHERE id = ?', [sessionId]);
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  async exportSessionToJSON(sessionId: string): Promise<string> {
    try {
      const [metadata, measurements] = await Promise.all([
        this.getSessionMetaData(sessionId),
        this.getSessionMeasurements(sessionId),
      ]);

      const exportData = {
        metadata,
        measurements: measurements.map((measurement) => ({
          timestamp: measurement.timestamp,
          acc: [measurement.accX, measurement.accY, measurement.accZ],
          gyro: [measurement.gyrX, measurement.gyrY, measurement.gyrZ],
        })),
      };
      return JSON.stringify(exportData);
    } catch (error) {
      console.error('Error in exportSessionToJSON:', error);
      throw error;
    }
  }
}

export const dbService = new DatabaseService();
export type { IMeasurement, ISession };
