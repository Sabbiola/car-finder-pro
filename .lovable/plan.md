

# 🚗 AutoDeal Finder — Aggregatore Offerte Auto

Piattaforma completa per cercare, confrontare e monitorare le migliori offerte auto da tutti i principali portali italiani.

---

## Fase 1 — Ricerca e Confronto

### Homepage con ricerca avanzata
- Barra di ricerca con filtri: marca, modello, anno, prezzo min/max, km, alimentazione, cambio
- Toggle tra auto nuove e usate
- Selezione delle fonti da includere (AutoScout24, Subito.it, Automobile.it, Brumbrum, ecc.)

### Pagina risultati
- Lista aggregata di annunci da tutte le fonti, ordinabili per prezzo, km, anno
- Badge con il nome del sito di provenienza per ogni annuncio
- Indicatore visivo "Migliore offerta" per evidenziare i prezzi più competitivi
- Link diretto all'annuncio originale

### Scheda dettaglio auto
- Foto, specifiche tecniche, prezzo e descrizione
- Confronto con annunci simili da altre fonti per la stessa auto
- Grafico con andamento prezzo medio per quel modello

---

## Fase 2 — Account utente e preferiti

### Registrazione e login
- Autenticazione con email tramite Supabase Auth

### Dashboard personale
- Auto salvate nei preferiti
- Cronologia ricerche recenti
- Panoramica degli alert attivi

---

## Fase 3 — Alert e monitoraggio automatico

### Sistema di alert
- Imposta criteri di ricerca (es. "BMW Serie 3, 2020+, sotto 25.000€")
- Notifiche quando appaiono nuovi annunci corrispondenti
- Riepilogo periodico via email o nella dashboard

### Storico prezzi
- Tracciamento nel tempo del prezzo di annunci specifici
- Grafici andamento prezzi per modello/anno

---

## Fase 4 — Backend e scraping

### Edge functions per web scraping
- Integrazione con Firecrawl per estrarre dati dai portali auto
- Normalizzazione dati da fonti diverse in un formato unificato
- Database Supabase per salvare annunci, preferiti, alert e storico prezzi

---

## Design
- Interfaccia moderna e pulita, mobile-first
- Dark mode disponibile
- Cards visive per ogni annuncio con foto, prezzo e dettagli chiave
- Palette professionale con accenti di colore per evidenziare le migliori offerte

