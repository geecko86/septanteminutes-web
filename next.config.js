/** @type {import('next').NextConfig} */
const withPWAInit = require('next-pwa');

const withPWA = withPWAInit({
  dest: "public",
  swSrc: 'sw.js',
  register: true,
  skipWaiting: true,
  disable: false, // true if develop
  // disable:process.env.NODE_ENV === 'development'
});

const NextConfig = {
    experimental: {
      urlImports: ['https://framer.com/m/', 'https://framerusercontent.com/modules/'],
    },
    output: 'export',
    compiler: {
      removeConsole: process.env.NODE_ENV !== 'development'
    },
    images: {
      unoptimized: true,
      formats: ['image/webp'],
    }
};

module.exports = withPWA(NextConfig);