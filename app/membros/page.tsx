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
      .filter((membro) => membro.status === "aprovado")
      .sort((a, b) =>
        (a.nomeRP || a.nome || "").localeCompare(
          b.nomeRP || b.nome || "",
          "pt-BR"
        )
      );

    setMembros(lista);
  }

  const lideres = membros.filter((m) => m.cargo === "Líder");
  const vices = membros.filter((m) => m.cargo === "Vice-Líder");
  const gerenteGeral = membros.filter((m) => m.cargo === "Gerente Geral");
  const gerenteFarm = membros.filter((m) => m.cargo === "Gerente de Farm");
  const gerenteCompras = membros.filter((m) => m.cargo === "Gerente de Compras");
  const gerenteVendas = membros.filter((m) => m.cargo === "Gerente de Vendas");
  const gerenteProducao = membros.filter((m) => m.cargo === "Gerente de Produção");
  const gerenteAcoes = membros.filter((m) => m.cargo === "Gerente de Ações");
  const elite = membros.filter((m) => m.cargo === "Elite");
  const membrosComuns = membros.filter((m) => m.cargo === "Membro");

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

        <p className="mt-2 font-bold text-red-400">{membro.cargo}</p>
      </div>
    );
  }

  function SecaoMembros({
    titulo,
    lista,
  }: {
    titulo: string;
    lista: Membro[];
  }) {
    return (
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-red-500">{titulo}</h2>

        {lista.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">
            Nenhum membro neste cargo.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {lista.map(CardMembro)}
          </div>
        )}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-10 text-center text-5xl font-black text-red-600">
        👥 MEMBROS DA INGLATERRA
      </h1>

      <SecaoMembros titulo="🏆 Líder" lista={lideres} />
      <SecaoMembros titulo="👑 Vice-Líder" lista={vices} />
      <SecaoMembros titulo="🛡️ Gerente Geral" lista={gerenteGeral} />
      <SecaoMembros titulo="🌿 Gerente de Farm" lista={gerenteFarm} />
      <SecaoMembros titulo="🛒 Gerente de Compras" lista={gerenteCompras} />
      <SecaoMembros titulo="💰 Gerente de Vendas" lista={gerenteVendas} />
      <SecaoMembros titulo="🏭 Gerente de Produção" lista={gerenteProducao} />
      <SecaoMembros titulo="🎯 Gerente de Ações" lista={gerenteAcoes} />
      <SecaoMembros titulo="🔫 Elite" lista={elite} />
      <SecaoMembros titulo="👥 Membros" lista={membrosComuns} />
    </main>
  );
}