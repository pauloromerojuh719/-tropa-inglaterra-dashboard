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
  nome?: string;
  nomeRP?: string;
  email?: string;
  cargo: string;
  status: string;
};

type Producao = {
  item: string;
  quantidade: number;
  responsavel: string;
  criadoEm: any;
};

type Farm = {
  membroId?: string;
  membroNome?: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
  criadoEm: any;
};

type Aba = "vendas" | "producao" | "compras";

export default function RelatorioPage() {
  const { data: session } = useSession();

  const [aba, setAba] = useState<Aba>("vendas");
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [gerandoAdv, setGerandoAdv] = useState(false);

  const [vendasSemana, setVendasSemana] = useState(0);
  const [acoesSemana, setAcoesSemana] = useState(0);
  const [comprasSemana, setComprasSemana] = useState(0);
  const [reembolsosSemana, setReembolsosSemana] = useState(0);
  const [producoesSemana, setProducoesSemana] = useState<Producao[]>([]);

  const META_FOLHAS = 2000;
  const META_OPIOS = 2000;
  const META_SERINGAS = 800;
  const META_AGULHAS = 800;

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

  function dataOk(data: any) {
    const d = data?.toDate?.();
    return d && d >= inicioDaSemana() && d <= fimDaSemana();
  }

  function formatarData(data: Date) {
    return data.toLocaleDateString("pt-BR");
  }

  function formatarNumero(valor: number) {
    return valor.toLocaleString("pt-BR");
  }

  function formatarDinheiro(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  async function carregarRelatorios() {
    const vendasSnap = await getDocs(collection(db, "vendas"));
    const acoesSnap = await getDocs(collection(db, "acoes"));
    const comprasSnap = await getDocs(collection(db, "compras"));
    const reembolsosSnap = await getDocs(collection(db, "reembolsos"));
    const producoesSnap = await getDocs(collection(db, "producoes"));

    setVendasSemana(
      vendasSnap.docs.reduce((total, item) => {
        const v = item.data() as any;
        return dataOk(v.criadoEm) ? total + Number(v.valor || 0) : total;
      }, 0)
    );

    setAcoesSemana(
      acoesSnap.docs.reduce((total, item) => {
        const a = item.data() as any;
        return dataOk(a.criadoEm) ? total + Number(a.valor || 0) : total;
      }, 0)
    );

    setComprasSemana(
      comprasSnap.docs.reduce((total, item) => {
        const c = item.data() as any;
        return dataOk(c.criadoEm) ? total + Number(c.valor || 0) : total;
      }, 0)
    );

    setReembolsosSemana(
      reembolsosSnap.docs.reduce((total, item) => {
        const r = item.data() as any;
        return dataOk(r.criadoEm) ? total + Number(r.valor || 0) : total;
      }, 0)
    );

    const listaProducoes = producoesSnap.docs
      .map((docItem) => docItem.data() as Producao)
      .filter((p) => dataOk(p.criadoEm));

    setProducoesSemana(listaProducoes);
  }

  async function gerarAdvertenciasAutomaticas() {
    const confirmar = confirm(
      "Deseja gerar advertências automáticas para quem não bateu a meta da semana?"
    );

    if (!confirmar) return;

    setGerandoAdv(true);

    try {
      const membrosSnap = await getDocs(collection(db, "membros"));
      const farmSnap = await getDocs(collection(db, "farm"));
      const advSnap = await getDocs(collection(db, "advertencias"));

      const inicio = inicioDaSemana();
      const fim = fimDaSemana();

      const semanaInicio = inicio.toISOString();
      const semanaFim = fim.toISOString();

      let criadas = 0;

      for (const membroDoc of membrosSnap.docs) {
        const membro = membroDoc.data() as Membro;
        const membroId = membroDoc.id;
        const cargo = membro.cargo || "";

        const isento =
          cargo === "Elite" ||
          cargo === "Gerente de Ações" ||
          cargo === "Líder" ||
          cargo === "Vice-Líder";

        if (membro.status !== "aprovado" || isento) continue;

        const farmsDoMembro = farmSnap.docs
          .map((f) => f.data() as Farm)
          .filter(
            (f) =>
              f.membroId === membroId &&
              f.status === "aprovado" &&
              dataOk(f.criadoEm)
          );

        const totalFolhas = farmsDoMembro.reduce(
          (t, f) => t + Number(f.folhas || 0),
          0
        );
        const totalOpios = farmsDoMembro.reduce(
          (t, f) => t + Number(f.opios || 0),
          0
        );
        const totalSeringas = farmsDoMembro.reduce(
          (t, f) => t + Number(f.seringas || 0),
          0
        );
        const totalAgulhas = farmsDoMembro.reduce(
          (t, f) => t + Number(f.agulhas || 0),
          0
        );

        const bateuMeta =
          totalFolhas >= META_FOLHAS &&
          totalOpios >= META_OPIOS &&
          totalSeringas >= META_SERINGAS &&
          totalAgulhas >= META_AGULHAS;

        if (bateuMeta) continue;

        const jaExiste = advSnap.docs.some((adv) => {
          const a = adv.data() as any;
          return (
            a.membroId === membroId &&
            a.semanaInicio === semanaInicio &&
            a.tipo === "automatica"
          );
        });

        if (jaExiste) continue;

        await addDoc(collection(db, "advertencias"), {
          membroId,
          membroNome: membro.nomeRP || membro.nome || "Sem nome",
          cargo,
          motivo: "Não bateu a meta semanal",
          tipo: "automatica",
          semanaInicio,
          semanaFim,
          folhas: totalFolhas,
          opios: totalOpios,
          seringas: totalSeringas,
          agulhas: totalAgulhas,
          criadoEm: Timestamp.now(),
        });

        criadas++;
      }

      alert(`Advertências geradas: ${criadas}`);
    } catch (error) {
      console.log(error);
      alert("Erro ao gerar advertências.");
    }

    setGerandoAdv(false);
  }

  useEffect(() => {
    async function verificar() {
      if (!session?.user) {
        setCarregando(false);
        return;
      }

      const discordId = (session.user as any).id;
      const snap = await getDoc(doc(db, "membros", discordId));

      if (!snap.exists()) {
        setCarregando(false);
        return;
      }

      const membro = snap.data() as Membro;
      const cargo = membro.cargo?.trim() || "";

      if (
        membro.status === "aprovado" &&
        (cargo === "Líder" ||
          cargo === "Vice-Líder" ||
          cargo.includes("Gerente"))
      ) {
        setTemPermissao(true);
        await carregarRelatorios();
      }

      setCarregando(false);
    }

    verificar();
  }, [session]);

  const inicioSemana = inicioDaSemana();
  const fimSemana = fimDaSemana();

  const entradas = vendasSemana + acoesSemana;
  const saidas = comprasSemana + reembolsosSemana;
  const resultado = entradas - saidas;

  const totalProducao = producoesSemana.reduce(
    (total, p) => total + Number(p.quantidade || 0),
    0
  );

  const resumoPorItem: Record<string, number> = {};

  producoesSemana.forEach((p) => {
    const item = p.item || "Sem item";
    resumoPorItem[item] = (resumoPorItem[item] || 0) + Number(p.quantidade || 0);
  });

  const textoVendas = `
RELATÓRIO SEMANAL DE VENDAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

ENTRADAS
Vendas: ${formatarDinheiro(vendasSemana)}
Ações: ${formatarDinheiro(acoesSemana)}
Total Entrada: ${formatarDinheiro(entradas)}

SAÍDAS
Compras: ${formatarDinheiro(comprasSemana)}
Reembolsos: ${formatarDinheiro(reembolsosSemana)}
Total Saída: ${formatarDinheiro(saidas)}

RESULTADO FINAL
${formatarDinheiro(resultado)}
`.trim();

  const textoProducao = `
RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

PRODUÇÃO TOTAL
Total produzido: ${formatarNumero(totalProducao)}
Registros: ${producoesSemana.length}

PRODUÇÃO POR ITEM
${
  Object.keys(resumoPorItem).length
    ? Object.entries(resumoPorItem)
        .map(([item, total]) => `${item}: ${formatarNumero(total)}`)
        .join("\n")
    : "Nenhuma produção registrada nessa semana."
}
`.trim();

  const textoCompras = `
RELATÓRIO SEMANAL DE COMPRAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

COMPRAS
Compras: ${formatarDinheiro(comprasSemana)}
Reembolsos: ${formatarDinheiro(reembolsosSemana)}

TOTAL GASTO
${formatarDinheiro(saidas)}
`.trim();

  function gerarPDF(titulo: string, texto: string, nomeArquivo: string) {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text(titulo, 10, 15);

    pdf.setFontSize(11);

    const linhas = pdf.splitTextToSize(texto, 180);
    let y = 30;

    linhas.forEach((linha: string) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(linha, 10, y);
      y += 7;
    });

    pdf.save(nomeArquivo);
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-black p-10 text-white">Carregando...</main>
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
        ❌ Acesso negado
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">📊 RELATÓRIOS</h1>

      <p className="mt-3 text-zinc-400">
        Semana: {formatarData(inicioSemana)} até {formatarData(fimSemana)}
      </p>

      <button
        onClick={gerarAdvertenciasAutomaticas}
        disabled={gerandoAdv}
        className="mt-6 rounded bg-yellow-600 px-6 py-3 font-bold text-black disabled:opacity-50"
      >
        {gerandoAdv
          ? "Gerando advertências..."
          : "⚠️ Gerar Advertências Automáticas"}
      </button>

      <div className="mt-8 flex flex-wrap gap-3">
        <BotaoAba ativo={aba === "vendas"} onClick={() => setAba("vendas")}>
          💰 Vendas
        </BotaoAba>

        <BotaoAba ativo={aba === "producao"} onClick={() => setAba("producao")}>
          🏭 Produção
        </BotaoAba>

        <BotaoAba ativo={aba === "compras"} onClick={() => setAba("compras")}>
          🛒 Compras
        </BotaoAba>
      </div>

      {aba === "vendas" && (
        <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
          <h2 className="text-3xl font-bold">💰 Relatório de Vendas</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card titulo="Entradas" valor={formatarDinheiro(entradas)} />
            <Card titulo="Saídas" valor={formatarDinheiro(saidas)} />
            <Card titulo="Resultado" valor={formatarDinheiro(resultado)} />
          </div>

          <textarea
            value={textoVendas}
            readOnly
            className="mt-6 h-80 w-full rounded bg-black p-4 text-white"
          />

          <button
            onClick={() =>
              gerarPDF(
                "RELATÓRIO SEMANAL DE VENDAS",
                textoVendas,
                "relatorio-vendas-inglaterra.pdf"
              )
            }
            className="mt-5 rounded bg-green-700 px-6 py-3 font-bold"
          >
            📄 Gerar PDF de Vendas
          </button>
        </section>
      )}

      {aba === "producao" && (
        <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
          <h2 className="text-3xl font-bold">🏭 Relatório de Produção</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card titulo="Produção da Semana" valor={formatarNumero(totalProducao)} />
            <Card titulo="Registros" valor={String(producoesSemana.length)} />
          </div>

          <textarea
            value={textoProducao}
            readOnly
            className="mt-6 h-80 w-full rounded bg-black p-4 text-white"
          />

          <button
            onClick={() =>
              gerarPDF(
                "RELATÓRIO SEMANAL DE PRODUÇÃO",
                textoProducao,
                "relatorio-producao-inglaterra.pdf"
              )
            }
            className="mt-5 rounded bg-green-700 px-6 py-3 font-bold"
          >
            📄 Gerar PDF de Produção
          </button>
        </section>
      )}

      {aba === "compras" && (
        <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
          <h2 className="text-3xl font-bold">🛒 Relatório de Compras</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Card titulo="Compras" valor={formatarDinheiro(comprasSemana)} />
            <Card titulo="Reembolsos" valor={formatarDinheiro(reembolsosSemana)} />
            <Card titulo="Total Gasto" valor={formatarDinheiro(saidas)} />
          </div>

          <textarea
            value={textoCompras}
            readOnly
            className="mt-6 h-80 w-full rounded bg-black p-4 text-white"
          />

          <button
            onClick={() =>
              gerarPDF(
                "RELATÓRIO SEMANAL DE COMPRAS",
                textoCompras,
                "relatorio-compras-inglaterra.pdf"
              )
            }
            className="mt-5 rounded bg-green-700 px-6 py-3 font-bold"
          >
            📄 Gerar PDF de Compras
          </button>
        </section>
      )}
    </main>
  );
}

function BotaoAba({
  children,
  ativo,
  onClick,
}: {
  children: React.ReactNode;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-6 py-3 font-bold ${
        ativo ? "bg-red-700 text-white" : "bg-zinc-900 text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-red-900 bg-black p-6">
      <p className="text-zinc-400">{titulo}</p>
      <h2 className="mt-2 text-3xl font-black text-red-500">{valor}</h2>
    </div>
  );
}