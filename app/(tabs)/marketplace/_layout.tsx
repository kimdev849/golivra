import { ChevronLeft } from 'lucide-react-native';
import { Stack, router } from 'expo-router';
import { Pressable } from 'react-native';

import { GOLIVRA_GREEN } from '@/constants/app-palette';
import { LUCIDE_STROKE } from '@/constants/icons';
import { useAppColors } from '@/hooks/use-app-colors';

export default function MarketplaceStackLayout() {
  const colors = useAppColors();

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[enterpriseId]"
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: '',
          headerTintColor: GOLIVRA_GREEN,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Retour">
              <ChevronLeft size={26} color={GOLIVRA_GREEN} strokeWidth={LUCIDE_STROKE} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
