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
import jsPDF from "jspdf";

type Membro = {
  cargo: string;
  status: string;
};

type Producao = {
  id: string;
  item: string;
  quantidade: number;
  responsavel: string;
  print?: string;
  criadoEm: any;
};

export default function ProducaoPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);

  const [item, setItem] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [print, setPrint] = useState("");
  const [producoes, setProducoes] = useState<Producao[]>([]);

  function formatarData(data: any) {
    if (!data?.toDate) return "Sem data";
    return data.toDate().toLocaleString("pt-BR");
  }

  function formatarDataSimples(data: Date) {
    return data.toLocaleDateString("pt-BR");
  }

  function formatarNumero(valor: number) {
    return valor.toLocaleString("pt-BR");
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

  function fimDaSemana() {
    const inicio = inicioDaSemana();
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    fim.setHours(23, 59, 59, 999);

    return fim;
  }

  function inicioDoMes() {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  }

  async function carregarProducoes() {
    const snapshot = await getDocs(collection(db, "producoes"));

    const lista = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Producao, "id">),
    })) as Producao[];

    lista.sort((a, b) => {
      const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
      const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
      return dataB - dataA;
    });

    setProducoes(lista);
  }

  async function salvarProducao() {
    if (!session?.user) return;

    if (!item || !quantidade || !print) {
      alert("Preencha item, quantidade e o link do print.");
      return;
    }

    await addDoc(collection(db, "producoes"), {
      item,
      quantidade: Number(quantidade),
      responsavel: session.user.name || "Sem nome",
      print,
      criadoEm: Timestamp.now(),
    });

    setItem("");
    setQuantidade("");
    setPrint("");

    await carregarProducoes();
    alert("Produção registrada!");
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

      if (
  status === "aprovado" &&
  (cargo === "Líder" ||
    cargo === "Vice-Líder" ||
    cargo.includes("Gerente"))
) {
        setTemPermissao(true);
        await carregarProducoes();
      } else {
        setTemPermissao(false);
      }

      setCarregando(false);
    }

    verificarPermissao();
  }, [session]);

  const totalProduzido = producoes.reduce(
    (total, producao) => total + (producao.quantidade || 0),
    0
  );

  const producoesSemana = producoes.filter((producao) => {
    const data = producao.criadoEm?.toDate?.();
    return data && data >= inicioDaSemana() && data <= fimDaSemana();
  });

  const producaoSemana = producoesSemana.reduce(
    (total, producao) => total + (producao.quantidade || 0),
    0
  );

  const producaoMes = producoes
    .filter((producao) => {
      const data = producao.criadoEm?.toDate?.();
      return data && data >= inicioDoMes();
    })
    .reduce((total, producao) => total + (producao.quantidade || 0), 0);

  const textoRelatorio = `
RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA

Semana: ${formatarDataSimples(inicioDaSemana())} até ${formatarDataSimples(fimDaSemana())}

PRODUÇÃO DA SEMANA
Total produzido: ${formatarNumero(producaoSemana)}
Registros: ${producoesSemana.length}

HISTÓRICO DA SEMANA
${
  producoesSemana.length
    ? producoesSemana
        .map(
          (p) =>
            `- ${p.item} | ${formatarNumero(p.quantidade)} | ${p.responsavel} | ${formatarData(p.criadoEm)} | Print: ${p.print || "Sem print"}`
        )
        .join("\n")
    : "Nenhuma produção registrada nessa semana."
}
`.trim();

  function gerarPDFSemanal() {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text("RELATÓRIO SEMANAL DE PRODUÇÃO", 10, 15);

    pdf.setFontSize(11);

    const linhas = pdf.splitTextToSize(textoRelatorio, 180);

    let y = 30;

    linhas.forEach((linha: string) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(linha, 10, y);
      y += 7;
    });

    pdf.save("relatorio-semanal-producao-inglaterra.pdf");
  }

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
          <h1 className="text-4xl font-black text-red-600">Produção</h1>

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
      <h1 className="text-5xl font-black text-red-600">🏭 PRODUÇÃO</h1>

      <div className="mt-8 grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Produção da semana</p>
          <h2 className="mt-2 text-3xl font-black text-red-500">
            {formatarNumero(producaoSemana)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Produção do mês</p>
          <h2 className="mt-2 text-3xl font-black text-red-500">
            {formatarNumero(producaoMes)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Total produzido</p>
          <h2 className="mt-2 text-3xl font-black">
            {formatarNumero(totalProduzido)}
          </h2>
        </div>

        <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
          <p className="text-zinc-400">Registros</p>
          <h2 className="mt-2 text-3xl font-black">{producoes.length}</h2>
        </div>
      </div>

      <button
        onClick={gerarPDFSemanal}
        className="mt-6 rounded bg-green-700 px-6 py-3 font-bold hover:bg-green-600"
      >
        📄 Gerar Relatório Semanal PDF
      </button>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Registrar Produção</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Item produzido"
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
            value={print}
            onChange={(e) => setPrint(e.target.value)}
            placeholder="Link do print obrigatório"
            className="rounded bg-black p-4 text-white"
          />
        </div>

        <button
          onClick={salvarProducao}
          className="mt-5 rounded bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
        >
          Salvar Produção
        </button>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="mb-5 text-3xl font-bold">Histórico de Produção</h2>

        {producoes.length === 0 ? (
          <p className="text-zinc-400">Nenhuma produção registrada ainda.</p>
        ) : (
          <div className="grid gap-4">
            {producoes.map((producao) => (
              <div
                key={producao.id}
                className="rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold">🏭 {producao.item}</h3>

                    <p className="mt-2 text-zinc-400">
                      Responsável: {producao.responsavel}
                    </p>

                    <p className="text-zinc-400">
                      Data: {formatarData(producao.criadoEm)}
                    </p>

                    {producao.print && (
                      <img
                        src={producao.print}
                        alt="Print da produção"
                        className="mt-3 h-40 rounded border border-zinc-700"
                      />
                    )}
                  </div>

                  <p className="text-2xl font-black text-red-500">
                    {formatarNumero(producao.quantidade)}
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