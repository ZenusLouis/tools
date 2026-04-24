---
name: angular
description: >
  Activate when: context.json framework includes "angular", or package.json contains "@angular/core".
  Provides Angular standalone component patterns and best practices.
role: FRONTEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# Angular Skill

## Standalone Components (Angular 17+)
- All new components use `standalone: true` — no NgModules required
- Import dependencies directly in component's `imports: []`
- Bootstrap with `bootstrapApplication(AppComponent, { providers: [...] })`

## Component Structure
```typescript
@Component({
  selector: 'app-feature',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `...`,
})
export class FeatureComponent {
  // inject() function preferred over constructor injection
  private service = inject(FeatureService);
}
```

## Signals (Angular 17+)
- `signal()` for local state — replaces `BehaviorSubject` for simple cases
- `computed()` for derived state — replaces `combineLatest` pipe
- `effect()` for side effects — replaces `ngOnChanges` in many cases
- RxJS still needed for complex async (HTTP, WebSocket)

## Services
- `@Injectable({ providedIn: 'root' })` for singleton services
- Feature-scoped: provide in component's `providers: []`
- HTTP: use `HttpClient` — inject via `inject(HttpClient)`

## Routing
- `app.routes.ts` — flat route config with lazy loading
- Lazy: `loadComponent: () => import('./feature/feature.component').then(m => m.FeatureComponent)`
- Guards: `canActivateFn` (functional guards — no class guards)

## Forms
- Reactive Forms preferred: `FormBuilder`, `FormGroup`, `FormControl`
- Template-driven for simple cases only
- Validation: built-in validators + custom validator functions

## Project Structure
```
src/app/
  core/           ← singleton services, guards, interceptors
  shared/         ← shared components, pipes, directives
  features/
    <feature>/
      <feature>.component.ts
      <feature>.service.ts
      <feature>.routes.ts
```

## Anti-Patterns
- No NgModules for new code (use standalone)
- No class-based guards (use functional)
- No `any` types
- No direct DOM manipulation — use Angular APIs

## Learned Patterns
<!-- auto-learned entries appended below -->
