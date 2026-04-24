# React Native + Expo — Production Structure Templates

> **Role: FRONTEND (Mobile) ONLY.** Backend is separate (NestJS/FastAPI/Django).

---

## A. Expo Router — File-Based Navigation

```
src/
├── app/                               ← Expo Router file-based routes
│   ├── (auth)/                        ← Route group: unauthenticated
│   │   ├── _layout.tsx                ← Stack navigator for auth flow
│   │   ├── login.tsx
│   │   └── register.tsx
│   │
│   ├── (tabs)/                        ← Route group: tab navigator
│   │   ├── _layout.tsx                ← Tab bar config
│   │   ├── index.tsx                  ← Home tab
│   │   ├── explore.tsx
│   │   └── profile.tsx
│   │
│   ├── [feature]/
│   │   ├── [id].tsx                   ← Detail screen
│   │   └── _layout.tsx
│   │
│   ├── _layout.tsx                    ← Root layout (AuthProvider, QueryClientProvider)
│   └── +not-found.tsx
│
├── components/
│   ├── ui/                            ← Atomic UI (no business logic)
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── index.ts                   ← Barrel export
│   │
│   └── features/                      ← Feature-scoped components
│       └── <feature>/
│           ├── index.ts
│           ├── <Feature>List.tsx
│           ├── <Feature>Card.tsx
│           └── use<Feature>.ts        ← TanStack Query hook
│
├── lib/
│   ├── api/
│   │   ├── client.ts                  ← Axios/fetch wrapper (base URL, interceptors)
│   │   └── <feature>.api.ts
│   │
│   ├── auth/
│   │   ├── auth.service.ts            ← Token storage (expo-secure-store)
│   │   └── auth.context.tsx           ← AuthContext + AuthProvider
│   │
│   ├── stores/                        ← Zustand global state
│   │   └── <feature>.store.ts
│   │
│   └── utils/
│       ├── format.ts
│       └── platform.ts                ← Platform.select helpers
│
├── types/
│   └── index.ts
│
├── constants/
│   ├── Colors.ts
│   ├── Layout.ts
│   └── Api.ts
│
└── assets/
    ├── images/
    ├── fonts/
    └── icons/

Root files:
├── app.json                           ← Expo config (slug, scheme, plugins)
├── babel.config.js
├── tsconfig.json
├── .env                               ← gitignored (expo-env.d.ts for types)
└── .env.example
```

---

## B. Complete package.json Dependencies

```json
{
  "dependencies": {
    "expo": "latest",
    "expo-router": "latest",
    "react": "latest",
    "react-native": "latest",

    "expo-constants": "latest",
    "expo-font": "latest",
    "expo-linking": "latest",
    "expo-splash-screen": "latest",
    "expo-status-bar": "latest",
    "expo-secure-store": "latest",     ← JWT token storage (native keychain)
    "expo-image-picker": "latest",
    "expo-notifications": "latest",

    "@react-navigation/native": "latest",
    "@react-navigation/native-stack": "latest",
    "@react-navigation/bottom-tabs": "latest",

    "@tanstack/react-query": "latest",
    "zustand": "latest",

    "react-hook-form": "latest",
    "@hookform/resolvers": "latest",
    "zod": "latest",

    "axios": "latest",

    "react-native-safe-area-context": "latest",
    "react-native-screens": "latest",
    "react-native-gesture-handler": "latest",
    "react-native-reanimated": "latest",

    "nativewind": "latest",            ← Tailwind for React Native
    "tailwindcss": "latest"
  },
  "devDependencies": {
    "@babel/core": "latest",
    "typescript": "latest",
    "@types/react": "latest",
    "@types/react-native": "latest",
    "jest": "latest",
    "jest-expo": "latest",
    "@testing-library/react-native": "latest",
    "detox": "latest",                 ← E2E testing
    "eslint": "latest",
    "eslint-config-expo": "latest"
  }
}
```

---

## Naming Conventions
- Screen files: `PascalCase` — `LoginScreen.tsx` (or kebab-case route files — `login.tsx`)
- Components: `PascalCase` — `BookingCard.tsx`, `SeatPicker.tsx`
- Hooks: `camelCase` with `use` prefix — `useBooking.ts`
- Constants: `UPPER_SNAKE_CASE` for values — `PRIMARY_COLOR`; `PascalCase` for files — `Colors.ts`
- Navigation params: typed `RootStackParamList` in types/navigation.ts
- API files: `camelCase` with feature + `.api` — `booking.api.ts`
- Assets: `kebab-case` filenames — `splash-screen.png`, `app-icon.png`
