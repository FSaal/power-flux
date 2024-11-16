// services/database.ts
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

export interface SessionUpdate {
    exerciseType?: string;
    comments?: string;
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

            // Create base tables
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
            console.log('Starting measurement storage for session:', measurement.sessionId);

            // Check if the session exists
            const sessionExists = await this.db!.getFirstAsync<{ count: number }>(
                'SELECT COUNT(*) as count FROM sessions WHERE id = ?',
                [measurement.sessionId]
            );
            console.log('Session exists check:', sessionExists);

            await this.db!.withTransactionAsync(async () => {
                const result = await this.db!.runAsync(
                    `INSERT INTO measurements (accX, accY, accZ, gyrX, gyrY, gyrZ, timestamp, sessionId) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        measurement.accX,
                        measurement.accY,
                        measurement.accZ,
                        measurement.gyrX,
                        measurement.gyrY,
                        measurement.gyrZ,
                        measurement.timestamp,
                        measurement.sessionId
                    ]
                );
                console.log('Insert result:', result);
            });

            // Verify storage
            const count = await this.db!.getFirstAsync<{ count: number }>(
                'SELECT COUNT(*) as count FROM measurements WHERE sessionId = ?',
                [measurement.sessionId]
            );
            console.log(`Total measurements for session ${measurement.sessionId}: `, count);

        } catch (error) {
            console.error('Detailed storage error:', error);
            throw error;
        }
    }

    async updateSession(sessionId: string, updates: SessionUpdate): Promise<void> {
        await this.ensureDbInitialized();
        try {
            const setClause = Object.keys(updates)
                .map(key => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(updates), sessionId];

            await this.db!.runAsync(
                `UPDATE sessions SET ${setClause} WHERE id = ?`,
                values
            );
        } catch (error) {
            console.error('Error updating session:', error);
            throw error;
        }
    }

    async getSessionMeasurements(sessionId: string): Promise<IMeasurement[]> {
        await this.ensureDbInitialized();
        try {
            console.log('Fetching measurements for session:', sessionId);
            const measurements = await this.db!.getAllAsync<IMeasurement>(
                `SELECT * FROM measurements WHERE sessionId = ? ORDER BY timestamp ASC`,
                [sessionId]
            );
            console.log('Found measurements:', measurements.length);
            return measurements;
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

    async deleteSession(sessionId: string): Promise<void> {
        await this.ensureDbInitialized();
        try {
            await this.db!.withTransactionAsync(async () => {
                // Delete measurements first due to foreign key constraint
                await this.db!.runAsync(
                    'DELETE FROM measurements WHERE sessionId = ?',
                    [sessionId]
                );
                // Then delete the session
                await this.db!.runAsync(
                    'DELETE FROM sessions WHERE id = ?',
                    [sessionId]
                );
            });
        } catch (error) {
            console.error('Error deleting session:', error);
            throw error;
        }
    }

    async exportSessionToCSV(sessionId: string): Promise<string> {
        try {
            console.log('Starting CSV export for session:', sessionId);
            const measurements = await this.getSessionMeasurements(sessionId);
            console.log('Retrieved measurements for CSV:', measurements.length);

            // Create CSV header
            let csv = 'timestamp,accX,accY,accZ,gyrX,gyrY,gyrZ\n';

            // Add data rows
            measurements.forEach(measurement => {
                csv += `${measurement.timestamp},${measurement.accX.toFixed(4)},${measurement.accY.toFixed(4)},${measurement.accZ.toFixed(4)},${measurement.gyrX.toFixed(4)},${measurement.gyrY.toFixed(4)},${measurement.gyrZ.toFixed(4)}\n`;
            });

            console.log('CSV generated, first 100 chars:', csv.substring(0, 100));
            return csv;
        } catch (error) {
            console.error('Error in exportSessionToCSV:', error);
            throw error;
        }
    }
}

export const dbService = new DatabaseService();
export type { IMeasurement, ISession };
