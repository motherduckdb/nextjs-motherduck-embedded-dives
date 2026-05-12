import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { findAppUserByEmail } from "@/app/_lib/db";
import { verifyPassword } from "@/app/_lib/password";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials.email === "string" ? credentials.email.trim() : "";
        const password = typeof credentials.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await findAppUserByEmail(email);
        if (!user || !(await verifyPassword(password, user.password_hash))) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
});
