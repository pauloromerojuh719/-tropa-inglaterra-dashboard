import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";

const META_FOLHAS = 2000;
const META_OPIOS = 2000;
const META_SERINGAS = 800;
const META_AGULHAS = 800;

function converterDataFirebase(data: any) {
  if (!data) return null;
  if (data?.toDate) return data.toDate();
  return new Date(data);
}

function isentoMeta(cargo?: string) {
  const cargoLimpo = String(cargo || "").trim();
  return cargoLimpo === "Elite" || cargoLimpo === "Gerente de Ações";
}

export async function GET() {
  try {
    const inicio = new Date("2026-06-22T00:00:00-03:00");
    const fim = new Date("2026-06-28T23:59:59-03:00");

    const farmSnap = await getDocs(collection(db, "farm"));
    const membrosSnap = await getDocs(collection(db, "membros"));

    const metasPorMembro: Record<string, any> = {};

    farmSnap.docs.forEach((doc) => {
      const f = doc.data() as any;

      if (f.status !== "aprovado") return;

      const data = converterDataFirebase(f.criadoEm);
      if (!data) return;

      if (data < inicio || data > fim) return;

      const membroId = f.membroId || f.discordId || f.membroEmail || f.membroNome;

      if (!metasPorMembro[membroId]) {
        metasPorMembro[membroId] = {
          folhas: 0,
          opios: 0,
          seringas: 0,
          agulhas: 0,
        };
      }

      metasPorMembro[membroId].folhas += Number(f.folhas || 0);
      metasPorMembro[membroId].opios += Number(f.opios || 0);
      metasPorMembro[membroId].seringas += Number(f.seringas || 0);
      metasPorMembro[membroId].agulhas += Number(f.agulhas || 0);
    });

    const bateram: any[] = [];
    const naoBateram: any[] = [];
    const isentos: any[] = [];

    membrosSnap.docs.forEach((doc) => {
      const m = doc.data() as any;

      if (m.status !== "aprovado") return;

      const nome = m.nomeRP || m.nome || m.nomeDiscord || "Sem nome";
      const membroId = m.discordId || doc.id;

      if (isentoMeta(m.cargo)) {
        isentos.push(nome);
        return;
      }

      const meta = metasPorMembro[membroId] || {
        folhas: 0,
        opios: 0,
        seringas: 0,
        agulhas: 0,
      };

      const bateu =
        meta.folhas >= META_FOLHAS &&
        meta.opios >= META_OPIOS &&
        meta.seringas >= META_SERINGAS &&
        meta.agulhas >= META_AGULHAS;

      const dados = {
        nome,
        folhas: meta.folhas,
        opios: meta.opios,
        seringas: meta.seringas,
        agulhas: meta.agulhas,
        total: meta.folhas + meta.opios + meta.seringas + meta.agulhas,
      };

      if (bateu) {
        bateram.push(dados);
      } else {
        naoBateram.push(dados);
      }
    });

    return NextResponse.json({
      status: "OK",
      semana: "22/06/2026 até 28/06/2026",
      bateramTotal: bateram.length,
      naoBateramTotal: naoBateram.length,
      isentosTotal: isentos.length,
      bateram,
      naoBateram,
      isentos,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        status: "ERRO",
        erro: String(error),
      },
      { status: 500 }
    );
  }
}