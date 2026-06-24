"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Programacao = {
  id: string;
  familia: string;
  responsavel: string;
  item: string;
  diaSemana: string;
  quantidade: number;
  valor: number;
};

export default function ProgramacaoSemanalPage() {
  const [familia, setFamilia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [item, setItem] = useState("");
  const [diaSemana, setDiaSemana] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [valor, setValor] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [programacoes, setProgramacoes] = useState<Programacao[]>([]);

  async function carregarProgramacoes() {
    const snapshot = await getDocs(collection(db, "programacaoSemanal"));

    const lista: Programacao[] = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...(documento.data() as Omit<Programacao, "id">),
    }));

    const ordemDias = [
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
      "Domingo",
    ];

    lista.sort(
      (a, b) =>
        ordemDias.indexOf(a.diaSemana) -
        ordemDias.indexOf(b.diaSemana)
    );

    setProgramacoes(lista);
  }

  function limparFormulario() {
    setFamilia("");
    setResponsavel("");
    setItem("");
    setDiaSemana("");
    setQuantidade("");
    setValor("");
    setEditandoId(null);
  }

  async function salvarProgramacao() {
    if (!familia || !responsavel || !item || !diaSemana || !quantidade || !valor) {
      alert("Preencha todos os campos");
      return;
    }

    const dados = {
      familia,
      responsavel,
      item,
      diaSemana,
      quantidade: Number(quantidade),
      valor: Number(valor),
    };

    if (editandoId) {
      await updateDoc(doc(db, "programacaoSemanal", editandoId), dados);
      alert("Programação atualizada com sucesso");
    } else {
      await addDoc(collection(db, "programacaoSemanal"), dados);
      alert("Programação salva com sucesso");
    }

    limparFormulario();
    carregarProgramacoes();
  }

  function editarProgramacao(prog: Programacao) {
    setEditandoId(prog.id);
    setFamilia(prog.familia);
    setResponsavel(prog.responsavel);
    setItem(prog.item);
    setDiaSemana(prog.diaSemana);
    setQuantidade(String(prog.quantidade));
    setValor(String(prog.valor));

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirProgramacao(id: string) {
    const confirmar = confirm("Tem certeza que deseja excluir esta programação?");

    if (!confirmar) return;

    await deleteDoc(doc(db, "programacaoSemanal", id));

    carregarProgramacoes();

    alert("Programação excluída com sucesso");
  }

  useEffect(() => {
    carregarProgramacoes();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        📅 Programação Semanal Fixa
      </h1>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <input
          placeholder="Família"
          value={familia}
          onChange={(e) => setFamilia(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          placeholder="Responsável"
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          placeholder="Item"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="border p-2 rounded"
        />

        <select
          value={diaSemana}
          onChange={(e) => setDiaSemana(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="">Selecione o dia</option>
          <option value="Segunda-feira">Segunda-feira</option>
          <option value="Terça-feira">Terça-feira</option>
          <option value="Quarta-feira">Quarta-feira</option>
          <option value="Quinta-feira">Quinta-feira</option>
          <option value="Sexta-feira">Sexta-feira</option>
          <option value="Sábado">Sábado</option>
          <option value="Domingo">Domingo</option>
        </select>

        <input
          type="number"
          placeholder="Quantidade"
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="number"
          placeholder="Valor"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={salvarProgramacao}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editandoId ? "Salvar Alteração" : "Salvar Programação"}
        </button>

        {editandoId && (
          <button
            onClick={limparFormulario}
            className="bg-gray-500 text-white px-4 py-2 rounded"
          >
            Cancelar Edição
          </button>
        )}
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">
          Cronograma Cadastrado
        </h2>

        {programacoes.map((prog) => (
          <div key={prog.id} className="border rounded p-4 mb-3">
            <p><strong>Dia:</strong> {prog.diaSemana}</p>
            <p><strong>Família:</strong> {prog.familia}</p>
            <p><strong>Responsável:</strong> {prog.responsavel}</p>
            <p><strong>Item:</strong> {prog.item}</p>
            <p><strong>Quantidade:</strong> {prog.quantidade}</p>
            <p><strong>Valor:</strong> R$ {prog.valor}</p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => editarProgramacao(prog)}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                ✏️ Editar
              </button>

              <button
                onClick={() => excluirProgramacao(prog.id)}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                🗑️ Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}