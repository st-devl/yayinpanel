"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/material-icon";

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button
      className="primary-button mt-2 w-full rounded-lg py-4 font-label-md text-label-md shadow-md disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={pending}
    >
      <span>{pending ? "Kontrol Ediliyor" : "Giriş Yap"}</span>
      <MaterialIcon name={pending ? "progress_activity" : "arrow_forward"} />
    </button>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending) {
      return;
    }

    setError(null);
    setPending(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password")
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "Giriş başarısız.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Giriş sırasında sunucuya ulaşılamadı.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface p-md text-on-surface">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-surface-container opacity-50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[30%] w-[30%] rounded-full bg-surface-variant opacity-40 blur-[100px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-[480px] flex-col gap-lg">
        <section className="flex flex-col items-center gap-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
            <MaterialIcon
              name="calendar_month"
              className="text-on-primary"
              size={32}
            />
          </div>
          <h1 className="font-headline-md text-headline-md text-primary">
            İçerik Planlayıcı
          </h1>
        </section>

        <section className="panel-card p-lg shadow-panel">
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-xs text-center">
              <h2 className="font-headline-sm text-headline-sm">
                Kişisel İçerik Planlama Paneli
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Instagram, X ve web sitesi içeriklerinizi tek panelden
                planlayın.
              </p>
            </div>

            {error ? (
              <div className="flex items-center gap-sm rounded-lg border border-error/20 bg-error-container p-sm text-on-error-container">
                <MaterialIcon name="error" size={20} />
                <p className="font-label-md text-label-md">{error}</p>
              </div>
            ) : null}

            <form className="flex flex-col gap-md" onSubmit={handleSubmit}>
              <label className="flex flex-col gap-xs">
                <span className="ml-1 font-label-md text-label-md text-on-surface-variant">
                  E-posta
                </span>
                <span className="relative">
                  <MaterialIcon
                    name="mail"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                  />
                  <input
                    className="input-surface w-full rounded-lg py-3 pl-11 pr-4 font-body-md text-body-md"
                    name="email"
                    placeholder="E-posta adresiniz"
                    required
                    type="email"
                  />
                </span>
              </label>

              <label className="flex flex-col gap-xs">
                <span className="px-1 font-label-md text-label-md text-on-surface-variant">
                  Şifre
                </span>
                <span className="relative">
                  <MaterialIcon
                    name="lock"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-outline"
                  />
                  <input
                    className="input-surface w-full rounded-lg py-3 pl-11 pr-12 font-body-md text-body-md"
                    name="password"
                    placeholder="Şifreniz"
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-on-surface-variant"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                    aria-label={
                      showPassword ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                  >
                    <MaterialIcon
                      name={showPassword ? "visibility_off" : "visibility"}
                    />
                  </button>
                </span>
              </label>

              <SubmitButton pending={pending} />
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
