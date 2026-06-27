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
      process.env.DISCORD_LOG_CARGOS_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal não encontrado." },
        { status: 500 }
      );
    }

    const emoji =
      body.tipo === "promocao"
        ? "⬆️"
        : body.tipo === "rebaixamento"
        ? "⬇️"
        : "🔄";

    const cor =
      body.tipo === "promocao"
        ? 0x00ff00
        : body.tipo === "rebaixamento"
        ? 0xff0000
        : 0xf1c40f;

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
          color: cor,
          title: `${emoji} Alteração de Cargo`,
          fields: [
            {
              name: "👤 Membro",
              value: body.nome || "Não informado",
              inline: false,
            },
            {
              name: "Cargo Anterior",
              value: body.cargoAntigo || "Não informado",
              inline: true,
            },
            {
              name: "Novo Cargo",
              value: body.cargoNovo || "Não informado",
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
      { erro: "Erro ao enviar log." },
      { status: 500 }
    );
  }
}