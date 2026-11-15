import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validation";
import { isEmail, normalizePhone } from "@/lib/phone";

const providers = [
  Credentials({
    credentials: { identifier: {}, password: {} },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const { identifier, password } = parsed.data;
      const where = isEmail(identifier)
        ? { email: identifier.toLowerCase() }
        : { phone: normalizePhone(identifier) ?? "__none__" };
      const user = await db.user.findUnique({ where });
      if (!user?.passwordHash || user.status !== "ACTIVE") return null;
      if (!(await bcrypt.compare(password, user.passwordHash))) return null;
      return { id: user.id, name: user.name, email: user.email, image: user.image };
    },
  }),
  ...(process.env.AUTH_GOOGLE_ID ? [Google({ allowDangerousEmailAccountLinking: false })] : []),
];

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers,
  pages: { signIn: "/fr/login" },
  logger: {
    // A wrong password is normal user behaviour, not a server error
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(error);
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
  events: {
    // Google has already verified the address
    async linkAccount({ user, account }) {
      if (account.provider === "google" && user.id) {
        await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
      }
    },
  },
});
