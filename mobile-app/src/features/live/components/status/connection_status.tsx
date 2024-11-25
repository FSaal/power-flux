import { theme } from '@/shared/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

interface ConnectionStatusProps {
  isConnected: boolean;
}

export const ConnectionStatus = ({ isConnected }: ConnectionStatusProps) => {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name={isConnected ? 'bluetooth-connect' : 'bluetooth-off'}
        size={20}
        color={isConnected ? theme.colors.success : theme.colors.danger}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
});
