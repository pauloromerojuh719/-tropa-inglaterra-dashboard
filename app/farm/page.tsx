"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
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
  print: string;
  status: string;
};

export default function FarmPage() {
  const { data: session } = useSession();

  const [folhas, setFolhas] = useState("");
  const [opios, setOpios] = useState("");
  const [seringas, setSeringas] = useState("");
  const [agulhas, setAgulhas] = useState("");
  const [print, setPrint] = useState("");
  const [historico, setHistorico] = useState<Farm[]>([]);

  useEffect(() => {
    buscarHistorico();
  }, [session]);

  async function buscarHistorico() {
    if (!session?.user) return;

    const discordId = (session.user as any).id;
    if (!discordId) return;

    const q = query(
      collection(db, "farm"),
      where("membroId", "==", discordId)
    );

    const snapshot = await getDocs(q);

    const lista = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Farm, "id">),
    }));

    setHistorico(lista.reverse());
  }

  function escolherPrint(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onloadend = () => {
      setPrint(leitor.result as string);
    };

    leitor.readAsDataURL(arquivo);
  }

  async function enviarFarm() {
    if (!session?.user) {
      alert("Você precisa estar logado com Discord.");
      return;
    }

    if (!print) {
      alert("Coloque o print do farm antes de enviar.");
      return;
    }

    await addDoc(collection(db, "farm"), {
      membroNome: session.user.name || "Sem nome",
      membroEmail: session.user.email || "",
      membroId: (session.user as any).id || "",

      folhas: Number(folhas),
      opios: Number(opios),
      seringas: Number(seringas),
      agulhas: Number(agulhas),

      print,
      status: "pendente",
      criadoEm: new Date(),
    });

    alert("Farm enviado para aprovação!");

    setFolhas("");
    setOpios("");
    setSeringas("");
    setAgulhas("");
    setPrint("");

    buscarHistorico();
  }

  function corStatus(status: string) {
    if (status === "aprovado") return "text-green-400";
    if (status === "reprovado") return "text-red-400";
    return "text-yellow-400";
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">📦 FARM</h1>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-2xl font-bold">Enviar Farm</h2>

        <p className="mb-5 text-zinc-400">
          Logado como:{" "}
          <strong className="text-white">
            {session?.user?.name || "Não logado"}
          </strong>
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            className="rounded bg-black p-3"
            placeholder="Folhas"
            value={folhas}
            onChange={(e) => setFolhas(e.target.value)}
          />

          <input
            className="rounded bg-black p-3"
            placeholder="Ópios"
            value={opios}
            onChange={(e) => setOpios(e.target.value)}
          />

          <input
            className="rounded bg-black p-3"
            placeholder="Seringas"
            value={seringas}
            onChange={(e) => setSeringas(e.target.value)}
          />

          <input
            className="rounded bg-black p-3"
            placeholder="Agulhas"
            value={agulhas}
            onChange={(e) => setAgulhas(e.target.value)}
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block font-bold">📷 Print obrigatório</label>

          <input
            type="file"
            accept="image/*"
            onChange={escolherPrint}
            className="w-full rounded bg-black p-3"
          />
        </div>

        {print && (
          <img
            src={print}
            alt="Prévia do print"
            className="mt-5 max-h-80 w-full rounded-xl border border-red-900 object-contain"
          />
        )}

        <button
          onClick={enviarFarm}
          className="mt-5 rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
        >
          Enviar Farm
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-2xl font-bold">📜 Histórico de Farms</h2>

        {historico.length === 0 && (
          <p className="text-zinc-400">Nenhum farm enviado ainda.</p>
        )}

        <div className="grid gap-5">
          {historico.map((farm) => (
            <div
              key={farm.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <p>
                Status:{" "}
                <strong className={corStatus(farm.status)}>
                  {farm.status}
                </strong>
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-4">
                <p>🍃 Folhas: {farm.folhas}</p>
                <p>💊 Ópios: {farm.opios}</p>
                <p>💉 Seringas: {farm.seringas}</p>
                <p>🪡 Agulhas: {farm.agulhas}</p>
              </div>

              {farm.print && (
                <img
                  src={farm.print}
                  alt="Print do farm"
                  className="mt-5 max-h-80 w-full rounded-xl border border-red-900 object-contain"
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}