import { Hand } from 'lucide-react-native';
import Animated, { FadeIn, RotateInDownLeft } from 'react-native-reanimated';

export function HelloWave() {
  return (
    <Animated.View
      entering={RotateInDownLeft.duration(400)}
      style={{ marginTop: -2 }}>
      <Hand size={28} color="#0B6B45" />
    </Animated.View>
  );
}
