"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import type { Lang, StoreState } from "@/lib/pos/model";
import { translator } from "@/lib/pos/i18n";
type StoreContext = {
  state: StoreState | undefined;
  loading: boolean;
  error: string;
  retry: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (s: string) => string;
  busy: boolean;
  act: (
    action: string,
    payload: unknown,
    message?: string,
  ) => Promise<StoreState | null>;
};
function requestKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-" +
    h.slice(12, 16) +
    "-" +
    h.slice(16, 20) +
    "-" +
    h.slice(20)
  );
}
const Context = createContext<StoreContext>(null!);
export const useStore = () => useContext(Context);
async function api(body?: unknown) {
  const r = await fetch("/api/store", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) {
    location.replace("/");
    throw new Error("Please sign in");
  }
  const data: any = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Could not save changes. Please try again.");
  return data as { state: StoreState; revision: number };
}
function Content({ children }: { children: React.ReactNode }) {
  const client = useQueryClient();
  const requests = useRef<Record<string, string>>({});
  const lock = useRef(false);
  const [lang, setLanguage] = useState<Lang>("en");
  const t = translator(lang);
  useEffect(() => {
    const v = localStorage.getItem("karobar-language");
    if (["en", "ur", "pa"].includes(v || "")) setLanguage(v as Lang);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === "pa" ? "pa-Arab" : lang;
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLanguage(l);
    localStorage.setItem("karobar-language", l);
  };
  const query = useQuery({
    queryKey: ["store"],
    queryFn: () => api(),
    staleTime: 10000,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: (v: unknown) => api(v),
    onSuccess: (data) => client.setQueryData(["store"], data),
  });
  async function act(
    action: string,
    payload: unknown,
    message = "Changes saved",
  ) {
    if (lock.current) return null;
    lock.current = true;
    const signature = action + JSON.stringify(payload);
    const requestId =
      requests.current[signature] ||
      (requests.current[signature] = requestKey());
    try {
      const d = await mutation.mutateAsync({ action, payload, requestId });
      delete requests.current[signature];
      if (message) toast.success(t(message));
      return d.state;
    } catch (error) {
      toast.error(
        t(
          error instanceof Error
            ? error.message
            : "Could not save changes. Please try again.",
        ),
      );
      return null;
    } finally {
      lock.current = false;
    }
  }
  return (
    <Context.Provider
      value={{
        state: query.data?.state,
        loading: query.isPending,
        error: query.error?.message || "",
        retry: () => void query.refetch(),
        lang,
        setLang,
        t,
        busy: mutation.isPending,
        act,
      }}
    >
      {children}
      <Toaster position="bottom-right" richColors closeButton />
    </Context.Provider>
  );
}
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <Content>{children}</Content>
    </QueryClientProvider>
  );
}
