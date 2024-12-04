import { cardStyles, settingStyles } from '@/shared/styles/components';
import { theme } from '@/shared/styles/theme';

export const SettingsCard: React.FC<SettingsCardProps> = ({
  removeGravityEnabled,
  onToggleGravity,
}) => {
  return (
    <View style={styles.container}>
      <Text style={cardStyles.title}>Settings</Text>

      <View style={[cardStyles.container, cardStyles.elevated, cardStyles.basePadding]}>
        <View style={settingStyles.cardHeader}>
          <MaterialCommunityIcons
            name="signal-processing"
            size={20}
            color={theme.colors.textSecondary}
          />
          <Text style={cardStyles.title}>Signal Processing</Text>
        </View>

        <View style={settingStyles.settingRow}>
          <View style={settingStyles.settingInfo}>
            <Text style={settingStyles.settingLabel}>Remove Gravity</Text>
            <Text style={settingStyles.settingDescription}>
              Compensate for gravitational acceleration
            </Text>
          </View>
          <Switch
            value={removeGravityEnabled}
            onValueChange={onToggleGravity}
            trackColor={{ false: theme.colors.surface, true: theme.colors.primary }}
            thumbColor={removeGravityEnabled ? theme.colors.text : theme.colors.textSecondary}
          />
        </View>
      </View>
    </View>
  );
};

// Minimal local styles only for layout specific to this component
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing.md,
    flex: 1,
  },
});
