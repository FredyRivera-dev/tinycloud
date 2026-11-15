"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSetupStatus } from "@/lib/api";
import { SetupForm } from "@/components/setup/SetupForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Dither from "@/components/Dither";

type Status = "checking" | "needs_setup" | "redirecting" | "unreachable";

export default function SetupPage() {
  const router = useRouter();
  const seed = 73;
  const [status, setStatus] = useState<Status>("checking");
  const [checkError, setCheckError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setStatus("checking");
    setCheckError(null);
    try {
      const { needs_setup } = await getSetupStatus();
      if (needs_setup) {
        setStatus("needs_setup");
      } else {
        setStatus("redirecting");
        router.replace("/login");
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Could not reach the TinyCloud API");
      setStatus("unreachable");
    }
  }, [router]);

  useEffect(() => {
    // Initial check without a synchronous setState: "checking" is already the
    // initial state, and the retry button handles its own loading state.
    let active = true;
    getSetupStatus()
      .then(({ needs_setup }) => {
        if (!active) return;
        if (needs_setup) {
          setStatus("needs_setup");
        } else {
          setStatus("redirecting");
          router.replace("/login");
        }
      })
      .catch((err) => {
        if (!active) return;
        setCheckError(err instanceof Error ? err.message : "Could not reach the TinyCloud API");
        setStatus("unreachable");
      });
    return () => {
      active = false;
    };
  }, [router]);

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
              <h1 className="text-2xl font-semibold tracking-tight">First run setup</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Create the administrator account for this TinyCloud instance
              </p>
            </div>

            {status === "checking" && (
              <div className="space-y-5" aria-label="Checking setup status">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-8 w-full" />
                </div>
                <Skeleton className="h-8 w-full" />
              </div>
            )}

            {status === "unreachable" && (
              <div className="space-y-4">
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {checkError}
                </div>
                <Button type="button" className="w-full" onClick={() => void check()}>
                  Try again
                </Button>
              </div>
            )}

            {status === "needs_setup" && <SetupForm />}

            {(status === "checking" || status === "redirecting") && <span className="sr-only">Loading</span>}
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
