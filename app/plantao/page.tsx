"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Plantao = {
  id: string;
  nome: string;
  email: string;
  inicio: any;
  fim?: any;
  minutos?: number;
  status: "aberto" | "fechado";
};

export default function PlantaoPage() {
  const { data: session } = useSession();
  const [plantaoAberto, setPlantaoAberto] = useState<Plantao | null>(null);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [carregando, setCarregando] = useState(true);

  function formatarMinutos(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}min`;
  }

  async function carregarPlantoes() {
    if (!session?.user?.email) return;

    setCarregando(true);

    const q = query(
      collection(db, "plantoes"),
      where("email", "==", session.user.email)
    );

    const snap = await getDocs(q);

    const lista = snap.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    })) as Plantao[];

    setPlantoes(lista);

    const aberto = lista.find((p) => p.status === "aberto");
    setPlantaoAberto(aberto || null);

    setCarregando(false);
  }

  useEffect(() => {
    carregarPlantoes();
  }, [session]);

  async function iniciarPlantao() {
    if (!session?.user) return;

    if (plantaoAberto) {
      alert("Você já tem um plantão aberto.");
      return;
    }

    await addDoc(collection(db, "plantoes"), {
      nome: session.user.name,
      email: session.user.email,
      inicio: Timestamp.now(),
      status: "aberto",
    });

    await carregarPlantoes();
  }

  async function encerrarPlantao() {
    if (!plantaoAberto) return;

    const agora = Timestamp.now();

    const inicioMillis = plantaoAberto.inicio.toDate().getTime();
    const fimMillis = agora.toDate().getTime();

    const minutos = Math.max(1, Math.floor((fimMillis - inicioMillis) / 60000));

    const ref = doc(db, "plantoes", plantaoAberto.id);

    await updateDoc(ref, {
      fim: agora,
      minutos,
      status: "fechado",
    });

    await carregarPlantoes();
  }

  const totalMinutos = plantoes
    .filter((p) => p.status === "fechado")
    .reduce((total, p) => total + (p.minutos || 0), 0);

  if (!session) {
    return (
      <main className="min-h-screen bg-red-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 text-center max-w-md w-full">
          <h1 className="text-3xl font-bold text-red-900">Plantão</h1>
          <p className="mt-3 text-gray-600">
            Entre com Discord para iniciar seu plantão.
          </p>

          <button
            onClick={() => signIn("discord")}
            className="mt-6 bg-red-900 text-white px-6 py-3 rounded-xl font-bold"
          >
            Entrar com Discord
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-red-950 p-6 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold">⏰ Plantão</h1>
        <p className="text-red-200 mt-2">
          Controle manual de entrada e saída da cidade.
        </p>

        <div className="bg-white text-black rounded-3xl p-6 mt-8">
          <h2 className="text-2xl font-bold">Olá, {session.user?.name}</h2>

          <p className="mt-3 font-bold text-red-900">
            Total finalizado: {formatarMinutos(totalMinutos)}
          </p>

          {plantaoAberto ? (
            <>
              <p className="mt-4 text-green-700 font-bold">
                Você está com plantão aberto.
              </p>

              <button
                onClick={encerrarPlantao}
                className="mt-5 bg-red-700 text-white px-6 py-3 rounded-xl font-bold"
              >
                Encerrar Plantão
              </button>
            </>
          ) : (
            <>
              <p className="mt-4 text-gray-600">
                Clique abaixo quando entrar na cidade.
              </p>

              <button
                onClick={iniciarPlantao}
                className="mt-5 bg-green-700 text-white px-6 py-3 rounded-xl font-bold"
              >
                Iniciar Plantão
              </button>
            </>
          )}
        </div>

        <div className="bg-white text-black rounded-3xl p-6 mt-6">
          <h2 className="text-2xl font-bold mb-4">Meus plantões</h2>

          {carregando ? (
            <p>Carregando...</p>
          ) : plantoes.length === 0 ? (
            <p>Nenhum plantão registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {plantoes.map((p) => (
                <div
                  key={p.id}
                  className="border rounded-xl p-4 flex justify-between"
                >
                  <div>
                    <p className="font-bold">{p.nome}</p>
                    <p className="text-sm text-gray-600">
                      Status: {p.status === "aberto" ? "Aberto" : "Fechado"}
                    </p>

                    {p.minutos && (
                      <p className="text-sm text-gray-600">
                        Tempo: {formatarMinutos(p.minutos)}
                      </p>
                    )}
                  </div>

                  <span className="font-bold">
                    {p.status === "aberto" ? "🟢 Em plantão" : "✅ Finalizado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}