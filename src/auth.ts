import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { z } from "zod";

import { env } from "@/env";
import { authorizeLocalCredentials } from "@/server/auth/credentials";
import { db } from "@/server/db/client";
import { accounts, sessions, users, verificationTokens } from "@/server/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const providers = [];

if (env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) {
  providers.push(
    Discord({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

if (env.LOCAL_AUTH_ENABLED) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        return authorizeLocalCredentials(parsed.data.email, parsed.data.password);
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET ?? "dynasty-command-center-local-development-secret",
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        return true;
      }

      return Boolean(user.email);
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "member";
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as "admin" | "member") ?? "member";
      }

      return session;
    },
  },
});
