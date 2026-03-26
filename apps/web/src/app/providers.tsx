"use client";
import { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ErrorBoundary>{children}</ErrorBoundary>
    </ToastProvider>
  );
}
