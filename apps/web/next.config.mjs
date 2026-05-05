/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["db", "jobs"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" }
  }
};

export default nextConfig;
