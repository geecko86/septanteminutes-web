/** @type {import('next').NextConfig} */
const withPWAInit = require("next-pwa");
const isProduction = process.env.NODE_ENV === 'production';

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
  webpack: (
    config
  ) => {
    if (!isProduction) return config;

    config.module.rules.push({
      test: /\.css$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            url: false,
            importLoaders: 2,
            modules: {
              mode: 'local',
              localIdentName: isProduction ? '[hash:base64:5]' : '[local]_[hash:base64:5]'
            },
          },
        },
      ],
    });
    
    config.module.rules.push({
      test: /\.(svg|png)$/,
      use: {
        loader: 'url-loader', options: {
          name: 'assets/[hash].[ext]',
          limit: 5000,
        },
      }
    });
    return config;
  }
};

module.exports = withPWA(NextConfig);
