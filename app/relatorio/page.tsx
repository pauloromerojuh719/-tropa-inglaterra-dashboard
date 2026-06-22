"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from "jspdf";

type Membro = {
  nome?: string;
  nomeRP?: string;
  cargo: string;
  status: string;
};

type LinhaProducao = {
  nome: string;
  cargo: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  total: number;
};

export default function ProducaoPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [producao, setProducao] = useState<LinhaProducao[]>([]);

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

  function formatarNumero(valor: number) {
    return valor.toLocaleString("pt-BR");
  }

  function dataOk(data: any) {
    const d = data?.toDate?.();
    return d && d >= inicioDaSemana() && d <= fimDaSemana();
  }

  async function carregarProducao() {
    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));

    const mapa: Record<string, LinhaProducao> = {};

    membrosSnap.docs.forEach((docItem) => {
      const m = docItem.data() as Membro;

      if (m.status !== "aprovado") return;

      mapa[docItem.id] = {
        nome: m.nomeRP || m.nome || "Sem nome",
        cargo: m.cargo || "Sem cargo",
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
        total: 0,
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

    const lista = Object.values(mapa)
      .map((m) => ({
        ...m,
        total: m.folhas + m.opios + m.seringas + m.agulhas,
      }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total);

    setProducao(lista);
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
        await carregarProducao();
      }

      setCarregando(false);
    }

    verificar();
  }, [session]);

  const inicioSemana = inicioDaSemana();
  const fimSemana = fimDaSemana();

  const totalFolhas = producao.reduce((t, m) => t + m.folhas, 0);
  const totalOpios = producao.reduce((t, m) => t + m.opios, 0);
  const totalSeringas = producao.reduce((t, m) => t + m.seringas, 0);
  const totalAgulhas = producao.reduce((t, m) => t + m.agulhas, 0);
  const totalGeral = totalFolhas + totalOpios + totalSeringas + totalAgulhas;

  const textoRelatorio = `
RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA

Semana: ${formatarDataSimples(inicioSemana)} até ${formatarDataSimples(fimSemana)}

PRODUÇÃO TOTAL
Folhas: ${formatarNumero(totalFolhas)}
Ópios: ${formatarNumero(totalOpios)}
Seringas: ${formatarNumero(totalSeringas)}
Agulhas: ${formatarNumero(totalAgulhas)}
Total Geral: ${formatarNumero(totalGeral)}

MEMBROS QUE PRODUZIRAM
${producao.length}

TOP PRODUÇÃO
${
  producao.length
    ? producao
        .slice(0, 10)
        .map((m, i) => `${i + 1}º ${m.nome} - ${formatarNumero(m.total)} itens`)
        .join("\n")
    : "Nenhum"
}

PRODUÇÃO POR MEMBRO
${
  producao.length
    ? producao
        .map(
          (m) => `- ${m.nome}
Folhas: ${formatarNumero(m.folhas)}
Ópios: ${formatarNumero(m.opios)}
Seringas: ${formatarNumero(m.seringas)}
Agulhas: ${formatarNumero(m.agulhas)}
Total: ${formatarNumero(m.total)}`
        )
        .join("\n\n")
    : "Nenhuma produção lançada nessa semana."
}
`.trim();

  function gerarPDF() {
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text("RELATÓRIO SEMANAL DE PRODUÇÃO - INGLATERRA", 10, 15);

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

  function copiarRelatorio() {
    navigator.clipboard.writeText(textoRelatorio);
    alert("Relatório copiado!");
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
        🏭 RELATÓRIO DE PRODUÇÃO
      </h1>

      <p className="mt-3 text-zinc-400">
        Semana: {formatarDataSimples(inicioSemana)} até{" "}
        {formatarDataSimples(fimSemana)}
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-5">
        <Card titulo="🌿 Folhas" valor={formatarNumero(totalFolhas)} />
        <Card titulo="🌿 Ópios" valor={formatarNumero(totalOpios)} />
        <Card titulo="💉 Seringas" valor={formatarNumero(totalSeringas)} />
        <Card titulo="💉 Agulhas" valor={formatarNumero(totalAgulhas)} />
        <Card titulo="📦 Total Geral" valor={formatarNumero(totalGeral)} />
      </div>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold text-red-400">🏆 Top Produção</h2>

        <div className="mt-4 grid gap-3">
          {producao.length === 0 ? (
            <p className="text-zinc-400">
              Nenhuma produção lançada nessa semana.
            </p>
          ) : (
            producao.slice(0, 10).map((membro, index) => (
              <div
                key={membro.nome}
                className="rounded border border-zinc-800 bg-black p-4"
              >
                {index + 1}º {membro.nome} - {formatarNumero(membro.total)} itens
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">📋 Produção por membro</h2>

        <div className="mt-5 grid gap-4">
          {producao.map((membro) => (
            <div
              key={membro.nome}
              className="rounded-xl border border-zinc-800 bg-black p-5"
            >
              <h3 className="text-xl font-bold text-red-500">{membro.nome}</h3>
              <p className="text-sm text-zinc-400">{membro.cargo}</p>

              <div className="mt-3 grid gap-3 md:grid-cols-5">
                <MiniCard titulo="Folhas" valor={formatarNumero(membro.folhas)} />
                <MiniCard titulo="Ópios" valor={formatarNumero(membro.opios)} />
                <MiniCard titulo="Seringas" valor={formatarNumero(membro.seringas)} />
                <MiniCard titulo="Agulhas" valor={formatarNumero(membro.agulhas)} />
                <MiniCard titulo="Total" valor={formatarNumero(membro.total)} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">📄 Relatório pronto</h2>

        <textarea
          value={textoRelatorio}
          readOnly
          className="mt-5 h-96 w-full rounded bg-black p-4 text-white"
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={copiarRelatorio}
            className="rounded bg-red-700 px-6 py-3 font-bold"
          >
            📋 Copiar Relatório
          </button>

          <button
            onClick={gerarPDF}
            className="rounded bg-green-700 px-6 py-3 font-bold"
          >
            📄 Gerar PDF
          </button>
        </div>
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

function MiniCard({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-sm text-zinc-400">{titulo}</p>
      <h4 className="text-xl font-bold text-white">{valor}</h4>
    </div>
  );
}