import NextAuth from "next-auth"
export let lastAuthError = "";

import GitHub from "next-auth/providers/github"
import { getPrisma } from "@/lib/prisma"
import { getCloudflareContext } from "@opennextjs/cloudflare"

function getAuthInstance() {
  let env: any = process.env;
  try {
    env = getCloudflareContext().env || process.env;
  } catch (e) {
    // Fallback to process.env if not in Cloudflare context
  }

  const processEnv = process["env"] || {};

  return NextAuth({
    logger: {
      error(error) {
        lastAuthError = String(error?.message || error?.name || error) + " | PROCESS_ENV_KEYS: " + Object.keys(processEnv).join(",") + " | CF_ENV_KEYS: " + Object.keys(env).join(",");
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
    async jwt({ token, user, account, profile }) {
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
        // @ts-ignore
        session.user.jwtSalt = token.jwtSalt as number;
        // @ts-ignore
        session.user.username = token.githubUsername as string;
        // @ts-ignore
        session.user.avatarUrl = token.avatarUrl as string;
      }
      return session;
    }
  }
  })
}

export const handlers = {
  GET: (req: any) => getAuthInstance().handlers.GET(req),
  POST: (req: any) => getAuthInstance().handlers.POST(req),
};
export const signIn = (...args: any[]) => (getAuthInstance().signIn as any)(...args);
export const signOut = (...args: any[]) => (getAuthInstance().signOut as any)(...args);
export const auth = (...args: any[]) => (getAuthInstance().auth as any)(...args);

