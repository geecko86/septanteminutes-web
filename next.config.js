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
  // Next 16 infers workspace root from lockfile location. Since there is a
  // stray yarn.lock at $HOME, it would pick that directory and look for pages
  // in the wrong place. Explicitly pin root to this project directory so page
  // discovery, Turbopack, and workspace resolution all point at the right spot.
  turbopack: {
    root: __dirname,
  },
  transpilePackages: ['scroll-snap'],
  experimental: {
    optimizePackageImports: ["framer-motion", "@floating-ui/react"]
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
    config, { buildId, isServer }
  ) => {
    // scroll-snap@5 ships with "type":"module" in its package.json, which makes
    // webpack try to parse it as an ES module. Two problems arise:
    //
    // 1. CLIENT: The UMD dist file is not an ES module — aliasing to the UMD
    //    file and marking it `javascript/auto` tells webpack to treat it as
    //    CommonJS, avoiding ESM-parse errors in the browser bundle.
    //
    // 2. SERVER: The UMD IIFE runs `t.scrollSnap = e()` where t is
    //    `self ?? this`. In strict-mode Node.js `this` is undefined at module
    //    top-level, so the assignment throws immediately on import.
    //    Since createScrollSnap is only ever called inside a useEffect (browser
    //    only), the server bundle just needs a safe no-op stub.
    // scroll-snap@5 ships with "type":"module" in its package.json, which causes
    // webpack to externalize it as a dynamic ESM import rather than bundling it.
    // Two problems arise from this:
    //
    // 1. CLIENT: The UMD dist file is not an ES module. We alias to the UMD file
    //    and mark it `javascript/auto` so webpack treats it as CommonJS. We also
    //    remove any existing externals entry for scroll-snap so it gets bundled.
    //
    // 2. SERVER: The UMD IIFE runs `t.scrollSnap = e()` where `t` resolves to
    //    `self ?? this`. In strict-mode Node.js, `this` is undefined at module
    //    top-level, so the assignment throws at import time. Since createScrollSnap
    //    is only ever called inside a useEffect (browser-only), the server just
    //    needs a safe no-op stub. We use a webpack `externals` function to intercept
    //    `scroll-snap` at resolution time and point it at the local stub.
    if (isServer) {
      // Intercept the scroll-snap module at the externals level (before alias runs)
      // and replace it with our CommonJS stub. This prevents the UMD IIFE from
      // executing in Node.js where `this` is undefined in strict mode.
      const stubPath = require.resolve('./src/utils/scroll-snap-stub.js');
      const existingExternals = config.externals || [];
      config.externals = [
        // Our interceptor runs first: if the request is for scroll-snap, resolve
        // to the local stub instead of letting Node/webpack find the ESM package.
        ({ request }, callback) => {
          if (request === 'scroll-snap') {
            // `commonjs2` tells webpack this is a CommonJS module that exports
            // via `module.exports`. The path must be absolute so Node can find it.
            return callback(null, `commonjs2 ${stubPath}`);
          }
          callback();
        },
        // Preserve all existing externals (Next.js adds its own entries here).
        ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
      ];
    } else {
      // On the client, alias scroll-snap to the pre-compiled UMD file and mark
      // it javascript/auto so webpack treats it as CommonJS, not ESM.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'scroll-snap': require.resolve('scroll-snap/dist/scroll-snap.min.js'),
      };
      config.module.rules.push({
        test: require.resolve('scroll-snap/dist/scroll-snap.min.js'),
        type: 'javascript/auto', // treat as CommonJS, not ES module
      });
    }

    if (!isProduction) return config;

    // The CSS module options shared between client and server compilations.
    // css-loader resolves class name locals (e.g. styles.leuven → a 5-char hash string)
    // so that importing a CSS module in JS always yields a plain object, not undefined.
    const cssLoaderOptions = {
      url: false,
      importLoaders: 1,
      modules: {
        mode: 'local',
        localIdentName: '[hash:base64:5]',
        getLocalIdent: (context, localIdentName, localName) => (
          localName.includes('rc-') ? localName : null
        ),
      },
    };

    if (isServer) {
      // On the server (static page data collection) we only need the class-name
      // mapping that css-loader produces — there is no DOM to inject a <style> tag
      // into. style-loader is a browser-only loader and its export is `undefined`
      // on the server, which would make `styles.leuven` throw at runtime.
      config.module.rules.push({
        test: /\.css$/,
        use: [
          { loader: 'css-loader', options: cssLoaderOptions },
        ],
      });
    } else {
      // On the client we run the full pipeline: css-loader resolves class names,
      // postcss/cssnano minifies, and style-loader injects the final CSS into a
      // <style> tag in the browser.
      config.module.rules.push({
        test: /\.css$/,
        use: [
          {
            loader: 'style-loader',
            options: { injectType: 'styleTag' },
          },
          { loader: 'css-loader', options: cssLoaderOptions },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('cssnano')({
                    preset: 'default',
                    discardComments: { removeAll: true },
                    reduceIdents: true,
                    discardUnused: true,
                  }),
                ],
              },
            },
          },
        ],
      });
    }


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