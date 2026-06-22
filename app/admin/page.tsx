"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Farm = {
  id: string;
  membroNome?: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  print: string;
  status: string;
};

type Membro = {
  id: string;
  nome: string;
  nomeRP?: string;
  passaporte?: string;
  email?: string;
  discordId?: string;
  cargo: string;
  status: string;
};

export default function AdminPage() {
  const { data: session } = useSession();

  const [farms, setFarms] = useState<Farm[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [novoAviso, setNovoAviso] = useState("");

  const [metaFolhas, setMetaFolhas] = useState("2000");
  const [metaOpios, setMetaOpios] = useState("2000");
  const [metaSeringas, setMetaSeringas] = useState("800");
  const [metaAgulhas, setMetaAgulhas] = useState("800");

  function ehGerencia(cargo?: string) {
    const cargoLimpo = cargo?.trim();

    return (
      cargoLimpo === "Líder" ||
      cargoLimpo === "Vice-Líder" ||
      cargoLimpo === "Gerente Geral" ||
      cargoLimpo === "Gerente de Farm" ||
      cargoLimpo === "Gerente de Compras" ||
      cargoLimpo === "Gerente de Vendas" ||
      cargoLimpo === "Gerente de Produção" ||
      cargoLimpo === "Gerente de Ações"
    );
  }

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

      if (status === "aprovado" && ehGerencia(cargo)) {
        setTemPermissao(true);
        await carregarFarms();
        await carregarMembros();
        await carregarMetas();
      } else {
        setTemPermissao(false);
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);
    async function carregarMetas() {
    const metasSnap = await getDoc(doc(db, "config", "metas"));

    if (metasSnap.exists()) {
      const metas = metasSnap.data();

      setMetaFolhas(String(metas.folhas || 2000));
      setMetaOpios(String(metas.opios || 2000));
      setMetaSeringas(String(metas.seringas || 800));
      setMetaAgulhas(String(metas.agulhas || 800));
    }
  }

  async function salvarMetas() {
    await setDoc(
      doc(db, "config", "metas"),
      {
        folhas: Number(metaFolhas),
        opios: Number(metaOpios),
        seringas: Number(metaSeringas),
        agulhas: Number(metaAgulhas),
      },
      { merge: true }
    );

    alert("Metas salvas com sucesso!");
  }

  async function carregarFarms() {
    const snapshot = await getDocs(collection(db, "farm"));

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<Farm, "id">),
    }));

    setFarms(lista.filter((farm) => farm.status === "pendente"));
  }

  async function carregarMembros() {
    const snapshot = await getDocs(collection(db, "membros"));

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...(item.data() as Omit<Membro, "id">),
    }));

    setMembros(lista.filter((membro) => membro.status?.trim() === "pendente"));
  }

  async function criarAviso() {
    if (!novoAviso.trim()) {
      alert("Digite um aviso.");
      return;
    }

    await addDoc(collection(db, "avisos"), {
      texto: novoAviso,
      criadoEm: new Date(),
    });

    alert("Aviso publicado!");
    setNovoAviso("");
  }

  async function aprovarMembro(id: string, cargo: string) {
    await updateDoc(doc(db, "membros", id), {
      status: "aprovado",
      cargo: cargo || "Membro",
    });

    alert("Membro aprovado!");
    carregarMembros();
  }

  async function reprovarMembro(id: string) {
    await updateDoc(doc(db, "membros", id), {
      status: "reprovado",
      cargo: "Nenhum",
    });

    alert("Membro reprovado!");
    carregarMembros();
  }

  async function mudarCargo(membroId: string, cargo: string) {
    await updateDoc(doc(db, "membros", membroId), {
      cargo,
    });

    carregarMembros();
  }

  async function aprovarFarm(farm: Farm) {
    await updateDoc(doc(db, "farm", farm.id), {
      status: "aprovado",
    });

    alert("Farm aprovado!");
    carregarFarms();
  }

  async function reprovarFarm(id: string) {
    await updateDoc(doc(db, "farm", id), {
      status: "reprovado",
    });

    alert("Farm reprovado!");
    carregarFarms();
  }  if (carregando) {
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
          <h1 className="text-4xl font-black text-red-600">Acesso Admin</h1>

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
            Apenas Líder, Vice-Líder ou Gerentes podem acessar o painel admin.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        ⚙️ PAINEL ADMIN
      </h1>

      <section className="mb-10 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">🎯 Configurar Metas</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={metaFolhas}
            onChange={(e) => setMetaFolhas(e.target.value)}
            placeholder="Folhas"
            className="rounded bg-black p-3"
          />

          <input
            value={metaOpios}
            onChange={(e) => setMetaOpios(e.target.value)}
            placeholder="Ópios"
            className="rounded bg-black p-3"
          />

          <input
            value={metaSeringas}
            onChange={(e) => setMetaSeringas(e.target.value)}
            placeholder="Seringas"
            className="rounded bg-black p-3"
          />

          <input
            value={metaAgulhas}
            onChange={(e) => setMetaAgulhas(e.target.value)}
            placeholder="Agulhas"
            className="rounded bg-black p-3"
          />
        </div>

        <button
          onClick={salvarMetas}
          className="mt-5 rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
        >
          Salvar Metas
        </button>
      </section>

      <section className="mb-10 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">📢 Criar Aviso</h2>

        <textarea
          value={novoAviso}
          onChange={(e) => setNovoAviso(e.target.value)}
          placeholder="Digite o aviso da facção..."
          className="min-h-32 w-full rounded bg-black p-4 text-white"
        />

        <button
          onClick={criarAviso}
          className="mt-4 rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
        >
          Publicar Aviso
        </button>
      </section>
            <section className="mb-10 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">👥 Membros Pendentes</h2>

        {membros.length === 0 && (
          <p className="text-zinc-400">Nenhum membro pendente.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {membros.map((membro) => (
            <div
              key={membro.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-2xl font-bold">
                👤 {membro.nomeRP || membro.nome}
              </h3>

              <p className="mt-2 text-zinc-400">
                🎫 Passaporte: {membro.passaporte || "Não informado"}
              </p>

              <p className="text-zinc-400">🎮 Discord: {membro.nome}</p>
              <p className="text-zinc-400">📧 {membro.email || "Sem email"}</p>

              <p className="mt-3">
                Status:{" "}
                <strong className="text-yellow-400">{membro.status}</strong>
              </p>

              <select
                value={membro.cargo === "Nenhum" ? "Membro" : membro.cargo}
                onChange={(e) => mudarCargo(membro.id, e.target.value)}
                className="mt-4 w-full rounded bg-zinc-900 p-3 text-white"
              >
                <option value="Membro">👥 Membro</option>
                <option value="Elite">⚔️ Elite</option>
                <option value="Gerente de Farm">🌿 Gerente de Farm</option>
                <option value="Gerente de Vendas">💰 Gerente de Vendas</option>
                <option value="Gerente de Produção">🏭 Gerente de Produção</option>
                <option value="Gerente de Compras">🛒 Gerente de Compras</option>
                <option value="Gerente de Ações">🎯 Gerente de Ações</option>
                <option value="Gerente Geral">🛡️ Gerente Geral</option>
                <option value="Vice-Líder">👑 Vice-Líder</option>
                <option value="Líder">🏆 Líder</option>
              </select>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() =>
                    aprovarMembro(
                      membro.id,
                      membro.cargo === "Nenhum" ? "Membro" : membro.cargo
                    )
                  }
                  className="rounded bg-green-700 px-5 py-3 font-bold hover:bg-green-600"
                >
                  Aprovar
                </button>

                <button
                  onClick={() => reprovarMembro(membro.id)}
                  className="rounded bg-red-700 px-5 py-3 font-bold hover:bg-red-600"
                >
                  Reprovar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">📦 Farms Pendentes</h2>

        {farms.length === 0 && (
          <p className="text-zinc-400">Nenhum farm pendente.</p>
        )}

        {farms.map((farm) => (
          <div
            key={farm.id}
            className="mb-8 rounded-xl border border-red-900 bg-black p-6"
          >
            <p className="text-xl font-bold">
              👤 {farm.membroNome || "Sem nome"}
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
                alt="Print"
                className="mt-5 max-h-96 w-full rounded-xl object-contain"
              />
            )}

            <div className="mt-5 flex gap-4">
              <button
                onClick={() => aprovarFarm(farm)}
                className="rounded bg-green-700 px-5 py-3 font-bold hover:bg-green-600"
              >
                Aprovar Farm
              </button>

              <button
                onClick={() => reprovarFarm(farm.id)}
                className="rounded bg-red-700 px-5 py-3 font-bold hover:bg-red-600"
              >
                Reprovar Farm
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}