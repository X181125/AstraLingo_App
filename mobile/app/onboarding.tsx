import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button } from '../components/UI';
import { ActionNotice, Choices, Copy, LearningScreen, Panel, Section, useAction } from '../components/Learning';
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
  const [step, setStep] = useState(0);
  const [nativeLang, setNativeLang] = useState('vi');
  const [goal, setGoal] = useState<typeof goals[number]>('study');
  const [level, setLevel] = useState('A1');
  const [ageGroup, setAgeGroup] = useState<typeof ages[number]>('18-24');
  const [dailyMinutes, setMinutes] = useState<typeof minutes[number]>(10);
  const [referral, setReferral] = useState<typeof referrals[number]>('other');
  const steps = [
    { title: 'Bạn thường dùng ngôn ngữ nào?', options: <Choices values={languages} value={nativeLang} label={item => languageName[item]} onChange={setNativeLang} /> },
    { title: 'Bạn muốn học tiếng Anh để làm gì?', options: <Choices values={goals} value={goal} label={item => goalName[item]} onChange={setGoal} /> },
    { title: 'Trình độ tiếng Anh của bạn?', options: <Choices values={levels} value={level} onChange={setLevel} /> },
    { title: 'Bạn thuộc nhóm tuổi nào?', options: <Choices values={ages} value={ageGroup} label={item => item === 'under18' ? 'Dưới 18' : item} onChange={setAgeGroup} /> },
    { title: 'Bạn muốn học bao lâu mỗi ngày?', options: <Choices values={minutes} value={dailyMinutes} label={item => `${item} phút`} onChange={setMinutes} /> },
    { title: 'Bạn biết đến AstraLingo từ đâu?', options: <Choices values={referrals} value={referral} label={item => referralName[item]} onChange={setReferral} /> },
    { title: 'Lộ trình tiếng Anh của bạn', options: <Panel><Copy>{languageName[nativeLang]} · Tiếng Anh {level}</Copy>
      <Copy>{goalName[goal]} · {dailyMinutes} phút mỗi ngày</Copy><Copy>Bạn có thể khám phá các bài luyện theo bốn kỹ năng trong Study.</Copy></Panel> },
  ];
  return <LearningScreen title={step === 7 ? 'Sẵn sàng học tiếng Anh!' : 'Thiết lập tài khoản'} subtitle={step < 7 ? `Bước ${step + 1} / 7` : undefined}>
    {step === 7
      ? <><Copy>Thông tin đã được lưu vào hồ sơ của bạn.</Copy><Button label="Vào trang chủ" onPress={() => router.replace('/(tabs)/home')} /></>
      : <><Section title={steps[step].title}>{steps[step].options}</Section>
        <ActionNotice action={action} />
        <Button label={step < 6 ? 'Tiếp tục' : 'Hoàn tất thiết lập'} loading={action.busy} onPress={() => {
          if (step < 6) { setStep(index => index + 1); return; }
          void action.run(async () => {
            const user = await api<User>('/account/onboarding', { token: auth.token, method: 'PUT',
              body: { nativeLang, level, preferences: { goal, ageGroup, dailyMinutes, referral, appearance: auth.user?.preferences?.appearance ?? 'light' } } });
            auth.updateUser(user);
            setStep(7);
          });
        }} />
        {step > 0 && <Button label="Quay lại bước trước" secondary disabled={action.busy} onPress={() => setStep(index => index - 1)} />}
        <Button label="Để sau" secondary disabled={action.busy} onPress={() => router.replace('/(tabs)/home')} />
      </>}
  </LearningScreen>;
}
