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
      process.env.DISCORD_LOG_PRODUCAO_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal de produção não encontrado." },
        { status: 500 }
      );
    }

    await canal.send({
      embeds: [
        {
          color: 0x9b59b6,
          title: "🏭 Nova Produção Registrada",
          fields: [
            {
              name: "👤 Responsável",
              value: body.responsavel || "Não informado",
              inline: false,
            },
            {
              name: "📦 Item",
              value: body.item || "Não informado",
              inline: true,
            },
            {
              name: "🔢 Quantidade",
              value: String(body.quantidade || 0),
              inline: true,
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
      { erro: "Erro ao enviar log de produção." },
      { status: 500 }
    );
  }
}