import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const buttonStyles = StyleSheet.create({
  // Base button - combines commonly used styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
  },

  // Variants
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.secondary },
  danger: { backgroundColor: theme.colors.danger },
  cancel: { backgroundColor: theme.colors.surface },

  // States
  disabled: { opacity: 0.5 },

  // Typography
  text: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Optional modifiers (for special cases)
  compact: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  fullWidth: { width: '100%' },
  autoWidth: {
    width: 'auto',
  },
});

export const cardStyles = StyleSheet.create({
  // Layout
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Spacing
  basePadding: {
    padding: 16,
    gap: 12,
  },

  // Visual
  elevated: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  // Typography
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  text: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

export const modalStyles = StyleSheet.create({
  // Layout
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    minHeight: 300,
  },
  content: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },

  // Visual Elements
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
  },

  // Typography
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  text: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Progress
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },

  // Button Layouts
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    width: '100%',
  },
  buttonRowItem: {
    flex: 1,
  },
  buttonSingle: {
    width: '100%',
  },
});
