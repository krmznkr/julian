import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isAuthenticated, logout, startGoogleAuth } from "@/lib/google-calendar";

export function GoogleLoginButton({ onAuthChange }: { onAuthChange?: () => void }) {
  const [isAuth, setIsAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAuthenticated().then(setIsAuth);
  }, []);

  const handleLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // In the browser this redirects away and never returns. In the desktop
      // app it resolves once the loopback OAuth exchange completes, so refresh
      // the connected state in place.
      await startGoogleAuth();
      const authed = await isAuthenticated();
      setIsAuth(authed);
      if (authed) onAuthChange?.();
    } catch (err) {
      console.error("Failed to start Google auth:", err);
      setError(err instanceof Error ? err.message : "Failed to connect to Google.");
    } finally {
      setIsLoading(false);
    }
  }, [onAuthChange]);

  const handleLogout = useCallback(() => {
    logout();
    setIsAuth(false);
    onAuthChange?.();
  }, [onAuthChange]);

  if (isAuth) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-medium text-muted-foreground">Google Calendar</span>
          <div className="size-2 rounded-full bg-green-500" />
        </div>
        <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={handleLogout}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs h-8"
        onClick={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? "Connecting..." : "Connect Google Calendar"}
      </Button>
      {error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
