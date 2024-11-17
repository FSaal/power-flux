import { Stack } from 'expo-router';
import { BLEProvider } from '../services/BLEContext';

export default function RootLayout() {
  return (
    <BLEProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </BLEProvider>
  );
}
