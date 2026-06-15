"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../api";

export function useAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedEmail = localStorage.getItem("userEmail");
    if (!savedToken) {
      router.push("/signin");
    } else {
      setToken(savedToken);
      setUserEmail(savedEmail);
    }
  }, [router]);

  const signout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    router.push("/signin");
  }, [router]);

  const handleApiAuthError = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && err.status === 401) {
        signout();
        return true;
      }
      return false;
    },
    [signout],
  );

  return { token, userEmail, signout, handleApiAuthError };
}
