---
name: spring-boot
description: >
  Activate when: context.json framework includes "spring-boot", or pom.xml contains "spring-boot-starter".
  Backend-only framework. Provides production-grade Spring Boot layered/microservice patterns.
role: BACKEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# Spring Boot Skill — Backend Only

## Layer Architecture (Separation of Concerns)

```
Controller → Service Interface → ServiceImpl → Repository → Entity/Domain
```

### Controller Layer — HTTP only, ZERO business logic
```java
@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor  // Lombok constructor injection
@Tag(name = "User API")
public class UserController {
    private final UserService userService;  // Inject interface, NOT impl

    @PostMapping
    public ResponseEntity<UserResponse> create(@Valid @RequestBody CreateUserRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(userService.create(req));
    }
}
```

### Service Layer — Business logic + Transaction boundary
- Declare as **interface** + **impl** pair (`UserService` + `UserServiceImpl`)
- `@Transactional` belongs HERE for multi-step operations spanning multiple repos
- `@Transactional(readOnly = true)` for all read operations
- Never call other @Transactional methods on `this` (bypasses proxy — use self-injection or extract)

```java
public interface UserService {
    UserResponse create(CreateUserRequest req);
    UserResponse findById(Long id);
}

@Service
@RequiredArgsConstructor
@Transactional          // class-level default: wraps ALL public methods
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;  // multi-repo → MUST be in same tx

    @Override
    @Transactional(readOnly = true)  // overrides class-level for reads
    public UserResponse findById(Long id) {
        return userRepository.findById(id)
            .map(userMapper::toResponse)
            .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    @Override
    public UserResponse create(CreateUserRequest req) {
        // Multiple repo calls → one transaction = ACID guaranteed
        Role role = roleRepository.findByName("USER").orElseThrow();
        User user = new User(req.getEmail(), passwordEncoder.encode(req.getPassword()), role);
        return userMapper.toResponse(userRepository.save(user));
    }
}
```

### Why @Transactional on Service (not just Repository):
- Spring Data's `SimpleJpaRepository` ALREADY adds `@Transactional` to its CRUD methods — so simple single-repo ops are fine without it
- When your service calls **multiple repos** that must be atomic, you MUST add `@Transactional` at the service level — otherwise each repo call is a separate transaction
- DDD note: In Hexagonal/DDD, the Application Service layer IS the transaction boundary — "service layer acts as a transaction boundary" (Baeldung, DZone)

### Repository Layer — DB access only
```java
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u JOIN FETCH u.roles WHERE u.id = :id")
    Optional<User> findByIdWithRoles(Long id);  // explicit JOIN FETCH to avoid N+1
}
```
- Spring Data CRUD methods are ALREADY `@Transactional` — don't re-annotate them
- Custom `@Query` with `@Modifying` needs `@Transactional` from calling service

### Entity Layer — JPA mapping
```java
@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String email;

    @Version  // optimistic locking — prevents lost updates under concurrency
    private Long version;

    @ManyToMany(fetch = FetchType.LAZY)  // LAZY always — use JOIN FETCH in queries
    @JoinTable(name = "user_roles")
    private Set<Role> roles = new HashSet<>();
}
```

---

## Dependency Injection — Constructor Injection Always
```java
// CORRECT: constructor injection via @RequiredArgsConstructor (Lombok)
@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements OrderService {
    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final ApplicationEventPublisher eventPublisher;
}

// WRONG: field injection — breaks testability
@Service
public class OrderServiceImpl {
    @Autowired private OrderRepository orderRepository;  // ❌
}
```

---

## Production Folder Structure (Feature-Based, Microservice-Ready)

```
com.company.servicename/
├── controller/
│   ├── UserController.java
│   └── advice/
│       └── GlobalExceptionHandler.java   ← @RestControllerAdvice
├── service/
│   ├── UserService.java                  ← Interface
│   └── impl/
│       └── UserServiceImpl.java          ← @Service @Transactional
├── repository/
│   └── UserRepository.java               ← extends JpaRepository
├── domain/entity/
│   └── User.java                         ← @Entity, @Version for OCC
├── dto/
│   ├── request/
│   │   ├── CreateUserRequest.java        ← @Valid fields
│   │   └── UpdateUserRequest.java
│   └── response/
│       └── UserResponse.java
├── mapper/
│   └── UserMapper.java                   ← MapStruct interface
├── config/
│   ├── SecurityConfig.java               ← Spring Security
│   ├── SwaggerConfig.java                ← SpringDoc OpenAPI
│   ├── CacheConfig.java                  ← Redis/Caffeine
│   └── JpaConfig.java
├── exception/
│   ├── ResourceNotFoundException.java
│   ├── BusinessException.java
│   └── ErrorResponse.java
├── aspect/
│   └── LoggingAspect.java                ← AOP: method logging, perf
├── util/
│   └── DateUtils.java
├── constants/
│   └── ApiConstants.java                 ← "/api/v1/users" constants
└── Application.java
```

---

## Complete Production Dependencies (pom.xml)

```xml
<!-- Core -->
spring-boot-starter-web
spring-boot-starter-data-jpa
spring-boot-starter-validation
spring-boot-starter-security
spring-boot-starter-actuator

<!-- Database -->
postgresql (runtime)
flyway-core  OR  liquibase-core     ← migrations (pick one)
spring-boot-starter-data-redis      ← caching/sessions

<!-- Resilience & Observability -->
resilience4j-spring-boot3           ← circuit breaker, rate limiter, retry
micrometer-tracing-bridge-otel      ← distributed tracing
zipkin-reporter-brave               ← Zipkin export

<!-- Developer Tools -->
lombok
mapstruct
mapstruct-processor
springdoc-openapi-starter-webmvc-ui  ← Swagger UI

<!-- Messaging (if event-driven) -->
spring-kafka  OR  spring-boot-starter-amqp   ← Kafka or RabbitMQ

<!-- Cloud (if microservice) -->
spring-cloud-starter-netflix-eureka-client
spring-cloud-starter-config
spring-cloud-starter-loadbalancer

<!-- Testing -->
spring-boot-starter-test
testcontainers (postgresql, kafka)
spring-security-test
wiremock-spring-boot
```

---

## Microservice Communication Patterns

### REST (sync)
```java
@FeignClient(name = "payment-service", fallback = PaymentFallback.class)
public interface PaymentClient {
    @PostMapping("/api/v1/payments")
    PaymentResponse charge(@RequestBody ChargeRequest req);
}
```

### Event-Driven (async — Kafka)
```java
@Service @RequiredArgsConstructor
public class OrderService {
    private final KafkaTemplate<String, OrderCreatedEvent> kafkaTemplate;

    public void createOrder(CreateOrderRequest req) {
        Order order = orderRepository.save(new Order(req));
        kafkaTemplate.send("order.created", new OrderCreatedEvent(order.getId()));
    }
}

@KafkaListener(topics = "order.created", groupId = "inventory-service")
public void handleOrderCreated(OrderCreatedEvent event) { ... }
```

### Circuit Breaker (Resilience4j)
```java
@CircuitBreaker(name = "paymentService", fallbackMethod = "fallbackPayment")
@Retry(name = "paymentService")
public PaymentResponse charge(ChargeRequest req) { ... }
```

---

## ACID Transaction Rules
- Multi-table writes → `@Transactional` at service method level
- `@Transactional(rollbackFor = Exception.class)` for checked exceptions
- Keep transactions SHORT — no HTTP calls, emails, file I/O inside `@Transactional`
- `@Version` on entities for optimistic concurrency control
- Outbox pattern for cross-service atomic operations (DB write + event publish)

---

## application.yml (Production Template)
```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
    hikari:
      maximum-pool-size: 10
      connection-timeout: 30000
  jpa:
    hibernate:
      ddl-auto: validate          # NEVER create/update in prod
    open-in-view: false           # Prevent lazy-load trap
    properties:
      hibernate:
        format_sql: false
  flyway:
    enabled: true
    locations: classpath:db/migration

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus

resilience4j:
  circuitbreaker:
    instances:
      paymentService:
        registerHealthIndicator: true
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 10s
```

## Learned Patterns
<!-- auto-learned entries appended below -->
