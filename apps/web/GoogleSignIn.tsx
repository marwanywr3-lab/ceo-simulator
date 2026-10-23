import { useEffect, useRef, useState } from "react";
type GoogleAPI = {
  accounts: {
    id: {
      initialize: (o: {
        client_id: string;
        nonce: string;
        callback: (r: { credential: string }) => void;
      }) => void;
      renderButton: (
        node: HTMLElement,
        o: { theme: string; size: string; width: number },
      ) => void;
    };
  };
};
export function GoogleSignIn({
  base,
  onToken,
  onError,
  ar,
}: {
  base: string;
  onToken: (token: string) => void;
  onError: (error: string) => void;
  ar: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const config = (await (
          await fetch(base + "/api/auth/config")
        ).json()) as { googleClientId: string | null };
        if (cancelled) return;
        setConfigured(!!config.googleClientId);
        if (!config.googleClientId) return;
        const response = await fetch(base + "/api/auth/google/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) throw new Error("Google sign-in unavailable");
        const challenge = (await response.json()) as {
          id: string;
          nonce: string;
        };
        let sdk = document.querySelector<HTMLScriptElement>(
          "script[data-google-signin]",
        );
        if (!sdk) {
          sdk = document.createElement("script");
          sdk.src = "https://accounts.google.com/gsi/client";
          sdk.async = true;
          sdk.dataset.googleSignin = "true";
          document.head.appendChild(sdk);
        }
        const render = () => {
          const google = (window as unknown as { google?: GoogleAPI }).google;
          if (cancelled || !google || !ref.current) return;
          google.accounts.id.initialize({
            client_id: config.googleClientId!,
            nonce: challenge.nonce,
            callback: async (result) => {
              try {
                const response = await fetch(base + "/api/auth/google", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    credential: result.credential,
                    challenge: challenge.id,
                  }),
                });
                const value = (await response.json()) as {
                  token?: string;
                  error?: string;
                };
                if (!response.ok || !value.token)
                  throw new Error(value.error || "Google sign-in failed");
                onToken(value.token);
              } catch (e) {
                onError((e as Error).message);
              }
            },
          });
          google.accounts.id.renderButton(ref.current, {
            theme: "outline",
            size: "large",
            width: 280,
          });
        };
        if ((window as unknown as { google?: GoogleAPI }).google) render();
        else sdk.addEventListener("load", render, { once: true });
      } catch (e) {
        if (!cancelled) onError((e as Error).message);
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [base, onToken, onError]);
  return (
    <div className="google-signin">
      <div ref={ref} />
      {configured === false && (
        <p className="muted">
          {ar
            ? "تسجيل Google بانتظار إعداد الخدمة. البريد وكلمة المرور متاحان دون رسالة تحقق."
            : "Google sign-in awaits configuration. Email/password works without a verification email."}
        </p>
      )}
    </div>
  );
}
