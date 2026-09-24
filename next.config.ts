import type { NextConfig } from "next";
import { readPublicAuthConfig } from "./src/lib/auth/config";

// Reject a secret/JWT pasted into public config before Next can inline it in JS.
// Fully absent auth config remains compatible with the internal MVP.
readPublicAuthConfig();

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
