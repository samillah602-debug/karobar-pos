"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Store, LockKeyhole, ArrowRight } from "lucide-react";
import type { Lang } from "@/lib/pos/model";

const copy = {
  en: {
    heading: "Welcome to your store",
    text: "Sign in to manage your business.",
    password: "Store password",
    submit: "Sign in",
    working: "Signing in…",
    pending: "The store is not ready yet. Please contact the store owner.",
    wrong: "Incorrect password",
    unavailable: "Sign-in is temporarily unavailable. Please try again.",
    limited: "Too many attempts. Please try again in 10 minutes.",
  },
  ur: {
    heading: "اپنے اسٹور میں خوش آمدید",
    text: "اپنے کاروبار کو سنبھالنے کے لیے سائن اِن کریں۔",
    password: "اسٹور کا پاس ورڈ",
    submit: "سائن اِن کریں",
    working: "سائن اِن ہو رہا ہے…",
    pending: "اسٹور ابھی تیار نہیں۔ براہِ کرم اسٹور کے مالک سے رابطہ کریں۔",
    wrong: "پاس ورڈ درست نہیں",
    unavailable: "سائن اِن فی الحال دستیاب نہیں۔ دوبارہ کوشش کریں۔",
    limited: "بہت زیادہ کوششیں ہوئی ہیں۔ 10 منٹ بعد دوبارہ کوشش کریں۔",
  },
  pa: {
    heading: "اپنے سٹور وچ جی آیاں نوں",
    text: "اپنا کاروبار سنبھالن لئی سائن اِن کرو۔",
    password: "سٹور دا پاس ورڈ",
    submit: "سائن اِن کرو",
    working: "سائن اِن ہو رہیا اے…",
    pending: "سٹور ہجے تیار نہیں۔ سٹور دے مالک نال رابطہ کرو۔",
    wrong: "پاس ورڈ ٹھیک نہیں",
    unavailable: "سائن اِن ہن دستیاب نہیں۔ فیر کوشش کرو۔",
    limited: "بہت کوششاں ہو گئیاں نیں۔ 10 منٹ بعد فیر کوشش کرو۔",
  },
};

export default function Login({ configured }: { configured: boolean }) {
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"" | "wrong" | "unavailable" | "limited">(
    "",
  );
  const text = copy[lang];
  useEffect(() => {
    const saved = localStorage.getItem("karobar-language");
    if (saved === "en" || saved === "ur" || saved === "pa") setLang(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    document.documentElement.lang = lang === "pa" ? "pa-Arab" : lang;
  }, [lang]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const password = String(
      new FormData(event.currentTarget).get("password") || "",
    );
    try {
      const result = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (result.ok) {
        location.replace("/");
        return;
      }
      setError(
        result.status === 401
          ? "wrong"
          : result.status === 429
            ? "limited"
            : "unavailable",
      );
    } catch {
      setError("unavailable");
    }
    setBusy(false);
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span>
            <Store size={26} />
          </span>
          <b>karobar</b>
        </div>
        <select
          aria-label="Language"
          className="login-language"
          value={lang}
          onChange={(e) => {
            const value = e.target.value as Lang;
            setLang(value);
            localStorage.setItem("karobar-language", value);
          }}
        >
          <option value="en">English</option>
          <option value="ur">اردو</option>
          <option value="pa">پنجابی</option>
        </select>
        <div className="login-lock">
          <LockKeyhole size={24} />
        </div>
        <h1>{text.heading}</h1>
        <p>{text.text}</p>
        {configured ? (
          <form onSubmit={submit}>
            <label htmlFor="password">{text.password}</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={512}
              dir="ltr"
            />
            <button className="btn primary" disabled={busy}>
              {busy ? text.working : text.submit}
              <ArrowRight size={17} />
            </button>
            {error && (
              <p role="alert" className="login-error">
                {text[error]}
              </p>
            )}
          </form>
        ) : (
          <p role="status" className="login-pending">
            {text.pending}
          </p>
        )}
      </section>
    </main>
  );
}
