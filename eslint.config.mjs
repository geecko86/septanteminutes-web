// eslint-config-next@16 ships a native flat config array — no compat shim needed.
// We import it directly and spread it into our config array.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  // next/core-web-vitals flat config (exported as a ready-to-spread array).
  ...nextCoreWebVitals,
  {
    // Tell ESLint to skip generated/build output files so it doesn't try to
    // lint things like the compiled service worker or the Next.js output folder.
    ignores: [
      '.next/**',
      'out/**',
      'public/sw*.js',
      'public/worker*.js',
      'public/workbox-*.js',
    ],
  },
];
