"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeRP?: string;
  nomeDiscord?: string;
  username?: string;
  email?: string;
  discordId?: string;
  cargo: string;
  status: string;
};

type Farm = {
  id: string;
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  print?: string;
  status: string;
  criadoEm?: any;
};

type ResumoMembro = {
  membroNome: string;
  membroEmail: string;
  membroId: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  sobraFolhas: number;
  sobraOpios: number;
  sobraSeringas: number;
  sobraAgulhas: number;
  total: number;
};

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function nomeExibicao(membro?: Membro) {
  if (!membro) return "Sem nome";

  return (
    membro.nomeRP ||
    membro.nomeDiscord ||
    membro.nome ||
    membro.username ||
    membro.email ||
    "Sem nome"
  );
}

export default function ControleFarmPage() {
  const { data: session } = useSession();

  const [resumo, setResumo] = useState<ResumoMembro[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [membroSelecionado, setMembroSelecionado] =
    useState<ResumoMembro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [temPermissao, setTemPermissao] = useState(false);
  const [imagemAberta, setImagemAberta] = useState<string | null>(null);

  useEffect(() => {
    verificarPermissao();
  }, [session]);

  function inicioSemanaAtual() {
    const hoje = new Date();
    const dia = hoje.getDay();
    const diff = dia === 0 ? -6 : 1 - dia;

    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() + diff);
    inicio.setHours(0, 0, 0, 0);

    return inicio;
  }

  function inicioSemanaPassada() {
    const inicio = inicioSemanaAtual();
    const passada = new Date(inicio);
    passada.setDate(inicio.getDate() - 7);
    return passada;
  }

  function pegarDataFarm(farm: Farm) {
    if (!farm.criadoEm) return null;

    if (farm.criadoEm.toDate) {
      return farm.criadoEm.toDate();
    }

    return new Date(farm.criadoEm);
  }

  function formatarData(data: any) {
    if (!data?.toDate) return "Sem data";
    return data.toDate().toLocaleString("pt-BR");
  }

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
        cargo === "Gerente Geral" ||
        cargo === "Gerente de Farm" ||
        cargo === "Gerente de Produção" ||
        cargo?.includes("Gerente"))
    ) {
      setTemPermissao(true);
      await carregarControleFarm();
    } else {
      setTemPermissao(false);
    }

    setCarregando(false);
  }

  async function carregarControleFarm() {
    const farmSnap = await getDocs(collection(db, "farm"));
    const membrosSnap = await getDocs(collection(db, "membros"));

    const semanaAtual = inicioSemanaAtual();
    const semanaPassada = inicioSemanaPassada();

    const membrosPorId: Record<string, Membro> = {};
    const membrosPorEmail: Record<string, Membro> = {};

    membrosSnap.docs.forEach((item) => {
      const dados = item.data() as Membro;

      if (dados.discordId) {
        membrosPorId[dados.discordId] = dados;
      }

      if (dados.email) {
        membrosPorEmail[dados.email] = dados;
      }
    });

    const mapaAtual: Record<string, ResumoMembro> = {};
    const mapaPassado: Record<string, ResumoMembro> = {};
    const listaFarmsSemanaAtual: Farm[] = [];

    farmSnap.docs.forEach((docItem) => {
      const farm = {
        id: docItem.id,
        ...(docItem.data() as Omit<Farm, "id">),
      };

      if (farm.status !== "aprovado") return;

      const dataFarm = pegarDataFarm(farm);
      if (!dataFarm) return;

      const membroDoCadastro =
        membrosPorId[farm.membroId] || membrosPorEmail[farm.membroEmail];

      const nomeCorreto = membroDoCadastro
        ? nomeExibicao(membroDoCadastro)
        : farm.membroNome || "Sem nome";

      const membroEmail = farm.membroEmail || membroDoCadastro?.email || "";
      const membroId = farm.membroId || membroDoCadastro?.discordId || "";
      const chave = membroId || membroEmail || nomeCorreto;

      const farmCorrigido = {
        ...farm,
        membroNome: nomeCorreto,
        membroEmail,
        membroId,
      };

      const modeloVazio: ResumoMembro = {
        membroNome: nomeCorreto,
        membroEmail,
        membroId,
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
        sobraFolhas: 0,
        sobraOpios: 0,
        sobraSeringas: 0,
        sobraAgulhas: 0,
        total: 0,
      };

      const isSemanaAtual = dataFarm >= semanaAtual;
      const isSemanaPassada = dataFarm >= semanaPassada && dataFarm < semanaAtual;

      if (isSemanaAtual) {
        listaFarmsSemanaAtual.push(farmCorrigido);

        if (!mapaAtual[chave]) {
          mapaAtual[chave] = { ...modeloVazio };
        }

        mapaAtual[chave].membroNome = nomeCorreto;
        mapaAtual[chave].folhas += Number(farm.folhas || 0);
        mapaAtual[chave].opios += Number(farm.opios || 0);
        mapaAtual[chave].seringas += Number(farm.seringas || 0);
        mapaAtual[chave].agulhas += Number(farm.agulhas || 0);
      }

      if (isSemanaPassada) {
        if (!mapaPassado[chave]) {
          mapaPassado[chave] = { ...modeloVazio };
        }

        mapaPassado[chave].membroNome = nomeCorreto;
        mapaPassado[chave].folhas += Number(farm.folhas || 0);
        mapaPassado[chave].opios += Number(farm.opios || 0);
        mapaPassado[chave].seringas += Number(farm.seringas || 0);
        mapaPassado[chave].agulhas += Number(farm.agulhas || 0);
      }
    });

    const todasChaves = new Set([
      ...Object.keys(mapaAtual),
      ...Object.keys(mapaPassado),
    ]);

    const lista = Array.from(todasChaves).map((chave) => {
      const atual = mapaAtual[chave];
      const passado = mapaPassado[chave];

      const base = atual || passado;

      const sobraFolhas = Math.max((passado?.folhas || 0) - META_FOLHAS, 0);
      const sobraOpios = Math.max((passado?.opios || 0) - META_OPIOS, 0);
      const sobraSeringas = Math.max(
        (passado?.seringas || 0) - META_SERINGAS,
        0
      );
      const sobraAgulhas = Math.max(
        (passado?.agulhas || 0) - META_AGULHAS,
        0
      );

      const folhas = (atual?.folhas || 0) + sobraFolhas;
      const opios = (atual?.opios || 0) + sobraOpios;
      const seringas = (atual?.seringas || 0) + sobraSeringas;
      const agulhas = (atual?.agulhas || 0) + sobraAgulhas;

      return {
        membroNome: base?.membroNome || "Sem nome",
        membroEmail: base?.membroEmail || "",
        membroId: base?.membroId || "",
        folhas,
        opios,
        seringas,
        agulhas,
        sobraFolhas,
        sobraOpios,
        sobraSeringas,
        sobraAgulhas,
        total: folhas + opios + seringas + agulhas,
      };
    });

    lista.sort((a, b) => b.total - a.total);

    setResumo(lista);
    setFarms(listaFarmsSemanaAtual);
  }

  function bateuMeta(membro: ResumoMembro) {
    return (
      membro.folhas >= META_FOLHAS &&
      membro.opios >= META_OPIOS &&
      membro.seringas >= META_SERINGAS &&
      membro.agulhas >= META_AGULHAS
    );
  }

  function statusMeta(membro: ResumoMembro) {
    return bateuMeta(membro) ? "✅ Meta batida" : "⚠️ Falta farm";
  }

  function pendenciasMeta(membro: ResumoMembro) {
    const faltas = [];

    if (membro.folhas < META_FOLHAS) {
      faltas.push(`Folhas: falta ${META_FOLHAS - membro.folhas}`);
    }

    if (membro.opios < META_OPIOS) {
      faltas.push(`Ópios: falta ${META_OPIOS - membro.opios}`);
    }

    if (membro.seringas < META_SERINGAS) {
      faltas.push(`Seringas: falta ${META_SERINGAS - membro.seringas}`);
    }

    if (membro.agulhas < META_AGULHAS) {
      faltas.push(`Agulhas: falta ${META_AGULHAS - membro.agulhas}`);
    }

    return faltas.join(" | ");
  }

  function farmsDoMembro() {
    if (!membroSelecionado) return [];

    return farms
      .filter((farm) => {
        const chaveFarm = farm.membroId || farm.membroEmail || farm.membroNome;
        const chaveMembro =
          membroSelecionado.membroId ||
          membroSelecionado.membroEmail ||
          membroSelecionado.membroNome;

        return chaveFarm === chaveMembro;
      })
      .sort((a, b) => {
        const dataA = a.criadoEm?.toDate?.()?.getTime?.() || 0;
        const dataB = b.criadoEm?.toDate?.()?.getTime?.() || 0;
        return dataB - dataA;
      });
  }

  const bateramMeta = resumo.filter((membro) => bateuMeta(membro));
  const naoBateramMeta = resumo.filter((membro) => !bateuMeta(membro));
  const listaFarmsMembro = farmsDoMembro();
  const ultimoFarm = listaFarmsMembro[0];

  function gerarPDFMetas() {
    const pdf = new jsPDF();

    const totalMembros = resumo.length;
    const totalBateram = bateramMeta.length;
    const totalNaoBateram = naoBateramMeta.length;
    const percentual =
      totalMembros > 0 ? ((totalBateram / totalMembros) * 100).toFixed(2) : "0";

    let y = 18;

    pdf.setFontSize(18);
    pdf.text("RELATORIO DE METAS - CONTROLE DE FARM", 14, y);

    y += 10;
    pdf.setFontSize(11);
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, y);

    y += 10;
    pdf.text(`Total de membros: ${totalMembros}`, 14, y);
    y += 7;
    pdf.text(`Bateram a meta: ${totalBateram}`, 14, y);
    y += 7;
    pdf.text(`Nao bateram a meta: ${totalNaoBateram}`, 14, y);
    y += 7;
    pdf.text(`Conclusao: ${percentual}%`, 14, y);

    y += 12;
    pdf.setFontSize(15);
    pdf.text("BATERAM A META", 14, y);

    y += 8;
    pdf.setFontSize(11);

    bateramMeta.forEach((membro, index) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(`${index + 1}. ${membro.membroNome}`, 14, y);
      y += 7;
    });

    y += 8;

    if (y > 260) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFontSize(15);
    pdf.text("NAO BATERAM A META", 14, y);

    y += 8;
    pdf.setFontSize(11);

    naoBateramMeta.forEach((membro, index) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(`${index + 1}. ${membro.membroNome}`, 14, y);
      y += 6;

      pdf.setFontSize(9);
      pdf.text(pendenciasMeta(membro), 18, y);
      pdf.setFontSize(11);
      y += 8;
    });

    pdf.save("relatorio-metas-farm.pdf");
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
          <h1 className="text-4xl font-black text-red-600">
            Controle de Farm
          </h1>

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
            Apenas Líder, Vice-Líder, Gerente Geral, Gerente de Farm ou Gerente de Produção podem acessar esta área.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-10 text-white">
      <h1 className="text-5xl font-black text-red-600">
        🌿 CONTROLE DE FARM
      </h1>

      <button
        onClick={gerarPDFMetas}
        className="mt-6 rounded-xl bg-red-700 px-6 py-3 font-black text-white hover:bg-red-600"
      >
        📄 Gerar PDF das Metas
      </button>

      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-green-700 bg-zinc-950 p-6">
          <h2 className="text-3xl font-black text-green-400">
            ✅ Bateram a meta
          </h2>

          <p className="mt-2 text-zinc-400">Total: {bateramMeta.length}</p>

          <div className="mt-4 grid gap-3">
            {bateramMeta.length === 0 ? (
              <p className="text-zinc-500">Ninguém bateu a meta ainda.</p>
            ) : (
              bateramMeta.map((membro) => (
                <div
                  key={membro.membroId || membro.membroEmail || membro.membroNome}
                  className="rounded-lg bg-green-950 p-3 font-bold text-green-300"
                >
                  ✅ {membro.membroNome}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-yellow-700 bg-zinc-950 p-6">
          <h2 className="text-3xl font-black text-yellow-400">
            ❌ Não bateram a meta
          </h2>

          <p className="mt-2 text-zinc-400">Total: {naoBateramMeta.length}</p>

          <div className="mt-4 grid gap-3">
            {naoBateramMeta.length === 0 ? (
              <p className="text-zinc-500">Todos bateram a meta.</p>
            ) : (
              naoBateramMeta.map((membro) => (
                <div
                  key={membro.membroId || membro.membroEmail || membro.membroNome}
                  className="rounded-lg bg-yellow-950 p-3"
                >
                  <p className="font-bold text-yellow-300">
                    ❌ {membro.membroNome}
                  </p>

                  <p className="mt-1 text-sm text-yellow-200">
                    {pendenciasMeta(membro)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
        <h2 className="text-3xl font-bold">Resumo dos Membros</h2>

        {resumo.length === 0 ? (
          <p className="mt-4 text-zinc-400">
            Nenhum farm aprovado encontrado nesta semana.
          </p>
        ) : (
          <div className="mt-6 grid gap-4">
            {resumo.map((membro, index) => (
              <div
                key={membro.membroId || membro.membroEmail || membro.membroNome}
                className="rounded-xl border border-zinc-800 bg-black p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-black">
                      {index === 0
                        ? "🥇"
                        : index === 1
                        ? "🥈"
                        : index === 2
                        ? "🥉"
                        : `#${index + 1}`}{" "}
                      {membro.membroNome}
                    </h3>

                    <p className="mt-1 text-zinc-400">
                      {membro.membroEmail}
                    </p>

                    <p className="mt-2 font-bold text-red-400">
                      {statusMeta(membro)}
                    </p>

                    {(membro.sobraFolhas > 0 ||
                      membro.sobraOpios > 0 ||
                      membro.sobraSeringas > 0 ||
                      membro.sobraAgulhas > 0) && (
                      <p className="mt-2 text-sm font-bold text-green-400">
                        Sobra da semana passada: 🍃 {membro.sobraFolhas} | 💊{" "}
                        {membro.sobraOpios} | 💉 {membro.sobraSeringas} | 🪡{" "}
                        {membro.sobraAgulhas}
                      </p>
                    )}

                    <button
                      onClick={() => setMembroSelecionado(membro)}
                      className="mt-4 rounded bg-red-700 px-4 py-2 font-bold hover:bg-red-600"
                    >
                      Ver Perfil Farm
                    </button>
                  </div>

                  <div className="grid gap-3 text-right md:grid-cols-5">
                    <div>
                      <p className="text-sm text-zinc-400">Folhas</p>
                      <p className="text-xl font-black">{membro.folhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Ópios</p>
                      <p className="text-xl font-black">{membro.opios}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Seringas</p>
                      <p className="text-xl font-black">{membro.seringas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Agulhas</p>
                      <p className="text-xl font-black">{membro.agulhas}</p>
                    </div>

                    <div>
                      <p className="text-sm text-zinc-400">Total</p>
                      <p className="text-xl font-black text-red-500">
                        {membro.total}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {membroSelecionado && (
        <section className="mt-8 rounded-xl border border-red-900 bg-zinc-950 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black text-red-500">
              👤 {membroSelecionado.membroNome}
            </h2>

            <button
              onClick={() => setMembroSelecionado(null)}
              className="rounded bg-zinc-800 px-4 py-2 font-bold hover:bg-zinc-700"
            >
              Fechar
            </button>
          </div>

          <p className="mt-2 text-zinc-400">
            {membroSelecionado.membroEmail}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">🍃 Folhas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.folhas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">💊 Ópios</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.opios}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">💉 Seringas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.seringas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">🪡 Agulhas</p>
              <h3 className="text-2xl font-black">
                {membroSelecionado.agulhas}
              </h3>
            </div>

            <div className="rounded bg-black p-4">
              <p className="text-zinc-400">📦 Total</p>
              <h3 className="text-2xl font-black text-red-500">
                {membroSelecionado.total}
              </h3>
            </div>
          </div>

          <div className="mt-6 rounded bg-black p-4">
            <p className="font-bold">
              🎯 Status: {statusMeta(membroSelecionado)}
            </p>

            <p className="mt-2">
              🕒 Último farm da semana:{" "}
              {ultimoFarm ? formatarData(ultimoFarm.criadoEm) : "Sem farm"}
            </p>

            <p className="mt-2">
              🖼️ Prints enviados nesta semana: {listaFarmsMembro.length}
            </p>

            <p className="mt-2 text-green-400">
              Sobra carregada: 🍃 {membroSelecionado.sobraFolhas} | 💊{" "}
              {membroSelecionado.sobraOpios} | 💉{" "}
              {membroSelecionado.sobraSeringas} | 🪡{" "}
              {membroSelecionado.sobraAgulhas}
            </p>
          </div>

          <h3 className="mt-8 text-2xl font-bold">📸 Prints da semana</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {listaFarmsMembro.length === 0 ? (
              <p className="text-zinc-400">
                Nenhum print encontrado nesta semana.
              </p>
            ) : (
              listaFarmsMembro.map((farm) => (
                <div
                  key={farm.id}
                  className="rounded-xl border border-zinc-800 bg-black p-4"
                >
                  <p>🍃 Folhas: {farm.folhas}</p>
                  <p>💊 Ópios: {farm.opios}</p>
                  <p>💉 Seringas: {farm.seringas}</p>
                  <p>🪡 Agulhas: {farm.agulhas}</p>

                  <p className="mt-2 text-zinc-400">
                    Data: {formatarData(farm.criadoEm)}
                  </p>

                  {farm.print && (
                    <img
                      src={farm.print}
                      alt="Print do farm"
                      onClick={() => setImagemAberta(farm.print || "")}
                      className="mt-3 h-40 w-full cursor-pointer rounded border border-zinc-700 object-contain transition hover:scale-105"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {imagemAberta && (
        <div
          onClick={() => setImagemAberta(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          <button
            onClick={() => setImagemAberta(null)}
            className="absolute right-6 top-6 rounded bg-red-700 px-4 py-2 text-xl font-black text-white hover:bg-red-600"
          >
            ✕
          </button>

          <img
            src={imagemAberta}
            alt="Print aberto"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
          />
        </div>
      )}
    </main>
  );
}