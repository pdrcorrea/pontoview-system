import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Organization, OrganizationRole, Profile } from "../types";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  role: OrganizationRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);

  const loadAccount = useCallback(async (nextSession?: Session | null) => {
    const activeSession =
      nextSession === undefined
        ? (await supabase.auth.getSession()).data.session
        : nextSession;
    setSession(activeSession);
    if (!activeSession?.user) {
      setProfile(null);
      setOrganization(null);
      setRole(null);
      setLoading(false);
      return;
    }
    const profileResult = await supabase
      .from("profiles")
      .select("id,email,full_name,avatar_url,onboarding_completed")
      .eq("id", activeSession.user.id)
      .single();
    if (profileResult.data) setProfile(profileResult.data as Profile);

    let membership = await supabase
      .from("organization_users")
      .select(
        "organization_id,role,organizations(id,name,display_name,slug,timezone,locale,settings)",
      )
      .eq("user_id", activeSession.user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!membership.data) {
      await supabase.rpc("ensure_screen_organization", {
        p_name:
          activeSession.user.user_metadata?.organization_name ||
          "Minha empresa",
      });
      membership = await supabase
        .from("organization_users")
        .select(
          "organization_id,role,organizations(id,name,display_name,slug,timezone,locale,settings)",
        )
        .eq("user_id", activeSession.user.id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
    }
    if (membership.data) {
      setRole(membership.data.role as OrganizationRole);
      const orgValue = membership.data.organizations as unknown;
      setOrganization(
        (Array.isArray(orgValue) ? orgValue[0] : orgValue) as Organization,
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccount();
    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => void loadAccount(nextSession),
    );
    return () => data.subscription.unsubscribe();
  }, [loadAccount]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user || null,
      profile,
      organization,
      role,
      refresh: () => loadAccount(),
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [loading, session, profile, organization, role, loadAccount],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return value;
}
