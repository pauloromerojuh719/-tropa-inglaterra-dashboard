import { NextResponse } from "next/server";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
} from "discord.js";

export async function GET() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);

    const categoriaId = process.env.DISCORD_FARM_CATEGORY_ID;

    if (!categoriaId) {
      throw new Error("Categoria de farm não configurada.");
    }

    const guild = await client.guilds.fetch(
      process.env.DISCORD_GUILD_ID!
    );

    const canais = await guild.channels.fetch();

    const lista = [];

    for (const [, canal] of canais) {
      if (!canal) continue;

      if (
        canal.type === ChannelType.GuildText &&
        canal.parentId === categoriaId
      ) {
        lista.push({
          id: canal.id,
          nome: canal.name,
        });
      }
    }

    await client.destroy();

    return NextResponse.json({
      status: "OK",
      categoriaId,
      totalCanais: lista.length,
      canais: lista,
    });
  } catch (erro) {
    await client.destroy();

    return NextResponse.json(
      {
        status: "ERRO",
        erro: String(erro),
      },
      {
        status: 500,
      }
    );
  }
}