"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  cargo: string;
  status: string;
};

type Compra = {
  id: string;
  item: string;
  quantidade: number;
  valor: number;
  comprador: string;
  criadoEm: any;
};

type MovimentoCaixa = {
  id: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao?: string;
  responsavel: string;
  criadoEm: any;
};

export default function ComprasPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [membroLogado, setMembroLogado] = useState<Membro | null>(null);

  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");
  const [compras, setCompras] = useState<Compra[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [saldoAdicionar, setSaldoAdicionar] = useState("");
  const [saldoRetirar, setSaldoRetirar] = useState("");
  const [historicoCaixa, setHistoricoCaixa] = useState<MovimentoCaixa[]>([]);

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

  async function enviarLogCompra(dados: {
    item: string;
    quantidade: number;
    valor: number;
    comprador: string;
  }) {
    try {
      await fetch("/api/discord/log-compras", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });
    } catch (error) {
      console.error("Erro ao enviar log de compra:", error);
    }
  }

  async function carregarCompras() {
    const snapshot = await getDocs(collection(db, "compras"));

    const lista = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...(documento.data() as Omit<Compra, "id">),
    })) as Compra[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setCompras(lista);
  }

  async function carregarCaixa() {
    const snapshot = await getDocs(collection(db, "caixa"));

    const lista = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...(documento.data() as Omit<MovimentoCaixa, "id">),
    })) as MovimentoCaixa[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setHistoricoCaixa(lista);
  }

  function limparFormulario() {
    setItem("");
    setQuantidade("");
    setValor("");
    setEditandoId(null);
  }

  async function adicionarSaldo() {
    if (!session?.user) return;

    if (!saldoAdicionar) {
      alert("Digite o valor para adicionar.");
      return;
    }

    await addDoc(collection(db, "caixa"), {
      tipo: "entrada",
      valor: Number(saldoAdicionar),
      descricao: "Saldo adicionado",
      responsavel: nomeExibicao(),
      criadoEm: Timestamp.now(),
    });

    setSaldoAdicionar("");
    await carregarCaixa();

    alert("Saldo adicionado!");
  }

  async function retirarSaldo() {
    if (!session?.user) return;

    if (!saldoRetirar) {
      alert("Digite o valor para retirar.");
      return;
    }

    await addDoc(collection(db, "caixa"), {
      tipo: "saida",
      valor: Number(saldoRetirar),
      descricao: "Saldo retirado manualmente",
      responsavel: nomeExibicao(),
      criadoEm: Timestamp.now(),
    });

    setSaldoRetirar("");
    await carregarCaixa();

    alert("Saldo retirado!");
  }

  async function salvarCompra() {
    if (!session?.user) return;

    if (!item || !quantidade || !valor) {
      alert("Preencha item, quantidade e valor.");
      return;
    }

    const comprador = nomeExibicao();
    const novoValor = Number(valor);

    const dados = {
      item,
      quantidade: Number(quantidade),
      valor: novoValor,
      comprador,
    };

    if (editandoId) {
      const compraAntiga = compras.find((compra) => compra.id === editandoId);

      if (!compraAntiga) {
        alert("Compra não encontrada.");
        return;
      }

      const diferenca = novoValor - compraAntiga.valor;

      await updateDoc(doc(db, "compras", editandoId), dados);

      if (diferenca > 0) {
        await addDoc(collection(db, "caixa"), {
          tipo: "saida",
          valor: diferenca,
          descricao: `Ajuste compra: ${item}`,
          responsavel: comprador,
          criadoEm: Timestamp.now(),
        });
      }

      if (diferenca < 0) {
        await addDoc(collection(db, "caixa"), {
          tipo: "entrada",
          valor: Math.abs(diferenca),
          descricao: `Estorno ajuste compra: ${item}`,
          responsavel: comprador,
          criadoEm: Timestamp.now(),
        });
      }

      limparFormulario();
      await carregarCompras();
      await carregarCaixa();

      alert("Compra atualizada e caixa ajustado!");
      return;
    }

    await addDoc(collection(db, "compras"), {
      ...dados,
      criadoEm: Timestamp.now(),
    });

    await addDoc(collection(db, "caixa"), {
      tipo: "saida",
      valor: novoValor,
      descricao: `Compra: ${item}`,
      responsavel: comprador,
      criadoEm: Timestamp.now(),
    });

    await enviarLogCompra(dados);

    limparFormulario();

    await carregarCompras();
    await carregarCaixa();

    alert("Compra registrada e descontada do caixa!");
  }

  function editarCompra(compra: Compra) {
    setEditandoId(compra.id);
    setItem(compra.item);
    setQuantidade(String(compra.quantidade));
    setValor(String(compra.valor));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirCompra(compra: Compra) {
    if (!session?.user) return;

    const confirmar = confirm(
      "Tem certeza que deseja excluir esta compra? O valor será devolvido ao caixa."
    );

    if (!confirmar) return;

    await deleteDoc(doc(db, "compras", compra.id));

    await addDoc(collection(db, "caixa"), {
      tipo: "entrada",
      valor: compra.valor,
      descricao: `Estorno da compra: ${compra.item}`,
      responsavel: nomeExibicao(),
      criadoEm: Timestamp.now(),
    });

    await carregarCompras();
    await carregarCaixa();

    alert("Compra excluída e valor devolvido ao caixa!");
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
        await carregarCompras();
        await carregarCaixa();
      } else {
        setTemPermissao(false);
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  const totalGasto = compras.reduce(
    (total, compra) => total + (compra.valor || 0),
    0
  );

  const gastoSemana = compras
    .filter((compra) => {
      const data = compra.criadoEm?.toDate?.();
      return data && data >= inicioDaSemana();
    })
    .reduce((total, compra) => total + (compra.valor || 0), 0);

  const gastoMes = compras
    .filter((compra) => {
      const data = compra.criadoEm?.toDate?.();
      return data && data >= inicioDoMes();
    })
    .reduce((total, compra) => total + (compra.valor || 0), 0);

  const totalEntradasCaixa = historicoCaixa
    .filter((mov) => mov.tipo === "entrada")
    .reduce((total, mov) => total + (mov.valor || 0), 0);

  const totalSaidasCaixa = historicoCaixa
    .filter((mov) => mov.tipo === "saida")
    .reduce((total, mov) => total + (mov.valor || 0), 0);

  const saldoCaixa = totalEntradasCaixa - totalSaidasCaixa;

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
          <h1 className="text-4xl font-black text-red-600">Compras</h1>

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
            Apenas Líder, Vice-Líder ou Gerentes podem acessar esta área.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">🛒 COMPRAS</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Gasto da semana</p>
          <h2 className="mt-2 text-3xl font-black text-red-500">
            {formatarDinheiro(gastoSemana)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Gasto do mês</p>
          <h2 className="mt-2 text-3xl font-black text-red-500">
            {formatarDinheiro(gastoMes)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Total geral</p>
          <h2 className="mt-2 text-3xl font-black">
            {formatarDinheiro(totalGasto)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Compras registradas</p>
          <h2 className="mt-2 text-3xl font-black">{compras.length}</h2>
        </div>
      </div>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">💰 Caixa da Facção</h2>

        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-800 bg-black p-5">
            <p className="text-zinc-400">Saldo atual</p>
            <h3 className="mt-2 text-3xl font-black text-green-400">
              {formatarDinheiro(saldoCaixa)}
            </h3>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black p-5">
            <p className="text-zinc-400">Saldo Disponível</p>

            <h3 className="mt-2 text-3xl font-black">
              {formatarDinheiro(saldoCaixa)}
            </h3>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-black p-5">
            <p className="text-zinc-400">Total de saídas</p>
            <h3 className="mt-2 text-3xl font-black text-red-500">
              {formatarDinheiro(totalSaidasCaixa)}
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 md:flex-row">
            <input
              value={saldoAdicionar}
              onChange={(e) => setSaldoAdicionar(e.target.value)}
              placeholder="Valor para adicionar ao caixa"
              type="number"
              className="rounded bg-black p-4 text-white md:w-80"
            />

            <button
              onClick={adicionarSaldo}
              className="rounded bg-green-700 px-6 py-3 font-bold hover:bg-green-600"
            >
              ➕ Adicionar Saldo
            </button>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <input
              value={saldoRetirar}
              onChange={(e) => setSaldoRetirar(e.target.value)}
              placeholder="Valor para retirar do caixa"
              type="number"
              className="rounded bg-black p-4 text-white md:w-80"
            />

            <button
              onClick={retirarSaldo}
              className="rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
            >
              ➖ Retirar Saldo
            </button>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">
          {editandoId ? "Editar Compra" : "Registrar Compra"}
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item comprado"
            className="rounded bg-black p-4 text-white"
          />

          <input
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            placeholder="Quantidade"
            type="number"
            className="rounded bg-black p-4 text-white"
          />

          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor total"
            type="number"
            className="rounded bg-black p-4 text-white"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={salvarCompra}
            className="rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
          >
            {editandoId ? "Salvar Alteração" : "Salvar Compra"}
          </button>

          {editandoId && (
            <button
              onClick={limparFormulario}
              className="rounded bg-zinc-700 px-6 py-3 font-bold hover:bg-zinc-600"
            >
              Cancelar Edição
            </button>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">Histórico de Compras</h2>

        {compras.length === 0 ? (
          <p className="text-zinc-400">Nenhuma compra registrada ainda.</p>
        ) : (
          <div className="grid gap-4">
            {compras.map((compra) => (
              <div
                key={compra.id}
                className="rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">🛒 {compra.item}</h3>

                    <p className="mt-2 text-zinc-400">
                      Quantidade: {compra.quantidade}
                    </p>

                    <p className="text-zinc-400">
                      Comprador: {compra.comprador}
                    </p>

                    <p className="text-zinc-400">
                      Data: {formatarData(compra.criadoEm)}
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => editarCompra(compra)}
                        className="rounded bg-yellow-600 px-4 py-2 font-bold hover:bg-yellow-500"
                      >
                        ✏️ Editar
                      </button>

                      <button
                        onClick={() => excluirCompra(compra)}
                        className="rounded bg-red-700 px-4 py-2 font-bold hover:bg-red-600"
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>

                  <p className="text-2xl font-black text-red-500">
                    {formatarDinheiro(compra.valor)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}