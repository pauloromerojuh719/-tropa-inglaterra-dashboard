"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  cargo: string;
  status: string;
};

type Acao = {
  id: string;
  tipo: string;
  status: "Sucesso" | "Falhou";
  participantes: number;
  valor: number;
  observacao: string;
  familiaRival?: string;
  registradoPor: string;
  criadoEm: any;
};

const limites: Record<string, number> = {
  Joalheria: 1,
  Concessionária: 1,
  Fleeca: 2,
  Açougue: 1,
  Galinheiro: 1,
  "Central do Mergulhador": 1,
  "Banco Central": 1,
  "Banco Paleto": 1,
  Desafio: 999,
};

const tiposAcoes = Object.keys(limites);

export default function AcoesPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [membroLogado, setMembroLogado] = useState<Membro | null>(null);

  const [tipo, setTipo] = useState("Joalheria");
  const [status, setStatus] = useState<"Sucesso" | "Falhou">("Sucesso");
  const [participantes, setParticipantes] = useState("");
  const [valor, setValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [familiaRival, setFamiliaRival] = useState("");

  const [acoes, setAcoes] = useState<Acao[]>([]);

  function nomeExibicao() {
    return (
      membroLogado?.nomeRP ||
      membroLogado?.nomeDiscord ||
      membroLogado?.nome ||
      session?.user?.name ||
      "Sem nome"
    );
  }

  function formatarDinheiro(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: any) {
    if (!data?.toDate) return "Sem data";
    return data.toDate().toLocaleString("pt-BR");
  }

  function inicioDaSemana() {
    const hoje = new Date();
    const dia = hoje.getDay();
    const diferenca = dia === 0 ? 6 : dia - 1;

    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - diferenca);
    inicio.setHours(0, 0, 0, 0);

    return inicio;
  }

  async function enviarLogAcao(dados: {
    tipo: string;
    status: string;
    participantes: number;
    valor: number;
    responsavel: string;
    familiaRival?: string;
    observacao?: string;
  }) {
    try {
      await fetch("/api/discord/log-acoes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });
    } catch (error) {
      console.error("Erro ao enviar log de ação:", error);
    }
  }

  async function carregarAcoes() {
    const snapshot = await getDocs(collection(db, "acoes"));

    const lista = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...(docItem.data() as Omit<Acao, "id">),
    })) as Acao[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setAcoes(lista);
  }

  async function salvarAcao() {
    if (!session?.user) return;

    if (!participantes || !valor) {
      alert("Preencha participantes e valor.");
      return;
    }

    if (tipo === "Desafio" && !familiaRival) {
      alert("Preencha a família rival.");
      return;
    }

    const responsavel = nomeExibicao();

    const dados = {
      tipo,
      status,
      participantes: Number(participantes),
      valor: Number(valor),
      observacao,
      familiaRival: tipo === "Desafio" ? familiaRival : "",
      registradoPor: responsavel,
      criadoEm: Timestamp.now(),
    };

    await addDoc(collection(db, "acoes"), dados);

    await enviarLogAcao({
      tipo,
      status,
      participantes: Number(participantes),
      valor: Number(valor),
      responsavel,
      familiaRival: tipo === "Desafio" ? familiaRival : "",
      observacao,
    });

    setTipo("Joalheria");
    setStatus("Sucesso");
    setParticipantes("");
    setValor("");
    setObservacao("");
    setFamiliaRival("");

    await carregarAcoes();

    alert("Ação registrada!");
  }

  useEffect(() => {
    async function verificarPermissao() {
      if (!session?.user) {
        setCarregando(false);
        return;
      }

      const discordId = (session.user as any).id;

      const membroSnap = await getDoc(doc(db, "membros", discordId));

      if (!membroSnap.exists()) {
        setCarregando(false);
        return;
      }

      const membro = membroSnap.data() as Membro;
      setMembroLogado(membro);

      const cargo = membro.cargo?.trim() || "";
      const status = membro.status?.trim() || "";

      if (
        status === "aprovado" &&
        (cargo === "Líder" ||
          cargo === "Vice-Líder" ||
          cargo.includes("Gerente"))
      ) {
        setTemPermissao(true);
        await carregarAcoes();
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  const acoesSemana = acoes.filter((acao) => {
    const data = acao.criadoEm?.toDate?.();
    return data && data >= inicioDaSemana();
  });

  const totalSemana = acoesSemana.length;

  const valorSemana = acoesSemana.reduce(
    (total, acao) => total + (acao.valor || 0),
    0
  );

  const desafiosVencidos = acoesSemana.filter(
    (acao) => acao.tipo === "Desafio" && acao.status === "Sucesso"
  ).length;

  const desafiosPerdidos = acoesSemana.filter(
    (acao) => acao.tipo === "Desafio" && acao.status === "Falhou"
  ).length;

  function quantidadeNaSemana(tipoAcao: string) {
    return acoesSemana.filter((acao) => acao.tipo === tipoAcao).length;
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        Carregando...
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-red-700 px-6 py-3 font-bold"
        >
          Entrar com Discord
        </button>
      </main>
    );
  }

  if (!temPermissao) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">
        <h1 className="text-5xl font-black text-red-600">
          ❌ ACESSO NEGADO
        </h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">🎯 AÇÕES</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-5">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Ações da Semana</p>
          <h2 className="text-3xl font-black text-red-500">{totalSemana}</h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Valor da Semana</p>
          <h2 className="text-3xl font-black text-green-400">
            {formatarDinheiro(valorSemana)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Desafios Vencidos</p>
          <h2 className="text-3xl font-black text-green-400">
            {desafiosVencidos}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Desafios Perdidos</p>
          <h2 className="text-3xl font-black text-red-400">
            {desafiosPerdidos}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Registros Totais</p>
          <h2 className="text-3xl font-black">{acoes.length}</h2>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Limite Semanal</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          {tiposAcoes.map((tipoAcao) => {
            const usado = quantidadeNaSemana(tipoAcao);
            const limite = limites[tipoAcao];
            const atingiu = usado >= limite;

            return (
              <div key={tipoAcao} className="rounded bg-black p-4">
                <p className="font-bold">
                  {tipoAcao === "Desafio" ? "⚔️ Desafio" : tipoAcao}
                </p>

                {tipoAcao === "Desafio" ? (
                  <>
                    <p className="text-green-400">{usado} registrado(s)</p>
                    <p className="text-sm text-zinc-400">Sem limite semanal</p>
                  </>
                ) : (
                  <>
                    <p className={atingiu ? "text-red-500" : "text-green-400"}>
                      {usado}/{limite}
                    </p>
                    <p className="text-sm text-zinc-400">
                      {atingiu ? "🚫 Limite atingido" : "✅ Disponível"}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Registrar Ação</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="rounded bg-black p-4"
          >
            {tiposAcoes.map((tipoAcao) => (
              <option key={tipoAcao} value={tipoAcao}>
                {tipoAcao === "Desafio" ? "⚔️ Desafio" : tipoAcao}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "Sucesso" | "Falhou")}
            className="rounded bg-black p-4"
          >
            <option value="Sucesso">Sucesso / Vitória</option>
            <option value="Falhou">Falhou / Derrota</option>
          </select>

          {tipo === "Desafio" && (
            <input
              placeholder="Família rival"
              value={familiaRival}
              onChange={(e) => setFamiliaRival(e.target.value)}
              className="rounded bg-black p-4 md:col-span-2"
            />
          )}

          <input
            placeholder="Participantes"
            type="number"
            value={participantes}
            onChange={(e) => setParticipantes(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder={tipo === "Desafio" ? "Premiação / Valor" : "Valor"}
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="rounded bg-black p-4"
          />

          <textarea
            placeholder="Observação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="rounded bg-black p-4 md:col-span-2"
          />
        </div>

        <button
          onClick={salvarAcao}
          className="mt-5 rounded bg-red-700 px-6 py-3 font-bold"
        >
          Salvar Ação
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">Histórico de Ações</h2>

        <div className="grid gap-4">
          {acoes.map((acao) => (
            <div
              key={acao.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-2xl font-bold">
                {acao.tipo === "Desafio" ? "⚔️ Desafio" : `🎯 ${acao.tipo}`}
              </h3>

              {acao.tipo === "Desafio" && (
                <p>
                  Família Rival:{" "}
                  <span className="font-bold text-yellow-400">
                    {acao.familiaRival || "Não informado"}
                  </span>
                </p>
              )}

              <p>
                Resultado:{" "}
                <span
                  className={
                    acao.status === "Sucesso"
                      ? "font-bold text-green-400"
                      : "font-bold text-red-400"
                  }
                >
                  {acao.status === "Sucesso" ? "Vitória" : "Derrota"}
                </span>
              </p>

              <p>Participantes: {acao.participantes}</p>
              <p>Valor: {formatarDinheiro(acao.valor)}</p>
              <p>Registrado por: {acao.registradoPor}</p>
              <p>Data: {formatarData(acao.criadoEm)}</p>

              {acao.observacao && (
                <p className="mt-2 text-zinc-400">Obs: {acao.observacao}</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}