"use client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL
});

export const { signIn, signUp, signOut, useSession } = authClient;
