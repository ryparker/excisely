import type { NextConfig } from 'next'

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com https://www.ttb.gov",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://va.vercel-scripts.com https://*.blob.vercel-storage.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

const contentSecurityPolicy = cspDirectives.join('; ')

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'tesseract.js',
    'tesseract.js-core',
    'sharp',
    // tesseract.js transitive deps — must be external so the serverless
    // function tracer includes them alongside the main package
    'bmp-js',
    'is-url',
    'node-fetch',
    'zlibjs',
    'wasm-feature-detect',
    'idb-keyval',
    'regenerator-runtime',
  ],
  poweredByHeader: false,
  reactCompiler: true,
  outputFileTracingIncludes: {
    '/*': [
      './tessdata/eng.traineddata',
      './node_modules/tesseract.js/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/bmp-js/**/*',
      './node_modules/is-url/**/*',
      './node_modules/node-fetch/**/*',
      './node_modules/zlibjs/**/*',
      './node_modules/wasm-feature-detect/**/*',
      './node_modules/idb-keyval/**/*',
      './node_modules/regenerator-runtime/**/*',
      './node_modules/sharp/**/*',
    ],
  },
  experimental: {
    useCache: true,
    webVitalsAttribution: ['CLS', 'LCP'],
    viewTransition: true,
    isolatedDevBuild: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.ttb.gov',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
        ],
      },
    ]
  },
}

export default nextConfig
