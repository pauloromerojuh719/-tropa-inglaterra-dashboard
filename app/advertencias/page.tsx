"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import jsPDF from "jspdf";

type Membro = {
  cargo: string;
  status: string;
};

type Advertencia = {
  id: string;
  membroId?: string;
  membroNome: string;
  cargo?: string;
  motivo: string;
  semanaInicio?: string;
  semanaFim?: string;
  folhas?: number;
  opios?: number;
  seringas?: number;
  agulhas?: number;
  criadoEm?: any;
};

type ResumoAdvertencia = {
  membroId: string;
  membroNome: string;
  cargo: string;
  total: number;
  ultimaMotivo: string;
  ultimaSemana: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
};

export default function AdvertenciasPage() {
  const { data: session } = useSession();

  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [advertencias, setAdvertencias] = useState<Advertencia[]>([]);

  useEffect(() => {
    verificarPermissao();
  }, [session]);

  function formatarDataTexto(data?: string) {
    if (!data) return "Sem data";

    const d = new Date(data);
    return d.toLocaleDateString("pt-BR");
  }

  function statusDisciplinar(total: number) {
    if (total >= 3) return "PD / EXCLUIR DA FAC";
    if (total === 2) return "RISCO";
    return "AVISO";
  }

  function corStatus(total: number) {
    if (total >= 3) return "text-red-500";
    if (total === 2) return "text-yellow-400";
    return "text-green-400";
  }

  function resumoPorMembro() {
    const mapa: Record<string, ResumoAdvertencia> = {};

    advertencias.forEach((adv) => {
      const chave = adv.membroId || adv.membroNome;

      if (!mapa[chave]) {
        mapa[chave] = {
          membroId: chave,
          membroNome: adv.membroNome || "Sem nome",
          cargo: adv.cargo || "Sem cargo",
          total: 0,
          ultimaMotivo: adv.motivo || "Sem motivo",
          ultimaSemana: `${formatarDataTexto(adv.semanaInicio)} até ${formatarDataTexto(
            adv.semanaFim
          )}`,
          folhas: Number(adv.folhas || 0),
          opios: Number(adv.opios || 0),
          seringas: Number(adv.seringas || 0),
          agulhas: Number(adv.agulhas || 0),
          status: "AVISO",
        };
      }

      mapa[chave].total += 1;
      mapa[chave].ultimaMotivo = adv.motivo || "Sem motivo";
      mapa[chave].ultimaSemana = `${formatarDataTexto(
        adv.semanaInicio
      )} até ${formatarDataTexto(adv.semanaFim)}`;
      mapa[chave].folhas = Number(adv.folhas || 0);
      mapa[chave].opios = Number(adv.opios || 0);
      mapa[chave].seringas = Number(adv.seringas || 0);
      mapa[chave].agulhas = Number(adv.agulhas || 0);
      mapa[chave].status = statusDisciplinar(mapa[chave].total);
    });

    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }

  async function verificarPermissao() {
    const email = session?.user?.email;

    if (!email) {
      setCarregando(false);
      return;
    }

    try {
      const membrosSnap = await getDocs(collection(db, "membros"));

      const membro = membrosSnap.docs.find((d) => d.data().email === email);

      if (!membro) {
        setCarregando(false);
        return;
      }

      const dados = membro.data() as Membro;

      const permitidos = [
        "Líder",
        "Vice-Líder",
        "Gerente Geral",
        "Gerente de Farm",
        "Gerente de Produção",
        "Gerente de Compras",
        "Gerente de Vendas",
        "Gerente de Ações",
      ];

      if (dados.status === "aprovado" && permitidos.includes(dados.cargo)) {
        setTemPermissao(true);
        await carregarAdvertencias();
      }
    } catch (error) {
      console.log(error);
    }

    setCarregando(false);
  }

  async function carregarAdvertencias() {
    const q = query(collection(db, "advertencias"));
    const snap = await getDocs(q);

    const lista = snap.docs.map((documento) => ({
      id: documento.id,
      ...documento.data(),
    })) as Advertencia[];

    setAdvertencias(lista);
  }

  function gerarPDFAdvertencias() {
    const resumo = resumoPorMembro();
    const pdf = new jsPDF();

    pdf.setFontSize(18);
    pdf.text("RELATÓRIO DE ADVERTÊNCIAS - INGLATERRA", 10, 15);

    pdf.setFontSize(11);

    let y = 30;

    if (resumo.length === 0) {
      pdf.text("Nenhuma advertência registrada.", 10, y);
    }

    resumo.forEach((item, index) => {
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(`${index + 1}. ${item.membroNome}`, 10, y);
      y += 7;
      pdf.text(`Cargo: ${item.cargo}`, 10, y);
      y += 7;
      pdf.text(`Total de advertências: ${item.total}`, 10, y);
      y += 7;
      pdf.text(`Status: ${item.status}`, 10, y);
      y += 7;
      pdf.text(`Último motivo: ${item.ultimaMotivo}`, 10, y);
      y += 7;
      pdf.text(`Semana: ${item.ultimaSemana}`, 10, y);
      y += 7;
      pdf.text(
        `Farm: Folhas ${item.folhas}/2000 | Ópios ${item.opios}/2000 | Seringas ${item.seringas}/800 | Agulhas ${item.agulhas}/800`,
        10,
        y
      );
      y += 12;
    });

    pdf.save("relatorio-advertencias-inglaterra.pdf");
  }

  const resumo = resumoPorMembro();

  if (!session) {
    return (
      <div className="min-h-screen bg-black p-8 text-center text-white">
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-blue-600 px-4 py-2 text-white"
        >
          Entrar com Discord
        </button>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-black p-8 text-white">Carregando...</div>
    );
  }

  if (!temPermissao) {
    return (
      <div className="min-h-screen bg-black p-8 text-red-500">
        Sem permissão.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <h1 className="text-4xl font-black text-red-600">⚠️ Advertências</h1>

      <p className="mt-3 text-zinc-400">
        Controle disciplinar da Inglaterra. Com 3 advertências, o membro entra
        em status de PD / exclusão da fac.
      </p>

      <button
        onClick={gerarPDFAdvertencias}
        className="mt-6 rounded bg-green-700 px-6 py-3 font-bold hover:bg-green-600"
      >
        📄 Gerar PDF de Advertências
      </button>

      {resumo.length === 0 ? (
        <div className="mt-6 rounded border border-zinc-700 bg-zinc-900 p-4">
          Nenhuma advertência registrada ainda.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {resumo.map((item) => (
            <div
              key={item.membroId}
              className={`rounded-xl border p-5 ${
                item.total >= 3
                  ? "border-red-700 bg-red-950"
                  : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">{item.membroNome}</h2>

                  <p className="mt-1 text-zinc-400">Cargo: {item.cargo}</p>

                  <p className="mt-1 text-zinc-400">
                    Última semana: {item.ultimaSemana}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-xl font-black">
                    Advertências: {item.total}
                  </p>

                  <p className={`text-xl font-black ${corStatus(item.total)}`}>
                    {item.status}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-black p-4">
                <p>
                  <strong>Último motivo:</strong> {item.ultimaMotivo}
                </p>

                <p className="mt-2 text-zinc-300">
                  Farm da semana: Folhas {item.folhas}/2000 | Ópios{" "}
                  {item.opios}/2000 | Seringas {item.seringas}/800 | Agulhas{" "}
                  {item.agulhas}/800
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}