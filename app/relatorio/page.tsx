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

type Venda = {
  item: string;
  quantidade: number;
  valor: number;
  vendedor: string;
  tipo?: string;
  criadoEm: any;
};

type Compra = {
  item: string;
  quantidade: number;
  valor: number;
  comprador: string;
  criadoEm: any;
};

type Producao = {
  item: string;
  quantidade: number;
  responsavel: string;
  criadoEm: any;
};

type Reembolso = {
  nome: string;
  item: string;
  quantidade: number;
  valor: number;
  status: string;
  solicitadoPor?: string;
  criadoEm: any;
};

type Acao = {
  tipo?: string;
  valor: number;
  status?: string;
  responsavel?: string;
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

  const [vendasDetalhadas, setVendasDetalhadas] = useState<Venda[]>([]);
  const [comprasDetalhadas, setComprasDetalhadas] = useState<Compra[]>([]);
  const [producoesSemana, setProducoesSemana] = useState<Producao[]>([]);
  const [reembolsosDetalhados, setReembolsosDetalhados] = useState<Reembolso[]>([]);
  const [acoesDetalhadas, setAcoesDetalhadas] = useState<Acao[]>([]);

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

  function formatarData(data: any) {
    const d = data?.toDate?.() || data;
    if (!d) return "Sem data";
    return d.toLocaleDateString("pt-BR");
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

  function somarPorPessoa<T extends { valor?: number }>(
    lista: T[],
    campoNome: keyof T
  ) {
    const resumo: Record<string, number> = {};

    lista.forEach((item) => {
      const nome = String(item[campoNome] || "Sem responsável");
      resumo[nome] = (resumo[nome] || 0) + Number(item.valor || 0);
    });

    return resumo;
  }

  function somarQuantidadePorPessoa<T extends { quantidade?: number }>(
    lista: T[],
    campoNome: keyof T
  ) {
    const resumo: Record<string, number> = {};

    lista.forEach((item) => {
      const nome = String(item[campoNome] || "Sem responsável");
      resumo[nome] =
        (resumo[nome] || 0) + Number(item.quantidade || 0);
    });

    return resumo;
  }

  async function carregarRelatorios() {
    const vendasSnap = await getDocs(collection(db, "vendas"));
    const acoesSnap = await getDocs(collection(db, "acoes"));
    const comprasSnap = await getDocs(collection(db, "compras"));
    const reembolsosSnap = await getDocs(collection(db, "reembolsos"));
    const producoesSnap = await getDocs(collection(db, "producoes"));

    const vendas = vendasSnap.docs
      .map((docItem) => docItem.data() as Venda)
      .filter((v) => dataOk(v.criadoEm));

    const acoes = acoesSnap.docs
      .map((docItem) => docItem.data() as Acao)
      .filter((a) => dataOk(a.criadoEm));

    const compras = comprasSnap.docs
      .map((docItem) => docItem.data() as Compra)
      .filter((c) => dataOk(c.criadoEm));

    const reembolsos = reembolsosSnap.docs
      .map((docItem) => docItem.data() as Reembolso)
      .filter((r) => dataOk(r.criadoEm));

    const producoes = producoesSnap.docs
      .map((docItem) => docItem.data() as Producao)
      .filter((p) => dataOk(p.criadoEm));

    setVendasDetalhadas(vendas);
    setAcoesDetalhadas(acoes);
    setComprasDetalhadas(compras);
    setReembolsosDetalhados(reembolsos);
    setProducoesSemana(producoes);

    setVendasSemana(
      vendas.reduce((total, v) => total + Number(v.valor || 0), 0)
    );

    setAcoesSemana(
      acoes.reduce((total, a) => total + Number(a.valor || 0), 0)
    );

    setComprasSemana(
      compras.reduce((total, c) => total + Number(c.valor || 0), 0)
    );

    setReembolsosSemana(
      reembolsos.reduce((total, r) => total + Number(r.valor || 0), 0)
    );
  }  async function gerarAdvertenciasAutomaticas() {
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
  );  const resumoProducaoPorItem: Record<string, number> = {};
  producoesSemana.forEach((p) => {
    const item = p.item || "Sem item";
    resumoProducaoPorItem[item] =
      (resumoProducaoPorItem[item] || 0) + Number(p.quantidade || 0);
  });

  const vendasPorPessoa = somarPorPessoa(vendasDetalhadas, "vendedor");
  const comprasPorPessoa = somarPorPessoa(comprasDetalhadas, "comprador");
  const producaoPorPessoa = somarQuantidadePorPessoa(
    producoesSemana,
    "responsavel"
  );
  const reembolsosPorPessoa = somarPorPessoa(reembolsosDetalhados, "nome");

  const textoVendas = `
RELATÓRIO SEMANAL DE VENDAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

RESUMO FINANCEIRO
Entradas com Vendas: ${formatarDinheiro(vendasSemana)}
Entradas com Ações: ${formatarDinheiro(acoesSemana)}
Total de Entradas: ${formatarDinheiro(entradas)}

Saídas com Compras: ${formatarDinheiro(comprasSemana)}
Saídas com Reembolsos: ${formatarDinheiro(reembolsosSemana)}
Total de Saídas: ${formatarDinheiro(saidas)}

Resultado Final: ${formatarDinheiro(resultado)}

VENDAS DETALHADAS
${
  vendasDetalhadas.length
    ? vendasDetalhadas
        .map(
          (v) =>
            `Item: ${v.item || "Sem item"} | Quantidade: ${formatarNumero(
              Number(v.quantidade || 0)
            )} | Valor: ${formatarDinheiro(
              Number(v.valor || 0)
            )} | Vendedor: ${v.vendedor || "Sem vendedor"} | Tipo: ${
              v.tipo || "Não informado"
            } | Data: ${formatarData(v.criadoEm)}`
        )
        .join("\n")
    : "Nenhuma venda registrada nessa semana."
}

AÇÕES DETALHADAS
${
  acoesDetalhadas.length
    ? acoesDetalhadas
        .map(
          (a) =>
            `Ação: ${a.tipo || "Sem tipo"} | Valor: ${formatarDinheiro(
              Number(a.valor || 0)
            )} | Status: ${a.status || "Não informado"} | Data: ${formatarData(
              a.criadoEm
            )}`
        )
        .join("\n")
    : "Nenhuma ação registrada nessa semana."
}

RESUMO INDIVIDUAL DE VENDAS
${
  Object.keys(vendasPorPessoa).length
    ? Object.entries(vendasPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(total)}`)
        .join("\n")
    : "Nenhum vendedor com registro nessa semana."
}
`.trim();

  const textoProducao = `
RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

RESUMO
Total Produzido: ${formatarNumero(totalProducao)}
Registros: ${producoesSemana.length}

PRODUÇÃO DETALHADA
${
  producoesSemana.length
    ? producoesSemana
        .map(
          (p) =>
            `Item: ${p.item || "Sem item"} | Quantidade: ${formatarNumero(
              Number(p.quantidade || 0)
            )} | Responsável: ${
              p.responsavel || "Sem responsável"
            } | Data: ${formatarData(p.criadoEm)}`
        )
        .join("\n")
    : "Nenhuma produção registrada nessa semana."
}

PRODUÇÃO POR ITEM
${
  Object.keys(resumoProducaoPorItem).length
    ? Object.entries(resumoProducaoPorItem)
        .map(([item, total]) => `${item}: ${formatarNumero(total)}`)
        .join("\n")
    : "Nenhuma produção por item nessa semana."
}

RESUMO INDIVIDUAL DE PRODUÇÃO
${
  Object.keys(producaoPorPessoa).length
    ? Object.entries(producaoPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarNumero(total)}`)
        .join("\n")
    : "Nenhum responsável com produção nessa semana."
}
`.trim();

  const textoCompras = `
RELATÓRIO SEMANAL DE COMPRAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

RESUMO
Total em Compras: ${formatarDinheiro(comprasSemana)}
Total em Reembolsos: ${formatarDinheiro(reembolsosSemana)}
Total Gasto: ${formatarDinheiro(saidas)}

COMPRAS DETALHADAS
${
  comprasDetalhadas.length
    ? comprasDetalhadas
        .map(
          (c) =>
            `Item: ${c.item || "Sem item"} | Quantidade: ${formatarNumero(
              Number(c.quantidade || 0)
            )} | Valor: ${formatarDinheiro(
              Number(c.valor || 0)
            )} | Comprador: ${c.comprador || "Sem comprador"} | Data: ${formatarData(
              c.criadoEm
            )}`
        )
        .join("\n")
    : "Nenhuma compra registrada nessa semana."
}

REEMBOLSOS DETALHADOS
${
  reembolsosDetalhados.length
    ? reembolsosDetalhados
        .map(
          (r) =>
            `Nome: ${r.nome || "Sem nome"} | Item: ${
              r.item || "Sem item"
            } | Quantidade: ${formatarNumero(
              Number(r.quantidade || 0)
            )} | Valor: ${formatarDinheiro(
              Number(r.valor || 0)
            )} | Status: ${r.status || "Não informado"} | Data: ${formatarData(
              r.criadoEm
            )}`
        )
        .join("\n")
    : "Nenhum reembolso registrado nessa semana."
}

RESUMO INDIVIDUAL DE COMPRAS
${
  Object.keys(comprasPorPessoa).length
    ? Object.entries(comprasPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(total)}`)
        .join("\n")
    : "Nenhum comprador com registro nessa semana."
}

RESUMO INDIVIDUAL DE REEMBOLSOS
${
  Object.keys(reembolsosPorPessoa).length
    ? Object.entries(reembolsosPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(total)}`)
        .join("\n")
    : "Nenhum reembolso individual nessa semana."
}
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
  }  if (carregando) {
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
            className="mt-6 h-96 w-full rounded bg-black p-4 text-white"
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
            className="mt-6 h-96 w-full rounded bg-black p-4 text-white"
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
            className="mt-6 h-96 w-full rounded bg-black p-4 text-white"
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