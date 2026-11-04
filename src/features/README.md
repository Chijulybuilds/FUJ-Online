# Feature module convention

Each feature should follow this shape as it is implemented:

```text
feature-name/
  components/       UI specific to this feature
  actions/          Server Actions and mutations
  services/         Business rules / orchestration
  repositories/     Supabase queries and persistence
  schemas/          Zod validation
  types/            Feature-specific TypeScript types
```

Keep cross-feature UI in `src/components`; keep Supabase clients and shared security helpers in `src/lib`.
