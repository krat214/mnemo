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

Guardado en SQLite local, con búsqueda de texto completo y semántica opcional. Expuesto vía MCP con un set reducido de herramientas (capturar, recordar, consolidar, cristalizar, olvidar) y una interfaz web de administración real (no solo lectura) para gestionar todo eso a mano.

## Estado

🚧 En desarrollo activo — el motor se está reconstruyendo desde cero. Sin release todavía.

## Licencia

MIT. Ver [LICENSE](./LICENSE).
