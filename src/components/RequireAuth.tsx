import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { isDemoAuthEnabled } from "@/lib/demoAuth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const [backendUnavailable, setBackendUnavailable] = useState(false);
  const demoMode = isDemoAuthEnabled();

  useEffect(() => {
    if (!isLoading) {
      setBackendUnavailable(false);
      return;
    }

    const timeout = window.setTimeout(() => setBackendUnavailable(true), 8000);
    return () => window.clearTimeout(timeout);
  }, [isLoading]);

  if (demoMode || backendUnavailable) return children;

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return children;
}
