# Schieber Online (Self-hosted)

Web app fuer Schieber/Jass mit:

- Benutzerkonto (Register/Login via Passwort)
- stabiler Reconnect per Login + benutzergebundenem Raum-Merken
- 4er Tisch mit fixen Teams (Sitz 1+3 gegen 2+4) und sichtbarer Liste aktiver Tische
- Modi: Trumpf (alle Farben), Obenabe, Undenufe, Slalom, Misere
- Schieben (Push) bei Trumpfwahl
- Echtzeitspiel via Socket.IO

## Hinweise zu Regeln

Umgesetzt sind die Kernregeln wie bei Schieber:

- 36er Deck (6 bis Ass)
- Bedienpflicht (Farbe bedienen wenn moeglich)
- Trumpfwertung (Bauer 20, 9 14)
- normaler Stichpunktwert + letzter Stich +5
- Teamwertung und Matchstand bis 1000 Punkte

Zusatzmodi:

- `Slalom`: Stichreihenfolge wechselt zwischen Obenabe und Undenufe pro Stich.
- `Misere`: Es werden weiterhin Kartenpunkte gezaehlt, aber fuer die Matchwertung pro Runde invertiert (weniger nehmen ist besser).

## Lokal starten

Voraussetzungen:

- Node.js 20+
- npm

Schritte:

1. `cp .env.example .env` (unter Windows: `Copy-Item .env.example .env`)
2. `.env` anpassen, vor allem `JWT_SECRET`.
3. `npm install`
4. `npm start`
5. Browser: `http://localhost:3000`

## Docker / Server Hosting

1. In `docker-compose.yml` den `JWT_SECRET` auf einen sicheren Wert setzen.
2. Starten: `docker compose up -d --build`
3. App laeuft auf Port `3000`.

Persistente Daten liegen unter `./data` (JSON Datei).

## Reconnect-Verhalten

- Bei Verbindungsabbruch bleibt dein Sitz waehrend laufender Runde reserviert.
- Mit demselben Benutzer erneut einloggen und denselben Raumcode nutzen.
- Der Client versucht automatisch den letzten Raum wieder zu joinen.

## Sicherheit fuer Produktion

- `JWT_SECRET` stark und einzigartig setzen.
- Reverse Proxy (Nginx/Caddy) mit TLS davor schalten.
- Optional Rate-Limiting und Account-Lockout erweitern.