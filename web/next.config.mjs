/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/design-preview.html",
        permanent: false,
      },
    ];
  },
  async headers() {
    const security = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      security.push(
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      );
    }
    return [{ source: "/:path*", headers: security }];
  },
};

export default nextConfig;
