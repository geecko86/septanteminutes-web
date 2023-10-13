/** @type {import('next').NextConfig} */

const withPWAInit = require('next-pwa');
const runtimeCaching = require("./worker/cache");

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false, // true if develop
  runtimeCaching,
});

const NextConfig = {
    experimental: {
      urlImports: ['https://framer.com/m/', 'https://framerusercontent.com/modules/'],
    },
    output: 'export',
    compiler: {
      removeConsole: true
    },
    images: {
      formats: ['image/webp'],
    }
};

module.exports = withPWA(NextConfig);