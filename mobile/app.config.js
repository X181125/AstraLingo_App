const { isIP } = require('node:net');

function localHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (isIP(host) === 6) return /^(?:::1?$|::ffff:|f[cd]|fe[89ab])/i.test(host);
  if (isIP(host) !== 4) return false;
  const [first, second] = host.split('.').map(Number);
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

module.exports = ({ config }) => {
  if (['preview', 'production'].includes(process.env.EAS_BUILD_PROFILE)) {
    let url;
    try { url = new URL(process.env.EXPO_PUBLIC_API_URL?.trim()); } catch {}
    if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        localHost(url.hostname) || !/\/api\/?$/.test(url.pathname)) {
      throw new Error('Set EXPO_PUBLIC_API_URL to your public HTTPS backend URL (ending in /api) in the EAS build environment.');
    }
  }
  return config;
};
