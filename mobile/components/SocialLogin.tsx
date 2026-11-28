import React, { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import { api } from '../src/api';
import { saveOrigin } from '../src/social';
import { Button, Notice } from './UI';
import { useAction } from './Learning';

type Provider = 'google' | 'facebook';
type Flow = { id: string; proof: string; url: string };
export function SocialLogin() {
  const action = useAction();
  const [providers, setProviders] = useState<Provider[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    api<Provider[]>('/auth/social/providers', { signal: controller.signal }).then(setProviders).catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!providers.length) return null;
  return <View style={{ marginTop: 18, gap: 10 }}>
    {providers.map(network => <Button key={network} label={network === 'google' ? 'Tiếp tục với Google' : 'Tiếp tục với Facebook'}
      disabled={action.busy} secondary onPress={() => void action.run(async () => {
        const platform = Platform.OS === 'web' ? 'web' : 'native';
        const flow = await api<Flow>('/auth/social/start', { method: 'POST', body: { network, platform } });
        await saveOrigin({ id: flow.id, proof: flow.proof });
        if (platform === 'web') window.location.assign(flow.url);
        else await Linking.openURL(flow.url);
      })} />)}
    <Notice message={action.error} />
  </View>;
}
