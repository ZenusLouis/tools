# Spring Boot — Production Structure Templates

> **Role: BACKEND ONLY.** Pair with React/Angular/Next.js for frontend.

---

## A. Modular Monolith (Feature-Based)

Recommended starting point. Each feature can become a standalone microservice later.

```
com.company.appname/
├── controller/
│   ├── UserController.java
│   ├── OrderController.java
│   └── advice/
│       ├── GlobalExceptionHandler.java   ← @RestControllerAdvice
│       └── ErrorResponse.java
│
├── service/
│   ├── UserService.java                  ← Interface
│   ├── impl/
│   │   └── UserServiceImpl.java          ← @Service @Transactional
│   ├── OrderService.java
│   └── impl/
│       └── OrderServiceImpl.java
│
├── repository/
│   ├── UserRepository.java               ← extends JpaRepository<User, Long>
│   └── OrderRepository.java
│
├── domain/
│   ├── entity/
│   │   ├── User.java                     ← @Entity, @Version for OCC
│   │   └── Order.java
│   └── event/
│       └── UserCreatedEvent.java
│
├── dto/
│   ├── request/
│   │   ├── CreateUserRequest.java
│   │   └── UpdateUserRequest.java
│   └── response/
│       ├── UserResponse.java
│       └── PageResponse.java
│
├── mapper/
│   └── UserMapper.java                   ← MapStruct interface
│
├── config/
│   ├── SecurityConfig.java
│   ├── SwaggerConfig.java
│   ├── CacheConfig.java                  ← Redis / Caffeine
│   ├── KafkaConfig.java                  ← if event-driven
│   └── JpaAuditingConfig.java
│
├── exception/
│   ├── ResourceNotFoundException.java    ← extends RuntimeException
│   ├── BusinessException.java
│   └── ErrorCode.java                    ← enum of error codes
│
├── aspect/
│   ├── LoggingAspect.java                ← method entry/exit + duration
│   └── AuditAspect.java
│
├── util/
│   ├── DateUtils.java
│   └── SecurityUtils.java
│
├── constants/
│   └── ApiConstants.java
│
└── Application.java

src/main/resources/
├── application.yml
├── application-dev.yml
├── application-prod.yml
└── db/
    └── migration/
        ├── V1__create_users.sql          ← Flyway migrations
        └── V2__create_orders.sql
```

---

## B. Microservice Structure (Per Service)

Each service is an independent Spring Boot app with its own DB.

```
<service-name>/                           ← e.g. user-service, order-service
├── src/main/java/com/company/<service>/
│   ├── controller/
│   ├── service/
│   │   ├── <Feature>Service.java         ← interface
│   │   └── impl/<Feature>ServiceImpl.java
│   ├── repository/
│   ├── domain/
│   │   ├── entity/
│   │   ├── event/                        ← domain events (published to Kafka)
│   │   └── valueobject/
│   ├── dto/
│   │   ├── request/
│   │   └── response/
│   ├── mapper/                           ← MapStruct
│   ├── client/                           ← Feign clients for other services
│   │   └── PaymentServiceClient.java
│   ├── messaging/
│   │   ├── producer/
│   │   │   └── OrderEventProducer.java   ← Kafka producer
│   │   └── consumer/
│   │       └── PaymentEventConsumer.java ← @KafkaListener
│   ├── config/
│   ├── exception/
│   └── Application.java
│
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/
│
├── src/test/
│   ├── unit/
│   └── integration/                      ← Testcontainers
│
├── docker/
│   ├── Dockerfile
│   └── Dockerfile.dev
└── pom.xml
```

---

## C. Multi-Service Project Layout

```
project-root/
├── services/
│   ├── user-service/             ← User domain
│   ├── order-service/            ← Order domain
│   ├── payment-service/          ← Payment domain
│   ├── notification-service/     ← Email/SMS (async, event-driven)
│   └── api-gateway/              ← Spring Cloud Gateway
│
├── infrastructure/
│   ├── eureka-server/            ← Service discovery
│   ├── config-server/            ← Centralized config
│   └── zipkin/                   ← Distributed tracing
│
├── docker-compose.yml            ← Full stack: all services + infra
├── docker-compose.dev.yml        ← Dev with live reload
└── k8s/                          ← Kubernetes manifests
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
    build: ./services/user-service
    ports: ["8081:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://user-db:5432/userdb
      EUREKA_CLIENT_SERVICE_URL_DEFAULT_ZONE: http://eureka:8761/eureka
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:9092
    depends_on: [user-db, eureka, kafka]

  order-service:
    build: ./services/order-service
    ports: ["8082:8080"]
    depends_on: [order-db, eureka, kafka]

  api-gateway:
    build: ./services/api-gateway
    ports: ["8080:8080"]
    environment:
      EUREKA_CLIENT_SERVICE_URL_DEFAULT_ZONE: http://eureka:8761/eureka
    depends_on: [eureka]

  # ── Databases (one per service) ─────────────────────────
  user-db:
    image: postgres:latest
    environment: {POSTGRES_DB: userdb, POSTGRES_PASSWORD: dev}
    volumes: [user_db_data:/var/lib/postgresql/data]

  order-db:
    image: postgres:latest
    environment: {POSTGRES_DB: orderdb, POSTGRES_PASSWORD: dev}
    volumes: [order_db_data:/var/lib/postgresql/data]

  # ── Infrastructure ──────────────────────────────────────
  eureka:
    image: steeltoeoss/eureka-server
    ports: ["8761:8761"]

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
    depends_on: [zookeeper]

  zookeeper:
    image: confluentinc/cp-zookeeper:latest

  zipkin:
    image: openzipkin/zipkin
    ports: ["9411:9411"]

  redis:
    image: redis:alpine

volumes:
  user_db_data:
  order_db_data:
```

---

## E. Key application.yml (Per Service)
```yaml
spring:
  application:
    name: user-service
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME:postgres}
    password: ${SPRING_DATASOURCE_PASSWORD:dev}
    hikari:
      maximum-pool-size: 10
      connection-timeout: 30000
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
    properties:
      hibernate.format_sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration
  kafka:
    bootstrap-servers: ${SPRING_KAFKA_BOOTSTRAP_SERVERS:localhost:9092}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      group-id: user-service
      auto-offset-reset: earliest

eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_CLIENT_SERVICE_URL_DEFAULT_ZONE:http://localhost:8761/eureka}
  instance:
    prefer-ip-address: true

management:
  endpoints.web.exposure.include: health,info,metrics,prometheus
  tracing:
    sampling.probability: 1.0
    
resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
```

---

## F. Complete pom.xml Dependencies
```xml
<dependencies>
    <!-- Core -->
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-jpa</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-redis</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-cache</artifactId></dependency>

    <!-- Database -->
    <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
    <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
    <!-- OR: <artifactId>liquibase-core</artifactId> -->

    <!-- Messaging -->
    <dependency><groupId>org.springframework.kafka</groupId><artifactId>spring-kafka</artifactId></dependency>

    <!-- Cloud / Microservices -->
    <dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-starter-netflix-eureka-client</artifactId></dependency>
    <dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-starter-openfeign</artifactId></dependency>
    <dependency><groupId>org.springframework.cloud</groupId><artifactId>spring-cloud-starter-loadbalancer</artifactId></dependency>
    <dependency><groupId>io.github.resilience4j</groupId><artifactId>resilience4j-spring-boot3</artifactId></dependency>

    <!-- JWT -->
    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-api</artifactId></dependency>
    <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-impl</artifactId></dependency>

    <!-- Developer Tools -->
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></dependency>
    <dependency><groupId>org.mapstruct</groupId><artifactId>mapstruct</artifactId></dependency>
    <dependency><groupId>org.springdoc</groupId><artifactId>springdoc-openapi-starter-webmvc-ui</artifactId></dependency>

    <!-- Observability -->
    <dependency><groupId>io.micrometer</groupId><artifactId>micrometer-tracing-bridge-otel</artifactId></dependency>
    <dependency><groupId>io.opentelemetry.instrumentation</groupId><artifactId>opentelemetry-spring-boot-starter</artifactId></dependency>

    <!-- Testing -->
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.testcontainers</groupId><artifactId>postgresql</artifactId><scope>test</scope></dependency>
    <dependency><groupId>org.testcontainers</groupId><artifactId>kafka</artifactId><scope>test</scope></dependency>
    <dependency><groupId>com.github.tomakehurst</groupId><artifactId>wiremock-jre8</artifactId><scope>test</scope></dependency>
</dependencies>
```

---

## Naming Conventions
- Classes: `PascalCase` — `UserServiceImpl`, `OrderController`
- Methods/fields: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- DB tables: `snake_case` — `user_roles`, `order_items`
- API paths: `/api/v1/users/{id}/orders` (kebab-case, versioned)
- Kafka topics: `user.created`, `order.placed` (dot notation, past tense)
