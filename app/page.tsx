"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./lib/firebase";

type Membro = {
  nome: string;
  email: string;
  discordId: string;
  nomeDiscord?: string;
  username?: string;
  nomeRP?: string;
  passaporte?: string;
  numeroBau?: string;
  status: "cadastro" | "pendente" | "aprovado";
  cargo: string;
};

type Aviso = {
  id: string;
  texto: string;
};

type Farm = {
  membroId?: string;
  membroEmail?: string;
  membroNome?: string;
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
  criadoEm?: any;
};

type Reembolso = {
  status: string;
};

type Plantao = {
  id: string;
  nome: string;
  email: string;
  inicio: any;
  fim?: any;
  minutos?: number;
  status: "aberto" | "fechado";
};

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function nomeExibicao(membro: Membro | null) {
  if (!membro) return "Sem nome";

  return (
    membro.nomeRP ||
    membro.nomeDiscord ||
    membro.nome ||
    membro.username ||
    "Sem nome"
  );
}

function inicioSemanaAtualDate() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const diferenca = dia === 0 ? 6 : dia - 1;

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - diferenca);
  inicio.setHours(0, 0, 0, 0);

  return inicio;
}

function inicioSemanaPassadaDate() {
  const atual = inicioSemanaAtualDate();
  const passada = new Date(atual);
  passada.setDate(atual.getDate() - 7);
  return passada;
}

function pegarData(valor: any) {
  if (!valor) return null;
  if (valor.toDate) return valor.toDate();
  if (valor.seconds) return new Date(valor.seconds * 1000);
  return new Date(valor);
}

function formatarMinutos(minutos: number) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${horas}h ${mins}m`;
}

function formatarNumero(valor: number) {
  return valor.toLocaleString("pt-BR");
}

export default function Home() {
  const { data: session } = useSession();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [nomeRP, setNomeRP] = useState("");
  const [passaporte, setPassaporte] = useState("");
  const [numeroBau, setNumeroBau] = useState("");

  const [folhasMeta, setFolhasMeta] = useState(0);
  const [opiosMeta, setOpiosMeta] = useState(0);
  const [seringasMeta, setSeringasMeta] = useState(0);
  const [agulhasMeta, setAgulhasMeta] = useState(0);

  const [plantaoAberto, setPlantaoAberto] = useState<Plantao | null>(null);
  const [totalMinutosPlantao, setTotalMinutosPlantao] = useState(0);

  const [cadastrosPendentes, setCadastrosPendentes] = useState(0);
  const [farmsPendentes, setFarmsPendentes] = useState(0);
  const [reembolsosPendentes, setReembolsosPendentes] = useState(0);

  const [enviandoAlertas, setEnviandoAlertas] = useState(false);

  const cargoLimpo = membro?.cargo?.trim();

  const isElite = cargoLimpo === "Elite" || cargoLimpo === "Gerente de Ações";

  const podeVerAdmin =
    cargoLimpo === "Líder" ||
    cargoLimpo === "Vice-Líder" ||
    cargoLimpo === "Gerente Geral" ||
    cargoLimpo === "Gerente de Farm" ||
    cargoLimpo === "Gerente de Compras" ||
    cargoLimpo === "Gerente de Vendas" ||
    cargoLimpo === "Gerente de Produção" ||
    cargoLimpo === "Gerente de Ações";

  const podeEnviarAlertas =
    cargoLimpo === "Líder" ||
    cargoLimpo === "Vice-Líder" ||
    cargoLimpo === "Gerente de Farm";

  const progressoFolhas = Math.min(folhasMeta, META_FOLHAS);
  const progressoOpios = Math.min(opiosMeta, META_OPIOS);
  const progressoSeringas = Math.min(seringasMeta, META_SERINGAS);
  const progressoAgulhas = Math.min(agulhasMeta, META_AGULHAS);

  const totalFarm =
    progressoFolhas +
    progressoOpios +
    progressoSeringas +
    progressoAgulhas;

  const totalMeta = 5600;

  const porcentagemMeta = isElite
    ? 100
    : Math.min(100, Math.floor((totalFarm / totalMeta) * 100));

  const metaCompleta =
    folhasMeta >= META_FOLHAS &&
    opiosMeta >= META_OPIOS &&
    seringasMeta >= META_SERINGAS &&
    agulhasMeta >= META_AGULHAS;

  async function enviarAlertasIndividuais() {
    const confirmar = confirm(
      "Tem certeza que deseja enviar os alertas individuais por DM no Discord?"
    );

    if (!confirmar) return;

    try {
      setEnviandoAlertas(true);

      const resposta = await fetch("/api/discord/alertas-individuais", {
        method: "GET",
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        alert(dados?.erro || "Erro ao enviar alertas.");
        return;
      }

      alert(
        "Alertas enviados com sucesso!\n\n" +
          `Alertas de farm: ${dados.alertasFarm}\n` +
          `Alertas de cadastro: ${dados.alertasCadastro}\n` +
          `Parabéns enviados: ${dados.parabens}\n` +
          `Falhas: ${dados.falhas}\n` +
          `Isentos ignorados: ${dados.isentos}`
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar alertas individuais.");
    } finally {
      setEnviandoAlertas(false);
    }
  }

  async function buscarPendenciasGerencia() {
    const membrosSnap = await getDocs(collection(db, "membros"));
    const farmSnap = await getDocs(collection(db, "farm"));
    const reembolsoSnap = await getDocs(collection(db, "reembolsos"));

    setCadastrosPendentes(
      membrosSnap.docs.filter((item) => {
        const dados = item.data() as Membro;
        return dados.status === "pendente";
      }).length
    );

    setFarmsPendentes(
      farmSnap.docs.filter((item) => {
        const dados = item.data() as Farm;
        return dados.status === "pendente";
      }).length
    );

    setReembolsosPendentes(
      reembolsoSnap.docs.filter((item) => {
        const dados = item.data() as Reembolso;
        return dados.status === "pendente";
      }).length
    );
  }

  async function buscarPlantoes() {
    if (!session?.user?.email) return;

    const q = query(
      collection(db, "plantoes"),
      where("email", "==", session.user.email)
    );

    const snapshot = await getDocs(q);

    const lista = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as Plantao[];

    const aberto = lista.find((p) => p.status === "aberto");
    setPlantaoAberto(aberto || null);

    const total = lista
      .filter((p) => p.status === "fechado")
      .reduce((soma, p) => soma + (p.minutos || 0), 0);

    setTotalMinutosPlantao(total);
  }

  async function iniciarPlantao() {
    if (!session?.user || !membro) return;

    if (plantaoAberto) {
      alert("Você já está com entrada aberta.");
      return;
    }

    await addDoc(collection(db, "plantoes"), {
      nome: nomeExibicao(membro),
      email: session.user.email || "",
      inicio: Timestamp.now(),
      status: "aberto",
    });

    await buscarPlantoes();
  }

  async function encerrarPlantao() {
    if (!plantaoAberto) {
      alert("Você não tem entrada aberta.");
      return;
    }

    const agora = Timestamp.now();

    const inicioMillis = plantaoAberto.inicio.toDate().getTime();
    const fimMillis = agora.toDate().getTime();

    const minutos = Math.max(1, Math.floor((fimMillis - inicioMillis) / 60000));

    await updateDoc(doc(db, "plantoes", plantaoAberto.id), {
      fim: agora,
      minutos,
      status: "fechado",
    });

    await buscarPlantoes();
  }

  useEffect(() => {
    async function buscarMembro() {
      if (!session?.user) return;

      const discordId = (session.user as any).id;
      if (!discordId) return;

      const membroRef = doc(db, "membros", discordId);
      const membroSnap = await getDoc(membroRef);

      if (!membroSnap.exists()) {
        const novoMembro: Membro = {
          nome: session.user.name || "Sem nome",
          nomeDiscord: session.user.name || "Sem nome",
          username: session.user.name || "Sem nome",
          email: session.user.email || "",
          discordId,
          nomeRP: "",
          passaporte: "",
          numeroBau: "",
          status: "cadastro",
          cargo: "Nenhum",
        };

        await setDoc(membroRef, novoMembro);
        setMembro(novoMembro);
      } else {
        setMembro(membroSnap.data() as Membro);
      }
    }

    async function buscarAvisos() {
      const avisoSnap = await getDoc(doc(db, "avisos", "principal"));

      if (avisoSnap.exists()) {
        const dados = avisoSnap.data() as Omit<Aviso, "id">;
        setAvisos([{ id: "principal", texto: dados.texto }]);
      } else {
        setAvisos([]);
      }
    }

    async function buscarMinhaMeta() {
      if (!session?.user) return;

      const discordId = (session.user as any).id;
      const emailLogado = session.user.email || "";

      if (!discordId) return;

      const membroSnap = await getDoc(doc(db, "membros", discordId));
      const membroAtual = membroSnap.exists()
        ? (membroSnap.data() as Membro)
        : null;

      const inicioAtual = inicioSemanaAtualDate();
      const inicioPassada = inicioSemanaPassadaDate();

      const snapshot = await getDocs(
        query(collection(db, "farm"), where("status", "==", "aprovado"))
      );

      let semanaFolhas = 0;
      let semanaOpios = 0;
      let semanaSeringas = 0;
      let semanaAgulhas = 0;

      let passadaFolhas = 0;
      let passadaOpios = 0;
      let passadaSeringas = 0;
      let passadaAgulhas = 0;

      snapshot.docs.forEach((item) => {
        const farm = item.data() as Farm;

        const dataFarm = pegarData(farm.criadoEm);
        if (!dataFarm) return;

        const pertenceAoUsuario =
          farm.membroId === discordId ||
          farm.membroEmail === emailLogado ||
          farm.membroNome === membroAtual?.nomeRP ||
          farm.membroNome === membroAtual?.nome ||
          farm.membroNome === membroAtual?.nomeDiscord ||
          farm.membroNome === membroAtual?.username;

        if (!pertenceAoUsuario) return;

        const ehSemanaAtual = dataFarm >= inicioAtual;
        const ehSemanaPassada =
          dataFarm >= inicioPassada && dataFarm < inicioAtual;

        if (ehSemanaAtual) {
          semanaFolhas += farm.folhas || 0;
          semanaOpios += farm.opios || 0;
          semanaSeringas += farm.seringas || 0;
          semanaAgulhas += farm.agulhas || 0;
        }

        if (ehSemanaPassada) {
          passadaFolhas += farm.folhas || 0;
          passadaOpios += farm.opios || 0;
          passadaSeringas += farm.seringas || 0;
          passadaAgulhas += farm.agulhas || 0;
        }
      });

      const sobraFolhas = Math.max(passadaFolhas - META_FOLHAS, 0);
      const sobraOpios = Math.max(passadaOpios - META_OPIOS, 0);
      const sobraSeringas = Math.max(passadaSeringas - META_SERINGAS, 0);
      const sobraAgulhas = Math.max(passadaAgulhas - META_AGULHAS, 0);

      setFolhasMeta(semanaFolhas + sobraFolhas);
      setOpiosMeta(semanaOpios + sobraOpios);
      setSeringasMeta(semanaSeringas + sobraSeringas);
      setAgulhasMeta(semanaAgulhas + sobraAgulhas);
    }

    buscarMembro();
    buscarAvisos();
    buscarMinhaMeta();
    buscarPlantoes();
    buscarPendenciasGerencia();
  }, [session]);

  async function solicitarEntrada() {
    if (!session?.user) return;

    const discordId = (session.user as any).id;

    if (!nomeRP || !passaporte || !numeroBau) {
      alert("Preencha Nome RP, Passaporte e Número do Baú.");
      return;
    }

    const membroAtualizado: Membro = {
      nome: session.user.name || "Sem nome",
      nomeDiscord: session.user.name || "Sem nome",
      username: session.user.name || "Sem nome",
      email: session.user.email || "",
      discordId,
      nomeRP,
      passaporte,
      numeroBau,
      status: "pendente",
      cargo: "Nenhum",
    };

    await setDoc(doc(db, "membros", discordId), membroAtualizado, {
      merge: true,
    });

    setMembro(membroAtualizado);
    alert("Solicitação enviada! Aguarde aprovação.");
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto max-w-7xl p-6">
          <Image
            src="/banner.png"
            alt="Tropa da Inglaterra"
            width={1400}
            height={700}
            className="w-full rounded-2xl border border-red-900 shadow-2xl shadow-red-950/40"
            priority
          />

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => signIn("discord")}
              className="rounded-xl bg-red-700 px-10 py-5 text-xl font-black text-white shadow-lg shadow-red-950/50 hover:bg-red-600"
            >
              🎮 ENTRAR COM DISCORD
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!membro) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        <h1 className="text-4xl font-black text-red-500">Carregando...</h1>
      </main>
    );
  }

  if (membro.status === "cadastro") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-red-900 bg-zinc-950 p-8 shadow-2xl shadow-red-950/40">
          <Image
            src="/logo.png"
            alt="Tropa da Inglaterra"
            width={130}
            height={130}
            className="mx-auto rounded-full"
          />

          <h1 className="mt-6 text-center text-4xl font-black text-red-600">
            CADASTRO NA INGLATERRA
          </h1>

          <p className="mt-4 text-center text-zinc-400">
            Discord:{" "}
            <strong>
              {membro.nomeDiscord || membro.nome || membro.username || "Sem nome"}
            </strong>
          </p>

          <input
            value={nomeRP}
            onChange={(e) => setNomeRP(e.target.value)}
            placeholder="Nome RP na cidade"
            className="mt-6 w-full rounded-xl border border-red-950 bg-black p-4 outline-none focus:border-red-600"
          />

          <input
            value={passaporte}
            onChange={(e) => setPassaporte(e.target.value)}
            placeholder="Passaporte"
            className="mt-4 w-full rounded-xl border border-red-950 bg-black p-4 outline-none focus:border-red-600"
          />

          <input
            value={numeroBau}
            onChange={(e) => setNumeroBau(e.target.value)}
            placeholder="Número do Baú"
            className="mt-4 w-full rounded-xl border border-red-950 bg-black p-4 outline-none focus:border-red-600"
          />

          <button
            onClick={solicitarEntrada}
            className="mt-6 w-full rounded-xl bg-red-700 px-6 py-4 font-black hover:bg-red-600"
          >
            Solicitar Entrada
          </button>

          <button
            onClick={() => signOut()}
            className="mt-3 w-full rounded-xl border border-red-900 px-6 py-3 font-black"
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  if (membro.status === "pendente") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="max-w-xl rounded-2xl border border-red-900 bg-zinc-950 p-8 text-center shadow-2xl shadow-red-950/40">
          <Image
            src="/logo.png"
            alt="Tropa da Inglaterra"
            width={140}
            height={140}
            className="mx-auto rounded-full"
          />

          <h1 className="mt-6 text-4xl font-black text-red-600">
            AGUARDANDO APROVAÇÃO
          </h1>

          <p className="mt-4 text-xl">
            Nome RP: <strong>{membro.nomeRP}</strong>
          </p>

          <p className="mt-2 text-xl">
            Passaporte: <strong>{membro.passaporte}</strong>
          </p>

          <p className="mt-2 text-xl">
            Baú: <strong>{membro.numeroBau}</strong>
          </p>

          <p className="mt-4 text-zinc-400">
            Aguarde um Gerente, Vice-Líder ou Líder aprovar seu acesso.
          </p>

          <button
            onClick={() => signOut()}
            className="mt-6 rounded-xl bg-red-700 px-6 py-3 font-black hover:bg-red-600"
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto grid min-h-screen max-w-[1850px] gap-6 p-6 lg:grid-cols-[280px_1fr_360px]">
        <aside className="rounded-3xl border border-red-900 bg-black/80 p-5">
          <div className="text-center">
            <Image
              src="/logo.png"
              alt="Logo"
              width={96}
              height={96}
              className="mx-auto rounded-full border border-red-800"
            />

            <h1 className="mt-4 text-xl font-black text-red-600">
              TROPA DA INGLATERRA
            </h1>

            <p className="text-xs text-zinc-500">Painel Operacional</p>
          </div>

          <nav className="mt-8 space-y-2">
            <Menu href="/" ativo texto="🏠 Início" />
            <Menu href="/metas" texto="🎯 Metas" />
            <Menu href="/farm" texto="🌿 Farm" />

            {podeVerAdmin && (
              <>
                <div className="my-4 border-t border-zinc-800" />

                <Menu href="/controle-farm" texto="📋 Controle de Farm" />
                <Menu href="/compras" texto="🛒 Compras" />
                <Menu href="/contatos" texto="📞 Contatos" />
                <Menu href="/programacao-semanal" texto="📅 Programação" />
                <Menu href="/vendas" texto="💰 Vendas" />
                <Menu href="/producao" texto="🏭 Produção" />
                <Menu href="/reembolso" texto="💸 Reembolso" />
              </>
            )}

            <div className="my-4 border-t border-zinc-800" />

            <Menu href="/ranking" texto="🏆 Ranking" />
            <Menu href="/membros" texto="👥 Membros" />

            {podeVerAdmin && (
              <>
                <Menu href="/acoes" texto="⚔️ Ações" />
                <Menu href="/relatorio" texto="📊 Relatório" />
                <Menu href="/admin" texto="⚙️ Admin" />
              </>
            )}
          </nav>

          <button
            onClick={() => signOut()}
            className="mt-8 w-full rounded-2xl bg-red-700 py-3 font-black hover:bg-red-600"
          >
            Sair
          </button>
        </aside>

        <section className="space-y-5">
          <header className="flex items-center justify-between rounded-3xl border border-red-900 bg-black/80 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                Sistema de Gestão
              </p>

              <h2 className="text-3xl font-black tracking-wide text-white">
                PAINEL DA INGLATERRA
              </h2>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-5 py-4">
              <p className="text-lg font-bold text-white">
                {nomeExibicao(membro)}
              </p>

              <p className="text-sm text-zinc-400">{membro.cargo}</p>

              <p className="mt-1 text-xs text-zinc-500">
                Passaporte: {membro.passaporte || "--"}
              </p>

              <p className="text-xs text-zinc-500">
                Baú: {membro.numeroBau || "--"}
              </p>
            </div>
          </header>

          <section className="grid gap-5">
            <Card
              titulo="⏱️ Horas"
              valor={formatarMinutos(totalMinutosPlantao)}
              desc="Plantão total"
            />
          </section>

          {!isElite && (
            <section className="rounded-3xl border border-red-900 bg-black/80 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-red-500">
                    🎯 Minha Meta Semanal
                  </h2>

                  <p className="text-sm text-zinc-500">
                    Contando farms aprovados da semana atual + sobra da semana passada.
                  </p>
                </div>

                <p className="text-5xl font-black text-green-400">
                  {porcentagemMeta}%
                </p>
              </div>

              <div className="mt-5 h-5 w-full overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-5 bg-red-600 transition-all"
                  style={{ width: `${porcentagemMeta}%` }}
                />
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MiniMeta nome="Folhas" atual={folhasMeta} meta={META_FOLHAS} />
                <MiniMeta nome="Ópios" atual={opiosMeta} meta={META_OPIOS} />
                <MiniMeta
                  nome="Seringas"
                  atual={seringasMeta}
                  meta={META_SERINGAS}
                />
                <MiniMeta
                  nome="Agulhas"
                  atual={agulhasMeta}
                  meta={META_AGULHAS}
                />
              </div>
            </section>
          )}

          {isElite && (
            <section className="rounded-3xl border border-red-900 bg-black/80 p-6">
              <h2 className="text-2xl font-black text-red-500">
                ⚔️ Elite de Ações
              </h2>

              <p className="mt-3 text-zinc-300">
                Você está marcado como Elite/Gerente de Ações e não precisa bater
                meta de farm semanal.
              </p>
            </section>
          )}

          {podeEnviarAlertas && (
            <section className="rounded-3xl border border-yellow-700 bg-yellow-950/20 p-6 text-center">
              <h3 className="text-xl font-black text-yellow-400">
                📩 Alertas Individuais
              </h3>

              <p className="mt-2 text-sm text-zinc-400">
                Envia DM para quem não bateu meta, quem não se cadastrou e
                parabéns para quem bateu.
              </p>

              <button
                onClick={enviarAlertasIndividuais}
                disabled={enviandoAlertas}
                className="mt-4 w-full rounded-xl bg-yellow-600 px-6 py-4 font-black text-black hover:bg-yellow-500 disabled:opacity-50"
              >
                {enviandoAlertas
                  ? "Enviando alertas..."
                  : "📩 Enviar Alertas Individuais"}
              </button>
            </section>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">⏱️ Plantão</h3>

            <p className="mt-3 text-2xl font-black">
              {plantaoAberto ? "🟢 Em plantão" : "⚪ Fora da cidade"}
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              Total: {formatarMinutos(totalMinutosPlantao)}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={iniciarPlantao}
                disabled={!!plantaoAberto}
                className="rounded-xl bg-green-700 py-3 font-black hover:bg-green-600 disabled:opacity-40"
              >
                Entrada
              </button>

              <button
                onClick={encerrarPlantao}
                disabled={!plantaoAberto}
                className="rounded-xl bg-red-700 py-3 font-black hover:bg-red-600 disabled:opacity-40"
              >
                Saída
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">📢 Avisos</h3>

            {avisos.length === 0 && (
              <p className="mt-4 text-zinc-400">
                Nenhum aviso publicado ainda.
              </p>
            )}

            <div className="mt-4 grid gap-3">
              {avisos.map((aviso) => (
                <div
                  key={aviso.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <p className="text-zinc-200">{aviso.texto}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">⚠️ Pendências</h3>

            <div className="mt-4 space-y-3 text-sm text-zinc-300">
              <p>Cadastros pendentes: {cadastrosPendentes}</p>
              <p>Farms pendentes: {farmsPendentes}</p>
              <p>Reembolsos pendentes: {reembolsosPendentes}</p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Menu({
  href,
  texto,
  ativo = false,
}: {
  href: string;
  texto: string;
  ativo?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all duration-200 ${
        ativo
          ? "bg-red-700 text-white shadow-lg shadow-red-950/40"
          : "bg-zinc-950 text-zinc-400 hover:translate-x-1 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      {texto}
    </Link>
  );
}

function Card({
  titulo,
  valor,
  desc,
}: {
  titulo: string;
  valor: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-red-700 hover:shadow-xl hover:shadow-red-950/20">
      <p className="text-sm font-medium text-zinc-500">{titulo}</p>

      <h2 className="mt-3 text-4xl font-extrabold tracking-tight">{valor}</h2>

      <p className="mt-2 text-sm text-zinc-500">{desc}</p>
    </div>
  );
}

function MiniMeta({
  nome,
  atual,
  meta,
}: {
  nome: string;
  atual: number;
  meta: number;
}) {
  const porcentagem = Math.min(100, Math.floor((atual / meta) * 100));

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <p className="font-black text-zinc-300">{nome}</p>
        <p className="text-sm font-black text-red-400">{porcentagem}%</p>
      </div>

      <p className="mt-2 text-xl font-black">
        {formatarNumero(atual)}/{formatarNumero(meta)}
      </p>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="h-3 bg-red-600" style={{ width: `${porcentagem}%` }} />
      </div>
    </div>
  );
}