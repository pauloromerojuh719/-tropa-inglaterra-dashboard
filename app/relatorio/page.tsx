"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import {
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

type Registro = {
  id: string;
  [key: string]: any;
};

const CARGOS_PERMITIDOS = [
  "Líder",
  "Vice-Líder",
  "Gerente Geral",
  "Gerente de Farm",
  "Gerente de Vendas",
  "Gerente de Produção",
  "Gerente de Compras",
  "Gerente de Ações",
];

export default function RelatoriosPage() {
  const { data: session, status } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);

  useEffect(() => {
    verificarPermissao();
  }, [session]);

  async function verificarPermissao() {
    if (!session?.user?.email) {
      setCarregando(false);
      return;
    }

    const membroRef = doc(db, "membros", session.user.email);
    const membroSnap = await getDoc(membroRef);

    if (!membroSnap.exists()) {
      setTemPermissao(false);
      setCarregando(false);
      return;
    }

    const membro = membroSnap.data() as Membro;

    setTemPermissao(
      membro.status === "aprovado" && CARGOS_PERMITIDOS.includes(membro.cargo)
    );

    setCarregando(false);
  }

  function pegarSemanaPassada() {
    const hoje = new Date();

    const diaSemana = hoje.getDay();
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;

    const segundaAtual = new Date(hoje);
    segundaAtual.setDate(hoje.getDate() - diasDesdeSegunda);
    segundaAtual.setHours(0, 0, 0, 0);

    const inicio = new Date(segundaAtual);
    inicio.setDate(segundaAtual.getDate() - 7);
    inicio.setHours(0, 0, 0, 0);

    const fim = new Date(segundaAtual);
    fim.setDate(segundaAtual.getDate() - 1);
    fim.setHours(23, 59, 59, 999);

    return { inicio, fim };
  }

  function dentroDaSemana(data: any, inicio: Date, fim: Date) {
    if (!data) return false;

    let dataConvertida: Date;

    if (data instanceof Timestamp) {
      dataConvertida = data.toDate();
    } else if (data?.seconds) {
      dataConvertida = new Date(data.seconds * 1000);
    } else {
      dataConvertida = new Date(data);
    }

    return dataConvertida >= inicio && dataConvertida <= fim;
  }

  function formatarMoeda(valor: number) {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatarData(data: Date) {
    return data.toLocaleDateString("pt-BR");
  }

  async function buscarColecao(nome: string) {
    const snapshot = await getDocs(collection(db, nome));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Registro[];
  }

  async function gerarRelatorioGeralSemanaPassada() {
    const { inicio, fim } = pegarSemanaPassada();

    const [
      farms,
      vendas,
      compras,
      producoes,
      reembolsos,
      acoes,
      plantoes,
      membros,
    ] = await Promise.all([
      buscarColecao("farm"),
      buscarColecao("vendas"),
      buscarColecao("compras"),
      buscarColecao("producoes"),
      buscarColecao("reembolsos"),
      buscarColecao("acoes"),
      buscarColecao("plantoes"),
      buscarColecao("membros"),
    ]);

    const farmsSemana = farms.filter(
      (f) => f.status === "aprovado" && dentroDaSemana(f.criadoEm, inicio, fim)
    );

    const vendasSemana = vendas.filter((v) =>
      dentroDaSemana(v.criadoEm, inicio, fim)
    );

    const comprasSemana = compras.filter((c) =>
      dentroDaSemana(c.criadoEm, inicio, fim)
    );

    const producoesSemana = producoes.filter((p) =>
      dentroDaSemana(p.criadoEm, inicio, fim)
    );

    const reembolsosSemana = reembolsos.filter((r) =>
      dentroDaSemana(r.criadoEm, inicio, fim)
    );

    const acoesSemana = acoes.filter((a) =>
      dentroDaSemana(a.criadoEm, inicio, fim)
    );

    const plantoesSemana = plantoes.filter((p) =>
      dentroDaSemana(p.inicio || p.criadoEm, inicio, fim)
    );

    const membrosAprovados = membros.filter((m) => m.status === "aprovado");

    const totalFolhas = farmsSemana.reduce(
      (soma, f) => soma + Number(f.folhas || 0),
      0
    );
    const totalOpios = farmsSemana.reduce(
      (soma, f) => soma + Number(f.opios || 0),
      0
    );
    const totalSeringas = farmsSemana.reduce(
      (soma, f) => soma + Number(f.seringas || 0),
      0
    );
    const totalAgulhas = farmsSemana.reduce(
      (soma, f) => soma + Number(f.agulhas || 0),
      0
    );

    const totalVendas = vendasSemana.reduce(
      (soma, v) => soma + Number(v.valor || 0),
      0
    );

    const totalCompras = comprasSemana.reduce(
      (soma, c) => soma + Number(c.valor || 0),
      0
    );

    const totalReembolsos = reembolsosSemana.reduce(
      (soma, r) => soma + Number(r.valor || 0),
      0
    );

    const totalProduzido = producoesSemana.reduce(
      (soma, p) => soma + Number(p.quantidade || 0),
      0
    );

    const totalHoras = plantoesSemana.reduce(
      (soma, p) => soma + Number(p.minutos || 0),
      0
    );

    const saldoSemana = totalVendas - totalCompras - totalReembolsos;

    const resumoPorMembro: Record<string, any> = {};

    farmsSemana.forEach((farm) => {
      const nome =
        farm.membroNome ||
        farm.nome ||
        farm.responsavel ||
        farm.membroEmail ||
        "Sem nome";

      if (!resumoPorMembro[nome]) {
        resumoPorMembro[nome] = {
          nome,
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
        };
      }

      resumoPorMembro[nome].folhas += Number(farm.folhas || 0);
      resumoPorMembro[nome].opios += Number(farm.opios || 0);
      resumoPorMembro[nome].seringas += Number(farm.seringas || 0);
      resumoPorMembro[nome].agulhas += Number(farm.agulhas || 0);
    });

    const docPDF = new jsPDF();

    let y = 15;

    function titulo(texto: string) {
      docPDF.setFontSize(16);
      docPDF.text(texto, 10, y);
      y += 10;
    }

    function linha(texto: string) {
      docPDF.setFontSize(10);
      docPDF.text(texto, 10, y);
      y += 7;

      if (y > 280) {
        docPDF.addPage();
        y = 15;
      }
    }

    titulo("RELATÓRIO GERAL - TROPA DA INGLATERRA");

    linha(`Período: ${formatarData(inicio)} até ${formatarData(fim)}`);
    linha(`Gerado por: ${session?.user?.name || session?.user?.email}`);
    linha("");

    titulo("RESUMO GERAL");

    linha(`Membros aprovados: ${membrosAprovados.length}`);
    linha(`Farm aprovado na semana: ${farmsSemana.length} registros`);
    linha(`Vendas: ${formatarMoeda(totalVendas)}`);
    linha(`Compras: ${formatarMoeda(totalCompras)}`);
    linha(`Reembolsos: ${formatarMoeda(totalReembolsos)}`);
    linha(`Saldo da semana: ${formatarMoeda(saldoSemana)}`);
    linha(`Produção total: ${totalProduzido}`);
    linha(`Ações registradas: ${acoesSemana.length}`);
    linha(`Horas registradas: ${(totalHoras / 60).toFixed(1)}h`);
    linha("");

    titulo("FARM TOTAL DA SEMANA");

    linha(`Folhas: ${totalFolhas}`);
    linha(`Ópios: ${totalOpios}`);
    linha(`Seringas: ${totalSeringas}`);
    linha(`Agulhas: ${totalAgulhas}`);
    linha("");

    titulo("FARM POR MEMBRO");

    Object.values(resumoPorMembro)
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"))
      .forEach((m: any) => {
        linha(
          `${m.nome} | Folhas: ${m.folhas} | Ópios: ${m.opios} | Seringas: ${m.seringas} | Agulhas: ${m.agulhas}`
        );
      });

    linha("");

    titulo("VENDAS");

    if (vendasSemana.length === 0) {
      linha("Nenhuma venda registrada.");
    } else {
      vendasSemana.forEach((v) => {
        linha(
          `${v.item || "Item"} | Qtd: ${v.quantidade || 0} | Valor: ${formatarMoeda(
            Number(v.valor || 0)
          )} | Vendedor: ${v.vendedor || "Não informado"}`
        );
      });
    }

    linha("");

    titulo("COMPRAS");

    if (comprasSemana.length === 0) {
      linha("Nenhuma compra registrada.");
    } else {
      comprasSemana.forEach((c) => {
        linha(
          `${c.item || "Item"} | Qtd: ${c.quantidade || 0} | Valor: ${formatarMoeda(
            Number(c.valor || 0)
          )} | Comprador: ${c.comprador || "Não informado"}`
        );
      });
    }

    linha("");

    titulo("PRODUÇÃO");

    if (producoesSemana.length === 0) {
      linha("Nenhuma produção registrada.");
    } else {
      producoesSemana.forEach((p) => {
        linha(
          `${p.item || "Item"} | Qtd: ${p.quantidade || 0} | Responsável: ${
            p.responsavel || "Não informado"
          }`
        );
      });
    }

    linha("");

    titulo("REEMBOLSOS");

    if (reembolsosSemana.length === 0) {
      linha("Nenhum reembolso registrado.");
    } else {
      reembolsosSemana.forEach((r) => {
        linha(
          `${r.nome || "Nome"} | ${r.item || "Item"} | Valor: ${formatarMoeda(
            Number(r.valor || 0)
          )} | Status: ${r.status || "pendente"}`
        );
      });
    }

    linha("");

    titulo("AÇÕES");

    if (acoesSemana.length === 0) {
      linha("Nenhuma ação registrada.");
    } else {
      acoesSemana.forEach((a) => {
        linha(
          `${a.tipo || a.nome || "Ação"} | Status: ${
            a.status || "Não informado"
          } | Valor: ${formatarMoeda(Number(a.valor || 0))}`
        );
      });
    }

    docPDF.save(
      `relatorio-geral-semana-${formatarData(inicio).replaceAll(
        "/",
        "-"
      )}-a-${formatarData(fim).replaceAll("/", "-")}.pdf`
    );
  }

  if (status === "loading" || carregando) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <h1 className="text-2xl font-black text-red-500">📑 Relatórios</h1>
          <p className="mt-2 text-zinc-400">Entre com Discord para acessar.</p>

          <button
            onClick={() => signIn("discord")}
            className="mt-4 rounded-lg bg-red-600 px-5 py-3 font-bold hover:bg-red-500"
          >
            Entrar com Discord
          </button>
        </div>
      </main>
    );
  }

  if (!temPermissao) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <div className="rounded-xl border border-red-800 bg-red-950 p-6">
          <h1 className="text-2xl font-black text-red-400">Sem permissão</h1>
          <p className="mt-2 text-red-200">
            Apenas líderes e gerentes podem acessar os relatórios.
          </p>
        </div>
      </main>
    );
  }

  const { inicio, fim } = pegarSemanaPassada();

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black text-red-500">
          📑 Relatórios da Inglaterra
        </h1>

        <p className="mt-2 text-zinc-400">
          Gere relatórios completos da facção em PDF.
        </p>

        <div className="mt-6 rounded-xl border border-red-800 bg-zinc-900 p-6">
          <h2 className="text-2xl font-black text-red-400">
            📄 Relatório Geral da Semana Passada
          </h2>

          <p className="mt-2 text-zinc-300">
            Período:{" "}
            <span className="font-bold text-white">
              {formatarData(inicio)} até {formatarData(fim)}
            </span>
          </p>

          <p className="mt-3 text-sm text-zinc-400">
            Esse PDF puxa farm aprovado, vendas, compras, produção, reembolsos,
            ações e plantões da semana fechada.
          </p>

          <button
            onClick={gerarRelatorioGeralSemanaPassada}
            className="mt-5 w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-black text-white hover:bg-red-500"
          >
            📄 Gerar Relatório Geral da Semana Passada
          </button>
        </div>
      </div>
    </main>
  );
}