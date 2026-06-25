import { NextResponse } from "next/server";
import { Client, GatewayIntentBits } from "discord.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";

function limparCargo(cargo: string) {
  return cargo
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim();
}

function descobrirCargo(cargos: string[]) {
  const cargosLimpos = cargos.map((cargo) =>
    cargo
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
  );

  const prioridade = [
    { discord: "Líder", site: "Líder" },
    { discord: "Vice-Líder", site: "Vice-Líder" },
    { discord: "Gerente Geral", site: "Gerente Geral" },

    { discord: "Gerente de Farm", site: "Gerente de Farm" },
    { discord: "Gerente de Produção", site: "Gerente de Produção" },
    { discord: "Gerente de Compras", site: "Gerente de Compras" },
    { discord: "Gerente de Vendas", site: "Gerente de Vendas" },
    { discord: "Gerente de Ação", site: "Gerente de Ações" },

    { discord: "Admin Farm", site: "Admin Farm" },

    { discord: "Elite Alfa", site: "Elite" },
{ discord: "Elite", site: "Elite" },

{ discord: "Membro", site: "Membro" },
  ];

  for (const cargo of prioridade) {
    if (cargosLimpos.includes(cargo.discord)) {
      return cargo.site;
    }
  }

  return "Membro";
}

export async function GET() {
  try {
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !guildId) {
      return NextResponse.json(
        { erro: "Token ou Guild ID não configurado." },
        { status: 500 }
      );
    }

    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    await client.login(token);

    const guild = await client.guilds.fetch(guildId);
    const discordMembers = await guild.members.fetch();

    const membrosSnap = await getDocs(collection(db, "membros"));

    const cadastrados = new Map<string, string>();

    membrosSnap.forEach((docItem) => {
      const data = docItem.data();

      if (data.discordId) {
        cadastrados.set(data.discordId, docItem.id);
      }
    });

    const pendentes: any[] = [];
    let atualizados = 0;

    for (const [, member] of discordMembers) {
      if (member.user.bot) continue;

      const cargosDiscord = member.roles.cache
        .filter((role) => role.name !== "@everyone")
        .map((role) => role.name);

      const cargoDetectado = descobrirCargo(cargosDiscord);

      const dadosDiscord = {
        discordId: member.id,
        nomeDiscord: member.displayName,
        username: member.user.username,
        avatar: member.user.displayAvatarURL(),
        cargosDiscord,
        cargo: cargoDetectado,
        entrouServidorEm: member.joinedAt,
        atualizadoEm: new Date(),
      };

      const membroDocId = cadastrados.get(member.id);

      if (membroDocId) {
        await updateDoc(doc(db, "membros", membroDocId), dadosDiscord);
        atualizados++;
      } else {
        pendentes.push(dadosDiscord);

        await setDoc(doc(db, "membros_discord_pendentes", member.id), {
          ...dadosDiscord,
          status: "nao_cadastrado",
        });
      }
    }

    await client.destroy();

    return NextResponse.json({
      sucesso: true,
      totalDiscord: discordMembers.filter((m) => !m.user.bot).size,
      totalCadastrados: cadastrados.size,
      totalAtualizados: atualizados,
      totalPendentes: pendentes.length,
      pendentes,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { erro: "Erro ao sincronizar Discord." },
      { status: 500 }
    );
  }
}