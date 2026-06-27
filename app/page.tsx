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
  folhas: number;
  opios: number;
  seringas: number;
  agulhas: number;
  status: string;
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

  const progressoFolhas = Math.min(folhasMeta, 2000);
  const progressoOpios = Math.min(opiosMeta, 2000);
  const progressoSeringas = Math.min(seringasMeta, 800);
  const progressoAgulhas = Math.min(agulhasMeta, 800);  const totalFarm =
    progressoFolhas +
    progressoOpios +
    progressoSeringas +
    progressoAgulhas;

  const totalMeta = 2000 + 2000 + 800 + 800;

  const porcentagemMeta = isElite
    ? 100
    : Math.min(100, Math.floor((totalFarm / totalMeta) * 100));

  const metaCompleta =
    folhasMeta >= 2000 &&
    opiosMeta >= 2000 &&
    seringasMeta >= 800 &&
    agulhasMeta >= 800;

  const statusMeta = isElite
    ? "ISENTO"
    : metaCompleta
    ? "META BATIDA"
    : "EM ANDAMENTO";

  function formatarMinutos(minutos: number) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return `${horas}h ${mins}m`;
  }

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

    const totalCadastros = membrosSnap.docs.filter((item) => {
      const membro = item.data() as Membro;
      return membro.status === "pendente";
    }).length;

    const totalFarms = farmSnap.docs.filter((item) => {
      const farm = item.data() as Farm;
      return farm.status === "pendente";
    }).length;

    const totalReembolsos = reembolsoSnap.docs.filter((item) => {
      const reembolso = item.data() as Reembolso;
      return reembolso.status === "pendente";
    }).length;

    setCadastrosPendentes(totalCadastros);
    setFarmsPendentes(totalFarms);
    setReembolsosPendentes(totalReembolsos);
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
  }  async function iniciarPlantao() {
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

        setAvisos([
          {
            id: "principal",
            texto: dados.texto,
          },
        ]);
      } else {
        setAvisos([]);
      }
    }

    async function buscarMinhaMeta() {
      if (!session?.user) return;

      const discordId = (session.user as any).id;
      if (!discordId) return;

      const snapshot = await getDocs(
        query(collection(db, "farm"), where("status", "==", "aprovado"))
      );

      let minhasFolhas = 0;
      let meusOpios = 0;
      let minhasSeringas = 0;
      let minhasAgulhas = 0;

      snapshot.docs.forEach((item) => {
        const farm = item.data() as Farm;

        if (farm.membroId === discordId) {
          minhasFolhas += farm.folhas || 0;
          meusOpios += farm.opios || 0;
          minhasSeringas += farm.seringas || 0;
          minhasAgulhas += farm.agulhas || 0;
        }
      });

      setFolhasMeta(minhasFolhas);
      setOpiosMeta(meusOpios);
      setSeringasMeta(minhasSeringas);
      setAgulhasMeta(minhasAgulhas);
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
  }  if (!session) {
    return (
      <main className="min-h-screen bg-black">
        <div className="mx-auto max-w-7xl p-6">
          <Image
            src="/banner.png"
            alt="Tropa da Inglaterra"
            width={1400}
            height={700}
            className="w-full rounded-2xl border border-red-900"
            priority
          />

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => signIn("discord")}
              className="rounded-xl bg-red-700 px-10 py-5 text-xl font-bold text-white hover:bg-red-600"
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
        <h1 className="text-4xl">Carregando...</h1>
      </main>
    );
  }

  if (membro.status === "cadastro") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-xl rounded-2xl border border-red-900 bg-zinc-950 p-8">
          <Image src="/logo.png" alt="Tropa da Inglaterra" width={130} height={130} className="mx-auto rounded-full" />

          <h1 className="mt-6 text-center text-4xl font-black text-red-600">
            CADASTRO NA INGLATERRA
          </h1>

          <p className="mt-4 text-center text-zinc-400">
            Discord: <strong>{membro.nomeDiscord || membro.nome || membro.username || "Sem nome"}</strong>
          </p>

          <input value={nomeRP} onChange={(e) => setNomeRP(e.target.value)} placeholder="Nome RP na cidade" className="mt-6 w-full rounded bg-black p-4" />
          <input value={passaporte} onChange={(e) => setPassaporte(e.target.value)} placeholder="Passaporte" className="mt-4 w-full rounded bg-black p-4" />
          <input value={numeroBau} onChange={(e) => setNumeroBau(e.target.value)} placeholder="Número do Baú" className="mt-4 w-full rounded bg-black p-4" />

          <button onClick={solicitarEntrada} className="mt-6 w-full rounded-xl bg-red-700 px-6 py-4 font-bold hover:bg-red-600">
            Solicitar Entrada
          </button>

          <button onClick={() => signOut()} className="mt-3 w-full rounded-xl border border-red-900 px-6 py-3 font-bold">
            Sair
          </button>
        </div>
      </main>
    );
  }

  if (membro.status === "pendente") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="max-w-xl rounded-2xl border border-red-900 bg-zinc-950 p-8 text-center">
          <Image src="/logo.png" alt="Tropa da Inglaterra" width={140} height={140} className="mx-auto rounded-full" />

          <h1 className="mt-6 text-4xl font-black text-red-600">
            AGUARDANDO APROVAÇÃO
          </h1>

          <p className="mt-4 text-xl">Nome RP: <strong>{membro.nomeRP}</strong></p>
          <p className="mt-2 text-xl">Passaporte: <strong>{membro.passaporte}</strong></p>
          <p className="mt-2 text-xl">Baú: <strong>{membro.numeroBau}</strong></p>

          <p className="mt-4 text-zinc-400">
            Aguarde um Gerente, Vice-Líder ou Líder aprovar seu acesso.
          </p>

          <button onClick={() => signOut()} className="mt-6 rounded-xl bg-red-700 px-6 py-3 font-bold hover:bg-red-600">
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-5 text-white">
      <section className="mx-auto max-w-7xl">
        <Image src="/banner.png" alt="Tropa da Inglaterra" width={1400} height={700} className="mb-5 w-full rounded-2xl border border-red-900" priority />

        <section className="mt-5 grid gap-5 md:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-8 text-center">
              <Image src="/logo.png" alt="Logo" width={130} height={130} className="mx-auto rounded-full" />
              <p className="mt-3 text-xl font-black text-red-500">TROPA DA INGLATERRA</p>
            </div>

            <nav className="space-y-2">
              <Link href="/" className="block rounded-lg bg-red-800 px-4 py-3 font-bold">🏠 INÍCIO</Link>
              <Link href="/metas" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🎯 METAS</Link>
              <Link href="/farm" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">📦 FARM</Link>

              {podeVerAdmin && (
                <>
                  <Link href="/controle-farm" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🌿 CONTROLE FARM</Link>
                  <Link href="/compras" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🛒 COMPRAS</Link>
                  <Link href="/contatos" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">📞 CONTATOS</Link>
                  <Link href="/programacao-semanal" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">📅 PROGRAMAÇÃO</Link>
                  <Link href="/vendas" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">💰 VENDAS</Link>
                  <Link href="/producao" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🏭 PRODUÇÃO</Link>
                  <Link href="/reembolso" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">💸 REEMBOLSO</Link>
                </>
              )}

              <Link href="/ranking" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🏆 RANKING</Link>
              <Link href="/membros" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">👥 MEMBROS</Link>

              {podeVerAdmin && (
                <>
                  <Link href="/acoes" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">🎯 AÇÕES</Link>
                  <Link href="/relatorio" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">📊 RELATÓRIO</Link>
                  <Link href="/admin" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">⚙️ ADMIN</Link>
                </>
              )}
            </nav>

            <button onClick={() => signOut()} className="mt-6 w-full rounded-xl bg-red-700 px-4 py-3 font-bold hover:bg-red-600">
              Sair
            </button>
          </aside>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="rounded-xl border border-red-950 bg-black p-6">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-black text-red-500">BEM-VINDO(A)!</p>
                  <h3 className="mt-2 text-3xl font-black">{nomeExibicao(membro)}</h3>
                  <p className="mt-2 text-zinc-400">Passaporte: {membro.passaporte || "Não informado"}</p>
                  <p className="mt-1 text-zinc-400">Baú: {membro.numeroBau || "Não informado"}</p>
                  <span className="mt-3 inline-block rounded-full bg-red-800 px-4 py-1 text-sm">{membro.cargo}</span>
                </div>

                <div className="rounded-xl border border-red-900 bg-zinc-950 p-4 text-center">
                  <p className="text-sm font-bold text-zinc-400">REGISTRO DE HORAS</p>
                  <p className="mt-2 text-xl font-black">{plantaoAberto ? "🟢 Em plantão" : "⚪ Fora da cidade"}</p>

                  <div className="mt-4 flex gap-3">
                    <button onClick={iniciarPlantao} disabled={!!plantaoAberto} className="rounded-lg bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-600 disabled:opacity-40">
                      🟢 Entrada
                    </button>

                    <button onClick={encerrarPlantao} disabled={!plantaoAberto} className="rounded-lg bg-red-700 px-5 py-3 font-bold text-white hover:bg-red-600 disabled:opacity-40">
                      🔴 Saída
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Card titulo="HORAS NA CIDADE" valor={formatarMinutos(totalMinutosPlantao)} desc="TOTAL REGISTRADO" />

              {!isElite && (
                <Card titulo="STATUS DA META" valor={`${porcentagemMeta}%`} desc={statusMeta} />
              )}
            </div>

           {podeVerAdmin && (
              <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
                <h2 className="mb-4 text-2xl font-black text-red-500">
                  ⚠️ PENDÊNCIAS DA GERÊNCIA
                </h2>

                <div className="grid gap-4 md:grid-cols-3">
                  <Link href="/admin">
                    <Card titulo="CADASTROS PENDENTES" valor={String(cadastrosPendentes)} desc="AGUARDANDO APROVAÇÃO" />
                  </Link>

                  <Link href="/admin">
                    <Card titulo="FARMS PENDENTES" valor={String(farmsPendentes)} desc="AGUARDANDO APROVAÇÃO" />
                  </Link>

                  <Link href="/reembolso">
                    <Card titulo="REEMBOLSOS PENDENTES" valor={String(reembolsosPendentes)} desc="AGUARDANDO PAGAMENTO" />
                  </Link>
                </div>

                {(cargoLimpo === "Líder" ||
  cargoLimpo === "Vice-Líder" ||
  cargoLimpo === "Gerente de Farm") && (
  <div className="mt-5 rounded-xl border border-yellow-700 bg-zinc-950 p-5 text-center">
    <h3 className="text-xl font-black text-yellow-400">
      📩 ALERTAS INDIVIDUAIS
    </h3>

    <p className="mt-2 text-sm text-zinc-400">
      Envia DM para quem não bateu meta, quem não se cadastrou e parabéns para quem bateu.
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
  </div>
)}

</section>
)}

            {!isElite && (
              <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
                <h2 className="text-2xl font-black text-red-500">🎯 META SEMANAL</h2>

                <p className="mt-4 text-center text-6xl font-black text-green-400">
                  {porcentagemMeta}%
                </p>

                <div className="mt-5 h-5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-5 bg-green-500 transition-all" style={{ width: `${porcentagemMeta}%` }} />
                </div>

                <p className="mt-4 text-center text-xl font-bold text-zinc-300">
                  {statusMeta}
                </p>
              </section>
            )}

            {isElite && (
              <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
                <h2 className="text-2xl font-black text-red-500">⚔️ ELITE DE AÇÕES</h2>
                <p className="mt-3 text-zinc-300">
                  Você está marcado como Elite/Gerente de Ações e não precisa bater meta de farm semanal.
                </p>
              </section>
            )}

            <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
              <h2 className="mb-4 text-2xl font-black text-red-500">📢 AVISOS DA INGLATERRA</h2>

              {avisos.length === 0 && (
                <p className="text-zinc-400">Nenhum aviso publicado ainda.</p>
              )}

              <div className="grid gap-3">
                {avisos.map((aviso) => (
                  <div key={aviso.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <p className="text-zinc-200">{aviso.texto}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
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
    <div className="rounded-xl border border-red-950 bg-black p-5 text-center">
      <p className="text-sm text-zinc-400">{titulo}</p>
      <h3 className="mt-2 text-2xl font-black">{valor}</h3>
      <p className="mt-2 text-xs text-zinc-500">{desc}</p>
    </div>
  );
}