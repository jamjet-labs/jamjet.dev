---
title: Deployment
description: Deploy JamJet to production — self-hosted with PostgreSQL or hosted.
sidebar:
  order: 10
---

import { Aside, Steps, Tabs, TabItem } from '@astrojs/starlight/components';

# Deployment

JamJet uses SQLite locally and PostgreSQL in production. The same workflow code runs unchanged in both environments.

## Configuration

Production config lives in `jamjet.toml`:

```toml
[runtime]
port = 7700
workers = 8              # concurrent worker threads

[database]
url = "postgresql://user:password@db:5432/jamjet"
pool_size = 10
max_overflow = 20

[telemetry]
enabled = true
service_name = "my-agent"

[telemetry.otlp]
endpoint = "http://otel-collector:4317"

[auth]
enabled = true
method = "api_key"       # api_key | mtls | jwt
```

All values can be overridden with environment variables:

```bash
JAMJET_DATABASE_URL=postgresql://...
JAMJET_RUNTIME_PORT=7700
JAMJET_RUNTIME_WORKERS=16
JAMJET_AUTH_API_KEY=sk-...
```

## Docker

```dockerfile
FROM python:3.11-slim

RUN pip install jamjet

COPY jamjet.toml .
COPY workflow.yaml .

EXPOSE 7700

CMD ["jamjet", "serve"]
```

```bash
docker build -t my-agent .
docker run -p 7700:7700 \
  -e JAMJET_DATABASE_URL=postgresql://... \
  -e ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY \
  my-agent
```

## Docker Compose (full stack)

```yaml
version: "3.9"

services:
  runtime:
    image: my-agent
    ports:
      - "7700:7700"
    environment:
      JAMJET_DATABASE_URL: postgresql://jamjet:secret@db:5432/jamjet
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: jamjet
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: jamjet
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jamjet"]
      interval: 5s
      timeout: 5s
      retries: 5

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    volumes:
      - ./otel-config.yaml:/etc/otel/config.yaml
    command: ["--config=/etc/otel/config.yaml"]

volumes:
  pg_data:
```

## Kubernetes

<Steps>
1. **Create a Secret for credentials:**

   ```bash
   kubectl create secret generic jamjet-secrets \
     --from-literal=database-url="postgresql://..." \
    --from-literal=anthropic-api-key="YOUR_ANTHROPIC_API_KEY"
   ```

2. **Deploy the runtime:**

   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: jamjet-runtime
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: jamjet-runtime
     template:
       metadata:
         labels:
           app: jamjet-runtime
       spec:
         containers:
           - name: runtime
             image: my-agent:latest
             ports:
               - containerPort: 7700
             env:
               - name: JAMJET_DATABASE_URL
                 valueFrom:
                   secretKeyRef:
                     name: jamjet-secrets
                     key: database-url
               - name: ANTHROPIC_API_KEY
                 valueFrom:
                   secretKeyRef:
                     name: jamjet-secrets
                     key: anthropic-api-key
             resources:
               requests:
                 memory: "256Mi"
                 cpu: "250m"
               limits:
                 memory: "1Gi"
                 cpu: "2"
   ```

3. **Expose with a Service:**

   ```yaml
   apiVersion: v1
   kind: Service
   metadata:
     name: jamjet-runtime
   spec:
     selector:
       app: jamjet-runtime
     ports:
       - port: 80
         targetPort: 7700
     type: ClusterIP
   ```
</Steps>

## Database migrations

Run migrations before starting the runtime:

```bash
jamjet db migrate
```

Or automatically on startup (for simpler deployments):

```toml
[database]
auto_migrate = true
```

## Scaling workers

The JamJet runtime is horizontally scalable — run multiple instances against the same PostgreSQL database:

```bash
# Instance 1
jamjet serve --port 7700

# Instance 2 (same DB, different port)
jamjet serve --port 7701
```

The distributed scheduler uses database-level locks to prevent duplicate execution of nodes, so multiple instances coordinate safely without a message broker.

<Aside type="note">
For high throughput (thousands of concurrent executions), a dedicated message queue (NATS or Kafka) can replace the database-backed queue. This is available as a configuration option in v2.
</Aside>

## Health checks

```bash
# Liveness
curl http://localhost:7700/health

# Readiness (checks DB connectivity)
curl http://localhost:7700/ready
```

```json
{ "status": "ok", "version": "0.1.0", "db": "connected" }
```

## Security checklist

- Set `JAMJET_AUTH_API_KEY` and require it on all API calls
- Use TLS termination at the load balancer (or configure mTLS directly)
- Rotate API keys regularly
- Limit PostgreSQL user to only the `jamjet` database
- Don't log full state in production if it contains PII — use `logging.redact_state = true`
- Pin model API keys to least-privilege scopes where possible

## Environment variables reference

| Variable | Default | Description |
|----------|---------|-------------|
| `JAMJET_DATABASE_URL` | `.jamjet/dev.db` (SQLite) | Database connection string |
| `JAMJET_RUNTIME_PORT` | `7700` | HTTP port |
| `JAMJET_RUNTIME_WORKERS` | `4` | Worker thread count |
| `JAMJET_AUTH_API_KEY` | (none) | API key for auth |
| `JAMJET_LOG_LEVEL` | `info` | Log level |
| `JAMJET_LOG_FORMAT` | `json` | Log format |
| `ANTHROPIC_API_KEY` | (none) | For Claude models |
| `OPENAI_API_KEY` | (none) | For GPT models |
