"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

type Plantao = {
  nome: string;
  email: string;
  inicio: any;
  fim?: any;
  minutos?: number;
  status: string;
};

type Ranking = {
  nome: string;
  email: string;
  minutos: number;
};

export default function RankingPage() {
  const [rankingGeral, setRankingGeral] = useState<Ranking[]>([]);
  const [rankingSemanal, setRankingSemanal] = useState<Ranking[]>([]);
  const [carregando, setCarregando] = useState(true);

  function formatarMinutos(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  }

  function inicioDaSemana() {
    const hoje = new Date();
    const dia = hoje.getDay();

    const diferenca = dia === 0 ? -6 : 1 - dia;

    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diferenca);
    segunda.setHours(0, 0, 0, 0);

    return segunda;
  }

  function fimDaSemana() {
    const segunda = inicioDaSemana();

    const domingo = new Date(segunda);
    domingo.setDate(segunda.getDate() + 6);
    domingo.setHours(23, 59, 59, 999);

    return domingo;
  }

  function converterData(data: any) {
    if (!data) return null;

    if (data instanceof Timestamp) {
      return data.toDate();
    }

    if (data?.toDate) {
      return data.toDate();
    }

    return null;
  }

  function somarNoMapa(mapa: Record<string, Ranking>, plantao: Plantao) {
    const email = plantao.email || "sem-email";

    if (!mapa[email]) {
      mapa[email] = {
        nome: plantao.nome || "Sem nome",
        email,
        minutos: 0,
      };
    }

    mapa[email].minutos += plantao.minutos || 0;
  }

  useEffect(() => {
    async function carregarRanking() {
      const snapshot = await getDocs(collection(db, "plantoes"));

      const mapaGeral: Record<string, Ranking> = {};
      const mapaSemanal: Record<string, Ranking> = {};

      const segunda = inicioDaSemana();
      const domingo = fimDaSemana();

      snapshot.docs.forEach((item) => {
        const plantao = item.data() as Plantao;

        if (plantao.status !== "fechado") return;

        somarNoMapa(mapaGeral, plantao);

        const dataInicio = converterData(plantao.inicio);

        if (dataInicio && dataInicio >= segunda && dataInicio <= domingo) {
          somarNoMapa(mapaSemanal, plantao);
        }
      });

      const listaGeral = Object.values(mapaGeral).sort(
        (a, b) => b.minutos - a.minutos
      );

      const listaSemanal = Object.values(mapaSemanal).sort(
        (a, b) => b.minutos - a.minutos
      );

      setRankingGeral(listaGeral);
      setRankingSemanal(listaSemanal);
      setCarregando(false);
    }

    carregarRanking();
  }, []);

  function CardRanking({
    titulo,
    ranking,
  }: {
    titulo: string;
    ranking: Ranking[];
  }) {
    return (
      <section className="rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">{titulo}</h2>

        {carregando ? (
          <p className="text-zinc-400">Carregando ranking...</p>
        ) : ranking.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-black p-5">
            <p className="text-xl font-bold">Nenhuma hora registrada ainda.</p>
            <p className="mt-2 text-zinc-400">
              Quando os membros usarem Entrada e Saída, o ranking vai aparecer aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {ranking.map((membro, index) => (
              <div
                key={membro.email}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div>
                  <p className="text-2xl font-black">
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `#${index + 1}`}{" "}
                    {membro.nome}
                  </p>

                  <p className="mt-1 text-zinc-400">{membro.email}</p>
                </div>

                <p className="text-3xl font-black text-red-500">
                  {formatarMinutos(membro.minutos)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        🏆 RANKING
      </h1>

      <div className="grid gap-8">
        <CardRanking titulo="📅 Ranking Semanal" ranking={rankingSemanal} />

        <CardRanking titulo="⏱️ Ranking Geral" ranking={rankingGeral} />
      </div>
    </main>
  );
}