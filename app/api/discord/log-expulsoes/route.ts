import { NextResponse } from "next/server";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);

    const canal = await client.channels.fetch(
      process.env.DISCORD_LOG_EXPULSOES_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal de expulsões não encontrado." },
        { status: 500 }
      );
    }

    const dataBrasil = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await canal.send({
      embeds: [
        {
          color: 0xff0000,
          title: "🚪 Membro Removido da Facção",
          fields: [
            {
              name: "👤 Membro",
              value: body.nome || "Sem nome",
              inline: false,
            },
            {
              name: "🏷️ Último Cargo",
              value: body.cargoAntigo || "Não informado",
              inline: true,
            },
            {
              name: "📅 Data",
              value: dataBrasil,
              inline: false,
            },
          ],
          footer: {
            text: "Painel Inglaterra",
          },
        },
      ],
    });

    await client.destroy();

    return NextResponse.json({ sucesso: true });
  } catch (erro) {
    console.error(erro);

    return NextResponse.json(
      { erro: "Erro ao enviar log de expulsão." },
      { status: 500 }
    );
  }
}