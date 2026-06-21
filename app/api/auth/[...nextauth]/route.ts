import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

const SERVIDOR_INGLATERRA_ID = "1497350651187826691";

const handler = NextAuth({
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify email guilds",
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ account }) {
      if (!account?.access_token) {
        return false;
      }

      const resposta = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });

      if (!resposta.ok) {
        return false;
      }

      const servidores = await resposta.json();

      const estaNoServidor = servidores.some(
        (servidor: any) => servidor.id === SERVIDOR_INGLATERRA_ID
      );

      if (!estaNoServidor) {
        return false;
      }

      return true;
    },

    async jwt({ token, profile }) {
      if (profile) {
        token.id = (profile as any).id;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
      }

      return session;
    },
  },
});

export { handler as GET, handler as POST };