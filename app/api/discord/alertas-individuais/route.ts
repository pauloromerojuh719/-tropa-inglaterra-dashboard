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

function dataBrasilSomenteData(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
}function calcularFalta(atual: number, meta: number) {
  return Math.max(0, meta - atual);
}

function calcularPorcentagem(farm: {
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
}) {
  const folhasValidas = Math.min(farm.folhas, META_FOLHAS);
  const opiosValidos = Math.min(farm.opios, META_OPIOS);
  const seringasValidas = Math.min(farm.seringas, META_SERINGAS);
  const agulhasValidas = Math.min(farm.agulhas, META_AGULHAS);

  const total =
    folhasValidas + opiosValidos + seringasValidas + agulhasValidas;

  return Math.floor((total / TOTAL_META) * 100);
}

function nomeMembro(membro: any) {
  return (
    membro.nomeRP ||
    membro.nomeDiscord ||
    membro.nome ||
    membro.username ||
    "Sem nome"
  );
}

async function enviarDM(client: Client, discordId: string, embed: any) {
  try {
    const usuario = await client.users.fetch(discordId);

    await usuario.send({
      embeds: [embed],
    });

    return true;
  } catch (error) {
    console.error("Erro ao enviar DM:", error);
    return false;
  }
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
        { erro: "Canal de alerta não encontrado." },
        { status: 500 }
      );
    }

    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));
    const pendentesSnap = await getDocs(
      collection(db, "membros_discord_pendentes")
    );

    const farmPorMembro: Record<
      string,
      {
        nome: string;
        folhas: number;
        opios: number;
        seringas: number;
        agulhas: number;
      }
    > = {};    farmSnap.docs.forEach((docItem) => {
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

    const mensagensMetaEnviadas: string[] = [];
    const mensagensCadastroEnviadas: string[] = [];
    const mensagensParabensEnviadas: string[] = [];
    const mensagensFalharam: string[] = [];

    let isentos = 0;

    for (const docItem of membrosSnap.docs) {
      const membro = docItem.data();

      if (membro.status !== "aprovado") continue;

      if (isentoMeta(membro.cargo)) {
        isentos++;
        continue;
      }

      if (!membro.discordId) continue;

      const membroId = membro.discordId || docItem.id;
      const nome = nomeMembro(membro);

      const farm = farmPorMembro[membroId] || {
        nome,
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
      };

      const porcentagem = calcularPorcentagem(farm);

      if (porcentagem >= 100) {
        const sucesso = await enviarDM(client, membro.discordId, {
          color: 0x00ff00,
          title: "🎉 Parabéns pela meta batida!",
          description:
            `Parabéns, **${nome}**!\n\n` +
            `Você bateu sua meta semanal da Inglaterra.\n` +
            `Sua entrega está em **${porcentagem}%**.\n\n` +
            `Continue assim, isso ajuda muito a organização da facção.\n\n` +
            `📅 Enviado em: ${dataBrasilAgora()}`,
          footer: {
            text: "Painel Inglaterra",
          },
        });

        if (sucesso) {
          mensagensParabensEnviadas.push(nome);
        } else {
          mensagensFalharam.push(nome);
        }
      } else {
        const sucesso = await enviarDM(client, membro.discordId, {
          color: 0xff0000,
          title: "⚠️ Alerta de Farm Pendente",
          description:
            `Olá, **${nome}**.\n\n` +
            `A semana está chegando ao fim e sua meta ainda está em **${porcentagem}%**.\n\n` +
            `Regularize seu farm antes do fechamento para não ficar pendente.\n\n` +
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
        });

        if (sucesso) {
          mensagensMetaEnviadas.push(nome);
        } else {
          mensagensFalharam.push(nome);
        }
      }
    }    for (const docItem of pendentesSnap.docs) {
      const pendente = docItem.data();

      if (!pendente.discordId) continue;

      const nome =
        pendente.nomeDiscord ||
        pendente.username ||
        pendente.nome ||
        "Membro";

      const sucesso = await enviarDM(client, pendente.discordId, {
        color: 0xf1c40f,
        title: "📋 Cadastro pendente no Painel Inglaterra",
        description:
          `Olá, **${nome}**.\n\n` +
          `Você ainda não concluiu seu cadastro no site da Inglaterra.\n\n` +
          `O farm, metas e registros serão contabilizados pelo painel, então é importante fazer o cadastro o quanto antes.\n\n` +
          `Acesse o site, entre com Discord e finalize seu cadastro.\n\n` +
          `📅 Enviado em: ${dataBrasilAgora()}`,
        footer: {
          text: "Painel Inglaterra",
        },
      });

      if (sucesso) {
        mensagensCadastroEnviadas.push(nome);
      } else {
        mensagensFalharam.push(nome);
      }
    }

    const inicioSemana = inicioDaSemana();
    const fimSemana = fimDaSemana();

    await canal.send({
      embeds: [
        {
          color: 0xe74c3c,
          title: "📩 Alertas Individuais Enviados",
          description: `Semana: ${dataBrasilSomenteData(
            inicioSemana
          )} até ${dataBrasilSomenteData(fimSemana)}
Gerado em: ${dataBrasilAgora()}`,
          fields: [
            {
              name: "⚠️ Alertas de farm enviados",
              value: String(mensagensMetaEnviadas.length),
              inline: true,
            },
            {
              name: "📋 Alertas de cadastro enviados",
              value: String(mensagensCadastroEnviadas.length),
              inline: true,
            },
            {
              name: "🎉 Parabéns enviados",
              value: String(mensagensParabensEnviadas.length),
              inline: true,
            },
            {
              name: "❌ Falhas",
              value: String(mensagensFalharam.length),
              inline: true,
            },
            {
              name: "⚔️ Isentos ignorados",
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
      alertasFarm: mensagensMetaEnviadas.length,
      alertasCadastro: mensagensCadastroEnviadas.length,
      parabens: mensagensParabensEnviadas.length,
      falhas: mensagensFalharam.length,
      isentos,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { erro: "Erro ao enviar alertas individuais." },
      { status: 500 }
    );
  }
}