/** @type {import('next').NextConfig} */
const withPWAInit = require("next-pwa");
const { webpack } = require('next/dist/compiled/webpack/webpack');
const fs = require('fs');
const isProduction = process.env.NODE_ENV === 'production';

const withWrapper = (process.env.ANALYZE === 'true') ? require('@next/bundle-analyzer')({
  enabled: true,
}) : withPWAInit({
  dest: "public",
  swSrc: "sw.js",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

const NextConfig = {
  experimental: {
    optimizePackageImports: ["typescript", "framer", "framer-motion", "eslint", "@floating-ui/react", "react-dom"]
  },
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
        'process.env.BUILD_ID': JSON.stringify(buildId),
      }),
      function () {
        fs.writeFileSync('public/api/buildId.txt', buildId);
      }
    );

    config.optimization.splitChunks = {
      chunks: 'all',
      minSize: 0,
      cacheGroups: {
        default: false,
        vendors: false,
        framework: {
          chunks: 'all',
          name: 'framework',
          test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
          priority: 40,
          enforce: true,
        },
        lib: {
          test(module) {
            return module.size() > 160000;
          },
          name(module) {
            return module.identifier().split('/').reduceRight((acc, part) => {
              if (acc.length < 3) {
                acc.unshift(part);
              }
              return acc;
            }, []).join('/');
          },
          priority: 30,
          minChunks: 1,
          reuseExistingChunk: true,
        },
      },
    };

    config.mode = "production";

    return config;
  }
};

module.exports = withWrapper(NextConfig);