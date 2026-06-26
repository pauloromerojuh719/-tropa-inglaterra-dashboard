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
      process.env.DISCORD_LOG_ACOES_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal de ações não encontrado." },
        { status: 500 }
      );
    }

    await canal.send({
      embeds: [
        {
          color: body.status === "Sucesso" ? 0x00ff00 : 0xff0000,
          title: "🎯 Nova Ação Registrada",
          fields: [
            {
              name: "🎯 Ação",
              value: body.tipo || "Não informado",
              inline: true,
            },
            {
              name: "📌 Status",
              value: body.status || "Não informado",
              inline: true,
            },
            {
              name: "👥 Participantes",
              value: body.participantes || "Não informado",
              inline: false,
            },
            {
              name: "💵 Valor",
              value: `R$ ${Number(body.valor || 0).toLocaleString("pt-BR")}`,
              inline: true,
            },
            {
              name: "👮 Responsável",
              value: body.responsavel || "Sistema",
              inline: false,
            },
            {
              name: "📅 Data",
              value: new Date().toLocaleString("pt-BR"),
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
      { erro: "Erro ao enviar log de ações." },
      { status: 500 }
    );
  }
}