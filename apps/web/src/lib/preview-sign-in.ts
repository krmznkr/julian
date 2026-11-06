// A PR preview runs on an origin Google does not know, so it borrows the
// production callback and lets the production edge send the browser back.
// See @julian/security/preview-origin.
import type { AppConfigShape } from "@julian/google/config";
import { PREVIEW_SIGN_IN_REDIRECT_URI, isPreviewOrigin } from "@julian/security/preview-origin";

export const withPreviewSignIn = (config: AppConfigShape): AppConfigShape =>
  isPreviewOrigin(config.appOrigin)
    ? { ...config, redirectUri: PREVIEW_SIGN_IN_REDIRECT_URI }
    : config;
