import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function SessionLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen 
        name="new" 
        options={{ 
          title: 'Start Session',
          headerBackTitle: 'Cancel',
        }} 
      />
    </Stack>
  );
}
