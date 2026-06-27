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
      process.env.DISCORD_LOG_FARM_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        { erro: "Canal não encontrado." },
        { status: 500 }
      );
    }

    const tipo = body.tipo || "enviado";

    const titulo =
      tipo === "aprovado"
        ? "✅ Farm Aprovado"
        : tipo === "reprovado"
        ? "❌ Farm Reprovado"
        : "📦 Novo Farm Enviado";

    const cor =
      tipo === "aprovado"
        ? 0x00ff00
        : tipo === "reprovado"
        ? 0xff0000
        : 0xffa500;

    const statusTexto =
      tipo === "aprovado"
        ? `Aprovado por: ${body.aprovadoPor || "Gerência"}`
        : tipo === "reprovado"
        ? `Reprovado por: ${body.aprovadoPor || "Gerência"}`
        : "Aguardando aprovação no painel.";

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
          title: titulo,
          fields: [
            {
              name: "👤 Membro",
              value:
                body.nomeRP ||
                body.nomeDiscord ||
                body.nome ||
                "Sem nome",
              inline: false,
            },
            {
              name: "🍃 Folhas",
              value: String(body.folhas || 0),
              inline: true,
            },
            {
              name: "💊 Ópios",
              value: String(body.opios || 0),
              inline: true,
            },
            {
              name: "💉 Seringas",
              value: String(body.seringas || 0),
              inline: true,
            },
            {
              name: "🪡 Agulhas",
              value: String(body.agulhas || 0),
              inline: true,
            },
            {
              name: "📊 Total",
              value: String(
                Number(body.folhas || 0) +
                  Number(body.opios || 0) +
                  Number(body.seringas || 0) +
                  Number(body.agulhas || 0)
              ),
              inline: true,
            },
            {
              name: "📌 Status",
              value: statusTexto,
              inline: false,
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