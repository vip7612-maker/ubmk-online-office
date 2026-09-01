import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { envAdminEmails, findMemberByEmail, upsertMemberOnLogin } from "@/lib/members";

const allowedDomain = () => process.env.ALLOWED_GOOGLE_DOMAIN?.trim().toLowerCase() || "";

/** 이 이메일이 이 교무실에 들어올 수 있는가. */
function isAllowedEmail(email: string, hd?: string): boolean {
  const e = email.toLowerCase();
  if (envAdminEmails().includes(e)) return true; // 예외 허용 목록이 항상 우선
  const domain = allowedDomain();
  if (!domain) return true; // 도메인 미설정(로컬 개발) → 전체 허용
  return hd?.toLowerCase() === domain || e.endsWith("@" + domain);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
          // 구글 계정 선택 화면에서부터 학교 도메인만 보이게 한다(우회는 signIn에서 막는다).
          ...(allowedDomain() ? { hd: allowedDomain() } : {}),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile, user }) {
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      if (!email) return false;

      const hd = (profile as { hd?: string } | undefined)?.hd;
      if (!isAllowedEmail(email, hd)) return false;

      // 관리자가 비활성 처리한 계정은 도메인이 맞아도 막는다.
      const existing = await findMemberByEmail(email);
      if (existing && !existing.active && !envAdminEmails().includes(email)) return false;

      await upsertMemberOnLogin({
        email,
        name: user?.name ?? (profile?.name as string) ?? null,
        image: user?.image ?? (profile?.picture as string) ?? null,
      });
      return true;
    },

    async jwt({ token, trigger }) {
      // 로그인 직후, 그리고 session.update() 호출 시 DB에서 권한을 다시 읽는다.
      if (!token.email) return token;
      if (token.memberId && trigger !== "signIn" && trigger !== "update") return token;

      const member = await findMemberByEmail(token.email);
      if (member) {
        token.memberId = member.id;
        token.role = member.role;
        token.department = member.department;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.memberId as string) ?? "";
        session.user.role = (token.role as "admin" | "member") ?? "member";
        session.user.department = (token.department as string | null) ?? null;
      }
      return session;
    },
  },
});
