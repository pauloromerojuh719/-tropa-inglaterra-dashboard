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

type Venda = {
  id: string;
  tipo: "Família" | "Membro";
  comprador?: string;
  item: string;
  quantidade: number;
  valor: number;
  vendedor: string;
  criadoEm: any;
};

export default function VendasPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [membroLogado, setMembroLogado] = useState<Membro | null>(null);

  const [tipo, setTipo] = useState<"Família" | "Membro">("Família");
  const [comprador, setComprador] = useState("");
  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [vendas, setVendas] = useState<Venda[]>([]);

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

  function inicioDoMes() {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  async function enviarLogVenda(dados: {
    tipoVenda: string;
    comprador: string;
    item: string;
    quantidade: number;
    valor: number;
    vendedor: string;
  }) {
    try {
      await fetch("/api/discord/log-vendas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });
    } catch (error) {
      console.error("Erro ao enviar log de venda:", error);
    }
  }

  async function carregarVendas() {
    const snapshot = await getDocs(collection(db, "vendas"));

    const lista = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Venda, "id">),
    })) as Venda[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setVendas(lista);
  }

  async function salvarVenda() {
    if (!session?.user) return;

    if (!comprador || !item || !quantidade || !valor) {
      alert("Preencha todos os campos.");
      return;
    }

    const vendedor = nomeExibicao();

    const dados = {
      tipo,
      comprador,
      item,
      quantidade: Number(quantidade),
      valor: Number(valor),
      vendedor,
    };

    await addDoc(collection(db, "vendas"), {
      ...dados,
      criadoEm: Timestamp.now(),
    });

    await enviarLogVenda({
      tipoVenda: tipo,
      comprador,
      item,
      quantidade: Number(quantidade),
      valor: Number(valor),
      vendedor,
    });

    setTipo("Família");
    setComprador("");
    setItem("");
    setQuantidade("");
    setValor("");

    await carregarVendas();

    alert("Venda registrada!");
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

      if (
        membro.status === "aprovado" &&
        (cargo === "Líder" ||
          cargo === "Vice-Líder" ||
          cargo.includes("Gerente"))
      ) {
        setTemPermissao(true);
        await carregarVendas();
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  const vendaSemana = vendas
    .filter((venda) => {
      const data = venda.criadoEm?.toDate?.();
      return data && data >= inicioDaSemana();
    })
    .reduce((total, venda) => total + venda.valor, 0);

  const vendaMes = vendas
    .filter((venda) => {
      const data = venda.criadoEm?.toDate?.();
      return data && data >= inicioDoMes();
    })
    .reduce((total, venda) => total + venda.valor, 0);

  const totalFamilia = vendas
    .filter((venda) => venda.tipo === "Família")
    .reduce((total, venda) => total + venda.valor, 0);

  const totalMembro = vendas
    .filter((venda) => venda.tipo === "Membro")
    .reduce((total, venda) => total + venda.valor, 0);

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-black text-red-600">Carregando...</h1>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
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
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <h1 className="text-5xl font-black text-red-600">❌ ACESSO NEGADO</h1>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">💰 VENDAS</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Vendas da Semana</p>
          <h2 className="text-3xl font-black text-red-500">
            {formatarDinheiro(vendaSemana)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Vendas do Mês</p>
          <h2 className="text-3xl font-black text-red-500">
            {formatarDinheiro(vendaMes)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Família</p>
          <h2 className="text-3xl font-black text-yellow-400">
            {formatarDinheiro(totalFamilia)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p>Membro</p>
          <h2 className="text-3xl font-black text-green-400">
            {formatarDinheiro(totalMembro)}
          </h2>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Registrar Venda</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "Família" | "Membro")}
            className="rounded bg-black p-4"
          >
            <option value="Família">Família</option>
            <option value="Membro">Membro</option>
          </select>

          <input
            placeholder={
              tipo === "Família" ? "Nome da família" : "Nome do membro"
            }
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="Item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="Quantidade"
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="rounded bg-black p-4"
          />

          <input
            placeholder="Valor"
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="rounded bg-black p-4"
          />
        </div>

        <button
          onClick={salvarVenda}
          className="mt-5 rounded bg-red-700 px-6 py-3 font-bold"
        >
          Salvar Venda
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">Histórico de Vendas</h2>

        <div className="grid gap-4">
          {vendas.map((venda) => (
            <div
              key={venda.id}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-2xl font-bold">💰 {venda.item}</h3>

              <p>
                Tipo:{" "}
                <span className="font-bold text-red-400">
                  {venda.tipo || "Sem tipo"}
                </span>
              </p>

              <p>
                Comprador:{" "}
                <span className="font-bold text-yellow-400">
                  {venda.comprador || "Não informado"}
                </span>
              </p>

              <p>Quantidade: {venda.quantidade}</p>
              <p>Vendedor: {venda.vendedor}</p>
              <p>Data: {formatarData(venda.criadoEm)}</p>

              <p className="mt-2 text-2xl font-black text-red-500">
                {formatarDinheiro(venda.valor)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}