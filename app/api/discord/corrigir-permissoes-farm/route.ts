import { NextResponse } from "next/server";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from "discord.js";

export async function GET() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    const canais = await guild.channels.fetch();

    const categoriaId = process.env.DISCORD_FARM_CATEGORY_ID!;
    const cargoBotId = process.env.DISCORD_FARM_BOT_ROLE_ID!;

    const corrigidos: string[] = [];
    const pulados: string[] = [];
    const erros: { canal: string; erro: string }[] = [];

    for (const [, canal] of canais) {
      if (!canal) continue;

      if (
        canal.type !== ChannelType.GuildText ||
        canal.parentId !== categoriaId
      ) {
        continue;
      }

      try {
        const canalTexto = canal as TextChannel;

        const permissaoBot = canalTexto.permissionsFor(client.user!.id);

        if (!permissaoBot?.has(PermissionFlagsBits.ManageChannels)) {
          pulados.push(`${canalTexto.name} - bot sem permissão para gerenciar`);
          continue;
        }

        await canalTexto.permissionOverwrites.edit(cargoBotId, {
          ViewChannel: true,
          ReadMessageHistory: true,
          SendMessages: true,
          AttachFiles: true,
          EmbedLinks: true,
          UseExternalEmojis: true,
        });

        corrigidos.push(canalTexto.name);
      } catch (erroCanal) {
        erros.push({
          canal: canal.name,
          erro: String(erroCanal),
        });
      }
    }

    await client.destroy();

    return NextResponse.json({
      status: "OK",
      totalCorrigidos: corrigidos.length,
      totalPulados: pulados.length,
      totalErros: erros.length,
      corrigidos,
      pulados,
      erros,
    });
  } catch (erro) {
    await client.destroy();

    return NextResponse.json(
      {
        status: "ERRO",
        erro: String(erro),
      },
      { status: 500 }
    );
  }
}