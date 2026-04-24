# NestJS — Production Structure Templates

> **Role: BACKEND / BFF.** Pair with Next.js/React/Angular for frontend.

---

## A. Modular Monolith (Feature-Based)

Recommended starting point. Each module can be extracted to a microservice later.

```
src/
├── modules/
│   ├── auth/
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── auth-response.dto.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── refresh.strategy.ts
│   │   ├── auth.controller.ts         ← Routes + validation only
│   │   ├── auth.service.ts            ← @Injectable(), ALL business logic
│   │   └── auth.module.ts             ← DI wiring
│   │
│   └── users/
│       ├── dto/
│       │   ├── create-user.dto.ts     ← class-validator decorators
│       │   ├── update-user.dto.ts     ← extends PartialType(CreateUserDto)
│       │   └── user-response.dto.ts   ← class-transformer @Exclude/@Expose
│       ├── entities/
│       │   └── user.entity.ts         ← TypeORM @Entity, @Version for OCC
│       ├── events/
│       │   └── user-created.event.ts
│       ├── users.controller.ts
│       ├── users.service.ts
│       ├── users.repository.ts        ← Custom queries (optional)
│       └── users.module.ts
│
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts  ← @CurrentUser() param decorator
│   │   └── roles.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts   ← @Catch(HttpException)
│   ├── guards/
│   │   └── throttler.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   └── transform.interceptor.ts   ← Wrap responses: { data, meta }
│   ├── pipes/
│   │   └── parse-object-id.pipe.ts
│   └── types/
│       └── paginated.type.ts
│
├── config/
│   ├── app.config.ts                  ← ConfigModule schema (Joi validation)
│   ├── database.config.ts
│   └── jwt.config.ts
│
└── main.ts                            ← ValidationPipe global + Swagger + CORS
```

---

## B. Microservice Structure (Per Service)

Each service is an independent NestJS app with its own database.

```
<service-name>/                        ← e.g. user-service, order-service
├── src/
│   ├── modules/
│   │   └── <feature>/
│   │       ├── dto/
│   │       ├── entities/
│   │       ├── events/                ← Domain events (emitted via EventEmitter2 or Kafka)
│   │       ├── <feature>.controller.ts
│   │       ├── <feature>.service.ts
│   │       └── <feature>.module.ts
│   │
│   ├── messaging/
│   │   ├── producers/
│   │   │   └── order-event.producer.ts  ← ClientKafka or ClientRedis
│   │   └── consumers/
│   │       └── payment-event.consumer.ts  ← @EventPattern/@MessagePattern
│   │
│   ├── common/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   └── pipes/
│   │
│   ├── config/
│   │   └── microservice.config.ts
│   │
│   └── main.ts                        ← Hybrid HTTP + Microservice
│
├── test/
│   ├── unit/
│   └── e2e/                           ← Supertest + Testcontainers
│
├── docker/
│   ├── Dockerfile
│   └── Dockerfile.dev
├── .env.example
└── package.json
```

---

## C. Multi-Service Project Layout (NestJS Monorepo)

```
project-root/
├── apps/
│   ├── user-service/         ← User domain (HTTP + Kafka consumer)
│   ├── order-service/        ← Order domain
│   ├── payment-service/      ← Payment domain (Stripe webhook)
│   ├── notification-service/ ← Email/SMS (async, event-driven only)
│   └── api-gateway/          ← HTTP reverse proxy or custom routing
│
├── libs/                     ← Shared NestJS libraries
│   ├── common/               ← Guards, filters, interceptors, decorators
│   ├── contracts/            ← Kafka event schemas (shared DTOs)
│   └── config/               ← Shared ConfigModule
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── nest-cli.json             ← Monorepo project declarations
├── tsconfig.base.json
└── k8s/
    ├── deployments/
    ├── services/
    └── ingress/
```

---

## D. Docker Compose (Microservices)

```yaml
version: '3.9'
services:
  # ── Services ───────────────────────────────────────────
  user-service:
    build:
      context: ./apps/user-service
      dockerfile: docker/Dockerfile
    ports: ["3001:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:dev@user-db:5432/userdb
      KAFKA_BROKERS: kafka:9092
      JWT_SECRET: ${JWT_SECRET}
    depends_on: [user-db, kafka]

  order-service:
    build: ./apps/order-service
    ports: ["3002:3000"]
    environment:
      DATABASE_URL: postgresql://postgres:dev@order-db:5432/orderdb
      KAFKA_BROKERS: kafka:9092
    depends_on: [order-db, kafka]

  api-gateway:
    build: ./apps/api-gateway
    ports: ["3000:3000"]
    environment:
      USER_SERVICE_URL: http://user-service:3000
      ORDER_SERVICE_URL: http://order-service:3000
    depends_on: [user-service, order-service]

  # ── Databases (one per service) ─────────────────────────
  user-db:
    image: postgres:16-alpine
    environment: {POSTGRES_DB: userdb, POSTGRES_PASSWORD: dev}
    volumes: [user_db_data:/var/lib/postgresql/data]

  order-db:
    image: postgres:16-alpine
    environment: {POSTGRES_DB: orderdb, POSTGRES_PASSWORD: dev}
    volumes: [order_db_data:/var/lib/postgresql/data]

  # ── Infrastructure ──────────────────────────────────────
  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:latest

  redis:
    image: redis:7-alpine

  zipkin:
    image: openzipkin/zipkin
    ports: ["9411:9411"]

volumes:
  user_db_data:
  order_db_data:
```

---

## E. main.ts — Hybrid HTTP + Microservice

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Microservice transport ────────────────────────────
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'user-service',
        brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
      },
      consumer: { groupId: 'user-service-consumer' },
    },
  });

  // ── Global middleware ─────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  // ── Swagger ───────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('User Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  await app.startAllMicroservices();
  await app.listen(3000);
}
bootstrap();
```

---

## F. Complete package.json Dependencies

```json
{
  "dependencies": {
    "@nestjs/common": "latest",
    "@nestjs/core": "latest",
    "@nestjs/platform-express": "latest",
    "@nestjs/config": "latest",

    "@nestjs/typeorm": "latest",
    "typeorm": "latest",
    "pg": "latest",

    "@nestjs/swagger": "latest",
    "@nestjs/jwt": "latest",
    "@nestjs/passport": "latest",
    "passport-jwt": "latest",
    "passport": "latest",
    "bcrypt": "latest",

    "@nestjs/microservices": "latest",
    "kafkajs": "latest",
    "ioredis": "latest",

    "@nestjs/cqrs": "latest",
    "@nestjs/event-emitter": "latest",
    "@nestjs/schedule": "latest",
    "@nestjs/throttler": "latest",
    "@nestjs/terminus": "latest",

    "class-validator": "latest",
    "class-transformer": "latest",

    "nestjs-pino": "latest",
    "pino-http": "latest",

    "@opentelemetry/sdk-node": "latest",
    "@opentelemetry/auto-instrumentations-node": "latest"
  },
  "devDependencies": {
    "@nestjs/cli": "latest",
    "@nestjs/testing": "latest",
    "jest": "latest",
    "@types/jest": "latest",
    "ts-jest": "latest",
    "supertest": "latest",
    "@types/supertest": "latest",
    "testcontainers": "latest",
    "@faker-js/faker": "latest",
    "typescript": "latest"
  }
}
```

---

## Naming Conventions
- Classes: `PascalCase` — `UserService`, `OrderController`
- Files: `kebab-case` — `user.service.ts`, `create-user.dto.ts`
- Methods/fields: `camelCase`
- DB tables: `snake_case` — `user_roles`, `order_items`
- API paths: `/api/v1/users/:id/orders` (kebab-case, versioned)
- Kafka topics: `user.created`, `order.placed` (dot notation, past tense)
- Events: `UserCreatedEvent`, `OrderPlacedEvent` (PascalCase + Event suffix)
