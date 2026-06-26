import { NextResponse } from "next/server";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function inicioDaSemana() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const diferenca = dia === 0 ? 6 : dia - 1;

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - diferenca);
  inicio.setHours(0, 0, 0, 0);

  return inicio;
}

function fimDaSemana() {
  const inicio = inicioDaSemana();
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);

  return fim;
}

function dentroDaSemana(data: any) {
  const d = data?.toDate?.();
  return d && d >= inicioDaSemana() && d <= fimDaSemana();
}

function dinheiro(valor: number) {
  return `R$ ${valor.toLocaleString("pt-BR")}`;
}

function isentoMeta(cargo?: string) {
  const cargoLimpo = cargo?.trim();
  return cargoLimpo === "Elite" || cargoLimpo === "Gerente de Ações";
}

export async function GET() {
  try {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);

    const canal = await client.channels.fetch(
      process.env.DISCORD_RELATORIO_SEMANAL_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal do relatório não encontrado." },
        { status: 500 }
      );
    }

    const farmSnap = await getDocs(collection(db, "farm"));
    const vendasSnap = await getDocs(collection(db, "vendas"));
    const comprasSnap = await getDocs(collection(db, "compras"));
    const producoesSnap = await getDocs(collection(db, "producoes"));
    const reembolsosSnap = await getDocs(collection(db, "reembolsos"));
    const acoesSnap = await getDocs(collection(db, "acoes"));
    const membrosSnap = await getDocs(collection(db, "membros"));
    const plantoesSnap = await getDocs(collection(db, "plantoes"));

    let totalFarm = 0;
    let totalVendas = 0;
    let totalCompras = 0;
    let totalProduzido = 0;
    let totalReembolsosPagos = 0;
    let totalAcoes = 0;
    let totalHoras = 0;

    const metasPorMembro: Record<
      string,
      {
        folhas: number;
        opios: number;
        seringas: number;
        agulhas: number;
      }
    > = {};

    farmSnap.docs.forEach((doc) => {
      const f = doc.data();

      if (f.status === "aprovado" && dentroDaSemana(f.criadoEm)) {
        const membroId = f.membroId || f.discordId || f.membroEmail || f.membroNome;

        if (!metasPorMembro[membroId]) {
          metasPorMembro[membroId] = {
            folhas: 0,
            opios: 0,
            seringas: 0,
            agulhas: 0,
          };
        }

        metasPorMembro[membroId].folhas += Number(f.folhas || 0);
        metasPorMembro[membroId].opios += Number(f.opios || 0);
        metasPorMembro[membroId].seringas += Number(f.seringas || 0);
        metasPorMembro[membroId].agulhas += Number(f.agulhas || 0);

        totalFarm +=
          Number(f.folhas || 0) +
          Number(f.opios || 0) +
          Number(f.seringas || 0) +
          Number(f.agulhas || 0);
      }
    });

    vendasSnap.docs.forEach((doc) => {
      const v = doc.data();
      if (dentroDaSemana(v.criadoEm)) {
        totalVendas += Number(v.valor || 0);
      }
    });

    comprasSnap.docs.forEach((doc) => {
      const c = doc.data();
      if (dentroDaSemana(c.criadoEm)) {
        totalCompras += Number(c.valor || 0);
      }
    });

    producoesSnap.docs.forEach((doc) => {
      const p = doc.data();
      if (dentroDaSemana(p.criadoEm)) {
        totalProduzido += Number(p.quantidade || 0);
      }
    });

    reembolsosSnap.docs.forEach((doc) => {
      const r = doc.data();
      if (r.status === "pago" && dentroDaSemana(r.pagoEm || r.criadoEm)) {
        totalReembolsosPagos += Number(r.valor || 0);
      }
    });

    acoesSnap.docs.forEach((doc) => {
      const a = doc.data();
      if (dentroDaSemana(a.criadoEm)) {
        totalAcoes++;
      }
    });

    plantoesSnap.docs.forEach((doc) => {
      const p = doc.data();
      if (p.status === "fechado" && dentroDaSemana(p.fim || p.inicio)) {
        totalHoras += Number(p.minutos || 0);
      }
    });

    const membrosAprovadosDocs = membrosSnap.docs.filter((doc) => {
      const m = doc.data();
      return m.status === "aprovado";
    });

    const membrosAprovados = membrosAprovadosDocs.length;

    const removidos = membrosSnap.docs.filter((doc) => {
      const m = doc.data();
      return m.status === "removido";
    }).length;

    let bateramMeta = 0;
    let naoBateramMeta = 0;
    let isentos = 0;

    membrosAprovadosDocs.forEach((doc) => {
      const m = doc.data();
      const membroId = m.discordId || doc.id;

      if (isentoMeta(m.cargo)) {
        isentos++;
        return;
      }

      const meta = metasPorMembro[membroId] || {
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
      };

      const bateu =
        meta.folhas >= META_FOLHAS &&
        meta.opios >= META_OPIOS &&
        meta.seringas >= META_SERINGAS &&
        meta.agulhas >= META_AGULHAS;

      if (bateu) {
        bateramMeta++;
      } else {
        naoBateramMeta++;
      }
    });

    const horas = Math.floor(totalHoras / 60);
    const minutos = totalHoras % 60;

    await canal.send({
      embeds: [
        {
          color: 0xe74c3c,
          title: "📊 Relatório Semanal - Inglaterra",
          description: `Semana: ${inicioDaSemana().toLocaleDateString(
            "pt-BR"
          )} até ${fimDaSemana().toLocaleDateString("pt-BR")}`,
          fields: [
            {
              name: "👥 Membros aprovados",
              value: String(membrosAprovados),
              inline: true,
            },
            {
              name: "🚪 Removidos",
              value: String(removidos),
              inline: true,
            },
            {
              name: "✅ Bateram meta",
              value: String(bateramMeta),
              inline: true,
            },
            {
              name: "❌ Não bateram meta",
              value: String(naoBateramMeta),
              inline: true,
            },
            {
              name: "⚔️ Isentos",
              value: String(isentos),
              inline: true,
            },
            {
              name: "📦 Farm aprovado",
              value: totalFarm.toLocaleString("pt-BR"),
              inline: true,
            },
            {
              name: "💵 Vendas",
              value: dinheiro(totalVendas),
              inline: true,
            },
            {
              name: "🛒 Compras",
              value: dinheiro(totalCompras),
              inline: true,
            },
            {
              name: "🏭 Produção",
              value: totalProduzido.toLocaleString("pt-BR"),
              inline: true,
            },
            {
              name: "💸 Reembolsos pagos",
              value: dinheiro(totalReembolsosPagos),
              inline: true,
            },
            {
              name: "🎯 Ações realizadas",
              value: String(totalAcoes),
              inline: true,
            },
            {
              name: "⏱️ Horas registradas",
              value: `${horas}h ${minutos}m`,
              inline: true,
            },
          ],
          footer: {
            text: "Painel Inglaterra",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    await client.destroy();

    return NextResponse.json({
      sucesso: true,
      bateramMeta,
      naoBateramMeta,
      isentos,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { erro: "Erro ao gerar relatório semanal." },
      { status: 500 }
    );
  }
}