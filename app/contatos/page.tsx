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

type Contato = {
  id: string;
  familia: string;
  responsavel: string;
  item: string;
  valor: number;
  telefone: string;
};

export default function ContatosPage() {
  const [familia, setFamilia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [item, setItem] = useState("");
  const [valor, setValor] = useState("");
  const [telefone, setTelefone] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);

  async function carregarContatos() {
    const snapshot = await getDocs(collection(db, "contatos"));

    const lista: Contato[] = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...(documento.data() as Omit<Contato, "id">),
    }));

    setContatos(lista);
  }

  function limparFormulario() {
    setFamilia("");
    setResponsavel("");
    setItem("");
    setValor("");
    setTelefone("");
    setEditandoId(null);
  }

  async function salvarContato() {
    if (!familia || !responsavel || !item || !valor || !telefone) {
      alert("Preencha todos os campos");
      return;
    }

    const dados = {
      familia,
      responsavel,
      item,
      valor: Number(valor),
      telefone,
    };

    if (editandoId) {
      await updateDoc(doc(db, "contatos", editandoId), dados);
      alert("Contato atualizado com sucesso");
    } else {
      await addDoc(collection(db, "contatos"), dados);
      alert("Contato salvo com sucesso");
    }

    limparFormulario();
    carregarContatos();
  }

  function editarContato(contato: Contato) {
    setEditandoId(contato.id);
    setFamilia(contato.familia);
    setResponsavel(contato.responsavel);
    setItem(contato.item);
    setValor(String(contato.valor));
    setTelefone(contato.telefone);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirContato(id: string) {
    const confirmar = confirm("Tem certeza que deseja excluir este contato?");

    if (!confirmar) return;

    await deleteDoc(doc(db, "contatos", id));

    carregarContatos();

    alert("Contato excluído com sucesso");
  }

  useEffect(() => {
    carregarContatos();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        📞 Contatos Fornecedores e Compradores
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

        <input
          placeholder="Valor Sugerido"
          type="number"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          placeholder="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={salvarContato}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          {editandoId ? "Salvar Alteração" : "Salvar Contato"}
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
        <h2 className="text-2xl font-bold mb-4">Lista de Contatos</h2>

        {contatos.map((contato) => (
          <div key={contato.id} className="border rounded p-4 mb-3">
            <p><strong>Família:</strong> {contato.familia}</p>
            <p><strong>Responsável:</strong> {contato.responsavel}</p>
            <p><strong>Item:</strong> {contato.item}</p>
            <p><strong>Valor Sugerido:</strong> R$ {contato.valor}</p>
            <p><strong>Telefone:</strong> {contato.telefone}</p>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => editarContato(contato)}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                ✏️ Editar
              </button>

              <button
                onClick={() => excluirContato(contato.id)}
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