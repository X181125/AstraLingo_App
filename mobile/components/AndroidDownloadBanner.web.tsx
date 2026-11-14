import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors as c, heading } from '../src/theme';

const apkUrl = '/downloads/astralingo-release.apk';
const apkType = 'application/vnd.android.package-archive';
const desktopQuery = '(min-width: 900px) and (hover: hover) and (pointer: fine)';

export function AndroidDownloadBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const { userAgent, maxTouchPoints } = window.navigator;
    // iPadOS can identify as macOS when it requests the desktop site.
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ||
        (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return;

    const desktop = window.matchMedia(desktopQuery);
    let request: AbortController | undefined;

    function checkDownload() {
      request?.abort();
      setAvailable(false);
      if (!desktop.matches) return;

      const { signal } = (request = new AbortController());
      void fetch(apkUrl, { method: 'HEAD', cache: 'no-store', redirect: 'error', signal })
        .then(response => {
          const size = response.headers.get('content-length');
          if (!signal.aborted) {
            setAvailable(response.status === 200 && response.headers.get('content-type') === apkType &&
              (size === null || Number(size) > 0));
          }
        })
        .catch(() => { /* Keep the link hidden when the download is unavailable. */ });
    }

    desktop.addEventListener('change', checkDownload);
    checkDownload();
    return () => {
      desktop.removeEventListener('change', checkDownload);
      request?.abort();
    };
  }, []);

  if (!available) return null;

  return <View style={styles.banner}>
    <Text accessibilityRole="header" aria-level={2} style={styles.title}>AstraLingo cho Android</Text>
    <Text style={styles.description}>Học tiếng Anh thuận tiện hơn trên điện thoại.</Text>
    <a href={apkUrl} download="AstraLingo.apk" style={{
      display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginTop: 9,
      padding: '9px 12px', border: `1px solid ${c.border}`, borderRadius: 9, backgroundColor: c.white,
      color: c.purpleDark, fontSize: 14, fontWeight: 700, textDecoration: 'none',
    }}>
      <Ionicons name="download-outline" size={18} aria-hidden />
      Tải ứng dụng Android (.apk)
    </a>
  </View>;
}

const styles = StyleSheet.create({
  banner: { marginTop: 20, padding: 14, borderRadius: 14, backgroundColor: c.lavender },
  title: { fontFamily: heading, fontSize: 18, color: c.ink },
  description: { marginTop: 3, fontSize: 13, lineHeight: 20, color: '#514A64' },
});
