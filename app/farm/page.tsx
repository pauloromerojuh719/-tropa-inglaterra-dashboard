"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { addDoc, collection, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  username?: string;
  email?: string;
  discordId?: string;
};

function nomeExibicao(membro: Membro | null, sessionName?: string | null) {
  if (!membro) return sessionName || "Sem nome";

  return (
    membro.nomeRP ||
    membro.nomeDiscord ||
    membro.nome ||
    membro.username ||
    sessionName ||
    "Sem nome"
  );
}

export default function FarmPage() {
  const { data: session, status } = useSession();

  const [folhas, setFolhas] = useState("");
  const [opios, setOpios] = useState("");
  const [seringas, setSeringas] = useState("");
  const [agulhas, setAgulhas] = useState("");
  const [print, setPrint] = useState("");
  const [enviando, setEnviando] = useState(false);

  function converterPrint(arquivo: File) {
    const reader = new FileReader();

    reader.onloadend = () => {
      const resultado = reader.result as string;
      setPrint(resultado);
    };

    reader.readAsDataURL(arquivo);
  }

  async function enviarFarm() {
    if (!session?.user) {
      alert("Você precisa estar logado.");
      return;
    }

    if (!folhas && !opios && !seringas && !agulhas) {
      alert("Preencha pelo menos uma quantidade.");
      return;
    }

    if (!print) {
      alert("Envie o print do farm.");
      return;
    }

    try {
      setEnviando(true);

      const discordId = (session.user as any).id || "";

      let membroCadastro: Membro | null = null;

      if (discordId) {
        const membroSnap = await getDoc(doc(db, "membros", discordId));

        if (membroSnap.exists()) {
          membroCadastro = membroSnap.data() as Membro;
        }
      }

      const nomeParaSalvar = nomeExibicao(
        membroCadastro,
        session.user.name || "Sem nome"
      );

      const dadosFarm = {
        membroNome: nomeParaSalvar,
        membroEmail: session.user.email || "",
        membroId: discordId,
        discordId: discordId,
        folhas: Number(folhas || 0),
        opios: Number(opios || 0),
        seringas: Number(seringas || 0),
        agulhas: Number(agulhas || 0),
        print,
        status: "pendente",
        criadoEm: Timestamp.now(),
      };

      await addDoc(collection(db, "farm"), dadosFarm);

      await fetch("/api/discord/log-farm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nomeParaSalvar,
          nomeRP: membroCadastro?.nomeRP || nomeParaSalvar,
          nomeDiscord: membroCadastro?.nomeDiscord || session.user.name || "",
          email: session.user.email || "",
          folhas: Number(folhas || 0),
          opios: Number(opios || 0),
          seringas: Number(seringas || 0),
          agulhas: Number(agulhas || 0),
        }),
      });

      setFolhas("");
      setOpios("");
      setSeringas("");
      setAgulhas("");
      setPrint("");

      alert("Farm enviado para aprovação!");
    } catch (error: any) {
      console.error("ERRO COMPLETO:", error);

      alert(
        "ERRO REAL:\n\n" +
          (error?.message || error?.code || JSON.stringify(error))
      );
    } finally {
      setEnviando(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-red-700 px-6 py-3 font-bold"
        >
          Entrar com Discord
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">📦 FARM</h1>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Enviar Farm</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input
            placeholder="🍃 Folhas"
            type="number"
            value={folhas}
            onChange={(e) => setFolhas(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="💊 Ópios"
            type="number"
            value={opios}
            onChange={(e) => setOpios(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="💉 Seringas"
            type="number"
            value={seringas}
            onChange={(e) => setSeringas(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="🪡 Agulhas"
            type="number"
            value={agulhas}
            onChange={(e) => setAgulhas(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            type="file"
            accept="image/*"
            className="rounded bg-black p-4 md:col-span-2"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];

              if (arquivo) {
                converterPrint(arquivo);
              }
            }}
          />
        </div>

        {print && (
          <div className="mt-5 w-full max-w-xl rounded border border-zinc-700 bg-black p-2">
            <p className="mb-2 text-sm text-zinc-400">Preview do print:</p>

            <img
              src={print}
              alt="Print do farm"
              className="max-h-80 w-full rounded object-contain"
            />
          </div>
        )}

        <button
          onClick={enviarFarm}
          disabled={enviando}
          className="mt-6 rounded bg-red-700 px-6 py-3 font-bold disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Enviar Farm"}
        </button>
      </section>
    </main>
  );
}