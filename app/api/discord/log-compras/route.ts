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
      process.env.DISCORD_LOG_COMPRAS_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal de compras não encontrado." },
        { status: 500 }
      );
    }

    await canal.send({
      embeds: [
        {
          color: 0xf1c40f,
          title: "💰 Nova Compra Registrada",
          fields: [
            {
              name: "👤 Responsável",
              value: body.comprador || "Não informado",
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
              name: "💵 Valor",
              value: `R$ ${Number(body.valor || 0).toLocaleString("pt-BR")}`,
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
      { erro: "Erro ao enviar log de compras." },
      { status: 500 }
    );
  }
}