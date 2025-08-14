/** @type {import('next').NextConfig} */
const nextConfig = {
   
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qzsrcefgmggasjptpauj.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**',
      },
    ],
  },
  experimental: {
    typedRoutes: false,
  },
}

module.exports = nextConfig 