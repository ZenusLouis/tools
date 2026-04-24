---
name: react-native
description: >
  Activate when: context.json framework includes "react-native", or package.json contains "expo" or "react-native".
  Provides React Native + Expo patterns and best practices.
role: FRONTEND
model: claude-sonnet-4-6
disable-model-invocation: true
---

# React Native / Expo Skill

## Project Structure (Expo Router)
```
app/
  (tabs)/           ← Tab navigator screens
    index.tsx
    profile.tsx
  (auth)/           ← Auth screens (no tab bar)
    login.tsx
  _layout.tsx       ← Root layout
components/
  ui/               ← Platform-aware atomic components
  features/         ← Feature components
hooks/              ← Custom hooks
stores/             ← Zustand stores
services/           ← API calls
constants/          ← Colors, sizes, strings
```

## Navigation (Expo Router)
- File-based routing — same mental model as Next.js App Router
- `Link` component for navigation
- `useRouter()` for programmatic navigation
- `useLocalSearchParams()` for route params

## Platform-Specific Code
- `Platform.OS === 'ios'` / `'android'` for inline checks
- `.ios.ts` / `.android.ts` file suffixes for platform-specific modules
- `<Platform.select>` for style differences

## Styling
- StyleSheet.create — not inline objects (performance)
- NativeWind (Tailwind for RN) if in package.json
- `flex: 1` for full-height containers
- No CSS — use `StyleSheet` or NativeWind

## State Management
- Zustand for global state
- `react-query` or `SWR` for server state
- AsyncStorage for simple persistence
- MMKV for high-performance local storage

## Performance
- `useMemo`, `useCallback` more important here than web — JS bridge is expensive
- `FlatList` / `SectionList` for lists — never `ScrollView` + map for long lists
- `React.memo` on components rendered in lists
- Image: `expo-image` (not `Image` from RN) — better caching

## Permissions
- Ask at point of use — not on startup
- `expo-permissions` or module-specific APIs
- Handle denial gracefully — show explanation

## Key Packages
- Navigation: expo-router
- Storage: AsyncStorage, expo-secure-store (for tokens)
- Camera/Media: expo-camera, expo-image-picker
- Read versions from package.json — never assume

## Anti-Patterns
- No DOM APIs (no `document`, `window`)
- No CSS-in-JS libraries that rely on DOM
- No `ScrollView` with `map()` for unbounded lists

## Learned Patterns
<!-- auto-learned entries appended below -->
