import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ─────────────────────────────────────────────────────────
  // WASM / OpenCASCADE.js Configuration
  // ─────────────────────────────────────────────────────────
  // Turbopack (default in Next.js 16) cannot resolve .wasm imports
  // from node_modules via standard module resolution. We use two
  // strategies in parallel:
  //
  // 1. resolveAlias — tells Turbopack where to find the binary when
  //    opencascade.js's index.js does `import wasmFile from "...wasm"`.
  // 2. The actual .wasm binary is copied to /public at build time
  //    so the WebWorker can fetch() it by URL at runtime.
  // ─────────────────────────────────────────────────────────
  turbopack: {
    root: __dirname,
    resolveAlias: {
      // Map the WASM binary import to its physical location
      "./dist/opencascade.wasm.wasm":
        "./node_modules/opencascade.js/dist/opencascade.wasm.wasm",
    },
  },

  // Webpack fallback (used when running `next dev --webpack` or
  // in CI environments without Turbopack bindings)
  webpack: (config, { isServer }) => {
    // Enable async WASM experiments
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Treat .wasm files as asset/resource so they get a public URL
    config.module?.rules?.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    // Prevent OpenCASCADE from being bundled server-side
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push("opencascade.js");
      }
    }

    return config;
  },

  // Allow importing from the opencascade.js package
  transpilePackages: ["opencascade.js"],
};

export default nextConfig;
