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

type Aba = "vendas" | "producao" | "compras" | "reembolsos" | "acoes";

export default function RelatorioPage() {
  const { data: session } = useSession();

  const [aba, setAba] = useState<Aba>("vendas");
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [gerandoAdv, setGerandoAdv] = useState(false);

  const [vendasDetalhadas, setVendasDetalhadas] = useState<Venda[]>([]);
  const [comprasDetalhadas, setComprasDetalhadas] = useState<Compra[]>([]);
  const [producoesDetalhadas, setProducoesDetalhadas] = useState<Producao[]>([]);
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
  }  function formatarData(data: any) {
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

  function somarDinheiroPorPessoa<T extends { valor?: number }>(
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
      resumo[nome] = (resumo[nome] || 0) + Number(item.quantidade || 0);
    });

    return resumo;
  }

  async function carregarRelatorios() {
    const vendasSnap = await getDocs(collection(db, "vendas"));
    const comprasSnap = await getDocs(collection(db, "compras"));
    const producoesSnap = await getDocs(collection(db, "producoes"));
    const reembolsosSnap = await getDocs(collection(db, "reembolsos"));
    const acoesSnap = await getDocs(collection(db, "acoes"));

    const vendas = vendasSnap.docs
      .map((docItem) => docItem.data() as Venda)
      .filter((v) => dataOk(v.criadoEm));

    const compras = comprasSnap.docs
      .map((docItem) => docItem.data() as Compra)
      .filter((c) => dataOk(c.criadoEm));

    const producoes = producoesSnap.docs
      .map((docItem) => docItem.data() as Producao)
      .filter((p) => dataOk(p.criadoEm));

    const reembolsos = reembolsosSnap.docs
      .map((docItem) => docItem.data() as Reembolso)
      .filter((r) => dataOk(r.criadoEm));

    const acoes = acoesSnap.docs
      .map((docItem) => docItem.data() as Acao)
      .filter((a) => dataOk(a.criadoEm));

    setVendasDetalhadas(vendas);
    setComprasDetalhadas(compras);
    setProducoesDetalhadas(producoes);
    setReembolsosDetalhados(reembolsos);
    setAcoesDetalhadas(acoes);
  }

  async function gerarAdvertenciasAutomaticas() {
    const confirmar = confirm(
      "Deseja gerar advertências automáticas para quem não bateu a meta da semana?"
    );

    if (!confirmar) return;

    setGerandoAdv(true);    try {
      const membrosSnap = await getDocs(collection(db, "membros"));
      const farmSnap = await getDocs(collection(db, "farm"));
      const advSnap = await getDocs(collection(db, "advertencias"));

      const semanaInicio = inicioDaSemana().toISOString();
      const semanaFim = fimDaSemana().toISOString();

      let criadas = 0;

      for (const membroDoc of membrosSnap.docs) {
        const membro = membroDoc.data() as Membro;
        const membroId = membroDoc.id;

        const isento =
          membro.cargo === "Elite" ||
          membro.cargo === "Gerente de Ações" ||
          membro.cargo === "Líder" ||
          membro.cargo === "Vice-Líder";

        if (membro.status !== "aprovado" || isento) continue;

        const farms = farmSnap.docs
          .map((f) => f.data() as Farm)
          .filter(
            (f) =>
              f.membroId === membroId &&
              f.status === "aprovado" &&
              dataOk(f.criadoEm)
          );

        const folhas = farms.reduce((t, f) => t + Number(f.folhas || 0), 0);
        const opios = farms.reduce((t, f) => t + Number(f.opios || 0), 0);
        const seringas = farms.reduce(
          (t, f) => t + Number(f.seringas || 0),
          0
        );
        const agulhas = farms.reduce(
          (t, f) => t + Number(f.agulhas || 0),
          0
        );

        const bateuMeta =
          folhas >= META_FOLHAS &&
          opios >= META_OPIOS &&
          seringas >= META_SERINGAS &&
          agulhas >= META_AGULHAS;

        if (bateuMeta) continue;

        const jaExiste = advSnap.docs.some((adv) => {
          const a = adv.data() as any;

          return (
            a.membroId === membroId &&
            a.semanaInicio === semanaInicio
          );
        });

        if (jaExiste) continue;

        await addDoc(collection(db, "advertencias"), {
          membroId,
          membroNome: membro.nomeRP || membro.nome || "Sem nome",
          cargo: membro.cargo,
          motivo: "Não bateu a meta semanal",
          tipo: "automatica",
          semanaInicio,
          semanaFim,
          folhas,
          opios,
          seringas,
          agulhas,
          criadoEm: Timestamp.now(),
        });

        criadas++;
      }

      alert(`Advertências geradas: ${criadas}`);
    } catch (error) {
      console.log(error);
      alert("Erro ao gerar advertências");
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

      if (
        membro.status === "aprovado" &&
        (
          membro.cargo === "Líder" ||
          membro.cargo === "Vice-Líder" ||
          membro.cargo.includes("Gerente")
        )
      ) {
        setTemPermissao(true);
        await carregarRelatorios();
      }

      setCarregando(false);
    }

    verificar();
  }, [session]);  const inicioSemana = inicioDaSemana();
  const fimSemana = fimDaSemana();

  const totalVendas = vendasDetalhadas.reduce(
    (total, v) => total + Number(v.valor || 0),
    0
  );

  const totalCompras = comprasDetalhadas.reduce(
    (total, c) => total + Number(c.valor || 0),
    0
  );

  const totalProducoes = producoesDetalhadas.reduce(
    (total, p) => total + Number(p.quantidade || 0),
    0
  );

  const totalReembolsos = reembolsosDetalhados.reduce(
    (total, r) => total + Number(r.valor || 0),
    0
  );

  const totalAcoes = acoesDetalhadas.reduce(
    (total, a) => total + Number(a.valor || 0),
    0
  );

  const vendasPorPessoa = somarDinheiroPorPessoa(vendasDetalhadas, "vendedor");
  const comprasPorPessoa = somarDinheiroPorPessoa(comprasDetalhadas, "comprador");
  const producaoPorPessoa = somarQuantidadePorPessoa(
    producoesDetalhadas,
    "responsavel"
  );
  const reembolsoPorPessoa = somarDinheiroPorPessoa(reembolsosDetalhados, "nome");
  const acoesPorPessoa = somarDinheiroPorPessoa(acoesDetalhadas, "responsavel");

  const textoVendas = `
RELATÓRIO SEMANAL DE VENDAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

TOTAL DE VENDAS
${formatarDinheiro(totalVendas)}

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

RESUMO INDIVIDUAL DE VENDAS
${
  Object.keys(vendasPorPessoa).length
    ? Object.entries(vendasPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(Number(total))}`)
        .join("\n")
    : "Nenhum vendedor com registro nessa semana."
}
`.trim();

  const textoCompras = `
RELATÓRIO SEMANAL DE COMPRAS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

TOTAL DE COMPRAS
${formatarDinheiro(totalCompras)}

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

RESUMO INDIVIDUAL DE COMPRAS
${
  Object.keys(comprasPorPessoa).length
    ? Object.entries(comprasPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(Number(total))}`)
        .join("\n")
    : "Nenhum comprador com registro nessa semana."
}
`.trim();

  const textoProducao = `
RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

TOTAL PRODUZIDO
${formatarNumero(totalProducoes)}

PRODUÇÃO DETALHADA
${
  producoesDetalhadas.length
    ? producoesDetalhadas
        .map(
          (p) =>
            `Item: ${p.item || "Sem item"} | Quantidade: ${formatarNumero(
              Number(p.quantidade || 0)
            )} | Responsável: ${p.responsavel || "Sem responsável"} | Data: ${formatarData(
              p.criadoEm
            )}`
        )
        .join("\n")
    : "Nenhuma produção registrada nessa semana."
}

RESUMO INDIVIDUAL DE PRODUÇÃO
${
  Object.keys(producaoPorPessoa).length
    ? Object.entries(producaoPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarNumero(Number(total))}`)
        .join("\n")
    : "Nenhum responsável com produção nessa semana."
}
`.trim();  const textoReembolsos = `
RELATÓRIO SEMANAL DE REEMBOLSOS - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

TOTAL DE REEMBOLSOS
${formatarDinheiro(totalReembolsos)}

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

RESUMO INDIVIDUAL DE REEMBOLSOS
${
  Object.keys(reembolsoPorPessoa).length
    ? Object.entries(reembolsoPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(Number(total))}`)
        .join("\n")
    : "Nenhum reembolso registrado."
}
`.trim();

  const textoAcoes = `
RELATÓRIO SEMANAL DE AÇÕES - INGLATERRA

Semana: ${formatarData(inicioSemana)} até ${formatarData(fimSemana)}

TOTAL DE AÇÕES
${formatarDinheiro(totalAcoes)}

AÇÕES DETALHADAS
${
  acoesDetalhadas.length
    ? acoesDetalhadas
        .map(
          (a) =>
            `Ação: ${a.tipo || "Sem tipo"} | Valor: ${formatarDinheiro(
              Number(a.valor || 0)
            )} | Status: ${a.status || "Não informado"} | Responsável: ${
              a.responsavel || "Sem responsável"
            } | Data: ${formatarData(a.criadoEm)}`
        )
        .join("\n")
    : "Nenhuma ação registrada nessa semana."
}

RESUMO INDIVIDUAL DE AÇÕES
${
  Object.keys(acoesPorPessoa).length
    ? Object.entries(acoesPorPessoa)
        .map(([nome, total]) => `${nome}: ${formatarDinheiro(Number(total))}`)
        .join("\n")
    : "Nenhuma ação registrada."
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
        {gerandoAdv ? "Gerando advertências..." : "⚠️ Gerar Advertências Automáticas"}
      </button>

      <div className="mt-8 flex flex-wrap gap-3">
        <BotaoAba ativo={aba === "vendas"} onClick={() => setAba("vendas")}>💰 Vendas</BotaoAba>
        <BotaoAba ativo={aba === "compras"} onClick={() => setAba("compras")}>🛒 Compras</BotaoAba>
        <BotaoAba ativo={aba === "producao"} onClick={() => setAba("producao")}>🏭 Produção</BotaoAba>
        <BotaoAba ativo={aba === "reembolsos"} onClick={() => setAba("reembolsos")}>💸 Reembolsos</BotaoAba>
        <BotaoAba ativo={aba === "acoes"} onClick={() => setAba("acoes")}>🎯 Ações</BotaoAba>
      </div>

      <RelatorioBox
        mostrar={aba === "vendas"}
        titulo="💰 Relatório de Vendas"
        totalTitulo="Total de Vendas"
        total={formatarDinheiro(totalVendas)}
        registros={vendasDetalhadas.length}
        texto={textoVendas}
        gerar={() => gerarPDF("RELATÓRIO SEMANAL DE VENDAS", textoVendas, "relatorio-vendas-inglaterra.pdf")}
      />

      <RelatorioBox
        mostrar={aba === "compras"}
        titulo="🛒 Relatório de Compras"
        totalTitulo="Total de Compras"
        total={formatarDinheiro(totalCompras)}
        registros={comprasDetalhadas.length}
        texto={textoCompras}
        gerar={() => gerarPDF("RELATÓRIO SEMANAL DE COMPRAS", textoCompras, "relatorio-compras-inglaterra.pdf")}
      />

      <RelatorioBox
        mostrar={aba === "producao"}
        titulo="🏭 Relatório de Produção"
        totalTitulo="Total Produzido"
        total={formatarNumero(totalProducoes)}
        registros={producoesDetalhadas.length}
        texto={textoProducao}
        gerar={() => gerarPDF("RELATÓRIO SEMANAL DE PRODUÇÃO", textoProducao, "relatorio-producao-inglaterra.pdf")}
      />

      <RelatorioBox
        mostrar={aba === "reembolsos"}
        titulo="💸 Relatório de Reembolsos"
        totalTitulo="Total de Reembolsos"
        total={formatarDinheiro(totalReembolsos)}
        registros={reembolsosDetalhados.length}
        texto={textoReembolsos}
        gerar={() => gerarPDF("RELATÓRIO SEMANAL DE REEMBOLSOS", textoReembolsos, "relatorio-reembolsos-inglaterra.pdf")}
      />

      <RelatorioBox
        mostrar={aba === "acoes"}
        titulo="🎯 Relatório de Ações"
        totalTitulo="Total de Ações"
        total={formatarDinheiro(totalAcoes)}
        registros={acoesDetalhadas.length}
        texto={textoAcoes}
        gerar={() => gerarPDF("RELATÓRIO SEMANAL DE AÇÕES", textoAcoes, "relatorio-acoes-inglaterra.pdf")}
      />
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

function RelatorioBox({
  mostrar,
  titulo,
  totalTitulo,
  total,
  registros,
  texto,
  gerar,
}: {
  mostrar: boolean;
  titulo: string;
  totalTitulo: string;
  total: string;
  registros: number;
  texto: string;
  gerar: () => void;
}) {
  if (!mostrar) return null;

  return (
    <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
      <h2 className="text-3xl font-bold">{titulo}</h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card titulo={totalTitulo} valor={total} />
        <Card titulo="Registros" valor={String(registros)} />
      </div>

      <textarea
        value={texto}
        readOnly
        className="mt-6 h-96 w-full rounded bg-black p-4 text-white"
      />

      <button
        onClick={gerar}
        className="mt-5 rounded bg-green-700 px-6 py-3 font-bold"
      >
        📄 Gerar PDF
      </button>
    </section>
  );
}