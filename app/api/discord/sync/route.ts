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

function descobrirCargo(cargos: string[]) {
  const cargosLimpos = cargos.map((cargo) =>
    cargo.replace(/[^\p{L}\p{N}\s-]/gu, "").trim()
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
    { discord: "Gerente de Ações", site: "Gerente de Ações" },
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

function pesoCargo(cargo: string) {
  const pesos: Record<string, number> = {
    Removido: 0,
    Nenhum: 1,
    Membro: 2,
    Elite: 3,
    "Admin Farm": 4,
    "Gerente de Farm": 5,
    "Gerente de Produção": 5,
    "Gerente de Compras": 5,
    "Gerente de Vendas": 5,
    "Gerente de Ações": 5,
    "Gerente Geral": 6,
    "Vice-Líder": 7,
    Líder: 8,
  };

  return pesos[cargo] || 2;
}

async function enviarLogCargo({
  nome,
  cargoAntigo,
  cargoNovo,
}: {
  nome: string;
  cargoAntigo: string;
  cargoNovo: string;
}) {
  try {
    if (!process.env.DISCORD_LOG_CARGOS_CHANNEL_ID) return;

    const pesoAntigo = pesoCargo(cargoAntigo);
    const pesoNovo = pesoCargo(cargoNovo);

    const tipo =
      pesoNovo > pesoAntigo
        ? "promocao"
        : pesoNovo < pesoAntigo
        ? "rebaixamento"
        : "alteracao";

    await fetch(`${process.env.NEXTAUTH_URL}/api/discord/log-cargos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo,
        nome,
        cargoAntigo,
        cargoNovo,
      }),
    });
  } catch (error) {
    console.error("Erro ao enviar log de cargo:", error);
  }
}

async function enviarLogExpulsao({
  nome,
  cargoAntigo,
}: {
  nome: string;
  cargoAntigo: string;
}) {
  try {
    if (!process.env.DISCORD_LOG_EXPULSOES_CHANNEL_ID) return;

    await fetch(`${process.env.NEXTAUTH_URL}/api/discord/log-expulsoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nome,
        cargoAntigo,
      }),
    });
  } catch (error) {
    console.error("Erro ao enviar log de expulsão:", error);
  }
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
    const dadosCadastrados = new Map<string, any>();
    const discordIdsNoServidor = new Set<string>();

    membrosSnap.forEach((docItem) => {
      const data = docItem.data();

      if (data.discordId) {
        cadastrados.set(data.discordId, docItem.id);
        dadosCadastrados.set(data.discordId, data);
      }
    });

    const pendentes: any[] = [];
    let atualizados = 0;
    let removidos = 0;
    let cargosAlterados = 0;

    for (const [, member] of discordMembers) {
      if (member.user.bot) continue;

      discordIdsNoServidor.add(member.id);

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
        removidoEm: null,
        atualizadoEm: new Date(),
      };

      const membroDocId = cadastrados.get(member.id);
      const dadosAntigos = dadosCadastrados.get(member.id);

      if (membroDocId) {
        const cargoAntigo = dadosAntigos?.cargo || "Nenhum";

        if (cargoAntigo !== cargoDetectado && cargoAntigo !== "Removido") {
          cargosAlterados++;

          await enviarLogCargo({
            nome:
              dadosAntigos?.nomeRP ||
              dadosAntigos?.nomeDiscord ||
              dadosAntigos?.nome ||
              member.displayName ||
              member.user.username ||
              "Sem nome",
            cargoAntigo,
            cargoNovo: cargoDetectado,
          });
        }

        await updateDoc(doc(db, "membros", membroDocId), {
          ...dadosDiscord,
          status:
            dadosAntigos?.status === "removido"
              ? "aprovado"
              : dadosAntigos?.status || "aprovado",
        });

        atualizados++;
      } else {
        pendentes.push(dadosDiscord);

        await setDoc(doc(db, "membros_discord_pendentes", member.id), {
          ...dadosDiscord,
          status: "nao_cadastrado",
        });
      }
    }

    for (const [discordId, membroDocId] of cadastrados.entries()) {
      if (!discordIdsNoServidor.has(discordId)) {
        const dadosAntigos = dadosCadastrados.get(discordId);

        if (dadosAntigos?.status !== "removido") {
          await enviarLogExpulsao({
            nome:
              dadosAntigos?.nomeRP ||
              dadosAntigos?.nomeDiscord ||
              dadosAntigos?.nome ||
              "Sem nome",
            cargoAntigo: dadosAntigos?.cargo || "Membro",
          });
        }

        await updateDoc(doc(db, "membros", membroDocId), {
          status: "removido",
          cargo: "Removido",
          removidoEm: new Date(),
          atualizadoEm: new Date(),
        });

        removidos++;
      }
    }

    await client.destroy();

    return NextResponse.json({
      sucesso: true,
      totalDiscord: discordMembers.filter((m) => !m.user.bot).size,
      totalCadastrados: cadastrados.size,
      totalAtualizados: atualizados,
      totalPendentes: pendentes.length,
      totalRemovidos: removidos,
      totalCargosAlterados: cargosAlterados,
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