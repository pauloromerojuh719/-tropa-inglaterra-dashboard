"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Farm = {
  id: string;
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
};

type ResumoMembro = {
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  total: number;
};

export default function ControleFarmPage() {
  const [resumo, setResumo] = useState<ResumoMembro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarControleFarm();
  }, []);

  async function carregarControleFarm() {
    const snapshot = await getDocs(collection(db, "farm"));

    const mapa: Record<string, ResumoMembro> = {};

    snapshot.docs.forEach((docItem) => {
      const farm = {
        id: docItem.id,
        ...(docItem.data() as Omit<Farm, "id">),
      };

      if (farm.status !== "aprovado") return;

      const chave = farm.membroId || farm.membroEmail || farm.membroNome;

      if (!mapa[chave]) {
        mapa[chave] = {
          membroNome: farm.membroNome || "Sem nome",
          membroEmail: farm.membroEmail || "",
          membroId: farm.membroId || "",
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
          total: 0,
        };
      }

      mapa[chave].folhas += Number(farm.folhas || 0);
      mapa[chave].opios += Number(farm.opios || 0);
      mapa[chave].seringas += Number(farm.seringas || 0);
      mapa[chave].agulhas += Number(farm.agulhas || 0);

      mapa[chave].total =
        mapa[chave].folhas +
        mapa[chave].opios +
        mapa[chave].seringas +
        mapa[chave].agulhas;
    });

    const lista = Object.values(mapa).sort((a, b) => b.total - a.total);

    setResumo(lista);
    setCarregando(false);
  }

  function statusMeta(membro: ResumoMembro) {
    const bateu =
      membro.folhas >= 2000 &&
      membro.opios >= 2000 &&
      membro.seringas >= 800 &&
      membro.agulhas >= 800;

    return bateu ? "✅ Meta batida" : "⚠️ Falta farm";
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">
        🌿 CONTROLE DE FARM
      </h1>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Resumo dos Membros</h2>

        {carregando ? (
          <p className="mt-4 text-zinc-400">Carregando farms...</p>
        ) : resumo.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            Nenhum farm aprovado encontrado ainda.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {resumo.map((membro, index) => (
              <div
                key={membro.membroId || membro.membroEmail || membro.membroNome}
                className="rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-black">
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : `#${index + 1}`}{" "}
                      {membro.membroNome}
                    </h3>

                    <p className="mt-1 text-zinc-400">
                      {membro.membroEmail}
                    </p>

                    <p className="mt-2 font-bold text-red-400">
                      {statusMeta(membro)}
                    </p>
                  </div>

                  <div className="grid gap-3 text-right md:grid-cols-5">
                    <div>
                      <p className="text-sm text-zinc-400">Folhas</p>
                      <p className="text-xl font-black">{membro.folhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Ópios</p>
                      <p className="text-xl font-black">{membro.opios}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Seringas</p>
                      <p className="text-xl font-black">{membro.seringas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Agulhas</p>
                      <p className="text-xl font-black">{membro.agulhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Total</p>
                      <p className="text-xl font-black text-red-500">
                        {membro.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}