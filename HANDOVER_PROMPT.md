# Übergabe-Prompt für einen neuen Claude-Chat

Den folgenden Block vollständig in einen neuen Chat kopieren (am besten Claude Code mit Zugriff auf dieses
Repository). Die heruntergeladene Betreiber-Anleitung („KaufCheck – Anleitung für die fehlenden Schritte“)
als Datei anhängen.

---

```text
Du übernimmst die Weiterentwicklung von KaufCheck. Bisher wurde das Projekt in einem anderen Claude-Account
entwickelt; den Gesprächsverlauf von dort hast du nicht. Alles Nötige steht im Repository und in der
angehängten Betreiber-Anleitung.

## Das Projekt in Kürze

- KaufCheck („Gebraucht kaufen. Besser entscheiden.“) ist eine deutschsprachige Web-App für den
  Gebrauchtwagenkauf in Deutschland: Auto finden (eine Suche, die auf die Ergebnisseiten von mobile.de,
  AutoScout24, Kleinanzeigen & Co. verlinkt), Auto-Berater, Modellseiten mit belegten Schwachstellen,
  Inserat prüfen (Inseratstext einfügen → regelbasierte Analyse, optional KI), Angebote speichern und
  vergleichen, Pro-Abo (4,99 €/Monat über Stripe).
- Live: https://kaufcheck-app.de (Render, Frankfurt; jeder Merge in main wird automatisch deployt).
- Repository: Philipp-Knecht/vitejs-vite-5ffhb13b. Monorepo mit Node 22: apps/web (React 19, Vite),
  apps/api (Fastify 5, Prisma 7, PostgreSQL), packages/shared, packages/domain, packages/catalog, e2e
  (Playwright), tools/model-research (Recherche-Werkzeuge für das Modellwissen, nicht Teil der App).
- Arbeitsbranch bisher: claude/kaufcheck-complete-app-6yabal. Er enthält gegenüber main noch nicht
  gemergte Commits: 10 weitere Modelle (Kia, Audi, Seat → 53 Modelle), die Übergabedokumentation und
  tools/model-research.

## Was ich angehängt habe

Die Betreiber-Anleitung („KaufCheck – Anleitung für die fehlenden Schritte“). Sie beschreibt, was ich als
Betreiber außerhalb des Codes eingerichtet habe oder noch einrichten muss: Render-Variablen, E-Mail über
Brevo, Stripe inkl. Fehlersuche, Google AdSense, eigene Domain sowie E-Mail-Entwürfe an mobile.de,
AutoScout24, Autohero und pkw.de mit der Bitte um Erlaubnis für den Link-Abruf. Sie ist ein Stand vom
Oktober 2026 und kann in Einzelheiten veraltet sein. Wenn sie dem Repository widerspricht, gilt das
Repository – sprich mich darauf an.

## Vorgehen – bitte in dieser Reihenfolge

1. Lies die Übergabedokumentation im Repository-Wurzelverzeichnis: PROJECT_CONTEXT.md, DECISIONS.md,
   TODO.md. Danach README.md, packages/catalog/data/models/README.md und tools/model-research/README.md.
   Dann die angehängte Anleitung.
2. Analysiere danach den Quellcode, bevor du etwas änderst: die Workspaces, die Stellen, die eine Aufgabe
   betrifft, und die zugehörigen Tests. Prüfe mit git log und git status, ob der Stand noch der Doku
   entspricht (zum Beispiel, ob die offenen Commits inzwischen in main sind).
3. Fasse mir kurz zusammen, was du verstanden hast, was dir unklar ist und was du als Nächstes vorschlägst.
   Warte auf meine Bestätigung, bevor du mit Änderungen beginnst.

## Arbeitsregeln

- Erhalte den bestehenden Code. Keine Refactorings, Umbenennungen oder Architekturwechsel ohne meine
  ausdrückliche Zustimmung. Arbeite in kleinen, nachvollziehbaren Schritten und passe dich Stil,
  Kommentardichte und Benennung des umgebenden Codes an.
- Bearbeite keine Probleme erneut, die in TODO.md unter „Bereits gelöste Probleme“ stehen, und stelle
  Entscheidungen aus DECISIONS.md nicht ohne neuen Grund in Frage.
- Frage bei Unklarheiten zuerst nach, statt Annahmen zu treffen – besonders bei Recht, Kosten, externen
  Diensten und allem, was in der Doku als „(unbekannt)“ markiert ist.
- Erfinde keine Daten: keine erfundenen Inseratsdaten, Quellen, URLs, Preise oder Modellfakten. Jede
  Schwachstelle im Modellwissen braucht eine echte, abrufbare Quelle.
- Kein Scraping von Marktplätzen, keine Umgehung von CAPTCHAs, Logins oder Bot-Schutz; AGB und robots.txt
  respektieren. Marktplatz-Such- und Inseratsseiten werden nie automatisiert abgerufen. Der Link-Abruf von
  Inseraten bleibt in Produktion aus, bis eine Plattform schriftlich zustimmt. Auf adac.de nie /bff oder
  /suche/ abrufen.
- Der URL-Abruf darf nie localhost, private Netze, Cloud-Metadaten oder interne Dienste erreichen.
- Keine Geheimnisse in Code, Commits, Logs, Doku oder Chat. Schlüssel stehen nur in den
  Umgebungsvariablen bei Render; frag mich nie danach, sondern sag mir, wo ich sie eintragen soll.
- Die Oberfläche ist Deutsch, Code, Commits und README sind Englisch. Antworte mir auf Deutsch, per „du“,
  kurz und konkret; nenne Quellen, wenn du im Web recherchiert hast.
- Vor jedem Commit die Prüfungen ausführen: npm run check; bei API-Änderungen npm run test:integration
  (PostgreSQL nötig); bei UI- oder Server-Änderungen npm run test:e2e. Nach Änderungen am Modellwissen
  npm run catalog:index und npx vitest run --project catalog. Ein Fehler im Test ist ein echter Fehler,
  kein „Flake“: erst die Ursache finden.
- Arbeite auf einem eigenen Branch, öffne Pull Requests gegen main und merge nur, wenn ich es freigebe.
  Ein Merge geht sofort live; prüfe danach die Live-Seite.
- Wenn ich etwas im Render-, Stripe-, Google- oder Domain-Dashboard tun muss, gib mir eine kurze
  Schritt-für-Schritt-Anleitung.

## Aktueller Stand und nächste Schritte (Details in TODO.md)

1. Ich mache noch einen Stripe-Testkauf, um den Webhook zu bestätigen. Hilf mir, falls dabei etwas
   schiefgeht (Render-Logs: invalid_signature, could not load the Stripe price).
2. Die offenen Commits per Pull Request nach main bringen (10 Modelle, Doku, tools/model-research),
   CI abwarten, nach meiner Freigabe mergen und live prüfen (z. B. /modelle/kia-ceed).
3. Das Modellwissen nach dem Ablauf in tools/model-research/README.md weiter ausbauen (Ziel ~100–125
   Modellreihen; offen sind die Pakete A12–A21 und 38 jüngere Modelle). Schlag mir vor dem ersten Paket
   kurz vor, wie du vorgehst.

Beginne jetzt mit Schritt 1 des Vorgehens.
```
