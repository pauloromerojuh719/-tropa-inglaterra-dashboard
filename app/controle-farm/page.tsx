"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  username?: string;
  email?: string;
  discordId?: string;
  cargo: string;
  status: string;
};

type Farm = {
  id: string;
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  print?: string;
  status: string;
  criadoEm?: any;
};

type ResumoMembro = {
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  total: number;
};

function nomeExibicao(membro?: Membro) {
  if (!membro) return "Sem nome";

  return (
    membro.nomeRP ||
    membro.nomeDiscord ||
    membro.nome ||
    membro.username ||
    membro.email ||
    "Sem nome"
  );
}

export default function ControleFarmPage() {
  const { data: session } = useSession();

  const [resumo, setResumo] = useState<ResumoMembro[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [membroSelecionado, setMembroSelecionado] =
    useState<ResumoMembro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [imagemAberta, setImagemAberta] = useState<string | null>(null);

  useEffect(() => {
    verificarPermissao();
  }, [session]);

  function formatarData(data: any) {
    if (!data?.toDate) return "Sem data";
    return data.toDate().toLocaleString("pt-BR");
  }

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
      (cargo === "Líder" ||
        cargo === "Vice-Líder" ||
        cargo === "Gerente Geral" ||
        cargo === "Gerente de Farm" ||
        cargo === "Gerente de Produção" ||
        cargo?.includes("Gerente"))
    ) {
      setTemPermissao(true);
      await carregarControleFarm();
    } else {
      setTemPermissao(false);
    }

    setCarregando(false);
  }

  async function carregarControleFarm() {
    const farmSnap = await getDocs(collection(db, "farm"));
    const membrosSnap = await getDocs(collection(db, "membros"));

    const membrosPorId: Record<string, Membro> = {};
    const membrosPorEmail: Record<string, Membro> = {};

    membrosSnap.docs.forEach((item) => {
      const dados = item.data() as Membro;

      if (dados.discordId) {
        membrosPorId[dados.discordId] = dados;
      }

      if (dados.email) {
        membrosPorEmail[dados.email] = dados;
      }
    });

    const mapa: Record<string, ResumoMembro> = {};
    const listaFarms: Farm[] = [];

    farmSnap.docs.forEach((docItem) => {
      const farm = {
        id: docItem.id,
        ...(docItem.data() as Omit<Farm, "id">),
      };

      if (farm.status !== "aprovado") return;

      const membroDoCadastro =
        membrosPorId[farm.membroId] || membrosPorEmail[farm.membroEmail];

      const nomeCorreto = membroDoCadastro
        ? nomeExibicao(membroDoCadastro)
        : farm.membroNome || "Sem nome";

      const farmCorrigido = {
        ...farm,
        membroNome: nomeCorreto,
      };

      listaFarms.push(farmCorrigido);

      const chave = farm.membroId || farm.membroEmail || farm.membroNome;

      if (!mapa[chave]) {
        mapa[chave] = {
          membroNome: nomeCorreto,
          membroEmail: farm.membroEmail || membroDoCadastro?.email || "",
          membroId: farm.membroId || membroDoCadastro?.discordId || "",
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
          total: 0,
        };
      }

      mapa[chave].membroNome = nomeCorreto;
      mapa[chave].folhas += Number(farm.folhas || 0);
      mapa[chave].opios += Number(farm.opios || 0);
      mapa[chave].seringas += Number(farm.seringas || 0);
      mapa[chave].agulhas += Number(farm.agulhas || 0);

      mapa[chave].total =
        mapa[chave].folhas +
        mapa[chave].opios +
        mapa[chave].seringas +
        mapa[chave].agulhas;
    });

    const lista = Object.values(mapa).sort((a, b) => b.total - a.total);

    setResumo(lista);
    setFarms(listaFarms);
  }

  function statusMeta(membro: ResumoMembro) {
    const bateu =
      membro.folhas >= 2000 &&
      membro.opios >= 2000 &&
      membro.seringas >= 800 &&
      membro.agulhas >= 800;

    return bateu ? "✅ Meta batida" : "⚠️ Falta farm";
  }

  function farmsDoMembro() {
    if (!membroSelecionado) return [];

    return farms
      .filter((farm) => {
        const chaveFarm = farm.membroId || farm.membroEmail || farm.membroNome;
        const chaveMembro =
          membroSelecionado.membroId ||
          membroSelecionado.membroEmail ||
          membroSelecionado.membroNome;

        return chaveFarm === chaveMembro;
      })
      .sort((a, b) => {
        const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
        const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
        return dataB - dataA;
      });
  }

  const listaFarmsMembro = farmsDoMembro();
  const ultimoFarm = listaFarmsMembro[0];

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
          <h1 className="text-4xl font-black text-red-600">
            Controle de Farm
          </h1>

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
          <h1 className="text-5xl font-black text-red-600">❌ ACESSO NEGADO</h1>

          <p className="mt-4 text-zinc-400">
            Apenas Líder, Vice-Líder, Gerente Geral, Gerente de Farm ou Gerente de Produção podem acessar esta área.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">
        🌿 CONTROLE DE FARM
      </h1>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Resumo dos Membros</h2>

        {resumo.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            Nenhum farm aprovado encontrado ainda.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {resumo.map((membro, index) => (
              <div
                key={membro.membroId || membro.membroEmail || membro.membroNome}
                className="rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-black">
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : `#${index + 1}`}{" "}
                      {membro.membroNome}
                    </h3>

                    <p className="mt-1 text-zinc-400">
                      {membro.membroEmail}
                    </p>

                    <p className="mt-2 font-bold text-red-400">
                      {statusMeta(membro)}
                    </p>

                    <button
                      onClick={() => setMembroSelecionado(membro)}
                      className="mt-4 rounded bg-red-700 px-4 py-2 font-bold hover:bg-red-600"
                    >
                      Ver Perfil Farm
                    </button>
                  </div>

                  <div className="grid gap-3 text-right md:grid-cols-5">
                    <div>
                      <p className="text-sm text-zinc-400">Folhas</p>
                      <p className="text-xl font-black">{membro.folhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Ópios</p>
                      <p className="text-xl font-black">{membro.opios}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Seringas</p>
                      <p className="text-xl font-black">{membro.seringas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Agulhas</p>
                      <p className="text-xl font-black">{membro.agulhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Total</p>
                      <p className="text-xl font-black text-red-500">
                        {membro.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {membroSelecionado && (
        <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-red-500">
              👤 {membroSelecionado.membroNome}
            </h2>

            <button
              onClick={() => setMembroSelecionado(null)}
              className="rounded bg-zinc-800 px-4 py-2 font-bold hover:bg-zinc-700"
            >
              Fechar
            </button>
          </div>

          <p className="mt-2 text-zinc-400">
            {membroSelecionado.membroEmail}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">🍃 Folhas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.folhas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">💊 Ópios</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.opios}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">💉 Seringas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.seringas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">🪡 Agulhas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.agulhas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">📦 Total</p>
              <h3 className="text-2xl font-black text-red-500">
                {membroSelecionado.total}
              </h3>
            </div>
          </div>

          <div className="mt-6 rounded bg-black p-4">
            <p className="font-bold">
              🎯 Status: {statusMeta(membroSelecionado)}
            </p>

            <p className="mt-2">
              🕒 Último farm:{" "}
              {ultimoFarm ? formatarData(ultimoFarm.criadoEm) : "Sem farm"}
            </p>

            <p className="mt-2">
              🖼️ Prints enviados: {listaFarmsMembro.length}
            </p>
          </div>

          <h3 className="mt-8 text-2xl font-bold">📸 Prints enviados</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {listaFarmsMembro.length === 0 ? (
              <p className="text-zinc-400">Nenhum print encontrado.</p>
            ) : (
              listaFarmsMembro.map((farm) => (
                <div
                  key={farm.id}
                  className="rounded-xl border border-zinc-800 bg-black p-4"
                >
                  <p>🍃 Folhas: {farm.folhas}</p>
                  <p>💊 Ópios: {farm.opios}</p>
                  <p>💉 Seringas: {farm.seringas}</p>
                  <p>🪡 Agulhas: {farm.agulhas}</p>

                  <p className="mt-2 text-zinc-400">
                    Data: {formatarData(farm.criadoEm)}
                  </p>

                  {farm.print && (
                    <img
                      src={farm.print}
                      alt="Print do farm"
                      onClick={() => setImagemAberta(farm.print || "")}
                      className="mt-3 h-40 w-full cursor-pointer rounded border border-zinc-700 object-contain transition hover:scale-105"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {imagemAberta && (
        <div
          onClick={() => setImagemAberta(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            onClick={() => setImagemAberta(null)}
            className="absolute right-6 top-6 rounded bg-red-700 px-4 py-2 text-xl font-black text-white hover:bg-red-600"
          >
            ✕
          </button>

          <img
            src={imagemAberta}
            alt="Print aberto"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
          />
        </div>
      )}
    </main>
  );
}