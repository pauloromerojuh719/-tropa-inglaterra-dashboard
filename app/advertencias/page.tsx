"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  cargo: string;
  status: string;
};

type Advertencia = {
  id: string;
  membroNome: string;
  motivo: string;
  criadoEm?: any;
};

export default function AdvertenciasPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);

  useEffect(() => {
    verificarPermissao();
  }, [session]);

  async function verificarPermissao() {
    const email = session?.user?.email;

    if (!email) {
      setCarregando(false);
      return;
    }

    try {
      const membrosSnap = await getDocs(collection(db, "membros"));

      const membro = membrosSnap.docs.find(
        (d) => d.data().email === email
      );

      if (!membro) {
        setCarregando(false);
        return;
      }

      const dados = membro.data() as Membro;

      const permitidos = [
        "Líder",
        "Vice-Líder",
        "Gerente Geral",
        "Gerente de Farm",
        "Gerente de Produção",
        "Gerente de Compras",
        "Gerente de Vendas",
        "Gerente de Ações",
      ];

      if (dados.status === "aprovado" && permitidos.includes(dados.cargo)) {
        setTemPermissao(true);
        await carregarAdvertencias();
      }
    } catch (error) {
      console.log(error);
    }

    setCarregando(false);
  }

  async function carregarAdvertencias() {
    const q = query(collection(db, "advertencias"));
    const snap = await getDocs(q);

    const lista = snap.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    })) as Advertencia[];

    setAdvertencias(lista);
  }

  if (!session) {
    return (
      <div className="p-8 text-center">
        <button
          onClick={() => signIn("discord")}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Entrar com Discord
        </button>
      </div>
    );
  }

  if (carregando) {
    return <div className="p-8">Carregando...</div>;
  }

  if (!temPermissao) {
    return <div className="p-8 text-red-500">Sem permissão.</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-6">Advertências</h1>

      {advertencias.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-700 rounded p-4">
          Nenhuma advertência registrada ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {advertencias.map((adv) => (
            <div
              key={adv.id}
              className="bg-zinc-900 border border-zinc-700 rounded p-4"
            >
              <p>
                <strong>Membro:</strong> {adv.membroNome}
              </p>

              <p>
                <strong>Motivo:</strong> {adv.motivo}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}