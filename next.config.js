/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
    serverComponentsExternalPackages: ['@prisma/client', 'bcrypt'],
  },
  
  // Temporarily disable TypeScript checking
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint errors from failing the build
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure which pages should not be statically generated
  output: 'standalone',
  
  // Set a custom output directory without spaces
  distDir: 'build',
  
  // Skip static generation for routes that access the database
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  
  // Add redirects for company and employee detail pages
  async redirects() {
    return [
      // Specific redirects for company and employee detail pages
      {
        source: '/dashboard/company/:id',
        destination: '/dashboard/companies/:id',
        permanent: false,
      },
      {
        source: '/dashboard/employees/:id',
        destination: '/dashboard/employee/:id',
        permanent: false,
      },
      // Add redirect for the new admin page
      {
        source: '/dashboard/admins/new',
        destination: '/dashboard/admins/create',
        permanent: false,
      }
    ];
  },
  
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
  
  // Increase maximum file upload size (default is 4MB)
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  }
};

module.exports = nextConfig;
