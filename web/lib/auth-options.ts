import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  authFailureDelay,
  getFallbackAdminCredentials,
  hasConfiguredDatabase,
  safeEqualText,
} from "@/lib/runtime-config";

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.NEXTAUTH_SECRET ||
    process.env.NEXTAUTH_SECRET.length < 32)
) {
  throw new Error(
    "NEXTAUTH_SECRET은 프로덕션에서 필수입니다(32자 이상). Vercel Environment Variables에 설정하세요.",
  );
}

const devFallbackSecret =
  "local-dev-only-nextauth-secret-do-not-use-in-production-min-32";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const fallback = getFallbackAdminCredentials();
        if (!hasConfiguredDatabase()) {
          if (
            fallback &&
            safeEqualText(email, fallback.email) &&
            safeEqualText(password, fallback.password)
          ) {
            return {
              id: "fallback-admin",
              email: fallback.email,
              name: "Fallback Admin",
              role: "ADMIN",
            };
          }
          await authFailureDelay();
          return null;
        }

        try {
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            await authFailureDelay();
            return null;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            await authFailureDelay();
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch {
          if (
            fallback &&
            safeEqualText(email, fallback.email) &&
            safeEqualText(password, fallback.password)
          ) {
            return {
              id: "fallback-admin",
              email: fallback.email,
              name: "Fallback Admin",
              role: "ADMIN",
            };
          }
          await authFailureDelay();
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role as typeof session.user.role;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret:
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? devFallbackSecret : undefined),
};
