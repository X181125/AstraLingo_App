module.exports = ({ config }) => {
  if (['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    let url;
    try { url = new URL(process.env.EXPO_PUBLIC_API_URL?.trim()); } catch {}
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname)) {
      throw new Error('Set EXPO_PUBLIC_API_URL to your public HTTPS backend URL (ending in /api) in the EAS build environment.');
    }
  }
  return config;
};
