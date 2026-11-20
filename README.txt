Freedoom (Web) — nur lokal
==========================

Dieser Ordner ist eine fertige, statische Website. Nichts davon wurde
veröffentlicht.

Lokal starten (im eigenen Netz, nicht ins Internet legen):

  ./serve.sh
  # oder:
  python3 -m http.server 8080 --bind 127.0.0.1

Dann im Browser: http://127.0.0.1:8080/

Tests (Playwright + installiertes Chrome):

  cd tests && npm test

Lizenzen: LIZENZEN.txt und CREDITS.txt
