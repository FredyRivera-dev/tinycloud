"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSetupStatus } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { LoginForm } from "@/components/login/LoginForm";
import Dither from "@/components/Dither";

export default function LoginPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const seed = 37;

  useEffect(() => {
    if (token) {
      router.replace("/home");
      return;
    }
    let active = true;
    getSetupStatus()
      .then(({ needs_setup }) => {
        if (active && needs_setup) router.replace("/setup");
      })
      .catch(() => {
        // The login form still works if the status endpoint is temporarily
        // unavailable; the user will see the real error on submit.
      });
    return () => {
      active = false;
    };
  }, [token, router]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex w-full flex-col lg:flex-row">
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:max-w-[520px] lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="mb-12 flex items-center gap-3.5">
              <Image src="/logo.svg" alt="TinyCloud" width={48} height={48} className="h-12 w-12" />
              <span className="text-2xl font-bold tracking-tight">TinyCloud</span>
            </div>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your account</p>
            </div>
            <LoginForm />
          </div>
        </div>
        <div className="relative hidden flex-1 overflow-hidden border-l border-border bg-background lg:flex">
          <div className="absolute inset-0">
            <Dither
              waveColor={[0.55, 0.36, 0.96]}
              waveFrequency={3}
              waveAmplitude={0.4}
              colorNum={4}
              pixelSize={2}
              seed={seed}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-grid-fade opacity-40" />
          <div className="relative z-10 flex flex-col justify-end p-10">
            <div className="max-w-md">
              <p className="text-sm font-medium leading-relaxed text-foreground/80">
                A mini-cloud for deploying your projects.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
