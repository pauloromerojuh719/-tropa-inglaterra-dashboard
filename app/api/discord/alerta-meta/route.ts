import { NextResponse } from "next/server";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;
const TOTAL_META = META_FOLHAS + META_OPIOS + META_SERINGAS + META_AGULHAS;

function dataBrasilAgora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dataBrasilSomenteData(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function hojeBrasil() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    })
  );
}

function inicioDaSemana() {
  const hoje = hojeBrasil();
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

function converterDataFirebase(data: any) {
  if (!data) return null;

  if (data?.toDate) {
    return data.toDate();
  }

  return new Date(data);
}

function dentroDaSemana(data: any) {
  const d = converterDataFirebase(data);

  if (!d) return false;

  return d >= inicioDaSemana() && d <= fimDaSemana();
}

function isentoMeta(cargo?: string) {
  const cargoLimpo = cargo?.trim();
  return cargoLimpo === "Elite" || cargoLimpo === "Gerente de Ações";
}

function calcularFalta(atual: number, meta: number) {
  return Math.max(0, meta - atual);
}

export async function GET() {
  try {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);

    const canal = await client.channels.fetch(
      process.env.DISCORD_ALERTA_META_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal de alerta de meta não encontrado." },
        { status: 500 }
      );
    }

    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));

    const farmPorMembro: Record<
      string,
      {
        nome: string;
        folhas: number;
        opios: number;
        seringas: number;
        agulhas: number;
      }
    > = {};

    farmSnap.docs.forEach((docItem) => {
      const farm = docItem.data();

      if (farm.status !== "aprovado") return;
      if (!dentroDaSemana(farm.criadoEm)) return;

      const membroId =
        farm.membroId || farm.discordId || farm.membroEmail || farm.membroNome;

      if (!farmPorMembro[membroId]) {
        farmPorMembro[membroId] = {
          nome: farm.membroNome || "Sem nome",
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
        };
      }

      farmPorMembro[membroId].folhas += Number(farm.folhas || 0);
      farmPorMembro[membroId].opios += Number(farm.opios || 0);
      farmPorMembro[membroId].seringas += Number(farm.seringas || 0);
      farmPorMembro[membroId].agulhas += Number(farm.agulhas || 0);
    });

    const longeDaMeta: string[] = [];
    const quaseNaMeta: string[] = [];
    const bateramMeta: string[] = [];
    const dmsEnviadas: string[] = [];
    const dmsFalharam: string[] = [];

    let isentos = 0;

    for (const docItem of membrosSnap.docs) {
      const membro = docItem.data();

      if (membro.status !== "aprovado") continue;

      if (isentoMeta(membro.cargo)) {
        isentos++;
        continue;
      }

      const membroId = membro.discordId || docItem.id;

      const nome =
        membro.nomeRP ||
        membro.nomeDiscord ||
        membro.nome ||
        membro.username ||
        "Sem nome";

      const farm = farmPorMembro[membroId] || {
        nome,
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
      };

      const folhasValidas = Math.min(farm.folhas, META_FOLHAS);
      const opiosValidos = Math.min(farm.opios, META_OPIOS);
      const seringasValidas = Math.min(farm.seringas, META_SERINGAS);
      const agulhasValidas = Math.min(farm.agulhas, META_AGULHAS);

      const total =
        folhasValidas + opiosValidos + seringasValidas + agulhasValidas;

      const porcentagem = Math.floor((total / TOTAL_META) * 100);

      const linha = `${nome}: ${porcentagem}%`;

      if (porcentagem >= 100) {
        bateramMeta.push(linha);
      } else if (porcentagem >= 50) {
        quaseNaMeta.push(linha);
      } else {
        longeDaMeta.push(linha);

        if (membro.discordId) {
          try {
            const usuario = await client.users.fetch(membro.discordId);

            await usuario.send({
              embeds: [
                {
                  color: 0xff0000,
                  title: "⚠️ Alerta de Meta - Inglaterra",
                  description:
                    `Olá, **${nome}**.\n\n` +
                    `Sua meta semanal está em **${porcentagem}%**.\n` +
                    `A semana encerra no domingo.\n\n` +
                    `Regularize sua entrega antes do fechamento da semana.\n\n` +
                    `📅 Enviado em: ${dataBrasilAgora()}`,
                  fields: [
                    {
                      name: "🍃 Folhas",
                      value: `${farm.folhas}/${META_FOLHAS} | Faltam ${calcularFalta(
                        farm.folhas,
                        META_FOLHAS
                      )}`,
                      inline: false,
                    },
                    {
                      name: "💊 Ópios",
                      value: `${farm.opios}/${META_OPIOS} | Faltam ${calcularFalta(
                        farm.opios,
                        META_OPIOS
                      )}`,
                      inline: false,
                    },
                    {
                      name: "💉 Seringas",
                      value: `${farm.seringas}/${META_SERINGAS} | Faltam ${calcularFalta(
                        farm.seringas,
                        META_SERINGAS
                      )}`,
                      inline: false,
                    },
                    {
                      name: "🪡 Agulhas",
                      value: `${farm.agulhas}/${META_AGULHAS} | Faltam ${calcularFalta(
                        farm.agulhas,
                        META_AGULHAS
                      )}`,
                      inline: false,
                    },
                  ],
                  footer: {
                    text: "Painel Inglaterra",
                  },
                },
              ],
            });

            dmsEnviadas.push(nome);
          } catch (erro) {
            console.error(`Erro ao enviar DM para ${nome}:`, erro);
            dmsFalharam.push(nome);
          }
        }
      }
    }

    const inicioSemana = inicioDaSemana();
    const fimSemana = fimDaSemana();

    await canal.send({
      embeds: [
        {
          color: 0xf1c40f,
          title: "⚠️ Alerta de Meta Semanal - Inglaterra",
          description: `Semana: ${dataBrasilSomenteData(
            inicioSemana
          )} até ${dataBrasilSomenteData(fimSemana)}
Gerado em: ${dataBrasilAgora()}`,
          fields: [
            {
              name: "❌ Longe da meta",
              value:
                longeDaMeta.length > 0
                  ? longeDaMeta.slice(0, 20).join("\n")
                  : "Ninguém abaixo de 50%.",
              inline: false,
            },
            {
              name: "⚠️ Acima de 50%, mas ainda não bateu",
              value:
                quaseNaMeta.length > 0
                  ? quaseNaMeta.slice(0, 20).join("\n")
                  : "Ninguém nessa faixa.",
              inline: false,
            },
            {
              name: "✅ Bateram meta",
              value:
                bateramMeta.length > 0
                  ? bateramMeta.slice(0, 20).join("\n")
                  : "Ninguém bateu ainda.",
              inline: false,
            },
            {
              name: "📩 DMs enviadas",
              value:
                dmsEnviadas.length > 0
                  ? dmsEnviadas.slice(0, 20).join("\n")
                  : "Nenhuma DM enviada.",
              inline: false,
            },
            {
              name: "⚠️ DMs com falha",
              value:
                dmsFalharam.length > 0
                  ? dmsFalharam.slice(0, 20).join("\n")
                  : "Nenhuma falha.",
              inline: false,
            },
            {
              name: "⚔️ Isentos",
              value: String(isentos),
              inline: true,
            },
          ],
          footer: {
            text: "Painel Inglaterra",
          },
        },
      ],
    });

    await client.destroy();

    return NextResponse.json({
      sucesso: true,
      longeDaMeta: longeDaMeta.length,
      quaseNaMeta: quaseNaMeta.length,
      bateramMeta: bateramMeta.length,
      dmsEnviadas: dmsEnviadas.length,
      dmsFalharam: dmsFalharam.length,
      isentos,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { erro: "Erro ao gerar alerta de meta." },
      { status: 500 }
    );
  }
}