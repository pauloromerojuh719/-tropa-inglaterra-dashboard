"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Membro = {
  nome?: string;
  nomeDiscord?: string;
  username?: string;
  nomeRP?: string;
  email?: string;
  cargo?: string;
  status?: string;
  passaporte?: string;
  numeroBau?: string;
};

type Farm = {
  membroId?: string;
  membroNome?: string;
  membroEmail?: string;
  folhas?: number;
  opios?: number;
  seringas?: number;
  agulhas?: number;
  status?: string;
  criadoEm?: any;
};

type Reembolso = {
  status?: string;
};

type Plantao = {
  email?: string;
  status?: string;
  minutos?: number;
};

type Aviso = {
  texto?: string;
};

type Caixa = {
  tipo?: "entrada" | "saida" | string;
  valor?: number;
};

type Producao = {
  item?: string;
  quantidade?: number;
  responsavel?: string;
  criadoEm?: any;
};

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function inicioDaSemanaAtualDate() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const diferenca = dia === 0 ? 6 : dia - 1;

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - diferenca);
  inicio.setHours(0, 0, 0, 0);

  return inicio;
}

function inicioDaSemanaPassadaDate() {
  const inicioAtual = inicioDaSemanaAtualDate();
  const inicioPassada = new Date(inicioAtual);
  inicioPassada.setDate(inicioAtual.getDate() - 7);
  return inicioPassada;
}

function inicioDoDiaAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(hoje);
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

function formatarDinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export default function PainelPage() {
  const { data: session } = useSession();

  const [membro, setMembro] = useState<Membro | null>(null);
  const [totalMembros, setTotalMembros] = useState(0);
  const [farmsPendentes, setFarmsPendentes] = useState(0);
  const [reembolsosPendentes, setReembolsosPendentes] = useState(0);
  const [totalMinutos, setTotalMinutos] = useState(0);
  const [aviso, setAviso] = useState("Nenhum aviso publicado.");

  const [saldoCaixa, setSaldoCaixa] = useState(0);
  const [producaoHoje, setProducaoHoje] = useState(0);

  const [folhas, setFolhas] = useState(0);
  const [opios, setOpios] = useState(0);
  const [seringas, setSeringas] = useState(0);
  const [agulhas, setAgulhas] = useState(0);

  const discordId = (session?.user as any)?.id || "";
  const emailLogado = session?.user?.email || "";
  const fotoDiscord = session?.user?.image || "/logo.png";

  const nome =
    membro?.nomeRP ||
    membro?.nomeDiscord ||
    membro?.nome ||
    membro?.username ||
    session?.user?.name ||
    "Usuário";

  const cargo = membro?.cargo || "Sem cargo";

  const totalFarm =
    Math.min(folhas, META_FOLHAS) +
    Math.min(opios, META_OPIOS) +
    Math.min(seringas, META_SERINGAS) +
    Math.min(agulhas, META_AGULHAS);

  const porcentagemFarm = Math.min(100, Math.floor((totalFarm / 5600) * 100));

  useEffect(() => {
    async function carregarDados() {
      if (!session?.user) return;

      const inicioSemanaAtual = inicioDaSemanaAtualDate();
      const inicioSemanaPassada = inicioDaSemanaPassadaDate();
      const inicioDia = inicioDoDiaAtual();

      let membroAtual: Membro | null = null;

      if (discordId) {
        const membroSnap = await getDoc(doc(db, "membros", discordId));

        if (membroSnap.exists()) {
          membroAtual = membroSnap.data() as Membro;
          setMembro(membroAtual);
        }
      }

      const membrosSnap = await getDocs(collection(db, "membros"));

      setTotalMembros(
        membrosSnap.docs.filter((item) => {
          const dados = item.data() as Membro;
          return dados.status === "aprovado";
        }).length
      );

      const farmSnap = await getDocs(collection(db, "farm"));

      let pendentes = 0;

      let semanaFolhas = 0;
      let semanaOpios = 0;
      let semanaSeringas = 0;
      let semanaAgulhas = 0;

      let passadaFolhas = 0;
      let passadaOpios = 0;
      let passadaSeringas = 0;
      let passadaAgulhas = 0;

      farmSnap.docs.forEach((item) => {
        const farm = item.data() as Farm;

        if (farm.status === "pendente") pendentes++;

        if (farm.status !== "aprovado") return;

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

        const ehSemanaAtual = dataFarm >= inicioSemanaAtual;
        const ehSemanaPassada =
          dataFarm >= inicioSemanaPassada && dataFarm < inicioSemanaAtual;

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

      setFarmsPendentes(pendentes);
      setFolhas(semanaFolhas + sobraFolhas);
      setOpios(semanaOpios + sobraOpios);
      setSeringas(semanaSeringas + sobraSeringas);
      setAgulhas(semanaAgulhas + sobraAgulhas);

      const reembolsoSnap = await getDocs(collection(db, "reembolsos"));

      setReembolsosPendentes(
        reembolsoSnap.docs.filter((item) => {
          const dados = item.data() as Reembolso;
          return dados.status === "pendente";
        }).length
      );

      if (emailLogado) {
        const plantaoSnap = await getDocs(
          query(collection(db, "plantoes"), where("email", "==", emailLogado))
        );

        const minutos = plantaoSnap.docs.reduce((soma, item) => {
          const dados = item.data() as Plantao;

          if (dados.status === "fechado") {
            return soma + (dados.minutos || 0);
          }

          return soma;
        }, 0);

        setTotalMinutos(minutos);
      }

      const caixaSnap = await getDocs(collection(db, "caixa"));

      const saldo = caixaSnap.docs.reduce((total, item) => {
        const dados = item.data() as Caixa;
        const valor = Number(dados.valor || 0);

        if (dados.tipo === "saida") {
          return total - valor;
        }

        return total + valor;
      }, 0);

      setSaldoCaixa(saldo);

      const producaoSnap = await getDocs(collection(db, "producoes"));

      let totalProducaoHoje = 0;

      producaoSnap.docs.forEach((item) => {
        const dados = item.data() as Producao;
        const dataProducao = dados.criadoEm;

        const ehHoje = dataProducao && dataProducao.seconds >= inicioDia.seconds;

        if (ehHoje) {
          totalProducaoHoje += dados.quantidade || 0;
        }
      });

      setProducaoHoje(totalProducaoHoje);

      const avisoSnap = await getDoc(doc(db, "avisos", "principal"));

      if (avisoSnap.exists()) {
        const dados = avisoSnap.data() as Aviso;
        setAviso(dados.texto || "Nenhum aviso publicado.");
      }
    }

    carregarDados();
  }, [session, discordId, emailLogado]);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <section className="mx-auto grid min-h-screen max-w-[1850px] gap-6 p-6 lg:grid-cols-[280px_1fr_360px]">
        <aside className="rounded-3xl border border-red-900 bg-black/80 p-5">
          <div className="text-center">
            <img
              src="/logo.png"
              className="mx-auto h-24 w-24 rounded-full border border-red-800"
              alt="Logo"
            />

            <h1 className="mt-4 text-xl font-black text-red-600">
              TROPA DA INGLATERRA
            </h1>

            <p className="text-xs text-zinc-500">Painel Administrativo</p>
          </div>

          <nav className="mt-8 space-y-2">
            <Menu href="/painel" ativo texto="🏠 Início" />
            <Menu href="/membros" texto="👥 Membros" />
            <Menu href="/farm" texto="🌿 Farm" />
            <Menu href="/controle-farm" texto="📋 Controle de Farm" />
            <Menu href="/metas" texto="🎯 Metas" />

            <div className="my-4 border-t border-zinc-800" />

            <Menu href="/producao" texto="🏭 Produção" />
            <Menu href="/compras" texto="🛒 Compras" />
            <Menu href="/vendas" texto="💰 Vendas" />
            <Menu href="/reembolsos" texto="💸 Reembolsos" />

            <div className="my-4 border-t border-zinc-800" />

            <Menu href="/acoes" texto="⚔️ Ações" />
            <Menu href="/ranking" texto="🏆 Ranking" />
            <Menu href="/relatorio" texto="📊 Relatórios" />
            <Menu href="/programacao-semanal" texto="📅 Programação" />
            <Menu href="/contatos" texto="📞 Contatos" />
            <Menu href="/horas" texto="⏱️ Horas" />

            <div className="my-4 border-t border-zinc-800" />

            <Menu href="/ia-inglaterra" texto="🤖 IA da Inglaterra" />
            <Menu href="/admin" texto="⚙️ Administração" />
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

            <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
              <img
                src={fotoDiscord}
                className="h-12 w-12 rounded-full border border-red-700"
                alt="Foto"
              />

              <div>
                <p className="text-lg font-bold text-white">{nome}</p>
                <p className="text-sm text-zinc-400">{cargo}</p>

                <p className="mt-1 text-xs text-zinc-500">
                  Passaporte: {membro?.passaporte || "--"}
                </p>

                <p className="text-xs text-zinc-500">
                  Baú: {membro?.numeroBau || "--"}
                </p>
              </div>
            </div>
          </header>

          <section className="grid gap-5 lg:grid-cols-4">
            <Card
              titulo="👥 Membros"
              valor={formatarNumero(totalMembros)}
              subtitulo="Aprovados"
            />

            <Card
              titulo="🌿 Farm"
              valor={`${porcentagemFarm}%`}
              subtitulo="Minha meta semanal"
            />

            <Card
              titulo="🏭 Produção"
              valor={formatarNumero(producaoHoje)}
              subtitulo="Produzido hoje"
            />

            <Card
              titulo="💰 Caixa"
              valor={formatarDinheiro(saldoCaixa)}
              subtitulo="Saldo atual"
            />
          </section>

          <section className="rounded-3xl border border-red-900 bg-black/80 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-red-500">
                  🧠 IA DA INGLATERRA
                </h2>

                <p className="text-zinc-500">
                  Inteligência operacional da facção
                </p>
              </div>

              <span className="rounded-full bg-green-700 px-4 py-2 text-sm font-black">
                EM OPERAÇÃO
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="font-black text-red-400">Situação de Hoje</h3>

                <ul className="mt-4 space-y-3 text-zinc-300">
                  <li>• {farmsPendentes} farms aguardando aprovação</li>
                  <li>• {reembolsosPendentes} reembolsos pendentes</li>
                  <li>• Sua meta semanal está em {porcentagemFarm}%</li>
                  <li>• Produção de hoje: {formatarNumero(producaoHoje)} itens</li>
                  <li>• Caixa atual: {formatarDinheiro(saldoCaixa)}</li>
                  <li>• Horas registradas: {formatarMinutos(totalMinutos)}</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <h3 className="font-black text-green-400">Recomendações</h3>

                <ul className="mt-4 space-y-3 text-zinc-300">
                  {farmsPendentes > 0 && <li>✔ Aprovar farms pendentes</li>}

                  {reembolsosPendentes > 0 && (
                    <li>✔ Conferir reembolsos em aberto</li>
                  )}

                  {porcentagemFarm < 100 && (
                    <li>✔ Acompanhar meta até domingo 23:59</li>
                  )}

                  {producaoHoje === 0 && (
                    <li>✔ Abrir produção hoje para movimentar o estoque</li>
                  )}

                  {saldoCaixa < 0 && (
                    <li>✔ Conferir o caixa, pois o saldo está negativo</li>
                  )}

                  {saldoCaixa >= 0 && (
                    <li>✔ Caixa positivo, manter controle das entradas e saídas</li>
                  )}
                </ul>
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">📢 Avisos</h3>

            <p className="mt-4 text-zinc-400">{aviso}</p>
          </div>

          <div className="rounded-3xl border border-yellow-700 bg-yellow-950/20 p-5">
            <h3 className="text-lg font-black text-yellow-400">📩 Alertas</h3>

            <p className="mt-3 text-sm text-zinc-400">
              Envie mensagens automáticas para quem não bateu a meta.
            </p>

            <Link
              href="/alertas-individuais"
              className="mt-5 block w-full rounded-xl bg-yellow-600 py-3 text-center font-black text-black hover:bg-yellow-500"
            >
              Enviar Alertas
            </Link>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">🎯 Minha Meta</h3>

            <div className="mt-4 space-y-3 text-sm">
              <LinhaMeta nome="Folhas" atual={folhas} meta={META_FOLHAS} />
              <LinhaMeta nome="Ópios" atual={opios} meta={META_OPIOS} />
              <LinhaMeta nome="Seringas" atual={seringas} meta={META_SERINGAS} />
              <LinhaMeta nome="Agulhas" atual={agulhas} meta={META_AGULHAS} />
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-6">
            <h3 className="text-lg font-black text-red-500">
              ⚠️ Pendências
            </h3>

            <div className="mt-4 space-y-3 text-sm text-zinc-300">
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
  subtitulo,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-[#111111] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-red-700 hover:shadow-xl hover:shadow-red-950/20">
      <p className="text-sm font-medium text-zinc-500">{titulo}</p>

      <h2 className="mt-3 text-4xl font-extrabold tracking-tight">
        {valor}
      </h2>

      <p className="mt-2 text-sm text-zinc-500">{subtitulo}</p>
    </div>
  );
}

function LinhaMeta({
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
    <div>
      <div className="mb-1 flex justify-between text-zinc-400">
        <span>{nome}</span>

        <span>
          {formatarNumero(atual)}/{formatarNumero(meta)}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-2 rounded-full bg-red-600"
          style={{ width: `${porcentagem}%` }}
        />
      </div>
    </div>
  );
}