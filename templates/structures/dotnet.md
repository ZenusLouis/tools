# ASP.NET Core — Production Structure Templates

> **Role: BACKEND ONLY.** Pair with React/Angular/Next.js for frontend.

---

## A. Clean Architecture — Single Service

Dependency rule: outer layers depend on inner layers. Domain has NO framework deps.

```
src/
├── Domain/                              ← NO framework dependencies
│   ├── Entities/
│   │   ├── User.cs                      ← Aggregate root, private setters
│   │   └── Order.cs
│   ├── ValueObjects/
│   │   ├── Email.cs
│   │   └── Money.cs
│   ├── Events/
│   │   ├── UserCreatedEvent.cs          ← Domain events (dispatched post-commit)
│   │   └── OrderPlacedEvent.cs
│   ├── Interfaces/
│   │   ├── IUserRepository.cs           ← Repo interfaces (implemented in Infra)
│   │   └── IUnitOfWork.cs
│   ├── Exceptions/
│   │   ├── DomainException.cs
│   │   └── NotFoundException.cs
│   └── Common/
│       └── BaseEntity.cs               ← Id, CreatedAt, DomainEvents list
│
├── Application/                         ← Use cases, orchestration
│   ├── Commands/
│   │   └── Users/
│   │       ├── CreateUser/
│   │       │   ├── CreateUserCommand.cs     ← record implements IRequest<UserDto>
│   │       │   ├── CreateUserCommandHandler.cs
│   │       │   └── CreateUserCommandValidator.cs  ← FluentValidation
│   │       └── UpdateUser/
│   ├── Queries/
│   │   └── Users/
│   │       └── GetUserById/
│   │           ├── GetUserByIdQuery.cs
│   │           └── GetUserByIdQueryHandler.cs
│   ├── DTOs/
│   │   └── UserDto.cs
│   ├── Behaviours/
│   │   ├── ValidationBehaviour.cs       ← IPipelineBehavior: validates before handler
│   │   ├── LoggingBehaviour.cs
│   │   └── TransactionBehaviour.cs      ← Wraps command handlers in DB transaction
│   ├── Interfaces/
│   │   └── IEmailService.cs             ← External service interfaces
│   └── DependencyInjection.cs           ← AddApplication() extension method
│
├── Infrastructure/                      ← EF Core, external APIs, email, storage
│   ├── Persistence/
│   │   ├── AppDbContext.cs              ← DbContext, dispatches domain events on save
│   │   ├── UnitOfWork.cs
│   │   ├── Configurations/
│   │   │   └── UserEntityConfiguration.cs  ← IEntityTypeConfiguration<User>
│   │   ├── Repositories/
│   │   │   └── UserRepository.cs        ← implements IUserRepository
│   │   └── Migrations/
│   ├── Services/
│   │   ├── EmailService.cs
│   │   └── StripePaymentService.cs
│   ├── Messaging/
│   │   ├── Consumers/
│   │   │   └── OrderCreatedConsumer.cs  ← MassTransit IConsumer<T>
│   │   └── Publishers/
│   │       └── EventPublisher.cs
│   └── DependencyInjection.cs           ← AddInfrastructure() extension method
│
└── WebAPI/                              ← Entry point
    ├── Controllers/
    │   ├── UsersController.cs           ← Inject ISender (MediatR), thin
    │   └── OrdersController.cs
    ├── Middleware/
    │   ├── ExceptionHandlingMiddleware.cs
    │   └── CorrelationIdMiddleware.cs
    ├── Filters/
    │   └── ApiExceptionFilter.cs
    ├── appsettings.json
    ├── appsettings.Development.json
    └── Program.cs                       ← Minimal API hosting, DI registration
```

---

## B. Microservice Structure (Per Service)

Each service is an independent ASP.NET Core app with its own database.

```
<service-name>/                          ← e.g. UserService, OrderService
├── src/
│   ├── <ServiceName>.Domain/
│   ├── <ServiceName>.Application/
│   ├── <ServiceName>.Infrastructure/
│   └── <ServiceName>.Api/
│       ├── Controllers/
│       ├── Program.cs
│       ├── appsettings.json
│       └── Dockerfile
│
├── tests/
│   ├── <ServiceName>.UnitTests/
│   ├── <ServiceName>.IntegrationTests/  ← Testcontainers.PostgreSql
│   └── <ServiceName>.ArchTests/         ← NetArchTest.Rules
│
└── <ServiceName>.sln
```

---

## C. Multi-Service Project Layout

```
project-root/
├── src/
│   ├── Services/
│   │   ├── UserService/
│   │   ├── OrderService/
│   │   ├── PaymentService/
│   │   └── NotificationService/         ← Async only, consumes events
│   │
│   ├── Gateways/
│   │   └── ApiGateway/                  ← YARP reverse proxy
│   │       ├── Program.cs
│   │       └── yarp.json                ← Route config
│   │
│   └── SharedKernel/                    ← Shared Domain primitives (NuGet package)
│       ├── BaseEntity.cs
│       ├── DomainEvent.cs
│       └── Guard.cs
│
├── docker-compose.yml
├── docker-compose.dev.yml
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
      context: ./src/Services/UserService
      dockerfile: src/UserService.Api/Dockerfile
    ports: ["5001:8080"]
    environment:
      ConnectionStrings__Default: Host=user-db;Database=userdb;Username=postgres;Password=dev
      RabbitMQ__Host: rabbitmq
      Jwt__Secret: ${JWT_SECRET}
    depends_on: [user-db, rabbitmq]

  order-service:
    build: ./src/Services/OrderService
    ports: ["5002:8080"]
    environment:
      ConnectionStrings__Default: Host=order-db;Database=orderdb;Username=postgres;Password=dev
      RabbitMQ__Host: rabbitmq
    depends_on: [order-db, rabbitmq]

  api-gateway:
    build: ./src/Gateways/ApiGateway
    ports: ["5000:8080"]
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
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports: ["5672:5672", "15672:15672"]   # 15672 = management UI

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

## E. Program.cs — Production Setup

```csharp
var builder = WebApplication.CreateBuilder(args);

// ── Application + Infrastructure layers ─────────────────
builder.Services
    .AddApplication()
    .AddInfrastructure(builder.Configuration);

// ── Web layer ────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.AddSecurityDefinition("Bearer", ...));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!)),
        };
    });

builder.Services.AddRateLimiter(opt =>
    opt.AddFixedWindowLimiter("fixed", o => { o.PermitLimit = 100; o.Window = TimeSpan.FromSeconds(10); }));

// ── Observability ─────────────────────────────────────────
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddZipkinExporter());

// ── Health checks ─────────────────────────────────────────
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!)
    .AddRedis(builder.Configuration["Redis:Connection"]!);

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
```

---

## F. Complete .csproj Dependencies

```xml
<!-- Application layer -->
<PackageReference Include="MediatR" />
<PackageReference Include="FluentValidation.AspNetCore" />
<PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" />
<PackageReference Include="Ardalis.GuardClauses" />
<PackageReference Include="Ardalis.Result" />

<!-- Infrastructure: EF Core + PostgreSQL -->
<PackageReference Include="Microsoft.EntityFrameworkCore" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
<PackageReference Include="EFCore.NamingConventions" />  <!-- snake_case columns -->

<!-- Infrastructure: Messaging (MassTransit) -->
<PackageReference Include="MassTransit" />
<PackageReference Include="MassTransit.RabbitMQ" />      <!-- or MassTransit.Kafka -->
<PackageReference Include="MassTransit.EntityFrameworkCore" />  <!-- Outbox pattern -->

<!-- Infrastructure: Caching -->
<PackageReference Include="StackExchange.Redis" />
<PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" />

<!-- WebAPI -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" />
<PackageReference Include="Microsoft.AspNetCore.OpenApi" />
<PackageReference Include="Swashbuckle.AspNetCore" />
<PackageReference Include="Serilog.AspNetCore" />
<PackageReference Include="Serilog.Sinks.Seq" />
<PackageReference Include="Microsoft.AspNetCore.RateLimiting" />

<!-- API Gateway (separate project) -->
<PackageReference Include="Yarp.ReverseProxy" />

<!-- Resilience -->
<PackageReference Include="Microsoft.Extensions.Http.Resilience" />  <!-- Polly built-in .NET 8+ -->
<PackageReference Include="Polly.Extensions" />

<!-- Observability -->
<PackageReference Include="OpenTelemetry.Extensions.Hosting" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" />
<PackageReference Include="OpenTelemetry.Instrumentation.EntityFrameworkCore" />
<PackageReference Include="OpenTelemetry.Exporter.Zipkin" />
<PackageReference Include="prometheus-net.AspNetCore" />

<!-- Testing -->
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />
<PackageReference Include="Testcontainers.PostgreSql" />
<PackageReference Include="Testcontainers.RabbitMq" />
<PackageReference Include="FluentAssertions" />
<PackageReference Include="NetArchTest.Rules" />          <!-- enforce layer deps -->
<PackageReference Include="NSubstitute" />                <!-- mocking -->
<PackageReference Include="Bogus" />                      <!-- test data -->
```

---

## Naming Conventions
- Projects: `PascalCase` — `UserService.Domain`, `UserService.Api`
- Classes: `PascalCase` — `CreateUserCommandHandler`, `UserEntityConfiguration`
- Files match class name exactly: `CreateUserCommand.cs`
- Interfaces: `I` prefix — `IUserRepository`, `IUnitOfWork`
- DB tables: `snake_case` via `EFCore.NamingConventions` — `user_roles`, `order_items`
- API routes: `/api/v1/users/{id}/orders` (kebab-case, versioned)
- MassTransit exchanges: `user-created`, `order-placed` (kebab-case, past tense)
