"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Plantao = {
  nome: string;
  email: string;
  minutos?: number;
  status: string;
};

type Ranking = {
  nome: string;
  email: string;
  minutos: number;
};

export default function RankingPage() {
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [carregando, setCarregando] = useState(true);

  function formatarMinutos(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  }

  useEffect(() => {
    async function carregarRanking() {
      const snapshot = await getDocs(collection(db, "plantoes"));

      const mapa: Record<string, Ranking> = {};

      snapshot.docs.forEach((item) => {
        const plantao = item.data() as Plantao;

        if (plantao.status !== "fechado") return;

        const email = plantao.email || "sem-email";

        if (!mapa[email]) {
          mapa[email] = {
            nome: plantao.nome || "Sem nome",
            email,
            minutos: 0,
          };
        }

        mapa[email].minutos += plantao.minutos || 0;
      });

      const lista = Object.values(mapa).sort(
        (a, b) => b.minutos - a.minutos
      );

      setRanking(lista);
      setCarregando(false);
    }

    carregarRanking();
  }, []);

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        🏆 RANKING
      </h1>

      <section className="rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">
          ⏱️ Ranking de Horas Manual
        </h2>

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
    </main>
  );
}