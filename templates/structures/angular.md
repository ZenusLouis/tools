# Angular — Production Structure Templates

> **Role: FRONTEND ONLY.** Pair with NestJS/FastAPI/Django/Spring Boot for backend.

---

## A. Standalone Components — Feature-Based (Angular 17+)

No NgModule boilerplate. Each feature is a standalone component tree.

```
src/
├── app/
│   ├── core/                          ← Singleton services (provided in root)
│   │   ├── auth/
│   │   │   ├── auth.service.ts        ← @Injectable({providedIn:'root'})
│   │   │   ├── auth.guard.ts          ← CanActivateFn (functional guard)
│   │   │   └── auth.interceptor.ts    ← HttpInterceptorFn — attach JWT
│   │   ├── http/
│   │   │   ├── api.service.ts         ← Base HTTP client (HttpClient wrapper)
│   │   │   └── error.interceptor.ts   ← Global error handling
│   │   └── store/
│   │       └── app.state.ts           ← NgRx global state (if used)
│   │
│   ├── shared/
│   │   ├── components/                ← Reusable dumb components
│   │   │   ├── button/
│   │   │   │   └── button.component.ts
│   │   │   ├── input/
│   │   │   └── modal/
│   │   ├── directives/
│   │   │   └── click-outside.directive.ts
│   │   ├── pipes/
│   │   │   └── date-format.pipe.ts
│   │   └── validators/
│   │       └── email-unique.validator.ts
│   │
│   ├── features/
│   │   └── <feature>/                 ← e.g. users, orders
│   │       ├── components/
│   │       │   ├── <feature>-list/
│   │       │   │   └── <feature>-list.component.ts  ← Standalone, signals
│   │       │   └── <feature>-form/
│   │       │       └── <feature>-form.component.ts
│   │       ├── services/
│   │       │   └── <feature>.service.ts  ← API calls (NOT business logic)
│   │       ├── store/                    ← NgRx feature state (if used)
│   │       │   ├── <feature>.actions.ts
│   │       │   ├── <feature>.effects.ts
│   │       │   ├── <feature>.reducer.ts
│   │       │   └── <feature>.selectors.ts
│   │       ├── models/
│   │       │   └── <feature>.model.ts    ← TypeScript interfaces
│   │       └── <feature>.routes.ts       ← Lazy-loaded route config
│   │
│   ├── app.routes.ts                  ← Root routes (lazy load features)
│   ├── app.config.ts                  ← bootstrapApplication config
│   └── app.component.ts               ← Root component (router-outlet)
│
├── environments/
│   ├── environment.ts                 ← dev: { apiUrl: 'http://localhost:4000' }
│   └── environment.prod.ts            ← prod: { apiUrl: '/api' }
│
└── styles/
    ├── _variables.scss
    ├── _mixins.scss
    └── styles.scss
```

---

## B. Component Patterns (Signals + Standalone)

```typescript
// Standalone component with signals
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, AsyncPipe],
  template: `...`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent {
  private userService = inject(UserService);  // inject() function (no constructor)

  users = signal<User[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.userService.getAll().subscribe(users => this.users.set(users));
  }
}

// Functional guard
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

// HTTP interceptor (functional, Angular 17+)
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
```

---

## C. Complete package.json Dependencies

```json
{
  "dependencies": {
    "@angular/animations": "latest",
    "@angular/common": "latest",
    "@angular/compiler": "latest",
    "@angular/core": "latest",
    "@angular/forms": "latest",
    "@angular/platform-browser": "latest",
    "@angular/platform-browser-dynamic": "latest",
    "@angular/router": "latest",

    "@ngrx/store": "latest",
    "@ngrx/effects": "latest",
    "@ngrx/entity": "latest",
    "@ngrx/router-store": "latest",
    "@ngrx/store-devtools": "latest",
    "@ngrx/signals": "latest",

    "rxjs": "latest",
    "zone.js": "latest",

    "@angular/material": "latest",
    "@angular/cdk": "latest",

    "zod": "latest"
  },
  "devDependencies": {
    "@angular/cli": "latest",
    "@angular/compiler-cli": "latest",
    "@angular-devkit/build-angular": "latest",
    "typescript": "latest",
    "jest": "latest",
    "jest-preset-angular": "latest",
    "@testing-library/angular": "latest",
    "cypress": "latest",
    "prettier": "latest",
    "eslint": "latest",
    "@angular-eslint/eslint-plugin": "latest"
  }
}
```

---

## Naming Conventions
- Components: `kebab-case` files — `user-list.component.ts`; `PascalCase` class — `UserListComponent`
- Services: `kebab-case` files — `user.service.ts`; `PascalCase` class — `UserService`
- Selectors: `app-` prefix — `<app-user-list>`
- Feature folders: `kebab-case` — `user-management/`, `order-history/`
- Routes: `kebab-case` paths — `/user-management`, `/order-history`
- NgRx actions: `[Feature] Action Name` — `[Users] Load Users`, `[Users] Load Users Success`
- Models: TypeScript interface — `interface User`, `interface CreateUserRequest`
