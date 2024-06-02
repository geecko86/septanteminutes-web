/** @type {import('next').NextConfig} */
const withPWAInit = require("next-pwa");
const { webpack } = require('next/dist/compiled/webpack/webpack');
const fs = require('fs');
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
    // removeConsole: process.env.NODE_ENV !== "development",
    removeConsole: false,
  },
  images: {
    loader: "custom",
    loaderFile: "src/utils/cdn_img_loader.js",
    formats: ["image/webp"],
  },
  webpack: (
    config, { buildId }
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
              localIdentName: '[hash:base64:5]',
              getLocalIdent: (context, localIdentName, localName) => (
                localName.includes('rc-') ? localName : null
              )
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

  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env': {
        BUILD_ID: JSON.stringify(buildId),
      },
    }),
    function() {
      fs.writeFileSync('public/api/buildId.txt', buildId);
    }
  );

    return config;
  }
};

module.exports = withPWA(NextConfig);