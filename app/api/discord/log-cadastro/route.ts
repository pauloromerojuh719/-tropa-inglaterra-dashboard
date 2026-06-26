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
      process.env.DISCORD_LOG_CADASTRO_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal não encontrado." },
        { status: 500 }
      );
    }

    await canal.send({
      embeds: [
        {
          color: 0x3498db,
          title: "👤 Novo Cadastro Aprovado",
          fields: [
            {
              name: "👤 Nome RP",
              value: body.nomeRP || "Não informado",
              inline: false,
            },
            {
              name: "🎫 Passaporte",
              value: body.passaporte || "Não informado",
              inline: true,
            },
            {
              name: "🎖 Cargo",
              value: body.cargo || "Membro",
              inline: true,
            },
            {
              name: "👮 Aprovado por",
              value: body.aprovadoPor || "Sistema",
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
      { erro: "Erro ao enviar log." },
      { status: 500 }
    );
  }
}