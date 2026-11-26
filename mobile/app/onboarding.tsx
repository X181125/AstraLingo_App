import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/typography';
import React, { useState } from 'react';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/UI';
import {
  ActionNotice,
  Choices,
  Copy,
  LearningScreen,
  Panel,
  Section,
  useAction,
} from '../components/Learning';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { languageName, languages, levels } from '../src/learning';
import type { User } from '../src/types';

const goals = ['study', 'work', 'travel', 'daily'] as const;
const ages = ['under18', '18-24', '25-34', '35+'] as const;
const minutes = [5, 10, 15, 20, 30] as const;
const referrals = ['friends', 'school', 'internet', 'other'] as const;
const goalName = { study: 'Học tập', work: 'Công việc', travel: 'Du lịch', daily: 'Giao tiếp hằng ngày' };
const referralName = { friends: 'Bạn bè', school: 'Trường học', internet: 'Internet', other: 'Khác' };

export default function Onboarding() {
  const auth = useAuth();
  const action = useAction();
  const { page } = useLocalSearchParams<{ page?: string }>();
  const [step, setStep] = useState(page === 'done' ? 7 : page && /^[1-7]$/.test(page) ? Number(page) - 1 : 0);
  const [nativeLang] = useState(auth.user?.nativeLang ?? 'vi');
  const [goal, setGoal] = useState<(typeof goals)[number]>('study');
  const [level, setLevel] = useState(auth.user?.level ?? 'A1');
  const [ageGroup, setAgeGroup] = useState<(typeof ages)[number]>('18-24');
  const [dailyMinutes, setMinutes] = useState<(typeof minutes)[number]>(10);
  const [referral, setReferral] = useState<(typeof referrals)[number]>('other');
  const steps = [
    {
      title: 'Your learning language',
      options: (
        <Panel>
          <Copy>English ✓</Copy>
        </Panel>
      ),
    },
    {
      title: 'Bạn muốn học tiếng Anh để làm gì?',
      options: (
        <SetupOptions values={goals} value={goal} label={(item) => goalName[item]} onChange={setGoal} />
      ),
    },
    {
      title: 'Trình độ tiếng Anh của bạn?',
      options: <SetupOptions values={levels} value={level} onChange={setLevel} />,
    },
    {
      title: 'Bạn thuộc nhóm tuổi nào?',
      options: (
        <SetupOptions
          values={ages}
          value={ageGroup}
          label={(item) => (item === 'under18' ? 'Dưới 18' : item)}
          onChange={setAgeGroup}
        />
      ),
    },
    {
      title: 'Bạn muốn học bao lâu mỗi ngày?',
      options: (
        <SetupOptions
          values={minutes}
          value={dailyMinutes}
          label={(item) => `${item} phút`}
          onChange={setMinutes}
        />
      ),
    },
    {
      title: 'Bạn biết đến AstraLingo từ đâu?',
      options: (
        <SetupOptions
          values={referrals}
          value={referral}
          label={(item) => referralName[item]}
          onChange={setReferral}
        />
      ),
    },
    {
      title: 'Lộ trình tiếng Anh của bạn',
      options: (
        <Panel>
          <Copy>
            {languageName[nativeLang]} · Tiếng Anh {level}
          </Copy>
          <Copy>
            {goalName[goal]} · {dailyMinutes} phút mỗi ngày
          </Copy>
          <Copy>Bạn có thể khám phá các bài luyện theo bốn kỹ năng trong Study.</Copy>
        </Panel>
      ),
    },
  ];
  if (auth.loading) return null;
  if (!auth.user) return <Redirect href="/login" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#272645' }}>
      <View
        style={{
          paddingHorizontal: 18,
          height: 82,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại bước trước"
          onPress={() => (step > 0 ? setStep(step - 1) : router.replace('/home'))}
          style={{ padding: 8 }}
        >
          <Ionicons name="chevron-back" color="white" size={23} />
        </Pressable>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>
          {step < 7 ? `Complete ${step + 1}/7` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Để sau"
          onPress={() => router.replace('/home')}
          style={{ padding: 8 }}
        >
          <Text style={{ color: 'white' }}>Skip</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
            padding: 24,
            gap: 20,
          }}
        >
          {step === 7 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <Ionicons name="ribbon" size={120} color="#00AD9C" />
              <Text style={{ fontSize: 26, fontWeight: '700', color: '#202244' }}>Congratulations</Text>
              <Copy>Your English learning profile is ready.</Copy>
            </View>
          ) : (
            <>
              <Text
                accessibilityRole="header"
                style={{ fontSize: 23, fontWeight: '600', color: '#202244', textAlign: 'center' }}
              >
                {steps[step].title}
              </Text>
              {steps[step].options}
            </>
          )}
          <ActionNotice action={action} />
        </ScrollView>
        <View
          style={{
            paddingHorizontal: 24,
            paddingVertical: 14,
            width: '100%',
            maxWidth: 560,
            alignSelf: 'center',
          }}
        >
          {step === 7 ? (
            <Button label="Vào trang chủ" onPress={() => router.replace('/home')} />
          ) : (
            <Button
              label={step < 6 ? 'Tiếp tục' : 'Hoàn tất thiết lập'}
              loading={action.busy}
              onPress={() => {
                if (step < 6) {
                  setStep((index) => index + 1);
                  return;
                }
                void action.run(async () => {
                  const user = await api<User>('/account/onboarding', {
                    token: auth.token,
                    method: 'PUT',
                    body: {
                      nativeLang,
                      level,
                      preferences: {
                        goal,
                        ageGroup,
                        dailyMinutes,
                        referral,
                        appearance: auth.user?.preferences?.appearance ?? 'light',
                      },
                    },
                  });
                  auth.updateUser(user);
                  setStep(7);
                });
              }}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function SetupOptions<T extends string | number>({
  values,
  value,
  label,
  onChange,
}: {
  values: readonly T[];
  value: T;
  label?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {values.map((v) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: v === value }}
          key={v}
          onPress={() => onChange(v)}
          style={{
            padding: 16,
            flexDirection: 'row',
            gap: 14,
            alignItems: 'center',
            borderRadius: 14,
            backgroundColor: v === value ? '#2259A6' : '#F2F4F5',
          }}
        >
          <Ionicons
            name={v === value ? 'checkmark-circle' : 'ellipse-outline'}
            color={v === value ? 'white' : '#657583'}
            size={21}
          />
          <Text style={{ fontSize: 16, color: v === value ? 'white' : '#202244', fontWeight: '500' }}>
            {label ? label(v) : v}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
