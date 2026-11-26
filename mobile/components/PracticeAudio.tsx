import { API_URL } from '../src/api';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import * as Documents from 'expo-document-picker';
import { Button } from './UI';
import { ActionNotice, Choice, Copy, Highlighted, useAction } from './Learning';
import { useAuth } from '../src/auth';
import { getPlayback, readRecording, type Recording } from '../src/audio';
import { duration, type Transcript } from '../src/learning';

export function Recorder({
  onRecorded,
  allowFile = false,
}: {
  onRecorded: (recording: Recording) => void;
  allowFile?: boolean;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const action = useAction();
  const [mic, setMic] = useState(false);
  const [uri, setUri] = useState<string>();
  const player = useAudioPlayer(uri ?? null);
  const playback = useAudioPlayerStatus(player);
  async function stop() {
    await recorder.stop();
    setMic(false);
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (recorder.uri) {
      const recording = await readRecording(recorder.uri);
      setUri(recorder.uri);
      onRecorded(recording);
    }
  }
  useEffect(() => {
    if (!mic) return;
    const timeout = setTimeout(() => void action.run(stop), 90_000);
    return () => clearTimeout(timeout);
  }, [mic]);
  useEffect(
    () => () => {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    },
    [],
  );
  return (
    <View style={{ gap: 10 }}>
      <ActionNotice action={action} />
      {mic ? (
        <>
          <Copy>Đang ghi {duration(state.durationMillis / 1000)} / 1:30</Copy>
          <Button label="Dừng ghi âm" loading={action.busy} onPress={() => void action.run(stop)} />
        </>
      ) : (
        <Button
          label={uri ? 'Ghi lại' : 'Bắt đầu ghi âm'}
          icon="mic-outline"
          loading={action.busy}
          onPress={() =>
            void action.run(async () => {
              const permission = await AudioModule.requestRecordingPermissionsAsync();
              if (!permission.granted)
                throw new Error('Hãy cấp quyền microphone trong cài đặt thiết bị hoặc trình duyệt.');
              if (playback.playing) player.pause();
              await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
              await recorder.prepareToRecordAsync();
              recorder.record();
              setMic(true);
            })
          }
        />
      )}
      {!!uri && !mic && (
        <Button
          secondary
          label={playback.playing ? 'Tạm dừng bản ghi' : 'Nghe bản ghi mới'}
          onPress={() =>
            void action.run(async () => {
              if (playback.playing) {
                player.pause();
                return;
              }
              if (playback.didJustFinish || playback.currentTime >= playback.duration) await player.seekTo(0);
              player.play();
            })
          }
        />
      )}
      {allowFile && !mic && (
        <Button
          secondary
          label="Chọn tệp âm thanh"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const result = await Documents.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
              });
              if (result.canceled) return;
              const file = result.assets[0];
              const extension = file.name.split('.').at(-1)?.toLowerCase();
              const byExtension: Record<string, string> = {
                mp3: 'audio/mpeg',
                m4a: 'audio/mp4',
                wav: 'audio/wav',
                webm: 'audio/webm',
                ogg: 'audio/ogg',
              };
              const mime = extension && byExtension[extension];
              if (!mime) throw new Error('Chọn tệp MP3, M4A, WAV, WebM hoặc OGG.');
              const recording = await readRecording(file.uri, mime);
              setUri(file.uri);
              onRecorded(recording);
            })
          }
        />
      )}
    </View>
  );
}

export function Listen({
  body,
  transcript,
  audioId,
  audioUrl,
  initiallyShown = false,
  highlights = [],
}: {
  initiallyShown?: boolean;
  body?: string;
  transcript?: Transcript[];
  audioId?: string;
  audioUrl?: string;
  highlights?: string[];
}) {
  const { token } = useAuth();
  const source = audioUrl?.startsWith('/api/') ? API_URL.replace(/\/api\/?$/, '') + audioUrl : audioUrl;
  const player = useAudioPlayer(source ?? null);
  const status = useAudioPlayerStatus(player);
  const action = useAction();
  const [shown, setShown] = useState(initiallyShown);
  const [mode, setMode] = useState<'normal' | 'shadow'>('normal');
  const cached = React.useRef<{ id: string; expiresAt?: number; cleanup: () => void } | null>(null);
  const alive = React.useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cached.current?.cleanup();
      cached.current = null;
      void Speech.stop();
    };
  }, []);
  async function play(start?: number) {
    if (audioId || source) {
      if (
        audioId &&
        (cached.current?.id !== audioId || (cached.current.expiresAt ?? Infinity) <= Date.now())
      ) {
        const media = await getPlayback(token, audioId);
        if (!alive.current) {
          media.cleanup();
          return;
        }
        cached.current?.cleanup();
        player.replace(media.uri);
        cached.current = { id: audioId, expiresAt: media.expiresAt, cleanup: media.cleanup };
      } else if (start === undefined && status.playing) {
        player.pause();
        return;
      }
      if (start !== undefined || status.didJustFinish) await player.seekTo(start ?? 0);
      player.setPlaybackRate(mode === 'shadow' ? 0.8 : 1);
      player.play();
      return;
    }
    if (!body) return;
    await Speech.stop();
    const segment = start !== undefined ? transcript?.find((part) => part.second === start)?.text : undefined;
    Speech.speak(segment ?? body, {
      language: 'en-US',
      rate: mode === 'shadow' ? 0.75 : 0.95,
      onError: () => {
        void action.run(async () => {
          throw new Error('Thiết bị không phát được giọng đọc tiếng Anh.');
        });
      },
    });
  }
  return (
    <View style={{ gap: 10 }}>
      <ActionNotice action={action} />
      <Button
        label={status.playing ? 'Tạm dừng' : audioId || source ? 'Phát âm thanh' : 'Nghe giọng đọc mẫu'}
        icon="volume-high-outline"
        loading={action.busy}
        onPress={() => void action.run(() => play())}
      />
      {!audioId && !source && (
        <Button
          label="Dừng đọc"
          secondary
          onPress={() => {
            void Speech.stop();
          }}
        />
      )}
      {body && (
        <>
          <Choice
            label={mode === 'shadow' ? 'Luyện nhại: tốc độ chậm' : 'Bật luyện nhại'}
            selected={mode === 'shadow'}
            onPress={() => setMode((m) => (m === 'shadow' ? 'normal' : 'shadow'))}
          />
          <Button
            label={shown ? 'Ẩn transcript' : 'Xem transcript'}
            secondary
            onPress={() => setShown((current) => !current)}
          />
          {shown &&
            (transcript?.length ? (
              transcript.map((part) => (
                <Choice
                  key={part.second}
                  label={`${duration(part.second)} · ${part.text}`}
                  onPress={() => void action.run(() => play(part.second))}
                >
                  {duration(part.second)} · <Highlighted text={part.text} quotes={highlights} />
                </Choice>
              ))
            ) : (
              <Copy selectable>
                <Highlighted text={body} quotes={highlights} />
              </Copy>
            ))}
        </>
      )}
    </View>
  );
}
