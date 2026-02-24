import type { NextConfig } from 'next'

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com https://www.ttb.gov",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://va.vercel-scripts.com https://*.blob.vercel-storage.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]

const contentSecurityPolicy = cspDirectives.join('; ')

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
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
