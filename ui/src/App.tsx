import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import type { Episode, Memory, Trait } from "./types";
import "./App.css";

type Tab = "memories" | "episodes" | "traits";

function App() {
  const [scopes, setScopes] = useState<string[]>([]);
  const [scope, setScope] = useState<string>("");
  const [tab, setTab] = useState<Tab>("memories");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newEpisode, setNewEpisode] = useState("");
  const [newTrait, setNewTrait] = useState({ name: "", value: "", evidence: "" });

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = scope || undefined;
      const [m, e, t] = await Promise.all([api.memories(s), api.episodes(s), api.traits(s)]);
      setMemories(m);
      setEpisodes(e);
      setTraits(t);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [scope]);

  useEffect(() => {
    api.scopes().then(setScopes).catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSearch() {
    if (!search.trim()) return load();
    try {
      setError(null);
      const result = await api.recall(search, scope || undefined);
      setMemories(result.memories);
      setTraits(result.traits);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCapture() {
    if (!newEpisode.trim() || !scope.trim()) {
      setError("Elige o escribe un scope, y escribe contenido, antes de capturar.");
      return;
    }
    await api.capture(scope, newEpisode);
    setNewEpisode("");
    await load();
    if (!scopes.includes(scope)) setScopes([...scopes, scope]);
  }

  async function handleConsolidate() {
    if (!scope.trim()) {
      setError("Elige un scope para consolidar.");
      return;
    }
    await api.consolidate(scope);
    await load();
  }

  async function handleCrystallize() {
    if (!scope.trim() || !newTrait.name.trim() || !newTrait.value.trim()) {
      setError("Un trait necesita scope, nombre y valor.");
      return;
    }
    await api.crystallize(scope, newTrait.name, newTrait.value, newTrait.evidence || undefined);
    setNewTrait({ name: "", value: "", evidence: "" });
    await load();
  }

  return (
    <div className="app">
      <header>
        <img src="/mnemo-logo.jpg" alt="Mnemo" className="logo" />
        <h1>Mnemo</h1>
        <span className="tagline">tu memoria, visible y editable</span>
      </header>

      {error && <div className="error">{error}</div>}

      <div className="toolbar">
        <input
          list="scope-options"
          placeholder="scope (ej: proyecto/diario)"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        />
        <datalist id="scope-options">
          {scopes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          placeholder="buscar en memorias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button onClick={handleSearch}>Buscar</button>
      </div>

      <nav className="tabs">
        <button className={tab === "memories" ? "active" : ""} onClick={() => setTab("memories")}>
          Memorias ({memories.length})
        </button>
        <button className={tab === "episodes" ? "active" : ""} onClick={() => setTab("episodes")}>
          Episodios ({episodes.length})
        </button>
        <button className={tab === "traits" ? "active" : ""} onClick={() => setTab("traits")}>
          Rasgos ({traits.length})
        </button>
      </nav>

      {tab === "memories" && (
        <section>
          {memories.map((m) => (
            <MemoryCard key={m.id} memory={m} onChange={load} />
          ))}
          {memories.length === 0 && <p className="empty">Sin memorias todavía. Captura episodios y consolídalos.</p>}
        </section>
      )}

      {tab === "episodes" && (
        <section>
          <div className="capture-form">
            <textarea
              placeholder="Escribe un episodio para capturar en este scope..."
              value={newEpisode}
              onChange={(e) => setNewEpisode(e.target.value)}
            />
            <div className="capture-actions">
              <button onClick={handleCapture}>Capturar episodio</button>
              <button onClick={handleConsolidate} className="secondary">
                Consolidar todo en memoria
              </button>
            </div>
          </div>
          {episodes.map((e) => (
            <div key={e.id} className="card episode">
              <p>{e.content}</p>
              <div className="meta">
                <span>{new Date(e.created_at).toLocaleString()}</span>
                {e.consolidated_into ? <span className="badge">consolidado</span> : <span className="badge pending">pendiente</span>}
              </div>
            </div>
          ))}
          {episodes.length === 0 && <p className="empty">Sin episodios en este scope.</p>}
        </section>
      )}

      {tab === "traits" && (
        <section>
          <div className="capture-form">
            <input placeholder="nombre" value={newTrait.name} onChange={(e) => setNewTrait({ ...newTrait, name: e.target.value })} />
            <input placeholder="valor" value={newTrait.value} onChange={(e) => setNewTrait({ ...newTrait, value: e.target.value })} />
            <input
              placeholder="evidencia (opcional)"
              value={newTrait.evidence}
              onChange={(e) => setNewTrait({ ...newTrait, evidence: e.target.value })}
            />
            <button onClick={handleCrystallize}>Cristalizar</button>
          </div>
          {traits.map((t) => (
            <div key={t.id} className="card trait">
              <div className="trait-header">
                <strong>{t.name}</strong>
                <button
                  className="danger"
                  onClick={async () => {
                    await api.deleteTrait(t.id);
                    load();
                  }}
                >
                  Borrar
                </button>
              </div>
              <p>{t.value}</p>
              {t.evidence && <p className="evidence">{t.evidence}</p>}
            </div>
          ))}
          {traits.length === 0 && <p className="empty">Sin rasgos en este scope.</p>}
        </section>
      )}
    </div>
  );
}

function MemoryCard({ memory, onChange }: { memory: Memory; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [gist, setGist] = useState(memory.gist);
  const [details, setDetails] = useState(memory.details ?? "");

  async function save() {
    await api.updateMemory(memory.id, { gist, details });
    setEditing(false);
    onChange();
  }

  return (
    <div className="card memory">
      <div className="salience-bar">
        <div className="salience-fill" style={{ width: `${Math.round(memory.salience * 100)}%` }} />
      </div>
      {editing ? (
        <>
          <input value={gist} onChange={(e) => setGist(e.target.value)} />
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="capture-actions">
            <button onClick={save}>Guardar</button>
            <button className="secondary" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="gist">{memory.gist}</p>
          {memory.details && <p className="details">{memory.details}</p>}
          <div className="meta">
            <span>salience: {memory.salience.toFixed(2)}</span>
            <span>{new Date(memory.updated_at).toLocaleString()}</span>
            <button onClick={() => setEditing(true)}>Editar</button>
            <button
              className="danger"
              onClick={async () => {
                await api.deleteMemory(memory.id);
                onChange();
              }}
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
