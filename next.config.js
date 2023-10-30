/** @type {import('next').NextConfig} */
const withPWAInit = require("next-pwa");

const withPWA = withPWAInit({
  dest: "public",
  swSrc: "sw.js",
  register: true,
  skipWaiting: true,
  disable: false,
  // disable:process.env.NODE_ENV === 'development'
});

const NextConfig = {
  output: "export",
  compiler: {
    removeConsole: process.env.NODE_ENV !== "development",
  },
  images: {
    loader: "custom",
    loaderFile: "src/utils/cdn_img_loader.js",
    formats: ["image/webp"],
  },
};

module.exports = withPWA(NextConfig);
