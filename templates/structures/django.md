# Django — Production Structure Templates

> **Role: BACKEND ONLY.** Pair with React/Angular/Next.js for frontend.

---

## A. Modular Monolith (App-Based)

Django apps map to features/domains. Services pattern separates business logic from views.

```
project_root/
├── config/
│   ├── settings/
│   │   ├── base.py               ← Shared: DB, installed apps, middleware, i18n
│   │   ├── local.py              ← DEBUG=True, console email, sqlite or dev postgres
│   │   └── production.py         ← Sentry, S3, gunicorn, logging
│   ├── urls.py                   ← Root URL conf — include each app's urls.py
│   ├── wsgi.py
│   ├── asgi.py                   ← For Channels (WebSocket) if needed
│   └── celery.py                 ← Celery app instance
│
├── apps/
│   └── <feature>/                ← e.g. users, orders, payments
│       ├── models.py             ← ORM models, db_table, indexes
│       ├── serializers.py        ← DRF: validation + serialize only (NO logic)
│       ├── views.py              ← DRF ViewSet/APIView — delegate to service
│       ├── services.py           ← ALL write logic + @transaction.atomic boundary
│       ├── selectors.py          ← ALL read queries (separate from write services)
│       ├── urls.py               ← Router registration
│       ├── tasks.py              ← Celery async tasks
│       ├── admin.py
│       ├── apps.py
│       ├── permissions.py        ← Custom DRF permissions
│       ├── exceptions.py         ← Feature-specific exceptions
│       ├── signals.py            ← post_save etc. (keep minimal)
│       └── tests/
│           ├── __init__.py
│           ├── test_models.py
│           ├── test_services.py  ← Unit tests: services + selectors
│           └── test_views.py     ← Integration tests: API endpoints
│
├── common/
│   ├── models.py                 ← BaseModel: id (UUID), created_at, updated_at
│   ├── serializers.py            ← Paginated response, error response
│   ├── exceptions.py             ← ApplicationError base class
│   ├── permissions.py
│   └── pagination.py             ← Custom PageNumberPagination
│
├── requirements/
│   ├── base.txt                  ← All envs
│   ├── local.txt                 ← Dev tools (debug-toolbar, factory-boy)
│   └── production.txt            ← gunicorn, sentry
│
├── manage.py
├── .env.example
└── docker-compose.yml
```

---

## B. Microservice Structure (Per Service)

Each service is an independent Django app with its own database.

```
<service-name>/                    ← e.g. user_service, order_service
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   └── production.py
│   ├── urls.py
│   └── celery.py
│
├── apps/
│   └── <feature>/
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── services.py
│       ├── selectors.py
│       ├── tasks.py               ← Celery tasks (event publishing via Kafka)
│       └── urls.py
│
├── messaging/
│   ├── producers/
│   │   └── order_producer.py      ← confluent-kafka producer
│   └── consumers/
│       └── payment_consumer.py    ← Standalone consumer process
│
├── requirements/
├── manage.py
├── Dockerfile
└── docker-compose.yml
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
│   ├── nginx/
│   │   └── nginx.conf             ← Reverse proxy / API gateway
│   └── celery-flower/             ← Celery monitoring
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
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [db, redis]

  celery-worker:
    build: .
    command: celery -A config worker --loglevel=info --concurrency=4
    env_file: .env
    depends_on: [db, redis]

  celery-beat:
    build: .
    command: celery -A config beat --loglevel=info
    env_file: .env
    depends_on: [db, redis]

  db:
    image: postgres:16-alpine
    environment: {POSTGRES_DB: appdb, POSTGRES_PASSWORD: dev}
    volumes: [db_data:/var/lib/postgresql/data]

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

## E. Complete Requirements (requirements/base.txt)

```
# Core
Django
djangorestframework
djangorestframework-simplejwt
django-cors-headers
django-filter
drf-spectacular              # OpenAPI schema generation
drf-nested-routers           # Nested URL routing

# Database
psycopg[binary]              # psycopg3 (async-capable)
django-redis

# Async tasks
celery
redis
django-celery-beat           # Periodic tasks
django-celery-results        # Store task results

# Messaging
confluent-kafka              # Kafka producer/consumer

# Env & config
django-environ               # os.environ + .env file

# Validation & utils
Pillow                       # Image handling
phonenumbers
django-countries
django-extensions

# Observability
sentry-sdk[django]
django-prometheus
django-structlog             # Structured logging
opentelemetry-instrumentation-django

# Production server
gunicorn
uvicorn[standard]            # ASGI (if using Channels/WebSocket)

# Development (requirements/local.txt)
django-debug-toolbar
Werkzeug                     # Better debug server
factory-boy                  # Test factories
pytest-django
pytest-cov
coverage
ipython
```

---

## Naming Conventions
- Apps: `snake_case` — `users`, `order_items`
- Models: `PascalCase` — `User`, `OrderItem`
- Services/Selectors: module-level functions — `create_user(data)`, `get_user_by_id(id)`
- Views: `PascalCase` — `UserViewSet`, `OrderListAPIView`
- URL names: `kebab-case` — `user-detail`, `order-list`
- DB tables: explicit `db_table = 'users'` (snake_case)
- Celery tasks: `snake_case` — `send_welcome_email`, `process_payment`
- Kafka topics: `user.created`, `order.placed` (dot notation, past tense)
