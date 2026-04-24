---
name: nestjs
description: >
  Activate when: context.json framework includes "nestjs", or package.json contains "@nestjs/core".
  Can be Backend API or BFF (Backend-for-Frontend). Supports microservices natively.
role: BACKEND / BFF
model: claude-sonnet-4-6
disable-model-invocation: true
---

# NestJS Skill — Backend / BFF

## Layer Architecture (Separation of Concerns)

```
Controller → Service → Repository → Entity/Schema
```

### Controller Layer — Routing + validation only
```typescript
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
export class UserController {
    constructor(private readonly userService: UserService) {}  // DI via constructor

    @Post()
    @ApiOperation({ summary: 'Create user' })
    async create(@Body() dto: CreateUserDto): Promise<UserResponse> {
        return this.userService.create(dto);  // delegate immediately — zero logic here
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponse> {
        return this.userService.findOne(id);
    }
}
```

### Service Layer — ALL business logic lives here
```typescript
@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,  // TypeORM
        // OR: private readonly userRepo: UserRepository  // custom repo
        private readonly roleService: RoleService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async create(dto: CreateUserDto): Promise<UserResponse> {
        const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
        if (existingUser) throw new ConflictException('Email already in use');

        const hashedPassword = await bcrypt.hash(dto.password, 12);
        const user = this.userRepo.create({ ...dto, password: hashedPassword });
        const saved = await this.userRepo.save(user);

        this.eventEmitter.emit('user.created', new UserCreatedEvent(saved.id));
        return plainToInstance(UserResponse, saved);
    }
}
```

### Repository Layer — DB access only
```typescript
@Injectable()
export class UserRepository {
    constructor(
        @InjectRepository(User)
        private readonly repo: Repository<User>,
        private readonly dataSource: DataSource,
    ) {}

    async findWithRoles(id: number): Promise<User | null> {
        return this.repo.findOne({ where: { id }, relations: ['roles'] });
    }

    // Multi-table atomic operation using QueryRunner (manual transaction)
    async createWithProfile(dto: CreateUserDto, profileDto: CreateProfileDto): Promise<User> {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const user = queryRunner.manager.create(User, dto);
            await queryRunner.manager.save(user);
            const profile = queryRunner.manager.create(Profile, { ...profileDto, userId: user.id });
            await queryRunner.manager.save(profile);
            await queryRunner.commitTransaction();
            return user;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }
}
```

---

## Module Structure (per feature)
```
src/modules/<feature>/
├── dto/
│   ├── create-<feature>.dto.ts   ← class-validator decorators
│   ├── update-<feature>.dto.ts   ← extends PartialType(Create)
│   └── <feature>-response.dto.ts ← class-transformer for serialization
├── entities/
│   └── <feature>.entity.ts       ← TypeORM @Entity, @Column, @Version
├── <feature>.controller.ts       ← thin — routing only
├── <feature>.service.ts          ← ALL business logic
├── <feature>.repository.ts       ← custom DB queries (optional)
├── <feature>.module.ts           ← DI wiring
└── events/
    └── <feature>-created.event.ts
```

---

## Dependency Injection — Module-based IoC

```typescript
@Module({
    imports: [
        TypeOrmModule.forFeature([User]),  // registers UserRepository
        RoleModule,                         // import to use RoleService
        EventEmitterModule.forRoot(),
    ],
    controllers: [UserController],
    providers: [
        UserService,
        UserRepository,  // custom repo if using
    ],
    exports: [UserService],  // export what other modules need
})
export class UserModule {}
```

**DI Rules:**
- Always inject interfaces via tokens for better testability:
  ```typescript
  providers: [
      { provide: 'IUserRepository', useClass: UserRepository },
  ]
  // inject: @Inject('IUserRepository') private repo: IUserRepository
  ```
- `@Optional()` for non-critical dependencies
- `@Global()` module only for truly cross-cutting singletons (config, logging)
- Circular deps: `forwardRef(() => ModuleB)` in both modules

---

## Microservices (NestJS Native)

### Transport Layers
```typescript
// main.ts — hybrid (HTTP + Microservice)
const app = await NestFactory.create(AppModule);
app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
        client: { brokers: [process.env.KAFKA_BROKER] },
        consumer: { groupId: 'user-service' },
    },
});
await app.startAllMicroservices();
await app.listen(3000);
```

### Message Patterns
```typescript
// Request-Response (sync)
@MessagePattern('get_user')
async getUser(@Payload() data: { id: number }): Promise<User> {
    return this.userService.findOne(data.id);
}

// Event-Based (async fire-and-forget)
@EventPattern('order.created')
async handleOrderCreated(@Payload() event: OrderCreatedEvent): Promise<void> {
    await this.inventoryService.reserveItems(event.orderId);
}
```

### CQRS Pattern
```typescript
// Command
export class CreateUserCommand {
    constructor(public readonly dto: CreateUserDto) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
    constructor(private readonly userRepo: UserRepository) {}

    async execute(command: CreateUserCommand): Promise<User> {
        return this.userRepo.create(command.dto);
    }
}
```

---

## Complete Production Dependencies

```json
"dependencies": {
    "@nestjs/core": "latest",
    "@nestjs/common": "latest",
    "@nestjs/platform-express": "latest",
    "@nestjs/config": "latest",
    "@nestjs/typeorm": "latest",
    "@nestjs/jwt": "latest",
    "@nestjs/passport": "latest",
    "@nestjs/swagger": "latest",
    "@nestjs/microservices": "latest",
    "@nestjs/cqrs": "latest",
    "@nestjs/event-emitter": "latest",
    "@nestjs/schedule": "latest",
    "@nestjs/throttler": "latest",
    "typeorm": "latest",
    "pg": "latest",
    "prisma": "latest",           // alternative to typeorm
    "@prisma/client": "latest",
    "class-validator": "latest",
    "class-transformer": "latest",
    "bcrypt": "latest",
    "passport-jwt": "latest",
    "kafkajs": "latest",          // if Kafka
    "ioredis": "latest",          // if Redis transport
    "nestjs-pino": "latest",      // structured logging
    "@opentelemetry/sdk-node": "latest"  // tracing
},
"devDependencies": {
    "@nestjs/testing": "latest",
    "jest": "latest",
    "supertest": "latest",
    "testcontainers": "latest"
}
```

---

## Validation — Always Global
```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // strip unknown properties
    forbidNonWhitelisted: true,
    transform: true,        // auto-type coercion
    transformOptions: { enableImplicitConversion: true },
}));
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

---

## ACID Transaction Rules
- Prisma: `prisma.$transaction(async (tx) => { ... })`
- TypeORM QueryRunner: `startTransaction` → `commitTransaction` / `rollbackTransaction`
- Never silently catch DB errors — always rethrow or translate to HttpException
- `@Version()` column on TypeORM entities for optimistic locking

## Learned Patterns
<!-- auto-learned entries appended below -->
