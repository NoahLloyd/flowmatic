import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

import { mainConfig } from "./webpack.main.config";
import { rendererConfig } from "./webpack.renderer.config";
import { MakerDMG } from "@electron-forge/maker-dmg";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "./src/assets/icons/mac/icon",
    name: "Flowmatic",
    extendInfo: {
      NSAppleEventsUsageDescription:
        "Flowmatic needs permission to control Focus mode (Do Not Disturb) via Shortcuts.",
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      setupIcon: "./src/assets/icon.ico",
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
    new MakerDMG(undefined),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self' 'unsafe-eval' 'unsafe-inline'; img-src 'self' data: https:",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/index.html",
            js: "./src/renderer.ts",
            name: "main_window",
            preload: {
              js: "./src/preload.ts",
            },
          },
          {
            html: "./src/overlay.html",
            js: "./src/overlayRenderer.ts",
            name: "overlay_window",
            preload: {
              js: "./src/overlayPreload.ts",
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
