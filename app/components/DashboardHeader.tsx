import HomeHeader from "./HomeHeader";
import StatusCidade from "./StatusCidade";
import DashboardCard from "./Card";
import MiniMetaCard from "./MiniMeta";

type Aviso = {
  id: string;
  texto: string;
};

type HomeDashboardProps = {
  nome: string;
  cargo: string;
  passaporte?: string;
  numeroBau?: string;

  plantaoAberto: boolean;
  totalHoras: string;
  onEntrada: () => void;
  onSaida: () => void;

  isElite: boolean;
  podeVerAdmin: boolean;

  porcentagemMeta: number;
  statusMeta: string;

  folhasMeta: number;
  opiosMeta: number;
  seringasMeta: number;
  agulhasMeta: number;

  cadastrosPendentes: number;
  farmsPendentes: number;
  reembolsosPendentes: number;

  avisos: Aviso[];

  cargoLimpo?: string;
  enviandoAlertas: boolean;
  onEnviarAlertas: () => void;
};

export default function HomeDashboard({
  nome,
  cargo,
  passaporte,
  numeroBau,
  plantaoAberto,
  totalHoras,
  onEntrada,
  onSaida,
  isElite,
  podeVerAdmin,
  porcentagemMeta,
  statusMeta,
  folhasMeta,
  opiosMeta,
  seringasMeta,
  agulhasMeta,
  cadastrosPendentes,
  farmsPendentes,
  reembolsosPendentes,
  avisos,
  cargoLimpo,
  enviandoAlertas,
  onEnviarAlertas,
}: HomeDashboardProps) {
  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <HomeHeader
          nome={nome}
          cargo={cargo}
          passaporte={passaporte}
          numeroBau={numeroBau}
        />

        <StatusCidade
          plantaoAberto={plantaoAberto}
          onEntrada={onEntrada}
          onSaida={onSaida}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardCard
          titulo="HORAS NA CIDADE"
          valor={totalHoras}
          desc="TOTAL REGISTRADO"
          destaque
        />

        {!isElite && (
          <DashboardCard
            titulo="STATUS DA META"
            valor={`${porcentagemMeta}%`}
            desc={statusMeta}
            destaque
          />
        )}

        {podeVerAdmin && (
          <DashboardCard
            titulo="FARMS PENDENTES"
            valor={String(farmsPendentes)}
            desc="AGUARDANDO APROVAÇÃO"
            destaque
          />
        )}
      </section>

      {!isElite && (
        <section className="rounded-3xl border border-red-950 bg-black/75 p-6 shadow-xl shadow-red-950/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-red-500">
                🎯 MINHA META SEMANAL
              </h2>
              <p className="text-sm text-zinc-500">
                Contando somente farms aprovados da semana atual.
              </p>
            </div>

            <p className="text-5xl font-black text-green-400">
              {porcentagemMeta}%
            </p>
          </div>

          <div className="mt-5 h-5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-5 bg-green-500 transition-all"
              style={{ width: `${porcentagemMeta}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <MiniMetaCard nome="Folhas" atual={folhasMeta} meta={2000} />
            <MiniMetaCard nome="Ópios" atual={opiosMeta} meta={2000} />
            <MiniMetaCard nome="Seringas" atual={seringasMeta} meta={800} />
            <MiniMetaCard nome="Agulhas" atual={agulhasMeta} meta={800} />
          </div>

          <p className="mt-4 text-center text-xl font-black text-zinc-300">
            {statusMeta}
          </p>
        </section>
      )}

      {isElite && (
        <section className="rounded-3xl border border-red-950 bg-black/75 p-6">
          <h2 className="text-2xl font-black text-red-500">
            ⚔️ ELITE DE AÇÕES
          </h2>
          <p className="mt-3 text-zinc-300">
            Você está marcado como Elite/Gerente de Ações e não precisa bater
            meta de farm semanal.
          </p>
        </section>
      )}

      {podeVerAdmin && (
        <section className="rounded-3xl border border-red-950 bg-black/75 p-6">
          <h2 className="mb-4 text-2xl font-black text-red-500">
            ⚠️ CENTRAL DA GERÊNCIA
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <DashboardCard
              titulo="CADASTROS"
              valor={String(cadastrosPendentes)}
              desc="PENDENTES"
            />

            <DashboardCard
              titulo="FARMS"
              valor={String(farmsPendentes)}
              desc="PENDENTES"
            />

            <DashboardCard
              titulo="REEMBOLSOS"
              valor={String(reembolsosPendentes)}
              desc="PENDENTES"
            />
          </div>

          {(cargoLimpo === "Líder" ||
            cargoLimpo === "Vice-Líder" ||
            cargoLimpo === "Gerente de Farm") && (
            <div className="mt-5 rounded-2xl border border-yellow-700 bg-yellow-950/20 p-5 text-center">
              <h3 className="text-xl font-black text-yellow-400">
                📩 ALERTAS INDIVIDUAIS
              </h3>

              <p className="mt-2 text-sm text-zinc-400">
                Envia DM para quem não bateu meta, quem não se cadastrou e
                parabéns para quem bateu.
              </p>

              <button
                onClick={onEnviarAlertas}
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

      <section className="rounded-3xl border border-red-950 bg-black/75 p-6">
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
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
            >
              <p className="text-zinc-200">{aviso.texto}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}