import { NextResponse } from "next/server";
import { Client, GatewayIntentBits } from "discord.js";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
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

async function sincronizarDiscord() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);

  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
  await guild.members.fetch();

  let criados = 0;
  let atualizados = 0;

  for (const [, member] of guild.members.cache) {
    if (member.user.bot) continue;

    const cargos = member.roles.cache.map((role) => role.name);
    const cargoSite = descobrirCargo(cargos);

    const ref = doc(db, "membros", member.id);
    const snap = await getDoc(ref);

    const dados = {
      discordId: member.id,
      nome: member.user.globalName || member.user.username,
      nomeDiscord: member.displayName || member.user.username,
      username: member.user.username,
      email: "",
      cargo: cargoSite,
      status: "aprovado",
      atualizadoEm: Timestamp.now(),
    };

    if (snap.exists()) {
      await updateDoc(ref, {
        discordId: member.id,
        nomeDiscord: member.displayName || member.user.username,
        username: member.user.username,
        cargo: cargoSite,
        status: "aprovado",
        atualizadoEm: Timestamp.now(),
      });

      atualizados++;
    } else {
      await setDoc(ref, {
        ...dados,
        criadoEm: Timestamp.now(),
      });

      criados++;
    }
  }

  await client.destroy();

  return {
    status: "OK",
    mensagem: "Sincronização concluída.",
    criados,
    atualizados,
  };
}

export async function GET() {
  try {
    const resultado = await sincronizarDiscord();
    return NextResponse.json(resultado);
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

export async function POST() {
  return GET();
}