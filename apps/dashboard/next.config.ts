import type { NextConfig } from "next";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version: string };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
