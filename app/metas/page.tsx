"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

type Farm = {
  membroNome?: string;
  membroEmail?: string;
  membroId?: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
  criadoEm?: any;
};

type MembroSistema = {
  id?: string;
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  username?: string;
  email?: string;
  cargo?: string;
  status?: string;
};

type ResumoMembro = {
  nome: string;
  email: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  saldoFolhas: number;
  saldoOpios: number;
  saldoSeringas: number;
  saldoAgulhas: number;
};

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

const cargosQueVeemTodos = [
  "Líder",
  "Vice-Líder",
  "Gerente Geral",
  "Gerente de Farm",
  "Gerente de Produção",
  "Gerente de Compras",
  "Gerente de Vendas",
];

function nomeExibicao(membro?: MembroSistema | null, fallback?: string) {
  return (
    membro?.nomeRP ||
    membro?.nome ||
    membro?.nomeDiscord ||
    membro?.username ||
    fallback ||
    "Sem nome"
  );
}

export default function MetasPage() {
  const { data: session, status } = useSession();

  const [membros, setMembros] = useState<ResumoMembro[]>([]);
  const [membroLogado, setMembroLogado] = useState<MembroSistema | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      carregarMetas();
    }

    if (status === "unauthenticated") {
      setCarregando(false);
    }
  }, [status]);

  function inicioSemanaAtual() {
    const hoje = new Date();
    const dia = hoje.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;

    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() + diff);
    inicio.setHours(0, 0, 0, 0);

    return inicio;
  }

  function inicioSemanaPassada() {
    const inicio = inicioSemanaAtual();
    const passada = new Date(inicio);
    passada.setDate(inicio.getDate() - 7);
    return passada;
  }

  function pegarData(farm: Farm) {
    if (!farm.criadoEm) return null;

    if (farm.criadoEm.toDate) {
      return farm.criadoEm.toDate();
    }

    return new Date(farm.criadoEm);
  }

  async function carregarMetas() {
    setCarregando(true);

    const emailLogado = session?.user?.email || "";
    const discordIdLogado = (session?.user as any)?.id || "";

    const membrosSnapshot = await getDocs(collection(db, "membros"));

    const todosMembrosSistema = membrosSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as MembroSistema),
    }));

    const usuarioLogado =
      todosMembrosSistema.find(
        (membro) =>
          membro.email === emailLogado ||
          membro.id === discordIdLogado
      ) || null;

    setMembroLogado(usuarioLogado);

    const podeVerTodos = cargosQueVeemTodos.includes(usuarioLogado?.cargo || "");

    const farmsSnapshot = await getDocs(collection(db, "farm"));
    const farms = farmsSnapshot.docs.map((doc) => doc.data() as Farm);

    const aprovados = farms.filter((farm) => farm.status === "aprovado");

    const semanaAtual = inicioSemanaAtual();
    const semanaPassada = inicioSemanaPassada();

    const resumo: Record<string, ResumoMembro> = {};

    aprovados.forEach((farm) => {
      const data = pegarData(farm);
      if (!data) return;

      if (!podeVerTodos && farm.membroEmail !== emailLogado && farm.membroId !== discordIdLogado) {
        return;
      }

      const membroSistema =
        todosMembrosSistema.find((membro) => membro.id === farm.membroId) ||
        todosMembrosSistema.find((membro) => membro.email === farm.membroEmail) ||
        todosMembrosSistema.find((membro) => membro.nome === farm.membroNome) ||
        null;

      const chave =
        farm.membroId ||
        farm.membroEmail ||
        membroSistema?.id ||
        membroSistema?.email ||
        farm.membroNome ||
        "Sem nome";

      if (!resumo[chave]) {
        resumo[chave] = {
          nome: nomeExibicao(membroSistema, farm.membroNome),
          email: farm.membroEmail || membroSistema?.email || "",
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
          saldoFolhas: 0,
          saldoOpios: 0,
          saldoSeringas: 0,
          saldoAgulhas: 0,
        };
      }

      const isSemanaAtual = data >= semanaAtual;
      const isSemanaPassada = data >= semanaPassada && data < semanaAtual;

      if (isSemanaAtual) {
        resumo[chave].folhas += farm.folhas || 0;
        resumo[chave].opios += farm.opios || 0;
        resumo[chave].seringas += farm.seringas || 0;
        resumo[chave].agulhas += farm.agulhas || 0;
      }

      if (isSemanaPassada) {
        resumo[chave].saldoFolhas += farm.folhas || 0;
        resumo[chave].saldoOpios += farm.opios || 0;
        resumo[chave].saldoSeringas += farm.seringas || 0;
        resumo[chave].saldoAgulhas += farm.agulhas || 0;
      }
    });

    const resultado = Object.values(resumo)
      .map((membro) => {
        const extraFolhas = Math.max(membro.saldoFolhas - META_FOLHAS, 0);
        const extraOpios = Math.max(membro.saldoOpios - META_OPIOS, 0);
        const extraSeringas = Math.max(membro.saldoSeringas - META_SERINGAS, 0);
        const extraAgulhas = Math.max(membro.saldoAgulhas - META_AGULHAS, 0);

        return {
          ...membro,
          folhas: membro.folhas + extraFolhas,
          opios: membro.opios + extraOpios,
          seringas: membro.seringas + extraSeringas,
          agulhas: membro.agulhas + extraAgulhas,
          saldoFolhas: extraFolhas,
          saldoOpios: extraOpios,
          saldoSeringas: extraSeringas,
          saldoAgulhas: extraAgulhas,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    setMembros(resultado);
    setCarregando(false);
  }

  function bateuMeta(membro: ResumoMembro) {
    return (
      membro.folhas >= META_FOLHAS &&
      membro.opios >= META_OPIOS &&
      membro.seringas >= META_SERINGAS &&
      membro.agulhas >= META_AGULHAS
    );
  }

  function pendencias(membro: ResumoMembro) {
    const faltas = [];

    if (membro.folhas < META_FOLHAS) {
      faltas.push(`Folhas: faltam ${META_FOLHAS - membro.folhas}`);
    }

    if (membro.opios < META_OPIOS) {
      faltas.push(`Ópios: faltam ${META_OPIOS - membro.opios}`);
    }

    if (membro.seringas < META_SERINGAS) {
      faltas.push(`Seringas: faltam ${META_SERINGAS - membro.seringas}`);
    }

    if (membro.agulhas < META_AGULHAS) {
      faltas.push(`Agulhas: faltam ${META_AGULHAS - membro.agulhas}`);
    }

    return faltas;
  }

  function progresso(valor: number, meta: number) {
    return Math.min((valor / meta) * 100, 100);
  }

  const podeVerTodos = cargosQueVeemTodos.includes(membroLogado?.cargo || "");

  const bateramMeta = membros.filter((membro) => bateuMeta(membro));
  const naoBateramMeta = membros.filter((membro) => !bateuMeta(membro));

  if (status === "unauthenticated") {
    return (
      <main className="min-h-screen bg-black text-white p-10">
        <h1 className="mb-8 text-5xl font-black text-red-600">
          🎯 META DA SEMANA
        </h1>

        <p className="mb-5 text-zinc-400">
          Você precisa entrar com Discord para ver sua meta.
        </p>

        <button
          onClick={() => signIn("discord")}
          className="rounded-xl bg-red-700 px-6 py-3 font-black hover:bg-red-600"
        >
          Entrar com Discord
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="mb-3 text-5xl font-black text-red-600">
        🎯 META DA SEMANA
      </h1>

      <p className="mb-8 text-zinc-400">
        {podeVerTodos
          ? "Você está vendo a meta de todos os membros."
          : "Você está vendo somente a sua meta."}
      </p>

      {carregando && <p>Carregando metas...</p>}

      {!carregando && membros.length === 0 && (
        <p className="text-zinc-400">Nenhum farm aprovado ainda.</p>
      )}

      {!carregando && membros.length > 0 && podeVerTodos && (
        <div className="mb-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-green-700 bg-zinc-950 p-6">
            <h2 className="mb-4 text-3xl font-black text-green-400">
              ✅ Bateram a meta
            </h2>

            {bateramMeta.length === 0 ? (
              <p className="text-zinc-400">Ninguém bateu a meta ainda.</p>
            ) : (
              <ul className="space-y-2">
                {bateramMeta.map((membro) => (
                  <li
                    key={membro.email || membro.nome}
                    className="rounded-lg bg-green-950 p-3 font-bold"
                  >
                    {membro.nome}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-yellow-700 bg-zinc-950 p-6">
            <h2 className="mb-4 text-3xl font-black text-yellow-400">
              ❌ Não bateram a meta
            </h2>

            {naoBateramMeta.length === 0 ? (
              <p className="text-zinc-400">Todos bateram a meta.</p>
            ) : (
              <ul className="space-y-3">
                {naoBateramMeta.map((membro) => (
                  <li
                    key={membro.email || membro.nome}
                    className="rounded-lg bg-yellow-950 p-3"
                  >
                    <p className="font-bold">{membro.nome}</p>

                    <p className="mt-1 text-sm text-yellow-300">
                      {pendencias(membro).join(" | ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {membros.map((membro) => (
          <div
            key={membro.email || membro.nome}
            className="border border-red-900 rounded-xl p-6 bg-zinc-950"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-3xl font-bold">{membro.nome}</h2>
                <p className="text-zinc-400">{membro.email}</p>
              </div>

              {bateuMeta(membro) ? (
                <span className="text-green-400 font-bold">✅ META BATIDA</span>
              ) : (
                <span className="text-yellow-400 font-bold">⚠️ PENDENTE</span>
              )}
            </div>

            <div className="mb-5 text-sm text-zinc-400">
              Saldo vindo da semana passada: 🍃 {membro.saldoFolhas} | 💊{" "}
              {membro.saldoOpios} | 💉 {membro.saldoSeringas} | 🪡{" "}
              {membro.saldoAgulhas}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <MetaItem
                titulo="🍃 Folhas"
                valor={membro.folhas}
                meta={META_FOLHAS}
                progresso={progresso(membro.folhas, META_FOLHAS)}
                cor="bg-green-500"
              />

              <MetaItem
                titulo="💊 Ópios"
                valor={membro.opios}
                meta={META_OPIOS}
                progresso={progresso(membro.opios, META_OPIOS)}
                cor="bg-blue-500"
              />

              <MetaItem
                titulo="💉 Seringas"
                valor={membro.seringas}
                meta={META_SERINGAS}
                progresso={progresso(membro.seringas, META_SERINGAS)}
                cor="bg-yellow-500"
              />

              <MetaItem
                titulo="🪡 Agulhas"
                valor={membro.agulhas}
                meta={META_AGULHAS}
                progresso={progresso(membro.agulhas, META_AGULHAS)}
                cor="bg-purple-500"
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function MetaItem({
  titulo,
  valor,
  meta,
  progresso,
  cor,
}: {
  titulo: string;
  valor: number;
  meta: number;
  progresso: number;
  cor: string;
}) {
  return (
    <div>
      <h3 className="text-xl font-bold">{titulo}</h3>
      <p className="text-lg mt-1">
        {valor} / {meta}
      </p>

      {valor >= meta ? (
        <p className="text-green-400 font-bold text-sm mt-1">✅ OK</p>
      ) : (
        <p className="text-yellow-400 font-bold text-sm mt-1">
          Falta {meta - valor}
        </p>
      )}

      <div className="mt-2 h-4 w-full rounded-full bg-zinc-800">
        <div
          className={`h-4 rounded-full ${cor}`}
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  );
}