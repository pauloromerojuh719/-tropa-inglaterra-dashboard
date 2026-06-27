import { NextResponse } from "next/server";
import { Client, GatewayIntentBits, TextChannel } from "discord.js";

export async function GET() {
  return NextResponse.json({
    rota: "log-reembolsos ativa",
    metodo: "GET teste",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);

    const canal = await client.channels.fetch(
      process.env.DISCORD_LOG_REEMBOLSOS_CHANNEL_ID!
    );

    if (!canal || !(canal instanceof TextChannel)) {
      await client.destroy();

      return NextResponse.json(
        {
          erro: "Canal de reembolsos não encontrado.",
        },
        {
          status: 500,
        }
      );
    }

    const tipo = body.tipo || "solicitado";

    const titulo =
      tipo === "pago"
        ? "✅ Reembolso Pago"
        : tipo === "recusado"
        ? "❌ Reembolso Recusado"
        : "💸 Novo Reembolso Solicitado";

    const cor =
      tipo === "pago"
        ? 0x00ff00
        : tipo === "recusado"
        ? 0xff0000
        : 0xf1c40f;

    await canal.send({
      embeds: [
        {
          color: cor,
          title: titulo,
          fields: [
            {
              name: "👤 Nome",
              value: body.nome || "Não informado",
              inline: true,
            },
            {
              name: "🎫 Passaporte",
              value: body.passaporte || "Não informado",
              inline: true,
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
              name: "👮 Responsável",
              value: body.responsavel || "Sistema",
              inline: false,
            },
            {
              name: "📅 Data",
              value: new Date().toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo",
}),
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

    return NextResponse.json({
      sucesso: true,
    });
  } catch (erro: any) {
    console.error("ERRO LOG REEMBOLSO:", erro);

    return NextResponse.json(
      {
        erro: erro?.message || String(erro),
      },
      {
        status: 500,
      }
    );
  }
}