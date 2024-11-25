import { cardStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

interface ConnectionCardProps {
  isConnected: boolean;
  isScanning: boolean;
}

export const ConnectionCard = ({ isConnected, isScanning }: ConnectionCardProps) => {
  return (
    <View style={[cardStyles.container, cardStyles.elevated, cardStyles.basePadding]}>
      <View style={cardStyles.header}>
        <MaterialCommunityIcons
          name={isConnected ? 'bluetooth-connect' : 'bluetooth-off'}
          size={24}
          color={isConnected ? theme.colors.success : theme.colors.danger}
        />
        <Text style={[cardStyles.title, { marginLeft: theme.spacing.sm }]}>Device Connection</Text>
      </View>
      <Text style={cardStyles.text}>
        Status: {isConnected ? 'Connected' : isScanning ? 'Scanning...' : 'Disconnected'}
      </Text>
    </View>
  );
};
