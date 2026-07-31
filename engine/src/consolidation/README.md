# Mnemo — Consolidaci\u00f3n LLM (ciclo de sue\u00f1o)

Destila episodios verbatim en memorias estructuradas usando un LLM v\u00eda OpenRouter.

## Arquitectura

```
episodes (verbatim, TTL ~14d)
   ↓ runConsolidation() — diario 4 AM
memories (gist + details, salience decay/Hebbian)
   ↓ crystallize()
traits (patrones cristalizados)
```

## Comando

```bash
mnemo-consolidate [--dry-run] [--scope <name>] [--min-age-hours 24] [--min-episodes 3] [--max-batch 60]
```

## Env vars

| Var | Default | Descripci\u00f3n |
|-----|---------|-------------|
| `OPENROUTER_API_KEY` | — | **Requerida** (salvo `--dry-run`) |
| `MNEMO_CONSOLIDATION_MODEL` | `deepseek/deepseek-chat` | Cualquier modelo OpenRouter |
| `MNEMO_CONSOLIDATION_MIN_AGE_HOURS` | `24` | Edad m\u00ednima de episodios |
| `MNEMO_CONSOLIDATION_MIN_EPISODES` | `3` | Episodios m\u00ednimos por scope |
| `MNEMO_CONSOLIDATION_MAX_BATCH` | `60` | M\u00e1x episodios por llamada LLM |
| `MNEMO_DB` | `~/.mnemo/mem.db` | Ruta a SQLite |

## Calidad

- **Modelo**: DeepSeek V3 (top-tier synthesis, ~$0.14/M in / $0.28/M out)
- **Costo estimado**: <$0.30/mes para volumen actual (~3999 episodios pendientes \u2192 single shot)
- **Anti-alucinaci\u00f3n**: filtra `evidence_episode_ids` que no est\u00e9n en el batch
- **Sin se\u00f1al**: si LLM devuelve `memories: []`, crea memoria stub con `salience=0.05` para que decay + `forget` limpien

## Deployment en producci\u00f3n (mnemo-brain)

### 1. Build + push imagen con la CLI nueva

```bash
docker build -t mnemo-brain:latest -f Dockerfile.mnemo-brain .
# o el flujo CI/CD que uses
```

### 2. Inyectar `OPENROUTER_API_KEY` al servicio

Editar el `docker-compose.yml` de tu stack:

```yaml
services:
  mnemo-brain:
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - MNEMO_CONSOLIDATION_MODEL=deepseek/deepseek-chat
```

Y en `.env` del stack:
```
OPENROUTER_API_KEY=sk-or-v1-...
```

Recrear el container:
```bash
docker compose up -d mnemo-brain
```

### 3. Cron en el servidor (4 AM diario, 1h despu\u00e9s del backup)

```bash
crontab -e
# A\u00f1adir:
0 4 * * * docker exec mnemo-brain node /app/dist/consolidate-cli.js >> /var/log/mnemo-consolidation.log 2>&1
```

### 4. Probar manualmente primero (dry-run)

```bash
ssh <tu-servidor> "docker exec mnemo-brain node /app/dist/consolidate-cli.js --dry-run"
```

Despu\u00e9s una corrida real con un solo scope:
```bash
ssh <tu-servidor> "docker exec mnemo-brain node /app/dist/consolidate-cli.js --scope engram-compat --max-batch 10"
```

## Tests

```bash
pnpm test consolidation
```

6 tests cubren: skip por threshold, skip por edad, destilaci\u00f3n exitosa, stub para noise, anti-alucinaci\u00f3n, dry-run.
