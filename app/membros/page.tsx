"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  id: string;
  nome: string;
  nomeRP?: string;
  passaporte?: string;
  cargo?: string;
  status?: string;
};

export default function MembrosPage() {
  const [membros, setMembros] = useState<Membro[]>([]);

  useEffect(() => {
    carregarMembros();
  }, []);

  async function carregarMembros() {
    const snapshot = await getDocs(collection(db, "membros"));

    const lista = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Membro, "id">),
      }))
      .filter((membro) => membro.status === "aprovado");

    setMembros(lista);
  }

  const lideres = membros.filter((m) => m.cargo === "Líder");
  const vices = membros.filter((m) => m.cargo === "Vice-Líder");
  const gerentes = membros.filter((m) => m.cargo === "Gerente");
  const soldados = membros.filter((m) => m.cargo === "Soldado");
  const recrutas = membros.filter((m) => m.cargo === "Recruta");

  function CardMembro(membro: Membro) {
    return (
      <div
        key={membro.id}
        className="rounded-xl border border-red-900 bg-zinc-950 p-5 shadow-lg"
      >
        <h3 className="text-2xl font-bold">
          👤 {membro.nomeRP || membro.nome}
        </h3>

        <p className="mt-2 text-zinc-300">
          🎫 Passaporte: {membro.passaporte || "Não informado"}
        </p>

        <p className="mt-2 font-bold text-red-400">
          {membro.cargo}
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-10 text-center text-5xl font-black text-red-600">
        👥 MEMBROS DA INGLATERRA
      </h1>

      {/* Líder */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-yellow-400">
          🏆 Líder
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {lideres.map(CardMembro)}
        </div>
      </section>

      {/* Vice */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-purple-400">
          👑 Vice-Líder
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {vices.map(CardMembro)}
        </div>
      </section>

      {/* Gerentes */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-blue-400">
          🛡️ Gerentes
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {gerentes.map(CardMembro)}
        </div>
      </section>

      {/* Soldados */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-green-400">
          ⚔️ Soldados
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {soldados.map(CardMembro)}
        </div>
      </section>

      {/* Recrutas */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-zinc-400">
          🪖 Recrutas
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {recrutas.map(CardMembro)}
        </div>
      </section>
    </main>
  );
}