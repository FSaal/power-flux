import React, { useEffect, useState } from 'react';
import { Dimensions, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { useBLE } from '../../services/BLEContext';

interface DataPoint {
    magnitude: number;
    timestamp: number;
}

const AccelerationPlot = () => {
    const { sensorData } = useBLE();
    const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
    const timeWindow = 5000;
    const width = Dimensions.get('window').width - 40;
    const height = 300;
    const padding = 40;
    const plotWidth = width - 2 * padding;
    const plotHeight = height - 2 * padding;

    useEffect(() => {
        if (!sensorData) return;

        const magnitude = Math.sqrt(
            sensorData.accX ** 2 +
            sensorData.accY ** 2 +
            sensorData.accZ ** 2
        );

        setDataPoints(prev => {
            const now = Date.now();
            const newPoints = [...prev, { magnitude, timestamp: now }];
            return newPoints.filter(point => now - point.timestamp <= timeWindow);
        });
    }, [sensorData]);

    const scaleX = (timestamp: number) => {
        const now = Date.now();
        const timeAgo = now - timestamp;
        return padding + plotWidth * (1 - timeAgo / timeWindow);
    };

    const scaleY = (magnitude: number) => {
        const maxMagnitude = 3; // Max acceleration in m/s²
        return height - padding - (magnitude / maxMagnitude) * plotHeight;
    };

    const pathData = dataPoints
        .map((point, index) => {
            const x = scaleX(point.timestamp);
            const y = scaleY(point.magnitude);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');

    const timeLabels = Array.from({ length: 6 }, (_, i) => {
        const seconds = i;
        return (
            <SvgText
                key={seconds}
                x={padding + (plotWidth * (5 - seconds)) / 5}
                y={height - padding + 20}
                fontSize="12"
                fill="#9CA3AF"
                textAnchor="middle"
            >
                {seconds}s
            </SvgText>
        );
    });

    const magnitudeLabels = Array.from({ length: 7 }, (_, i) => {
        const magnitude = i * 0.5;
        return (
            <SvgText
                key={magnitude}
                x={padding - 10}
                y={scaleY(magnitude)}
                fontSize="12"
                fill="#9CA3AF"
                textAnchor="end"
            >
                {magnitude.toFixed(1)}
            </SvgText>
        );
    });

    return (
        <View style={{ padding: 20, backgroundColor: '#111827', flex: 1 }}>
            <Svg width={width} height={height}>
                {/* Grid */}
                <Line
                    x1={padding}
                    y1={height - padding}
                    x2={width - padding}
                    y2={height - padding}
                    stroke="#374151"
                    strokeWidth="1"
                />
                <Line
                    x1={padding}
                    y1={padding}
                    x2={padding}
                    y2={height - padding}
                    stroke="#374151"
                    strokeWidth="1"
                />

                {/* Horizontal grid lines */}
                {Array.from({ length: 6 }, (_, i) => (
                    <Line
                        key={i}
                        x1={padding}
                        y1={scaleY(i * 0.5)}
                        x2={width - padding}
                        y2={scaleY(i * 0.5)}
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray="5,5"
                    />
                ))}

                {/* Vertical grid lines */}
                {Array.from({ length: 5 }, (_, i) => (
                    <Line
                        key={i}
                        x1={padding + (plotWidth * i) / 5}
                        y1={padding}
                        x2={padding + (plotWidth * i) / 5}
                        y2={height - padding}
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray="5,5"
                    />
                ))}

                {/* Data line */}
                <Path
                    d={pathData}
                    stroke="#6544C0"
                    strokeWidth="2"
                    fill="none"
                />

                {timeLabels}
                {magnitudeLabels}
            </Svg>
        </View>
    );
};

export default AccelerationPlot;