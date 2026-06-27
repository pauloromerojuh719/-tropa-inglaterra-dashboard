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

function statusFarm(totalEntregas: number, diasSemFarm: number) {
  if (totalEntregas === 0) return "🚨 Nunca entregou";

  if (diasSemFarm <= 7 && totalEntregas >= 4) {
    return "🔥 Entrega sempre";
  }

  if (diasSemFarm <= 7) {
    return "✅ Entregou recentemente";
  }

  if (diasSemFarm <= 14) {
    return "🟡 Faz mais de 7 dias que não entrega";
  }

  if (diasSemFarm <= 30) {
    return "⚠️ Faz mais de 14 dias que não entrega";
  }

  return "🚨 Faz mais de 30 dias que não entrega";
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

      const nomeCanal = canalTexto.name.toLowerCase();

      if (
        nomeCanal.includes("instru") ||
        nomeCanal.includes("planilha") ||
        nomeCanal.includes("como") ||
        nomeCanal.includes("aviso") ||
        nomeCanal.includes("modelo")
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

      const entregasComPrint = mensagensMembro.filter(
        (mensagem) => mensagem.attachments.size > 0
      );

      const entregasOrdenadas = entregasComPrint.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      const ultimaEntrega = entregasOrdenadas[0]?.createdAt || null;

      const primeiraEntrega =
        entregasOrdenadas[entregasOrdenadas.length - 1]?.createdAt || null;

      const diasSemFarm = diasDesde(ultimaEntrega);

      const totalEntregas = entregasComPrint.length;

      membros.push({
        nome: canalTexto.name,
        totalEntregas,
        mensagens: mensagensMembro.length,
        primeiraEntrega: formatarData(primeiraEntrega),
        ultimaEntrega: formatarData(ultimaEntrega),
        diasSemFarm,
        status: statusFarm(totalEntregas, diasSemFarm),
      });
    }

    await client.destroy();

    const ranking = [...membros].sort(
      (a, b) => b.totalEntregas - a.totalEntregas
    );

    const entregaSempre = membros.filter(
      (m) => m.totalEntregas > 0 && m.diasSemFarm <= 7 && m.totalEntregas >= 4
    );

    const entregouRecentemente = membros.filter(
      (m) => m.totalEntregas > 0 && m.diasSemFarm <= 7 && m.totalEntregas < 4
    );

    const maisDe7Dias = membros.filter(
      (m) => m.totalEntregas > 0 && m.diasSemFarm > 7 && m.diasSemFarm <= 14
    );

    const maisDe14Dias = membros.filter(
      (m) => m.totalEntregas > 0 && m.diasSemFarm > 14 && m.diasSemFarm <= 30
    );

    const maisDe30Dias = membros.filter(
      (m) => m.totalEntregas > 0 && m.diasSemFarm > 30
    );

    const nuncaEntregou = membros.filter((m) => m.totalEntregas === 0);

    const totalFarms = membros.reduce(
      (total, membro) => total + membro.totalEntregas,
      0
    );

    const mediaFarm =
      membros.length > 0 ? (totalFarms / membros.length).toFixed(1) : "0";

    let texto = "";

    texto += "═══════════════════════════════════════\n";
    texto += "📊 LEVANTAMENTO DE FARM — DISCORD\n";
    texto += "Período: Desde o início dos canais\n";
    texto += `Total de membros analisados: ${membros.length}\n`;
    texto += `Total de farms com print encontrados: ${totalFarms}\n`;
    texto += `Média de farms por membro: ${mediaFarm}\n`;
    texto += "═══════════════════════════════════════\n\n";

    texto += "📌 RESUMO GERAL\n\n";
    texto += `🔥 Entregam sempre: ${entregaSempre.length}\n`;
    texto += `✅ Entregaram recentemente: ${entregouRecentemente.length}\n`;
    texto += `🟡 Mais de 7 dias sem entregar: ${maisDe7Dias.length}\n`;
    texto += `⚠️ Mais de 14 dias sem entregar: ${maisDe14Dias.length}\n`;
    texto += `🚨 Mais de 30 dias sem entregar: ${maisDe30Dias.length}\n`;
    texto += `❌ Nunca entregaram: ${nuncaEntregou.length}\n\n`;

    texto += "═══════════════════════════════════════\n\n";

    texto += "🏆 TOP 10 QUE MAIS ENTREGARAM FARM\n\n";

    ranking.slice(0, 10).forEach((m, index) => {
      texto += `${index + 1}º ${m.nome}\n`;
      texto += `• Total de farms: ${m.totalEntregas}\n`;
      texto += `• Primeira entrega: ${m.primeiraEntrega}\n`;
      texto += `• Última entrega: ${m.ultimaEntrega}\n`;
      texto += `• Dias sem farm: ${
        m.diasSemFarm === 9999 ? "Nunca entregou" : m.diasSemFarm
      }\n`;
      texto += `• Status: ${m.status}\n\n`;
    });

    texto += "═══════════════════════════════════════\n\n";

    texto += "🔥 MEMBROS QUE ENTREGAM SEMPRE\n\n";

    if (entregaSempre.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      entregaSempre
        .sort((a, b) => b.totalEntregas - a.totalEntregas)
        .forEach((m) => {
          texto += `${m.nome} — ${m.totalEntregas} farms — Último: ${m.ultimaEntrega}\n`;
        });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "✅ ENTREGARAM RECENTEMENTE\n\n";

    if (entregouRecentemente.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      entregouRecentemente
        .sort((a, b) => b.totalEntregas - a.totalEntregas)
        .forEach((m) => {
          texto += `${m.nome} — ${m.totalEntregas} farms — Último: ${m.ultimaEntrega}\n`;
        });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "🟡 MAIS DE 7 DIAS SEM ENTREGAR\n\n";

    if (maisDe7Dias.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      maisDe7Dias
        .sort((a, b) => b.diasSemFarm - a.diasSemFarm)
        .forEach((m) => {
          texto += `${m.nome} — ${m.diasSemFarm} dias sem farm — Total: ${m.totalEntregas}\n`;
        });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "⚠️ MAIS DE 14 DIAS SEM ENTREGAR\n\n";

    if (maisDe14Dias.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      maisDe14Dias
        .sort((a, b) => b.diasSemFarm - a.diasSemFarm)
        .forEach((m) => {
          texto += `${m.nome} — ${m.diasSemFarm} dias sem farm — Último: ${m.ultimaEntrega}\n`;
        });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "🚨 MAIS DE 30 DIAS SEM ENTREGAR\n\n";

    if (maisDe30Dias.length === 0) {
      texto += "Nenhum membro nessa categoria.\n\n";
    } else {
      maisDe30Dias
        .sort((a, b) => b.diasSemFarm - a.diasSemFarm)
        .forEach((m) => {
          texto += `${m.nome} — ${m.diasSemFarm} dias sem farm — Último: ${m.ultimaEntrega}\n`;
        });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "❌ NUNCA ENTREGARAM FARM\n\n";

    if (nuncaEntregou.length === 0) {
      texto += "Todos os membros já entregaram pelo menos uma vez.\n\n";
    } else {
      nuncaEntregou.forEach((m) => {
        texto += `${m.nome}\n`;
      });
      texto += "\n";
    }

    texto += "═══════════════════════════════════════\n\n";

    texto += "📋 LISTA COMPLETA POR MEMBRO\n\n";

    ranking.forEach((m) => {
      texto += `${m.nome}\n`;
      texto += `• Status: ${m.status}\n`;
      texto += `• Total de farms: ${m.totalEntregas}\n`;
      texto += `• Primeira entrega: ${m.primeiraEntrega}\n`;
      texto += `• Última entrega: ${m.ultimaEntrega}\n`;
      texto += `• Dias sem farm: ${
        m.diasSemFarm === 9999 ? "Nunca entregou" : m.diasSemFarm
      }\n`;
      texto += `• Mensagens no canal: ${m.mensagens}\n\n`;
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