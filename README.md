<p align="center">
  <img src="assets/logo.jpg" alt="Mnemo" width="220">
</p>

<h1 align="center">Mnemo</h1>

<p align="center">
  Memoria persistente para agentes de IA — con una interfaz real para verla y editarla.
</p>

## Qué es

Mnemo es un servidor MCP (Model Context Protocol) de memoria persistente para LLMs y agentes de IA. Cualquier cliente que hable MCP — Claude Desktop, Claude Code, Copilot, agentes propios — puede guardar y recuperar información entre sesiones a través de él.

La diferencia frente a lo que ya existe (Hermes, Mem0, Hindsight, misMEM y otros): en todos esos, la memoria vive en un archivo de texto o una base de datos que solo el LLM lee y escribe — el usuario nunca la ve de verdad. **Mnemo viene con una interfaz visual para navegar, buscar, editar y borrar tu propia memoria**, no solo confiar en lo que el modelo decidió guardar.

## Por qué

Cada sesión de un LLM nace en blanco. Los agentes que sí persisten memoria lo hacen como una caja negra: guardan cosas automáticamente y el usuario no tiene forma simple de ver qué se guardó, corregir un error, o borrar algo que ya no aplica. Mnemo resuelve eso con una capa de administración visual sobre el motor de memoria.

## Arquitectura (en diseño)

Memoria en 3 capas, de lo efímero a lo permanente:

```
episodios   (lo que pasó, texto crudo con fecha)
    ↓ consolidación
memorias    (lo aprendido, con relevancia que decae si no se usa)
    ↓ cristalización
rasgos      (reglas o hechos permanentes — identidad, preferencias fijas)
```

Guardado en SQLite local, con búsqueda de texto completo (FTS5). Expuesto vía MCP con 5 herramientas (`capture`, `recall`, `consolidate`, `crystallize`, `forget`) y una interfaz web de administración real (no solo lectura) para gestionar todo eso a mano.

## Instalación rápida

Modo MCP (stdio), para conectar desde Claude Desktop/Code u otro cliente MCP:

```json
{
  "mcpServers": {
    "mnemo": {
      "command": "npx",
      "args": ["-y", "@krat214/mnemo"]
    }
  }
}
```

La base de datos se crea sola en `~/.mnemo/mem.db` (configurable con `MNEMO_DB`).

## Modo servidor + interfaz web

Para usar la interfaz visual (ver/editar tu memoria en el navegador):

```bash
git clone https://github.com/krat214/mnemo.git
cd mnemo
npm install && npm run build
MNEMO_AUTH_USER=tu_usuario MNEMO_AUTH_PASS=tu_password npm run start:http
```

Abre `http://localhost:3200`.

**Seguridad:** a diferencia de otros servidores de memoria similares, Mnemo **se rehúsa a arrancar en modo HTTP sin usuario y contraseña** — nunca queda abierto por accidente. Si de verdad quieres correrlo sin auth (solo localhost, solo para probar), tienes que decirlo explícitamente con `MNEMO_ALLOW_NO_AUTH=true`.

## Las 5 herramientas MCP

| Herramienta | Qué hace |
|---|---|
| `capture` | Guarda un episodio (texto crudo, con fecha) en un scope |
| `recall` | Busca en memorias por texto completo, refuerza lo que se recuerda |
| `consolidate` | Resume los episodios pendientes de un scope en una memoria |
| `crystallize` | Fija un rasgo permanente (identidad, regla, preferencia fija) |
| `forget` | Borra una memoria por id, o todas las que caigan bajo un umbral de relevancia |

## Estado

✅ Motor funcionando: captura, consolidación, búsqueda, cristalización y olvido — todo probado con tests reales (20/20 pasando) y en vivo.

✅ Servidor HTTP + API REST + interfaz web (React) funcionando end-to-end.

✅ Auth obligatoria por defecto en modo HTTP.

🚧 Pendiente: búsqueda semántica, más proveedores de embeddings, empaquetado para publicar en npm.

## Licencia

MIT. Ver [LICENSE](./LICENSE).
