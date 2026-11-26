import React, { useEffect, useRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthShell, Button, Notice } from '../components/UI';
import { useAction } from '../components/Learning';
import { useAuth } from '../src/auth';
import { readOrigin, removeOrigin } from '../src/social';

export default function SocialReturn() {
  const { ticket } = useLocalSearchParams<{ ticket?: string }>();
  const auth = useAuth();
  const action = useAction();
  const started = useRef(false);
  useEffect(() => {
    if (auth.loading || started.current) return;
    started.current = true;
    void action.run(async () => {
      const origin = await readOrigin();
      if (!origin || typeof ticket !== 'string') throw new Error('Hãy bắt đầu đăng nhập lại từ AstraLingo.');
      const user = await auth.finishSocial(origin.id, origin.proof, ticket);
      await removeOrigin().catch(() => undefined);
      router.replace(user.onboardedAt ? '/(tabs)/home' : '/onboarding');
    });
  }, [ticket, auth.loading]);
  return <AuthShell title="Đăng nhập AstraLingo" subtitle={action.error ? 'Phiên xác thực chưa hoàn tất.' : 'Đang xác thực tài khoản…'}>
    <Notice message={action.error} />
    {action.error && <Button label="Về đăng nhập" onPress={() => router.replace('/login')} />}
  </AuthShell>;
}
