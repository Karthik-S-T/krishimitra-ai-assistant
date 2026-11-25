import { useCallback, useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import {
  clearDemoSession,
  DEMO_AUTH_EVENT,
  isDemoAuthEnabled,
  readDemoSession,
  type DemoUser,
} from "@/lib/demoAuth";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const demoMode = isDemoAuthEnabled();
  const cloudUser = useQuery(api.users.currentUser, demoMode ? "skip" : {});
  const { signIn, signOut } = useAuthActions();
  const [demoUser, setDemoUser] = useState<DemoUser | null>(() =>
    typeof window === "undefined" ? null : readDemoSession(),
  );

  useEffect(() => {
    const refresh = () => setDemoUser(readDemoSession());
    window.addEventListener(DEMO_AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(DEMO_AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const localSignOut = useCallback(async () => {
    clearDemoSession();
    if (!demoMode && isAuthenticated) await signOut();
  }, [demoMode, isAuthenticated, signOut]);

  const isLoading = !demoMode && (isAuthLoading || cloudUser === undefined);

  return {
    isLoading,
    isAuthenticated: demoMode ? demoUser !== null : isAuthenticated,
    user: (demoMode ? demoUser : cloudUser) ?? null,
    signIn,
    signOut: localSignOut,
  };
}
