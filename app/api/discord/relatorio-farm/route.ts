import { NextResponse } from "next/server";
import {
  Client,
  GatewayIntentBits,
  ChannelType,
  TextChannel,
} from "discord.js";

function formatarData(data: Date | null) {
  if (!data) return "Nunca";

  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

function diasDesde(data: Date | null) {
  if (!data) return 9999;

  const agora = new Date();
  const diff = agora.getTime() - data.getTime();

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function estrelas(pontos: number) {
  if (pontos >= 90) return "⭐⭐⭐⭐⭐";
  if (pontos >= 70) return "⭐⭐⭐⭐";
  if (pontos >= 45) return "⭐⭐⭐";
  if (pontos >= 20) return "⭐⭐";
  return "⭐";
}

export async function GET() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  try {
    await client.login(process.env.DISCORD_BOT_TOKEN);

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    const canais = await guild.channels.fetch();

    const categoriaId = process.env.DISCORD_FARM_CATEGORY_ID!;

    const membros: any[] = [];

    for (const [, canal] of canais) {
      if (!canal) continue;

      if (
        canal.type !== ChannelType.GuildText ||
        canal.parentId !== categoriaId
      ) {
        continue;
      }

      const canalTexto = canal as TextChannel;

      if (
        canalTexto.name.includes("instru") ||
        canalTexto.name.includes("planilha") ||
        canalTexto.name.includes("como")
      ) {
        continue;
      }

      const todasMensagens: any[] = [];
      let ultimoId: string | undefined = undefined;

      while (true) {
        const mensagens: any = await canalTexto.messages.fetch({
          limit: 100,
          before: ultimoId,
        });

        if (mensagens.size === 0) break;

        todasMensagens.push(...mensagens.values());

        ultimoId = mensagens.last()?.id;

        if (mensagens.size < 100) break;
      }

      const mensagensMembro = todasMensagens.filter(
        (mensagem) => !mensagem.author.bot
      );

      const prints = mensagensMembro.filter(
        (mensagem) => mensagem.attachments.size > 0
      );

      const ordenadas = mensagensMembro.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      const ultimaEntrega = ordenadas[0]?.createdAt || null;
      const diasSemFarm = diasDesde(ultimaEntrega);

      let pontos = 0;

      pontos += prints.length * 3;
      pontos += mensagensMembro.length;

      if (diasSemFarm <= 7) pontos += 30;
      else if (diasSemFarm <= 14) pontos += 10;
      else if (diasSemFarm <= 30) pontos -= 20;
      else pontos -= 50;

      if (pontos < 0) pontos = 0;
      if (pontos > 100) pontos = 100;

      let status = "🚨 Possível demissão";

      if (pontos >= 90) status = "🔥 Exemplar";
      else if (pontos >= 70) status = "✅ Muito ativo";
      else if (pontos >= 45) status = "🟡 Regular";
      else if (pontos >= 20) status = "⚠️ Pouco ativo";

      membros.push({
        nome: canalTexto.name,
        mensagens: mensagensMembro.length,
        prints: prints.length,
        ultimaEntrega: formatarData(ultimaEntrega),
        diasSemFarm,
        pontos,
        estrelas: estrelas(pontos),
        status,
      });
    }

    await client.destroy();

    const ranking = [...membros].sort((a, b) => b.pontos - a.pontos);
    const demissao = membros.filter((m) => m.pontos < 20);
    const poucoAtivos = membros.filter((m) => m.pontos >= 20 && m.pontos < 45);
    const exemplares = membros.filter((m) => m.pontos >= 90);

    let texto = "";

    texto += "═══════════════════════════════════════\n";
    texto += "📊 RELATÓRIO DE ATIVIDADE DA FACÇÃO\n";
    texto += "Período: Desde o início do Discord\n";
    texto += `Total de membros analisados: ${membros.length}\n`;
    texto += "═══════════════════════════════════════\n\n";

    texto += "🏆 TOP 10 MAIS ATIVOS\n\n";
    ranking.slice(0, 10).forEach((m, index) => {
      texto += `${index + 1}º ${m.nome} — ${m.pontos} pts ${m.estrelas}\n`;
      texto += `   Prints: ${m.prints} | Msgs: ${m.mensagens} | Último: ${m.ultimaEntrega}\n\n`;
    });

    texto += "═══════════════════════════════════════\n\n";

    texto += "🚨 POSSÍVEIS DEMISSÕES\n\n";
    if (demissao.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      demissao.forEach((m) => {
        texto += `${m.nome}\n`;
        texto += `• ${m.pontos} pts ${m.estrelas}\n`;
        texto += `• Prints: ${m.prints}\n`;
        texto += `• Mensagens: ${m.mensagens}\n`;
        texto += `• Último farm: ${m.ultimaEntrega}\n\n`;
      });
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "⚠️ POUCO ATIVOS\n\n";
    if (poucoAtivos.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      poucoAtivos.forEach((m) => {
        texto += `${m.nome} — ${m.pontos} pts ${m.estrelas} — Último: ${m.ultimaEntrega}\n`;
      });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "🔥 MEMBROS EXEMPLARES\n\n";
    if (exemplares.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      exemplares.forEach((m) => {
        texto += `${m.nome} — ${m.pontos} pts ${m.estrelas}\n`;
      });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "📋 LISTA COMPLETA\n\n";
    ranking.forEach((m) => {
      texto += `${m.nome} — ${m.status} — ${m.pontos} pts ${m.estrelas}\n`;
      texto += `Prints: ${m.prints} | Mensagens: ${m.mensagens} | Dias sem farm: ${m.diasSemFarm}\n\n`;
    });

    return new Response(texto, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
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