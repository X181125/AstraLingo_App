import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Brand } from '@/components/UI';
export default function Modal() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 }}>
      <Brand />
      <Button label="Go to Home" onPress={() => router.replace('/home')} />
    </View>
  );
}
