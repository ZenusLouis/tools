---
name: django
description: >
  Activate when: context.json framework includes "django", or requirements.txt contains "Django".
  Backend-only framework. Django + DRF + Celery production patterns.
role: BACKEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# Django Skill — Backend Only

## Layer Architecture
```
View/ViewSet → Serializer → Service → Repository/Manager → Model
```

### View Layer (DRF) — HTTP handling only
```python
class UserViewSet(viewsets.GenericViewSet,
                  mixins.CreateModelMixin,
                  mixins.RetrieveModelMixin):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = UserService.create(serializer.validated_data)  # delegate to service
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
```

### Service Layer — Business logic + transaction boundary
```python
# apps/users/services.py
from django.db import transaction

class UserService:
    @staticmethod
    @transaction.atomic  # transaction boundary here — multi-model writes
    def create(data: dict) -> User:
        email = data['email']
        if User.objects.filter(email=email).exists():
            raise ValidationError({'email': 'Already in use'})

        user = User.objects.create_user(
            email=email,
            password=data['password'],
        )
        Profile.objects.create(user=user)  # atomic with user creation
        UserCreatedEvent.send(user.id)
        return user

    @staticmethod
    def get_by_id(user_id: int) -> User:
        return get_object_or_404(User, id=user_id)
```

### Serializer Layer — Validation + serialization only
```python
class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    # NO create()/update() logic — delegate to Service
```

### Model Layer — DB schema + domain logic
```python
class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=0)  # optimistic locking

    USERNAME_FIELD = 'email'
    objects = UserManager()

    class Meta:
        db_table = 'users'
        indexes = [models.Index(fields=['email'])]
```

---

## Dependency Injection via Django's DI System

Django doesn't have a formal DI container but uses:

```python
# settings.py — register implementations
AUTHENTICATION_BACKENDS = ['apps.users.backends.EmailBackend']
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}

# Service injection via function params (manual DI)
class UserViewSet(viewsets.GenericViewSet):
    def __init__(self, user_service=None, **kwargs):
        self.user_service = user_service or UserService()
        super().__init__(**kwargs)
```

For proper DI in tests, use `dependency_injector` or just dependency-inject via constructor parameters.

---

## Project Structure (Production)
```
project_root/
├── config/
│   ├── settings/
│   │   ├── base.py           ← shared — DB, installed apps, middleware
│   │   ├── local.py          ← DEBUG=True, sqlite or postgres dev
│   │   └── production.py     ← gunicorn, sentry, S3
│   ├── urls.py
│   ├── wsgi.py
│   └── celery.py
├── apps/
│   └── <feature>/
│       ├── models.py
│       ├── serializers.py    ← request/response only, no logic
│       ├── views.py          ← DRF ViewSet/APIView, thin
│       ├── services.py       ← ALL business logic + @transaction.atomic
│       ├── selectors.py      ← read queries (separate from write services)
│       ├── urls.py
│       ├── tasks.py          ← Celery async tasks
│       ├── admin.py
│       ├── apps.py
│       ├── exceptions.py
│       └── tests/
│           ├── test_models.py
│           ├── test_services.py
│           └── test_views.py
├── common/
│   ├── models.py             ← BaseModel with created_at, updated_at
│   ├── exceptions.py
│   └── pagination.py
├── requirements/
│   ├── base.txt
│   ├── local.txt
│   └── production.txt
├── docs/
│   └── api/                  ← drf-spectacular generated
└── manage.py
```

---

## Complete Production Dependencies (requirements/base.txt)
```
# Core
Django
djangorestframework
djangorestframework-simplejwt
django-cors-headers
django-filter
drf-spectacular              # OpenAPI schema generation

# Database
psycopg2-binary
django-redis

# Async tasks
celery
redis
django-celery-beat
django-celery-results

# Env & config
django-environ
python-decouple

# Validation & utils
Pillow                       # image handling
phonenumbers
django-countries

# Observability
sentry-sdk
django-prometheus
django-structlog             # structured logging

# Production server
gunicorn
uvicorn[standard]            # ASGI if using channels

# Development
django-debug-toolbar
factory-boy                  # test factories
pytest-django
coverage
```

---

## ACID Transaction Rules
```python
# Simple: decorator
@transaction.atomic
def create_order(user, items):
    order = Order.objects.create(user=user)
    OrderItem.objects.bulk_create([OrderItem(order=order, **i) for i in items])
    return order

# Advanced: context manager with savepoints
with transaction.atomic():
    order = Order.objects.create(user=user)
    try:
        with transaction.atomic():  # savepoint
            payment = Payment.objects.create(order=order, amount=total)
    except PaymentError:
        pass  # savepoint rollback — order still committed

# Select for update (pessimistic locking)
with transaction.atomic():
    seat = Seat.objects.select_for_update(nowait=True).get(id=seat_id)
    # nowait=True raises DatabaseError instead of waiting
    seat.status = 'held'
    seat.save()
```

## Learned Patterns
<!-- auto-learned entries appended below -->
