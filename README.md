# La Calculadora Celeste

Sitio publico para seguir las chances de Uruguay en el Mundial 2026.

## Que muestra

- Tablas en vivo de los 12 grupos.
- Ranking de los terceros, con corte de clasificacion para los 8 mejores.
- Simulador global para tocar resultados probables de cualquier partido pendiente.
- Proyeccion inmediata del Grupo H y del ranking de mejores terceros.
- Agenda completa de los 72 partidos de fase de grupos.

## Datos

El sitio corre sin backend y consume APIs publicas de ESPN:

- Standings: `site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings`
- Scoreboard: `site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard`

## Local

```bash
python3 -m http.server 4173
```

Abrir `http://localhost:4173`.
