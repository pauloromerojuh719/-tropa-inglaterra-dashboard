"use client";

import { useEffect, useState } from "react";
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

export default function MetasPage() {
  const [membros, setMembros] = useState<ResumoMembro[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarMetas();
  }, []);

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

    const snapshot = await getDocs(collection(db, "farm"));
    const farms = snapshot.docs.map((doc) => doc.data() as Farm);

    const aprovados = farms.filter((farm) => farm.status === "aprovado");

    const semanaAtual = inicioSemanaAtual();
    const semanaPassada = inicioSemanaPassada();

    const resumo: Record<string, ResumoMembro> = {};

    aprovados.forEach((farm) => {
      const data = pegarData(farm);
      if (!data) return;

      const chave =
        farm.membroId || farm.membroEmail || farm.membroNome || "Sem nome";

      if (!resumo[chave]) {
        resumo[chave] = {
          nome: farm.membroNome || "Sem nome",
          email: farm.membroEmail || "",
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

    const resultado = Object.values(resumo).map((membro) => {
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
    });

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

  function progresso(valor: number, meta: number) {
    return Math.min((valor / meta) * 100, 100);
  }

  return (
    <main className="min-h-screen bg-black text-white p-10">
      <h1 className="mb-8 text-5xl font-black text-red-600">
        🎯 META DA SEMANA
      </h1>

      {carregando && <p>Carregando metas...</p>}

      {!carregando && membros.length === 0 && (
        <p className="text-zinc-400">Nenhum farm aprovado ainda.</p>
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