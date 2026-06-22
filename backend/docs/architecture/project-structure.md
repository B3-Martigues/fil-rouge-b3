# Structure du projet

Le depot garde le backend dans un dossier dedie : `backend/`.

La racine contient les fichiers de gestion du depot. Le module Go, la
documentation et les scripts applicatifs vivent dans `backend/`.

## Arborescence

```text
mappening/
  .github/
  .gitignore
  README.md
  backend/
    cmd/
      api/
      migrate/
    internal/
      auth/
      config/
      contracts/
      db/
      http/
      httpx/
      logger/
      users/
    migrations/
    scripts/
    docs/
    .env.example
    go.mod
    go.sum
    README.md
```

## Conventions

- `backend/` est le dossier de travail principal.
- `cmd/` contient les executables.
- `internal/` contient le code applicatif prive du module Go.
- `migrations/` contient les migrations SQL versionnees.
- `scripts/` contient les scripts d'exploitation ou de controle.
- `docs/` contient la documentation detaillee.
- Les fichiers locaux temporaires restent ignores par Git.
