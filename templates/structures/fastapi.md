# FastAPI — Production Structure Templates

> **Role: BACKEND ONLY.** Pair with React/Angular/Next.js for frontend.

---

## A. Modular Monolith (Feature-Based)

Clean layered architecture: Router → Service → Repository → SQLAlchemy Model.

```
src/
├── api/
│   ├── v1/
│   │   ├── routers/
│   │   │   ├── __init__.py        ← api_router = APIRouter(); include all sub-routers
│   │   │   ├── users.py           ← /users routes
│   │   │   ├── auth.py            ← /auth/login, /auth/refresh
│   │   │   └── orders.py
│   │   └── dependencies.py        ← get_current_user, require_roles
│   └── v2/                        ← Future versioned API
│
├── core/
│   ├── config.py                  ← pydantic-settings Settings, env validation
│   ├── security.py                ← JWT create/verify, password hashing (bcrypt)
│   ├── database.py                ← async engine, AsyncSessionLocal, Base
│   ├── exceptions.py              ← Custom exceptions + FastAPI exception handlers
│   └── middleware.py              ← Logging middleware, correlation ID header
│
├── models/                        ← SQLAlchemy ORM models
│   ├── base.py                    ← Base with id (UUID), created_at, updated_at
│   ├── user.py                    ← User model, relationships
│   ├── order.py
│   └── __init__.py
│
├── schemas/                       ← Pydantic schemas (request/response)
│   ├── user.py                    ← CreateUserRequest, UpdateUserRequest, UserResponse
│   ├── order.py
│   └── common.py                  ← Pagination, ErrorResponse, HealthResponse
│
├── services/                      ← Business logic layer
│   ├── user_service.py            ← UserService class, constructor DI
│   ├── order_service.py
│   └── email_service.py
│
├── repositories/                  ← DB access layer (SQLAlchemy queries only)
│   ├── user_repository.py         ← UserRepository class
│   └── order_repository.py
│
├── deps/                          ← FastAPI Depends factories
│   ├── auth.py                    ← get_current_user, require_admin
│   ├── database.py                ← get_db_session
│   └── services.py                ← get_user_service, get_order_service
│
├── tasks/                         ← Background tasks (ARQ or Celery)
│   ├── email_tasks.py
│   └── worker.py                  ← ARQ WorkerSettings or Celery app
│
├── alembic/
│   ├── env.py
│   └── versions/
│       └── 0001_create_users.py   ← Alembic migration files
│
└── main.py                        ← FastAPI app factory, lifespan, middleware
```

---

## B. Microservice Structure (Per Service)

Each service is an independent FastAPI app with its own database.

```
<service-name>/                    ← e.g. user_service, order_service
├── src/
│   ├── api/v1/routers/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── deps/
│   ├── messaging/
│   │   ├── producers/
│   │   │   └── order_producer.py  ← confluent-kafka producer
│   │   └── consumers/
│   │       └── payment_consumer.py ← Standalone consumer process
│   ├── alembic/
│   └── main.py
│
├── tests/
│   ├── unit/
│   └── integration/               ← Testcontainers
│
├── Dockerfile
├── Dockerfile.dev
├── requirements.txt
└── alembic.ini
```

---

## C. Multi-Service Project Layout

```
project-root/
├── services/
│   ├── user_service/
│   ├── order_service/
│   ├── payment_service/
│   └── notification_service/      ← Async only, consumes events
│
├── infrastructure/
│   └── nginx/
│       └── nginx.conf             ← API gateway / reverse proxy
│
├── docker-compose.yml
├── docker-compose.dev.yml
└── k8s/
    ├── deployments/
    ├── services/
    └── ingress/
```

---

## D. Docker Compose

```yaml
version: '3.9'
services:
  api:
    build: .
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --workers 4
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db, redis]

  arq-worker:
    build: .
    command: python -m arq src.tasks.worker.WorkerSettings
    env_file: .env
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    environment: {POSTGRES_DB: appdb, POSTGRES_PASSWORD: dev}
    volumes: [db_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:latest

volumes:
  db_data:
```

---

## E. main.py — Production Setup

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from src.api.v1.routers import api_router
from src.core.config import settings
from src.core.database import engine
from src.core.exceptions import register_exception_handlers
from src.core.middleware import LoggingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: run Alembic migrations (or verify schema)
    yield
    # Shutdown: close DB pool
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.middleware("http")(LoggingMiddleware())

register_exception_handlers(app)

app.include_router(api_router, prefix="/api/v1")

Instrumentator().instrument(app).expose(app)  # /metrics for Prometheus
```

---

## F. Complete requirements.txt

```
# Core
fastapi[standard]
uvicorn[standard]
pydantic[email]
pydantic-settings

# Database
sqlalchemy[asyncio]
asyncpg                      # async PostgreSQL driver
alembic
greenlet                     # required for SQLAlchemy async

# Auth
python-jose[cryptography]    # JWT tokens
passlib[bcrypt]              # password hashing
python-multipart             # form data (OAuth2PasswordRequestForm)

# Async tasks
arq                          # lightweight async task queue (Redis-backed)
redis[asyncio]               # OR: celery[redis] for Celery

# HTTP client (service-to-service)
httpx

# Messaging
confluent-kafka               # Kafka producer/consumer

# Observability
structlog
sentry-sdk[fastapi]
opentelemetry-sdk
opentelemetry-instrumentation-fastapi
opentelemetry-instrumentation-sqlalchemy
prometheus-fastapi-instrumentator

# Testing
pytest
pytest-asyncio
httpx                        # async test client (AsyncClient)
testcontainers[postgresql]
factory-boy
```

---

## Naming Conventions
- Modules/files: `snake_case` — `user_service.py`, `create_user_request.py`
- Classes: `PascalCase` — `UserService`, `CreateUserRequest`
- Functions: `snake_case` — `create_user()`, `get_user_by_id()`
- DB tables: `snake_case` — `users`, `order_items`
- API paths: `/api/v1/users/{user_id}/orders` (snake_case params, versioned)
- Kafka topics: `user.created`, `order.placed` (dot notation, past tense)
- Alembic revisions: sequential `0001_`, `0002_` with descriptive suffix
