// app/(tabs)/settings.tsx
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useBLE } from '../../services/BLEContext';

export default function SettingsScreen() {
    const { isConnected, isScanning, startScan, disconnect } = useBLE();

    return (
        <View style={styles.container}>
            {/* Connection Status Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons
                        name={isConnected ? "bluetooth-connect" : "bluetooth-off"}
                        size={24}
                        color={isConnected ? "#22C55E" : "#EF4444"}
                    />
                    <Text style={styles.cardTitle}>Device Connection</Text>
                </View>
                <Text style={styles.statusText}>
                    Status: {isConnected ? "Connected" : isScanning ? "Scanning..." : "Disconnected"}
                </Text>
            </View>

            {/* Connection Controls */}
            <View style={styles.buttonContainer}>
                {isConnected ? (
                    <TouchableOpacity
                        style={[styles.button, styles.disconnectButton]}
                        onPress={disconnect}
                    >
                        <MaterialCommunityIcons
                            name="bluetooth-off"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>Disconnect</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.button, styles.connectButton]}
                        onPress={startScan}
                        disabled={isScanning}
                    >
                        <MaterialCommunityIcons
                            name="bluetooth-settings"
                            size={24}
                            color="white"
                        />
                        <Text style={styles.buttonText}>
                            {isScanning ? "Scanning..." : "Scan for Device"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 16,
        gap: 16,
    },
    card: {
        backgroundColor: '#1F2937',
        borderRadius: 16,
        padding: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    statusText: {
        fontSize: 16,
        color: '#9CA3AF',
    },
    buttonContainer: {
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 8,
    },
    connectButton: {
        backgroundColor: '#22C55E',
    },
    disconnectButton: {
        backgroundColor: '#EF4444',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});