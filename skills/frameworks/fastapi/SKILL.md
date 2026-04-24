---
name: fastapi
description: >
  Activate when: context.json framework includes "fastapi", or requirements.txt contains "fastapi".
  Backend-only framework. FastAPI + SQLAlchemy async + Alembic production patterns.
role: BACKEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# FastAPI Skill — Backend Only

## Layer Architecture
```
Router → Service → Repository → SQLAlchemy Model
```

### Router Layer — HTTP only
```python
router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    dto: CreateUserRequest,
    service: UserService = Depends(get_user_service),  # DI via Depends
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return await service.create(dto)
```

### Service Layer — Business logic + transaction boundary
```python
class UserService:
    def __init__(self, user_repo: UserRepository, email_service: EmailService):
        self.user_repo = user_repo
        self.email_service = email_service

    async def create(self, dto: CreateUserRequest) -> UserResponse:
        if await self.user_repo.exists_by_email(dto.email):
            raise HTTPException(status_code=409, detail="Email already in use")

        hashed = get_password_hash(dto.password)
        user = await self.user_repo.create(email=dto.email, password_hash=hashed)
        await self.email_service.send_welcome(user.email)
        return UserResponse.model_validate(user)
```

### Repository Layer — DB queries only
```python
class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> User:
        user = User(**kwargs)
        self.session.add(user)
        await self.session.flush()  # get ID without committing
        return user

    async def find_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def exists_by_email(self, email: str) -> bool:
        result = await self.session.execute(
            select(exists().where(User.email == email))
        )
        return result.scalar()
```

---

## Dependency Injection — Layered Depends Chain

```python
# core/database.py
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        async with session.begin():  # auto-commit / auto-rollback
            yield session

# deps/user.py — compose DI chain
async def get_user_repo(session: AsyncSession = Depends(get_db_session)) -> UserRepository:
    return UserRepository(session)

async def get_email_service() -> EmailService:
    return EmailService(settings.SMTP_URL)

async def get_user_service(
    user_repo: UserRepository = Depends(get_user_repo),
    email_service: EmailService = Depends(get_email_service),
) -> UserService:
    return UserService(user_repo, email_service)

# Router usage — inject composed service
@router.post("/")
async def create(dto: CreateUserRequest, service: UserService = Depends(get_user_service)):
    return await service.create(dto)
```

---

## Project Structure (Production)
```
src/
├── api/
│   ├── v1/
│   │   ├── routers/
│   │   │   ├── users.py
│   │   │   ├── auth.py
│   │   │   └── __init__.py   ← api_router = APIRouter(); include all
│   │   └── dependencies.py   ← get_current_user, get_db, etc.
│   └── v2/                   ← versioned APIs
├── core/
│   ├── config.py             ← pydantic-settings Settings
│   ├── security.py           ← JWT create/verify, password hashing
│   ├── database.py           ← engine, AsyncSessionLocal, Base
│   ├── exceptions.py         ← custom exceptions + handlers
│   └── middleware.py         ← logging, correlation ID
├── models/                   ← SQLAlchemy ORM models
│   ├── base.py               ← Base with id, created_at, updated_at
│   ├── user.py
│   └── __init__.py
├── schemas/                  ← Pydantic schemas
│   ├── user.py               ← CreateUserRequest, UserResponse
│   └── common.py             ← Pagination, ErrorResponse
├── services/                 ← Business logic
│   └── user_service.py
├── repositories/             ← DB access layer
│   └── user_repository.py
├── deps/                     ← FastAPI Depends factories
│   ├── auth.py               ← get_current_user
│   └── services.py           ← get_user_service, etc.
├── tasks/                    ← Celery/ARQ background tasks
│   └── email_tasks.py
└── main.py                   ← FastAPI app factory
```

---

## ACID Transaction Rules

```python
# session.begin() auto-manages transaction — async with session.begin(): yield session
# flush() writes to DB without commit (get ID before end of transaction)
# commit() on session.begin() context exit

# Explicit transaction for complex operations
async def transfer_seats(from_booking_id: int, to_user_id: int, session: AsyncSession):
    async with session.begin_nested():  # savepoint
        booking = await session.get(Booking, from_booking_id)
        booking.user_id = to_user_id
        # if exception here, only savepoint rolls back

# Optimistic locking
class Seat(Base):
    __tablename__ = "seats"
    version: Mapped[int] = mapped_column(default=0)

    __mapper_args__ = {"version_id_col": version}  # SQLAlchemy raises StaleDataError on conflict
```

---

## Complete Production Dependencies (requirements.txt)
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
python-jose[cryptography]    # JWT
passlib[bcrypt]
python-multipart             # form data

# Async tasks
celery[redis]
arq                          # alternative lightweight task queue
redis

# HTTP client (service-to-service)
httpx

# Observability
structlog
sentry-sdk[fastapi]
opentelemetry-sdk
opentelemetry-instrumentation-fastapi
prometheus-fastapi-instrumentator

# Testing
pytest
pytest-asyncio
httpx                        # test client
testcontainers[postgresql]
factory-boy
```

---

## Config — pydantic-settings
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 30
    redis_url: str = "redis://localhost:6379"
    smtp_url: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
```

## Learned Patterns
<!-- auto-learned entries appended below -->
