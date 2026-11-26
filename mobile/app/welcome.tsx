import { router } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/typography';
import { Artwork } from '@/components/Artwork';
import { Button } from '@/components/UI';
import { colors, heading } from '@/src/theme';
export default function Welcome() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <View style={{ width: '100%', maxWidth: 480, gap: 18 }}>
        <View style={{ alignItems: 'center' }}>
          <Artwork kind="book" size={150} />
        </View>
        <Text style={{ fontFamily: heading, fontSize: 26, textAlign: 'center', color: colors.ink }}>
          Choose a language
        </Text>
        <Button label="English" onPress={() => router.push('/register')} />
        <Button secondary label="Log in" onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}
