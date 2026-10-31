import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // App này toàn bộ là dynamic (session cookie, dữ liệu realtime) -- không
  // có trang nào cần prerender tĩnh, nên tắt Cache Components/PPR cho đơn giản.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
