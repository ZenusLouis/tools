---
name: dotnet
description: >
  Activate when: context.json framework includes "dotnet", or a .csproj file is detected.
  Backend-only framework. ASP.NET Core Clean Architecture + CQRS + microservice patterns.
role: BACKEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# ASP.NET Core Skill — Backend Only

## Clean Architecture Layers (Dependency Rule: outer → inner)

```
WebAPI → Application → Domain ← Infrastructure
```

- **Domain**: Entities, Value Objects, Domain Events, Interfaces — NO framework deps
- **Application**: Use cases (Commands/Queries), DTOs, Validators, Interfaces — depends on Domain only
- **Infrastructure**: EF Core, external services, email, storage — implements Application interfaces
- **WebAPI**: Controllers, Middleware, DI registration, Program.cs

---

## Controller Layer — Routes + serialize/deserialize only
```csharp
[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly ISender _sender;  // MediatR — inject ISender not IMediator

    public UsersController(ISender sender) => _sender = sender;

    [HttpPost]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateUserCommand command)
    {
        var result = await _sender.Send(command);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }
}
```

## Application Layer — CQRS with MediatR

### Command (write operation)
```csharp
public record CreateUserCommand(string Email, string Password) : IRequest<UserDto>;

public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, UserDto>
{
    private readonly IUserRepository _userRepo;
    private readonly IPasswordHasher _hasher;
    private readonly IUnitOfWork _unitOfWork;

    // Constructor injection — primary DI pattern
    public CreateUserCommandHandler(
        IUserRepository userRepo,
        IPasswordHasher hasher,
        IUnitOfWork unitOfWork)
    {
        _userRepo = userRepo;
        _hasher = hasher;
        _unitOfWork = unitOfWork;
    }

    public async Task<UserDto> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        var user = User.Create(cmd.Email, _hasher.Hash(cmd.Password));
        await _userRepo.AddAsync(user, ct);
        await _unitOfWork.SaveChangesAsync(ct);  // commit transaction here
        return user.ToDto();
    }
}
```

### Query (read operation)
```csharp
public record GetUserQuery(Guid Id) : IRequest<UserDto>;

public class GetUserQueryHandler : IRequestHandler<GetUserQuery, UserDto>
{
    private readonly IUserReadRepository _repo;  // separate read model
    public GetUserQueryHandler(IUserReadRepository repo) => _repo = repo;

    public async Task<UserDto> Handle(GetUserQuery query, CancellationToken ct)
        => await _repo.GetByIdAsync(query.Id, ct)
           ?? throw new NotFoundException(nameof(User), query.Id);
}
```

### Validation Pipeline Behavior
```csharp
public class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
        => _validators = validators;

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        var failures = _validators
            .Select(v => v.Validate(request))
            .SelectMany(r => r.Errors)
            .Where(f => f != null)
            .ToList();

        if (failures.Any())
            throw new ValidationException(failures);

        return await next();
    }
}
```

## Domain Layer — Pure business logic
```csharp
public class User : BaseEntity, IAggregateRoot
{
    public string Email { get; private set; }
    public string PasswordHash { get; private set; }

    private User() { }  // EF Core requires parameterless ctor

    public static User Create(string email, string passwordHash)
    {
        Guard.Against.NullOrWhiteSpace(email, nameof(email));
        var user = new User { Email = email, PasswordHash = passwordHash };
        user.AddDomainEvent(new UserCreatedEvent(user.Id));
        return user;
    }

    public void ChangePassword(string newHash)
    {
        PasswordHash = newHash;
        AddDomainEvent(new PasswordChangedEvent(Id));
    }
}
```

## Infrastructure Layer — EF Core
```csharp
public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        mb.ApplyUtcDateTimeConverter();
    }

    // Dispatch domain events on SaveChangesAsync
    public override async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        var events = ChangeTracker.Entries<BaseEntity>()
            .SelectMany(e => e.Entity.PopDomainEvents())
            .ToList();

        var result = await base.SaveChangesAsync(ct);
        foreach (var e in events) await _mediator.Publish(e, ct);
        return result;
    }
}

public class UserEntityConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.HasKey(u => u.Id);
        b.Property(u => u.Email).HasMaxLength(256).IsRequired();
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.RowVersion).IsRowVersion();  // optimistic concurrency
    }
}
```

## Dependency Injection — Program.cs Registration
```csharp
// Infrastructure/DependencyInjection.cs
public static class InfrastructureDI
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseNpgsql(config.GetConnectionString("Default"),
                npg => npg.EnableRetryOnFailure()));

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IPasswordHasher, BCryptPasswordHasher>();
        services.AddStackExchangeRedisCache(opt =>
            opt.Configuration = config["Redis:Connection"]);

        return services;
    }
}

// Application/DependencyInjection.cs
public static class ApplicationDI
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
        });
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
        services.AddAutoMapper(Assembly.GetExecutingAssembly());
        return services;
    }
}
```

---

## ACID Transaction Rules
- `SaveChangesAsync()` wraps a single unit of work atomically (EF Core)
- Explicit transaction for cross-aggregate:
  ```csharp
  await using var tx = await _context.Database.BeginTransactionAsync(ct);
  try { ... await _context.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
  catch { await tx.RollbackAsync(ct); throw; }
  ```
- `[ConcurrencyCheck]` or `IsRowVersion()` for optimistic locking
- Outbox pattern (MassTransit Outbox) for cross-service consistency

---

## Complete Production Dependencies (.csproj)
```xml
<!-- Application -->
<PackageReference Include="MediatR" />
<PackageReference Include="FluentValidation.AspNetCore" />
<PackageReference Include="AutoMapper.Extensions.Microsoft.DependencyInjection" />
<PackageReference Include="Ardalis.GuardClauses" />
<PackageReference Include="Ardalis.Result" />

<!-- Infrastructure -->
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" />
<PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Tools" />
<PackageReference Include="StackExchange.Redis" />
<PackageReference Include="MassTransit.RabbitMQ" />   <!-- or MassTransit.Kafka -->
<PackageReference Include="MassTransit.EntityFrameworkCore" />   <!-- outbox -->

<!-- WebAPI -->
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" />
<PackageReference Include="Microsoft.AspNetCore.OpenApi" />
<PackageReference Include="Swashbuckle.AspNetCore" />
<PackageReference Include="Serilog.AspNetCore" />
<PackageReference Include="Microsoft.AspNetCore.RateLimiting" />

<!-- Resilience -->
<PackageReference Include="Microsoft.Extensions.Http.Resilience" />  <!-- Polly built-in .NET 8 -->
<PackageReference Include="Microsoft.Extensions.ServiceDiscovery" />  <!-- Aspire -->

<!-- Observability -->
<PackageReference Include="OpenTelemetry.Extensions.Hosting" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" />
<PackageReference Include="OpenTelemetry.Exporter.Zipkin" />

<!-- Testing -->
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" />
<PackageReference Include="Testcontainers.PostgreSql" />
<PackageReference Include="FluentAssertions" />
<PackageReference Include="NetArchTest.Rules" />  <!-- enforce layer deps -->
```

## Learned Patterns
<!-- auto-learned entries appended below -->
