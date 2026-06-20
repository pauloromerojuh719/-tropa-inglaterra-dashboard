"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  cargo: string;
  status: string;
};

export default function ComprasPage() {
  const { data: session } = useSession();
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);

  useEffect(() => {
    async function verificarPermissao() {
      if (!session?.user) {
        setCarregando(false);
        return;
      }

      const discordId = (session.user as any).id;
      if (!discordId) {
        setCarregando(false);
        return;
      }

      const membroSnap = await getDoc(doc(db, "membros", discordId));

      if (!membroSnap.exists()) {
        setTemPermissao(false);
        setCarregando(false);
        return;
      }

      const membro = membroSnap.data() as Membro;
      const cargo = membro.cargo?.trim();
      const status = membro.status?.trim();

      if (
        status === "aprovado" &&
        (
          cargo === "Líder" ||
          cargo === "Vice-Líder" ||
          cargo === "Gerente Geral" ||
          cargo === "Gerente de Compras"
        )
      ) {
        setTemPermissao(true);
      } else {
        setTemPermissao(false);
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-black text-red-600">Carregando...</h1>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-8 text-center">
          <h1 className="text-4xl font-black text-red-600">Compras</h1>

          <button
            onClick={() => signIn("discord")}
            className="mt-6 rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
          >
            Entrar com Discord
          </button>
        </div>
      </main>
    );
  }

  if (!temPermissao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-8 text-center">
          <h1 className="text-5xl font-black text-red-600">
            ❌ ACESSO NEGADO
          </h1>
          <p className="mt-4 text-zinc-400">
            Apenas Líder, Vice-Líder, Gerente Geral ou Gerente de Compras podem acessar esta área.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">
        🛒 COMPRAS
      </h1>

      <div className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">
          Controle de Compras
        </h2>

        <p className="mt-4 text-zinc-400">
          Área exclusiva do Gerente de Compras.
        </p>
      </div>
    </main>
  );
}