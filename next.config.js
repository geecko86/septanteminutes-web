/**
 * Next.js config for septanteminutes.be — fully static export to Firebase Hosting.
 *
 * Notable customizations:
 * - PWA via @ducanh2912/next-pwa using InjectManifest mode (custom sw.js source).
 * - Custom CSS pipeline (style-loader/css-loader/postcss-loader/cssnano) to
 *   inline + minify CSS modules; localIdentName uses 5-char hashes for size.
 * - HtmlMinifier hook in webpack's emit phase (collapses whitespace, removes
 *   comments) — runs only in production builds.
 * - splitChunks tuned to keep the framework chunk separate from large libs.
 * - ANALYZE=true switches to @next/bundle-analyzer instead of PWA wrapping.
 *
 * @type {import('next').NextConfig}
 */
const withPWAInit = require("@ducanh2912/next-pwa").default;
const TerserPlugin = require('terser-webpack-plugin');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const HtmlMinifier = require('html-minifier-terser');
const fs = require('fs');
const isProduction = process.env.NODE_ENV === 'production';

const withWrapper = (process.env.ANALYZE === 'true') ? require('@next/bundle-analyzer')({
  enabled: true,
}) : withPWAInit({
  dest: "public",
  swSrc: "sw.js",
  register: true,
  disable: process.env.NODE_ENV === 'development'
});

const NextConfig = {
  experimental: {
    optimizePackageImports: ["typescript", "framer", "framer-motion", "eslint", "@floating-ui/react", "react-dom"]
  },
  productionBrowserSourceMaps: false,
  trailingSlash: true,
  output: "export",
  compiler: {
    removeConsole: process.env.NODE_ENV !== "development",
    // removeConsole: false,
  },
  images: {
    loader: "custom",
    loaderFile: "src/utils/cdn_img_loader.ts",
    formats: ["image/webp"],
    imageSizes: [128, 256, 384, 480, 560],
  },
  webpack: (
    config, { buildId }
  ) => {
    if (!isProduction) return config;

    config.module.rules.push({
      test: /\.css$/,
      use: [
        {
          loader: 'style-loader',
          options: {
            injectType: 'styleTag',
          },
        },
        {
          loader: 'css-loader',
          options: {
            url: false,
            importLoaders: 1,
            modules: {
              mode: 'local',
              localIdentName: '[hash:base64:5]',
              getLocalIdent: (context, localIdentName, localName) => (
                localName.includes('rc-') ? localName : null
              ),
            },
          },
        },
        {
          loader: 'postcss-loader', // Adding postcss-loader to ensure additional minification steps
          options: {
            postcssOptions: {
              plugins: [
                require('cssnano')({
                  preset: 'default',
                  discardComments: { removeAll: true },
                  reduceIdents: true,
                  discardUnused: true
                }),
              ],
            },
          },
        }
      ],
    });


    const terserMinimizer = new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true, // Remove console logs
          ecma: 2019,
          unsafe: true,
          unsafe_arrows: true,
          unsafe_comps: true,
          unsafe_math: true,
          unsafe_methods: true,
          unsafe_proto: true,
          unsafe_undefined: true,
          pure_funcs: ['console.info', 'console.debug'], // Remove specific console functions
        },
        mangle: true, // Shorten variable names
        output: {
          comments: false, // Remove comments
        },
      },
      extractComments: false, // Do not extract comments to a separate file
    });

    config.optimization.minimizer.push(terserMinimizer);
    config.optimization.minimize = true;

    config.module.rules.push({
      test: /\.(svg|png)$/,
      use: {
        loader: 'url-loader', options: {
          name: 'assets/[hash].[ext]',
          limit: 5000,
        },
      }
    });

    config.plugins.push({
      apply: (compiler) => {
        compiler.hooks.emit.tapAsync('MinifyHTML', (compilation, callback) => {
          for (const name in compilation.assets) {
            if (name.endsWith('.html')) {
              console.log(name, "is being minified");
              const minified = HtmlMinifier.minify(compilation.assets[name].source(), {
                collapseWhitespace: true,
                minifyCSS: true,
                removeComments: true,
                removeRedundantAttributes: true,
                useShortDoctype: true,
              });
              compilation.assets[name] = {
                source: () => minified,
                size: () => minified.length,
              };
            }
          }
          callback();
        });
      },
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