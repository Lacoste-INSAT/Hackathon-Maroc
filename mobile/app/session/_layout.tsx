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
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Active Session',
          headerBackVisible: false, // Prevent swiping back out of the session accidentally
          gestureEnabled: false,
        }} 
      />
    </Stack>
  );
}
