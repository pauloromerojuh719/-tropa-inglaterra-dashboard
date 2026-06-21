"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function FarmPage() {
  const { data: session } = useSession();

  const [folhas, setFolhas] = useState("");
  const [opios, setOpios] = useState("");
  const [seringas, setSeringas] = useState("");
  const [agulhas, setAgulhas] = useState("");
  const [print, setPrint] = useState("");
  const [enviando, setEnviando] = useState(false);

  function converterPrint(arquivo: File) {
    const reader = new FileReader();

    reader.onloadend = () => {
      setPrint(reader.result as string);
    };

    reader.readAsDataURL(arquivo);
  }

  async function enviarFarm() {
    if (!session?.user) return;

    if (!folhas && !opios && !seringas && !agulhas) {
      alert("Preencha pelo menos uma quantidade.");
      return;
    }

    if (!print) {
      alert("Envie o print do farm.");
      return;
    }

    setEnviando(true);

    await addDoc(collection(db, "farm"), {
      membroNome: session.user.name || "Sem nome",
      membroEmail: session.user.email || "",
      membroId: (session.user as any).id || "",
      folhas: Number(folhas || 0),
      opios: Number(opios || 0),
      seringas: Number(seringas || 0),
      agulhas: Number(agulhas || 0),
      print,
      status: "pendente",
      criadoEm: Timestamp.now(),
    });

    setFolhas("");
    setOpios("");
    setSeringas("");
    setAgulhas("");
    setPrint("");
    setEnviando(false);

    alert("Farm enviado para aprovação!");
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
              if (arquivo) converterPrint(arquivo);
            }}
          />
        </div>

        {print && (
          <img
            src={print}
            alt="Print do farm"
            className="mt-5 h-40 rounded border border-zinc-700"
          />
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