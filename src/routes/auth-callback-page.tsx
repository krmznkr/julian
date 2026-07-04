import { useEffect, useRef, useState } from "react";
import { handleAuthCallback } from "@/lib/google-calendar";

export function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string>("");
  // Authorization codes are single-use, and StrictMode runs effects twice in
  // dev — guard so the token exchange only ever fires once.
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (exchangeStarted.current) return;
    // eslint-disable-next-line functional/immutable-data
    exchangeStarted.current = true;

    async function processCallback() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (!code) {
          throw new Error("No authorization code received");
        }

        await handleAuthCallback(code);
        setStatus("success");

        // Redirect back to the app after a short delay
        const year = new Date().getFullYear();
        const redirectUrl = `/year/${year}`;
        const timeout = setTimeout(() => {
          location.assign(redirectUrl);
        }, 1000);

        return () => clearTimeout(timeout);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }

    processCallback();
  }, []);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
          <p className="text-white">Authorizing with Google...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-white mb-4">✓ Successfully authenticated!</p>
          <p className="text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-red-500 mb-4">✗ Authentication failed</p>
        <p className="text-gray-400 mb-4">{error}</p>
        <a href="/" className="text-blue-500 hover:underline">
          Go back to calendar
        </a>
      </div>
    </div>
  );
}
