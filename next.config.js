/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ]
  },
  
  images: {
    domains: [],
    unoptimized: false, // Enable optimization for better performance
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Add loader configuration for better compatibility
    loader: 'default',
    // Enable static imports for better performance
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    esmExternals: true,
  },
  webpack: (config, { isServer, dev }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    
    // Ensure proper module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    };

    // Handle Edge Runtime compatibility for Supabase
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'crypto': false,
        'stream': false,
        'util': false,
        'buffer': false,
        'process': false,
      };
    }

    // Suppress warnings for Supabase Edge Runtime compatibility
    config.ignoreWarnings = [
      {
        module: /node_modules\/@supabase\/realtime-js/,
        message: /A Node\.js API is used/
      },
      {
        module: /node_modules\/@supabase\/supabase-js/,
        message: /A Node\.js API is used/
      }
    ];
    
    return config;
  },
}

module.exports = nextConfig
