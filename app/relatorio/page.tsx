"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from "jspdf";

type Membro = {
  nome?: string;
  nomeRP?: string;
  email?: string;
  cargo: string;
  status: string;
};

type LinhaMeta = {
  nome: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  bateu: boolean;
};

export default function RelatorioPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);

  const [metas, setMetas] = useState<LinhaMeta[]>([]);
  const [vendasSemana, setVendasSemana] = useState(0);
  const [acoesSemana, setAcoesSemana] = useState(0);
  const [comprasSemana, setComprasSemana] = useState(0);
  const [reembolsosSemana, setReembolsosSemana] = useState(0);

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

  function formatarDataSimples(data: Date) {
    return data.toLocaleDateString("pt-BR");
  }

  function formatarDinheiro(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function dataOk(data: any) {
    const d = data?.toDate?.();
    return d && d >= inicioDaSemana() && d <= fimDaSemana();
  }
    async function carregarRelatorio() {
    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));
    const vendasSnap = await getDocs(collection(db, "vendas"));
    const acoesSnap = await getDocs(collection(db, "acoes"));
    const comprasSnap = await getDocs(collection(db, "compras"));
    const reembolsosSnap = await getDocs(collection(db, "reembolsos"));

    const mapa: Record<string, LinhaMeta> = {};

    membrosSnap.docs.forEach((docItem) => {
      const m = docItem.data() as Membro;

      if (m.status !== "aprovado") return;

      mapa[docItem.id] = {
        nome: m.nomeRP || m.nome || "Sem nome",
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
        bateu: false,
      };
    });

    farmSnap.docs.forEach((docItem) => {
      const f = docItem.data() as any;

      if (f.status !== "aprovado") return;
      if (!dataOk(f.criadoEm)) return;

      const id = f.membroId;
      if (!id || !mapa[id]) return;

      mapa[id].folhas += Number(f.folhas || 0);
      mapa[id].opios += Number(f.opios || 0);
      mapa[id].seringas += Number(f.seringas || 0);
      mapa[id].agulhas += Number(f.agulhas || 0);
    });

    const listaMetas = Object.values(mapa).map((m) => ({
      ...m,
      bateu:
        m.folhas >= 2000 &&
        m.opios >= 2000 &&
        m.seringas >= 800 &&
        m.agulhas >= 800,
    }));

    listaMetas.sort((a, b) => {
      if (a.bateu === b.bateu) return a.nome.localeCompare(b.nome);
      return a.bateu ? -1 : 1;
    });

    setMetas(listaMetas);

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
      const cargo = membro.cargo?.trim();

      if (
        membro.status === "aprovado" &&
        (cargo === "Líder" ||
          cargo === "Vice-Líder" ||
          cargo === "Gerente Geral")
      ) {
        setTemPermissao(true);
        await carregarRelatorio();
      }

      setCarregando(false);
    }

    verificar();
  }, [session]);

  const bateram = metas.filter((m) => m.bateu);
  const naoBateram = metas.filter((m) => !m.bateu);

  const entradas = vendasSemana + acoesSemana;
  const saidas = comprasSemana + reembolsosSemana;
  const resultado = entradas - saidas;

  const inicioSemana = inicioDaSemana();
  const fimSemana = fimDaSemana();

  const textoRelatorio = `
RELATÓRIO SEMANAL - INGLATERRA

Semana: ${formatarDataSimples(inicioSemana)} até ${formatarDataSimples(fimSemana)}

Bateram Meta: ${bateram.length}
Não Bateram Meta: ${naoBateram.length}

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

BATERAM META
${bateram.length ? bateram.map((m) => `- ${m.nome}`).join("\n") : "Nenhum"}

NÃO BATERAM META
${naoBateram.length ? naoBateram.map((m) => `- ${m.nome}`).join("\n") : "Nenhum"}
`.trim();

  function gerarPDF() {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text("RELATÓRIO SEMANAL - INGLATERRA", 10, 15);

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

    pdf.save("relatorio-semanal-inglaterra.pdf");
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
      <h1 className="text-5xl font-black text-red-600">
        📊 RELATÓRIO SEMANAL
      </h1>

      <p className="mt-3 text-zinc-400">
        Semana: {formatarDataSimples(inicioSemana)} até{" "}
        {formatarDataSimples(fimSemana)}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-5">
        <Card titulo="✅ Bateram Meta" valor={String(bateram.length)} />
        <Card titulo="❌ Não Bateram" valor={String(naoBateram.length)} />
        <Card titulo="💰 Entradas" valor={formatarDinheiro(entradas)} />
        <Card titulo="💸 Saídas" valor={formatarDinheiro(saidas)} />
        <Card titulo="📈 Resultado" valor={formatarDinheiro(resultado)} />
      </div>

      <section className="mt-8 rounded-xl border border-green-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold text-green-400">
          ✅ Lista de quem bateu
        </h2>

        <div className="mt-4 grid gap-3">
          {bateram.length === 0 ? (
            <p className="text-zinc-400">Nenhum membro bateu meta ainda.</p>
          ) : (
            bateram.map((membro) => (
              <div
                key={membro.nome}
                className="rounded border border-zinc-800 bg-black p-4"
              >
                ✅ {membro.nome}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold text-red-400">
          ❌ Lista de quem não bateu
        </h2>

        <div className="mt-4 grid gap-3">
          {naoBateram.length === 0 ? (
            <p className="text-zinc-400">Todos bateram a meta.</p>
          ) : (
            naoBateram.map((membro) => (
              <div
                key={membro.nome}
                className="rounded border border-zinc-800 bg-black p-4"
              >
                ❌ {membro.nome}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">📋 Relatório pronto</h2>

        <textarea
          value={textoRelatorio}
          readOnly
          className="mt-5 h-96 w-full rounded bg-black p-4 text-white"
        />

        <button
          onClick={gerarPDF}
          className="mt-5 rounded bg-green-700 px-6 py-3 font-bold"
        >
          📄 Gerar PDF
        </button>
      </section>
    </main>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-xl border border-red-900 bg-zinc-950 p-6">
      <p>{titulo}</p>
      <h2 className="text-3xl font-black text-red-500">{valor}</h2>
    </div>
  );
}