"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Farm = {
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
};

export default function MetasPage() {
  const [folhas, setFolhas] = useState(0);
  const [opios, setOpios] = useState(0);
  const [seringas, setSeringas] = useState(0);
  const [agulhas, setAgulhas] = useState(0);

  useEffect(() => {
    carregarMetas();
  }, []);

  async function carregarMetas() {
    const snapshot = await getDocs(collection(db, "farm"));

    const farms = snapshot.docs.map((doc) => doc.data() as Farm);
    const aprovados = farms.filter((farm) => farm.status === "aprovado");

    let totalFolhas = 0;
    let totalOpios = 0;
    let totalSeringas = 0;
    let totalAgulhas = 0;

    aprovados.forEach((farm) => {
      totalFolhas += farm.folhas || 0;
      totalOpios += farm.opios || 0;
      totalSeringas += farm.seringas || 0;
      totalAgulhas += farm.agulhas || 0;
    });

    setFolhas(totalFolhas);
    setOpios(totalOpios);
    setSeringas(totalSeringas);
    setAgulhas(totalAgulhas);
  }

  function statusMeta(valor: number, meta: number) {
    if (valor >= meta) {
      return <p className="mt-3 font-bold text-green-400">✅ META BATIDA</p>;
    }

    return (
      <p className="mt-3 font-bold text-yellow-400">
        Falta {meta - valor}
      </p>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        🎯 META DA SEMANA
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-red-900 rounded-xl p-6 bg-zinc-950">
          <h2 className="text-3xl font-bold">🍃 Folhas</h2>
          <p className="text-2xl mt-2">{folhas} / 2000</p>
          {statusMeta(folhas, 2000)}
          <div className="mt-4 h-5 w-full rounded-full bg-zinc-800">
            <div
              className="h-5 rounded-full bg-green-500"
              style={{ width: `${Math.min((folhas / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="border border-red-900 rounded-xl p-6 bg-zinc-950">
          <h2 className="text-3xl font-bold">💊 Ópios</h2>
          <p className="text-2xl mt-2">{opios} / 2000</p>
          {statusMeta(opios, 2000)}
          <div className="mt-4 h-5 w-full rounded-full bg-zinc-800">
            <div
              className="h-5 rounded-full bg-blue-500"
              style={{ width: `${Math.min((opios / 2000) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="border border-red-900 rounded-xl p-6 bg-zinc-950">
          <h2 className="text-3xl font-bold">💉 Seringas</h2>
          <p className="text-2xl mt-2">{seringas} / 800</p>
          {statusMeta(seringas, 800)}
          <div className="mt-4 h-5 w-full rounded-full bg-zinc-800">
            <div
              className="h-5 rounded-full bg-yellow-500"
              style={{ width: `${Math.min((seringas / 800) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="border border-red-900 rounded-xl p-6 bg-zinc-950">
          <h2 className="text-3xl font-bold">🪡 Agulhas</h2>
          <p className="text-2xl mt-2">{agulhas} / 800</p>
          {statusMeta(agulhas, 800)}
          <div className="mt-4 h-5 w-full rounded-full bg-zinc-800">
            <div
              className="h-5 rounded-full bg-purple-500"
              style={{ width: `${Math.min((agulhas / 800) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}