"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "./lib/firebase";

type Membro = {
  nome: string;
  email: string;
  discordId: string;
  nomeRP?: string;
  passaporte?: string;
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

export default function Home() {
  const { data: session } = useSession();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [nomeRP, setNomeRP] = useState("");
  const [passaporte, setPassaporte] = useState("");

  const [folhasMeta, setFolhasMeta] = useState(0);
  const [opiosMeta, setOpiosMeta] = useState(0);
  const [seringasMeta, setSeringasMeta] = useState(0);
  const [agulhasMeta, setAgulhasMeta] = useState(0);
  const [posicaoRanking, setPosicaoRanking] = useState("-");

  const cargoLimpo = membro?.cargo?.trim();

  const podeVerAdmin =
    cargoLimpo === "Gerente" ||
    cargoLimpo === "Vice-Líder" ||
    cargoLimpo === "Líder";

  const totalFarm = folhasMeta + opiosMeta + seringasMeta + agulhasMeta;
  const totalMeta = 2000 + 2000 + 800 + 800;

  const porcentagemMeta = Math.min(
    Math.round((totalFarm / totalMeta) * 100),
    100
  );

  const statusMeta = totalFarm >= totalMeta ? "META BATIDA" : "EM ANDAMENTO";

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
          email: session.user.email || "",
          discordId,
          nomeRP: "",
          passaporte: "",
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
      const snapshot = await getDocs(collection(db, "avisos"));

      const lista = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<Aviso, "id">),
      }));

      setAvisos(lista.reverse());
    }

    async function buscarMinhaMetaERanking() {
      if (!session?.user) return;

      const discordId = (session.user as any).id;
      if (!discordId) return;

      const snapshot = await getDocs(
        query(collection(db, "farm"), where("status", "==", "aprovado"))
      );

      const ranking: Record<string, number> = {};

      let minhasFolhas = 0;
      let meusOpios = 0;
      let minhasSeringas = 0;
      let minhasAgulhas = 0;

      snapshot.docs.forEach((item) => {
        const farm = item.data() as Farm;

        const total =
          (farm.folhas || 0) +
          (farm.opios || 0) +
          (farm.seringas || 0) +
          (farm.agulhas || 0);

        if (farm.membroId) {
          ranking[farm.membroId] = (ranking[farm.membroId] || 0) + total;
        }

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

      const rankingOrdenado = Object.entries(ranking).sort(
        (a, b) => b[1] - a[1]
      );

      const posicao = rankingOrdenado.findIndex(([id]) => id === discordId);

      setPosicaoRanking(posicao >= 0 ? `#${posicao + 1}` : "-");
    }

    buscarMembro();
    buscarAvisos();
    buscarMinhaMetaERanking();
  }, [session]);

  async function solicitarEntrada() {
    if (!session?.user) return;

    const discordId = (session.user as any).id;

    if (!nomeRP || !passaporte) {
      alert("Preencha Nome RP e Passaporte.");
      return;
    }

    const membroAtualizado: Membro = {
      nome: session.user.name || "Sem nome",
      email: session.user.email || "",
      discordId,
      nomeRP,
      passaporte,
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
            Discord: <strong>{membro.nome}</strong>
          </p>

          <input
            value={nomeRP}
            onChange={(e) => setNomeRP(e.target.value)}
            placeholder="Nome RP na cidade"
            className="mt-6 w-full rounded bg-black p-4"
          />

          <input
            value={passaporte}
            onChange={(e) => setPassaporte(e.target.value)}
            placeholder="Passaporte"
            className="mt-4 w-full rounded bg-black p-4"
          />

          <button
            onClick={solicitarEntrada}
            className="mt-6 w-full rounded-xl bg-red-700 px-6 py-4 font-bold hover:bg-red-600"
          >
            Solicitar Entrada
          </button>

          <button
            onClick={() => signOut()}
            className="mt-3 w-full rounded-xl border border-red-900 px-6 py-3 font-bold"
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
        <div className="max-w-xl rounded-2xl border border-red-900 bg-zinc-950 p-8 text-center">
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

          <p className="mt-4 text-zinc-400">
            Aguarde um Gerente, Vice-Líder ou Líder aprovar seu acesso.
          </p>

          <button
            onClick={() => signOut()}
            className="mt-6 rounded-xl bg-red-700 px-6 py-3 font-bold hover:bg-red-600"
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-5 text-white">
      <section className="mx-auto max-w-7xl">
        <Image
          src="/banner.png"
          alt="Tropa da Inglaterra"
          width={1400}
          height={700}
          className="mb-5 w-full rounded-2xl border border-red-900"
          priority
        />

        <section className="mt-5 grid gap-5 md:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-8 text-center">
              <Image
                src="/logo.png"
                alt="Logo"
                width={130}
                height={130}
                className="mx-auto rounded-full"
              />

              <p className="mt-3 text-xl font-black text-red-500">
                TROPA DA INGLATERRA
              </p>
            </div>

            <nav className="space-y-2">
              <Link href="/" className="block rounded-lg bg-red-800 px-4 py-3 font-bold">
                🏠 INÍCIO
              </Link>

              <Link href="/metas" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">
                🎯 METAS
              </Link>

              <Link href="/farm" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">
                📦 FARM
              </Link>

              <Link href="/ranking" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">
                🏆 RANKING
              </Link>

              <Link href="/membros" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">
                👥 MEMBROS
              </Link>

              {podeVerAdmin && (
                <Link href="/admin" className="block rounded-lg px-4 py-3 font-bold text-zinc-400 hover:bg-zinc-900">
                  ⚙️ ADMIN
                </Link>
              )}
            </nav>

            <button
              onClick={() => signOut()}
              className="mt-6 w-full rounded-xl bg-red-700 px-4 py-3 font-bold hover:bg-red-600"
            >
              Sair
            </button>
          </aside>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="rounded-xl border border-red-950 bg-black p-6">
              <p className="font-black text-red-500">BEM-VINDO(A)!</p>

              <h3 className="mt-2 text-3xl font-black">
                {membro.nomeRP || membro.nome}
              </h3>

              <p className="mt-2 text-zinc-400">
                Passaporte: {membro.passaporte || "Não informado"}
              </p>

              <span className="mt-3 inline-block rounded-full bg-red-800 px-4 py-1 text-sm">
                {membro.cargo}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <Card titulo="HORAS NA CIDADE" valor="00h 00m" desc="ESSA SEMANA" />
              <Card titulo="STATUS DA META" valor={statusMeta} desc="SEMANA ATUAL" />
              <Card titulo="CARGO" valor={membro.cargo} desc="ATUAL" />
              <Card titulo="POSIÇÃO" valor={posicaoRanking} desc="RANKING" />
            </div>

            <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-black text-red-500">
                  🎯 MINHA META SEMANAL
                </h2>

                <span className="rounded-full bg-red-800 px-4 py-2 text-lg font-black">
                  {porcentagemMeta}%
                </span>
              </div>

              <div className="mb-6">
                <div className="mb-2 flex justify-between text-sm text-zinc-400">
                  <span>Progresso total</span>
                  <span>
                    {totalFarm} / {totalMeta} itens
                  </span>
                </div>

                <div className="h-5 w-full rounded-full bg-zinc-800">
                  <div
                    className="h-5 rounded-full bg-red-600"
                    style={{ width: `${porcentagemMeta}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <MetaItem nome="🍃 Folhas" valor={folhasMeta} meta={2000} />
                <MetaItem nome="💊 Ópios" valor={opiosMeta} meta={2000} />
                <MetaItem nome="💉 Seringas" valor={seringasMeta} meta={800} />
                <MetaItem nome="🪡 Agulhas" valor={agulhasMeta} meta={800} />
              </div>
            </section>

            <section className="mt-5 rounded-xl border border-red-900 bg-black p-6">
              <h2 className="mb-4 text-2xl font-black text-red-500">
                📢 AVISOS DA INGLATERRA
              </h2>

              {avisos.length === 0 && (
                <p className="text-zinc-400">Nenhum aviso publicado ainda.</p>
              )}

              <div className="grid gap-3">
                {avisos.map((aviso) => (
                  <div
                    key={aviso.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
                  >
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

function MetaItem({
  nome,
  valor,
  meta,
}: {
  nome: string;
  valor: number;
  meta: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <h3 className="text-xl font-bold">{nome}</h3>

      <p className="mt-2 text-lg">
        {valor} / {meta}
      </p>

      {valor >= meta ? (
        <p className="mt-2 font-bold text-green-400">✅ META BATIDA</p>
      ) : (
        <p className="mt-2 font-bold text-yellow-400">
          Falta {meta - valor}
        </p>
      )}
    </div>
  );
}