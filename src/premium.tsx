import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getIsPremium } from "./store";

// The entitlement, read once at launch and shared. A hook that read storage per
// component would let two screens disagree for a frame after a purchase — and
// after a restore, every gated surface has to change its mind at the same time.
//
// src/store.ts owns the value; this file only decides when to ask for it.

type PremiumState = {
  isPremium: boolean;
  /**
   * False until storage has answered. Gated screens should wait rather than
   * paint the locked state first, which would flash a paywall at someone who
   * has already paid.
   */
  ready: boolean;
  /** Re-read the entitlement — after a purchase, or a restore. */
  refresh: () => Promise<void>;
};

const PremiumContext = createContext<PremiumState>({
  isPremium: false,
  ready: false,
  refresh: async () => {},
});

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremiumState] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setIsPremiumState(await getIsPremium());
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ isPremium, ready, refresh }), [isPremium, ready, refresh]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumState {
  return useContext(PremiumContext);
}
