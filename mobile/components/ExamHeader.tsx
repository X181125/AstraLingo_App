import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { Text } from './typography';

export default function ExamHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lai"
        onPress={onBack}
        style={{ padding: 10 }}
      >
        <Ionicons name="chevron-back" size={22} color="#202244" />
      </Pressable>
      <Text style={{ fontSize: 22, fontWeight: '600', color: '#202244', flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      <View style={{ width: 42 }} />
    </View>
  );
}
