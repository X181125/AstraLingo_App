import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../components/UI';
import {
  ActionNotice,
  Choices,
  Copy,
  Input,
  LearningScreen,
  Section,
  useAction,
} from '../components/Learning';
import { api } from '../src/api';
import { useAuth } from '../src/auth';
import { languageName, languages, levels } from '../src/learning';
import type { User } from '../src/types';

const appearances = ['light', 'dark', 'system'] as const;
const appearanceLabel = { light: 'Sáng', dark: 'Tối', system: 'Theo thiết bị' };

export default function Settings() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const auth = useAuth();
  const update = useAction();
  const remove = useAction();
  const [name, setName] = useState(auth.user?.name ?? '');
  const [nativeLang, setNativeLang] = useState(auth.user?.nativeLang ?? 'vi');
  const [level, setLevel] = useState(auth.user?.level ?? 'A1');
  const [appearance, setAppearance] = useState<(typeof appearances)[number]>(
    auth.user?.preferences?.appearance ?? 'light',
  );
  const [minutes, setMinutes] = useState(auth.user?.preferences?.dailyMinutes ?? 10);
  const [showDelete, setShowDelete] = useState(section === 'delete');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  return (
    <LearningScreen
      title={
        {
          theme: 'Change theme',
          language: 'Learning language',
          delete: 'Delete account',
          support: 'Support center',
          info: 'Personal Information',
        }[section ?? ''] ?? 'Edit Profile'
      }
      back
    >
      {section !== 'delete' && section !== 'support' && (
        <Section title="Thông tin cá nhân">
          {section !== 'theme' && section !== 'language' && (
            <>
              <Input label="Tên hiển thị" value={name} onChangeText={setName} maxLength={60} />
              <Copy>{auth.user?.email}</Copy>
            </>
          )}
          {section !== 'theme' && (
            <>
              <Copy>Ngôn ngữ mẹ đẻ</Copy>
              <Choices
                values={languages}
                value={nativeLang}
                label={(item) => languageName[item]}
                onChange={setNativeLang}
              />
              <Copy>Trình độ tiếng Anh</Copy>
              <Choices values={levels} value={level} onChange={setLevel} />
              <Copy>Thời gian học mỗi ngày</Copy>
              <Choices
                values={[5, 10, 15, 20, 30]}
                value={minutes}
                label={(item) => `${item} phút`}
                onChange={setMinutes}
              />
            </>
          )}
          {section !== 'language' && (
            <>
              <Copy>Giao diện</Copy>
              <Choices
                values={appearances}
                value={appearance}
                label={(item) => appearanceLabel[item]}
                onChange={setAppearance}
              />
            </>
          )}
          <ActionNotice action={update} />
          <Button
            label="Lưu hồ sơ"
            loading={update.busy}
            disabled={name.trim().length < 2 || remove.busy}
            onPress={() =>
              void update.run(async () => {
                const user = await api<User>('/account/profile', {
                  token: auth.token,
                  method: 'PATCH',
                  body: { name, nativeLang, level, appearance, dailyMinutes: minutes },
                });
                auth.updateUser(user);
                update.setSuccess('Đã lưu hồ sơ.');
              })
            }
          />
          <Button label="Thiết lập lại mục tiêu học" secondary onPress={() => router.push('/onboarding')} />
        </Section>
      )}
      {(!section || section === 'support') && (
        <Section title="Hỗ trợ">
          <Copy>Mã đặt lại mật khẩu gửi về email tài khoản khi dịch vụ gửi thư đã được cấu hình.</Copy>
          <Copy>
            Bạn xem bài đã nộp bằng mục Lịch sử trong từng bài luyện. Các thẻ đến hạn xuất hiện trong danh
            sách ôn tập của bộ thẻ.
          </Copy>
        </Section>
      )}
      {(!section || section === 'delete') && (
        <Section title="Xóa tài khoản">
          {!showDelete ? (
            <Button label="Mở xác nhận xóa tài khoản" secondary onPress={() => setShowDelete(true)} />
          ) : (
            <>
              <Copy>Thao tác xóa vĩnh viễn tài khoản, bài đã lưu, bài nộp, bộ thẻ và tiến độ.</Copy>
              <Input
                label="Mật khẩu"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
              />
              <Input label="Nhập XÓA để xác nhận" value={confirmation} onChangeText={setConfirmation} />
              <ActionNotice action={remove} />
              <Button
                label="Xóa tài khoản và dữ liệu"
                loading={remove.busy}
                disabled={!password || confirmation !== 'XÓA' || update.busy}
                onPress={() =>
                  void remove.run(async () => {
                    await api('/account/profile', {
                      token: auth.token,
                      method: 'DELETE',
                      body: { password, confirmation },
                      timeoutMs: 60_000,
                    });
                    await auth.logout();
                    router.replace('/login');
                  })
                }
              />
              <Button
                label="Hủy"
                secondary
                disabled={remove.busy}
                onPress={() => {
                  setShowDelete(false);
                  setPassword('');
                  setConfirmation('');
                }}
              />
            </>
          )}
        </Section>
      )}
    </LearningScreen>
  );
}
