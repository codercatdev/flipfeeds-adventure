/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@flipfeeds/game-client', '@flipfeeds/shared', 'partysocket'],
  webpack: (config, { isServer }) => {
    // Phaser needs canvas - don't bundle on server (Vite uses ssr.external in vite.config.ts)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('phaser');
    }
    return config;
  },
};

module.exports = nextConfig;
