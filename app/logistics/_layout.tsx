import { Stack } from 'expo-router';

export default function LogisticsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="incidents" />
      <Stack.Screen name="incident/[id]" />
      <Stack.Screen name="deliveries" />
      <Stack.Screen name="couriers" />
      <Stack.Screen name="stats" />
    </Stack>
  );
}
