import { NextResponse } from "next/server";
import { Client, GatewayIntentBits } from "discord.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

async function buscarSemCadastro() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  await guild.members.fetch();

  const snapshot = await getDocs(collection(db, "membros"));

  const cadastrados = new Set(
    snapshot.docs.map((doc) => {
      const dados = doc.data() as any;
      return dados.discordId || doc.id;
    })
  );

  const lista = guild.members.cache
    .filter((m) => !m.user.bot)
    .filter((m) => !cadastrados.has(m.id))
    .map((m) => ({
      discordId: m.id,
      nome: m.displayName || m.user.username,
      username: m.user.username,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  await client.destroy();

  return lista;
}

export async function GET() {
  try {
    const membros = await buscarSemCadastro();

    return NextResponse.json({
      status: "OK",
      total: membros.length,
      membros,
    });
  } catch (erro) {
    return NextResponse.json(
      {
        status: "ERRO",
        erro: String(erro),
      },
      { status: 500 }
    );
  }
}