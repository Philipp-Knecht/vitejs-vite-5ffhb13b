# Übergabe-Prompt für einen neuen Claude-Chat

Den folgenden Block vollständig in einen neuen Chat (Claude Code mit Zugriff auf dieses Repository) kopieren.

---

```text
Du übernimmst die Weiterentwicklung von KaufCheck („Gebraucht kaufen. Besser entscheiden.“), einer
deutschsprachigen Web-App für den Gebrauchtwagenkauf. Sie läuft live unter https://kaufcheck-app.de
(Render, Auto-Deploy von main). Repository: Philipp-Knecht/vitejs-vite-5ffhb13b.

Vorgehen – bitte genau in dieser Reihenfolge:

1. Lies zuerst die Übergabedokumentation im Repository-Wurzelverzeichnis:
   PROJECT_CONTEXT.md, DECISIONS.md, TODO.md, danach README.md und
   packages/catalog/data/models/README.md.
2. Analysiere danach den Quellcode, bevor du etwas änderst: Struktur der Workspaces (apps/api, apps/web,
   packages/shared, packages/domain, packages/catalog, e2e), die Stellen, die deine Aufgabe betrifft, und
   die zugehörigen Tests. Prüfe mit git log und git status, ob der Stand noch der Dokumentation entspricht
   (z. B. ob der Commit mit 10 neuen Modellen inzwischen in main ist).
3. Fasse mir kurz zusammen, was du verstanden hast und was du als Nächstes tun würdest, und warte auf
   meine Bestätigung, bevor du größere Änderungen beginnst.

Arbeitsregeln:

- Erhalte den bestehenden Code. Keine Refactorings, Umbenennungen oder Architekturwechsel ohne meine
  ausdrückliche Zustimmung. Arbeite in kleinen, nachvollziehbaren Schritten und passe dich Stil,
  Kommentardichte und Benennung des umgebenden Codes an.
- Bearbeite keine Probleme erneut, die laut TODO.md („Bereits gelöste Probleme“) oder DECISIONS.md schon
  gelöst bzw. entschieden sind. Stelle getroffene Entscheidungen nicht ohne neuen Grund in Frage.
- Frage bei Unklarheiten zuerst nach, statt Annahmen zu treffen – besonders bei rechtlichen Fragen,
  Kosten, externen Diensten und allem, was als „(unbekannt)“ markiert ist.
- Erfinde keine Daten: keine erfundenen Inseratsdaten, Quellen, URLs oder Modellfakten; jede Schwachstelle im
  Modellwissen braucht eine echte, abrufbare Quelle.
- Kein Scraping von Marktplätzen, keine Umgehung von CAPTCHAs, Logins oder Bot-Schutz; AGB und robots.txt
  respektieren. Der Link-Abruf bleibt in Produktion aus, bis eine Plattform schriftlich zustimmt.
- Keine Geheimnisse in Code, Commits, Logs oder Chat. Werte wie API-Schlüssel stehen nur in den
  Umgebungsvariablen bei Render.
- Die UI ist Deutsch, Code und README sind Englisch. Antworte mir auf Deutsch, per „du“, kurz und konkret.
- Vor jedem Commit/PR die Prüfungen des Repos ausführen: npm run check, bei API-Änderungen
  npm run test:integration (PostgreSQL nötig), bei UI/Server-Änderungen npm run test:e2e.
  Nach Änderungen am Modellwissen: npm run catalog:index.
- Arbeite auf einem eigenen Branch und öffne Pull Requests gegen main; merge nur, wenn ich es freigebe.
  Ein Merge in main geht automatisch live.

Erste sinnvolle Aufgaben laut TODO.md (Priorität 1): den offenen Commit mit 10 Modellen per PR nach main
bringen und das Modellwissen nach dem dokumentierten Ablauf weiter ausbauen. Die frühere
Recherche-Werkzeugkette ist nicht im Repository und müsste neu aufgebaut werden – schlag mir dafür
zuerst einen Plan vor.
```
