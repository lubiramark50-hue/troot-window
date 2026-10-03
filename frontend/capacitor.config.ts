import type { CapacitorConfig } from "@capacitor/cli";

const env = (globalThis as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

const config: CapacitorConfig = {
  appId: "ug.troot.window",
  appName: "Troot Window",
  webDir: "dist",
  server: { androidScheme: "https" },
  buildOptions: {
    releaseType: "APK",
    signingType: "apksigner",
    keystorePath: env.TROOT_KEYSTORE_PATH,
    keystorePassword: env.TROOT_KEYSTORE_PASSWORD,
    keystoreAlias: env.TROOT_KEY_ALIAS,
    keystoreAliasPassword: env.TROOT_KEY_PASSWORD
  }
};

export default config;
