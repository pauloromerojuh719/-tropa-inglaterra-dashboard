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
      { erro: "Erro ao enviar log de expulsão." },
      { status: 500 }
    );
  }
}