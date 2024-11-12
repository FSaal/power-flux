import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

interface MetricCardProps {
    label: string;
    value: number;
    unit: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, unit }) => (
    <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>
            {value.toFixed(2)} <Text style={styles.metricUnit}>{unit}</Text>
        </Text>
    </View>
);

const ConnectionStatus: React.FC = () => (
    <View style={styles.connectionContainer}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Device Connected</Text>
    </View>
);

const AccelerationGraph: React.FC = () => {
    const [data, setData] = useState({
        labels: ['', '', '', '', '', '', '', '', '', ''],  // 10 empty labels for cleaner look
        datasets: [{
            data: Array(10).fill(0)
        }]
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setData(prevData => {
                const newData = [...prevData.datasets[0].data.slice(1)];
                newData.push(2 * Math.sin(Date.now() / 1000));
                return {
                    labels: prevData.labels,
                    datasets: [{
                        data: newData
                    }]
                };
            });
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
        <View style={styles.graphContainer}>
            <Text style={styles.graphTitle}>ACCELERATION</Text>
            <LineChart
                data={data}
                width={Dimensions.get('window').width - 32} // full width minus padding
                height={180}
                chartConfig={{
                    backgroundColor: '#1F2937',
                    backgroundGradientFrom: '#1F2937',
                    backgroundGradientTo: '#1F2937',
                    decimalPlaces: 1,
                    color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`, // Cyan color
                    labelColor: (opacity = 1) => `rgba(156, 163, 175, ${opacity})`,
                    style: {
                        borderRadius: 16
                    },
                    propsForDots: {
                        r: '0',  // Remove dots
                    }
                }}
                bezier  // Smooth curve
                withDots={false}
                style={{
                    marginVertical: 8,
                    borderRadius: 16
                }}
            />
        </View>
    );
};

const LiveScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <ConnectionStatus />
            <View style={styles.metricsContainer}>
                <MetricCard
                    label="VELOCITY"
                    value={0.82}
                    unit="m/s"
                />
                <MetricCard
                    label="ACCELERATION"
                    value={2.1}
                    unit="m/s²"
                />
            </View>
            <AccelerationGraph />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111827',
        padding: 16,
    },
    connectionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    statusDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#22C55E',
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    metricsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    metricCard: {
        flex: 1,
        backgroundColor: '#1F2937',
        padding: 16,
        borderRadius: 8,
    },
    metricLabel: {
        color: '#9CA3AF',
        fontSize: 14,
        marginBottom: 4,
    },
    metricValue: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    metricUnit: {
        color: '#9CA3AF',
        fontSize: 18,
    },
    graphContainer: {
        backgroundColor: '#1F2937',
        padding: 16,
        borderRadius: 8,
        marginTop: 16,
    },
    graphTitle: {
        color: '#9CA3AF',
        fontSize: 14,
        marginBottom: 16,
    },
});

export default LiveScreen;