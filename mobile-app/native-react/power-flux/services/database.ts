// services/database.ts
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

interface IMeasurement {
    id?: number;
    magnitude: number;
    timestamp: number;
    sessionId: string;
}

interface ISession {
    id: string;
    startTime: number;
    endTime: number | null;
}

class DatabaseService {
    private db: SQLite.SQLiteDatabase | null = null;
    private dbInitPromise: Promise<void>;

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
                    endTime INTEGER
                );
                CREATE TABLE IF NOT EXISTS measurements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    magnitude REAL NOT NULL,
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

    async startSession(): Promise<string> {
        await this.ensureDbInitialized();
        const sessionId = new Date().toISOString();
        const startTime = Date.now();

        try {
            await this.db!.withTransactionAsync(async () => {
                await this.db!.runAsync(
                    `INSERT INTO sessions (id, startTime, endTime) VALUES (?, ?, NULL)`,
                    [sessionId, startTime]
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
        const endTime = Date.now();
        try {
            await this.db!.withTransactionAsync(async () => {
                await this.db!.runAsync(
                    `UPDATE sessions SET endTime = ? WHERE id = ?`,
                    [endTime, sessionId]
                );
            });
        } catch (error) {
            console.error('Error ending session:', error);
            throw error;
        }
    }

    async storeMeasurement(measurement: IMeasurement): Promise<void> {
        await this.ensureDbInitialized();
        try {
            await this.db!.withTransactionAsync(async () => {
                await this.db!.runAsync(
                    `INSERT INTO measurements (magnitude, timestamp, sessionId) 
                     VALUES (?, ?, ?)`,
                    [measurement.magnitude, measurement.timestamp, measurement.sessionId]
                );
            });
        } catch (error) {
            console.error('Error storing measurement:', error);
            throw error;
        }
    }

    async getSessionMeasurements(sessionId: string): Promise<IMeasurement[]> {
        await this.ensureDbInitialized();
        try {
            return await this.db!.getAllAsync<IMeasurement>(
                `SELECT * FROM measurements WHERE sessionId = ? ORDER BY timestamp ASC`,
                [sessionId]
            );
        } catch (error) {
            console.error('Error getting measurements:', error);
            throw error;
        }
    }

    async getSessions(): Promise<ISession[]> {
        await this.ensureDbInitialized();
        try {
            return await this.db!.getAllAsync<ISession>(
                'SELECT * FROM sessions ORDER BY startTime DESC'
            );
        } catch (error) {
            console.error('Error getting sessions:', error);
            throw error;
        }
    }

    async exportSessionToCSV(sessionId: string): Promise<string> {
        const measurements = await this.getSessionMeasurements(sessionId);
        let csv = 'timestamp,magnitude\n';
        measurements.forEach(measurement => {
            csv += `${measurement.timestamp},${measurement.magnitude}\n`;
        });
        return csv;
    }
}

export const dbService = new DatabaseService();
export type { IMeasurement, ISession };
