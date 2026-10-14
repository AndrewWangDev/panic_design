import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { getPrisma } from "@/lib/prisma"
import { getCloudflareContext } from "@opennextjs/cloudflare"

function getAuthInstance() {
  let env: Record<string, string | undefined> = process.env;
  try {
    env = (getCloudflareContext().env as unknown as Record<string, string | undefined>) || process.env;
  } catch {
    // Fallback to process.env if not in Cloudflare context
  }

  const processEnv = process["env"] || {};

  return NextAuth({
    logger: {
      error(error) {
        console.error("[NextAuth Error]", error);
      }
    },
    trustHost: true,
    secret: processEnv.AUTH_SECRET || env.AUTH_SECRET,
    providers: [
      GitHub({
        clientId: processEnv.AUTH_CLIENT_ID || env.AUTH_CLIENT_ID,
        clientSecret: processEnv.AUTH_CLIENT_SECRET || env.AUTH_CLIENT_SECRET,
      })
    ],
    callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github") {
        if (!profile?.id) return false;
        
        const githubId = Number(profile.id);
        const login = profile.login as string;
        
        const prisma = getPrisma();

        const existingUser = await prisma.user.findUnique({
          where: { githubId }
        });

        if (!existingUser) {
          const totalUsers = await prisma.user.count();
          if (totalUsers >= 100) {
            return "/?error=EnrollmentFull";
          }
        }

        await prisma.user.upsert({
          where: { githubId },
          update: {
            username: login,
            email: user.email,
            avatarUrl: user.image,
          },
          create: {
            githubId,
            username: login,
            email: user.email,
            avatarUrl: user.image,
          }
        });
        return true;
      }
      return true;
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const prisma = getPrisma();
        const dbUser = await prisma.user.findUnique({ 
          where: { githubId: Number(profile.id) } 
        });
        
        if (dbUser) {
          token.internalId = dbUser.id;
          token.jwtSalt = dbUser.jwtSalt;
          token.githubUsername = profile.login;
          token.avatarUrl = dbUser.avatarUrl;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.internalId) {
        session.user.id = token.internalId as string;
        // @ts-expect-error Custom session properties
        session.user.jwtSalt = token.jwtSalt as number;
        // @ts-expect-error Custom session properties
        session.user.username = token.githubUsername as string;
        // @ts-expect-error Custom session properties
        session.user.avatarUrl = token.avatarUrl as string;
      }
      return session;
    }
  }
  })
}

type AuthHandlers = ReturnType<typeof getAuthInstance>["handlers"];
export const handlers: AuthHandlers = {
  GET: (req) => getAuthInstance().handlers.GET(req),
  POST: (req) => getAuthInstance().handlers.POST(req),
};
export const signIn: ReturnType<typeof NextAuth>["signIn"] = (...args: any[]) => (getAuthInstance().signIn as any)(...args);
export const signOut: ReturnType<typeof NextAuth>["signOut"] = (...args: any[]) => (getAuthInstance().signOut as any)(...args);
export const auth: ReturnType<typeof NextAuth>["auth"] = (...args: any[]) => (getAuthInstance().auth as any)(...args);



