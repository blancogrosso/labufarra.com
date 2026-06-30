# Memoria de Desarrollo — La Bufarra

Este documento es la "memoria técnica" del proyecto. Contiene reglas críticas, decisiones de diseño y lecciones aprendidas para evitar regresiones y errores repetidos.

## 🛡️ Reglas Críticas de UI

- **Panel de Ingreso (Login)**:
    - El botón flotante (+) (`fabContainer`) **NUNCA** debe ser visible en la pantalla de login.
    - Debe estar oculto por defecto en el HTML/CSS (`display: none`).
    - Solo se activa mediante JS dentro de la función `showApp()` tras un ingreso exitoso.
- **Botones de Sincronización**:
    - No añadir botones manuales de "Sincronizar" en la cabecera a menos que se pida explícitamente. La sincronización debe ser automática o controlada.
- **Interacciones Premium (Anti-Parpadeo)**:
    - **PROHIBIDO** el uso de `confirm()` o `alert()` nativos del navegador. Causan parpadeos y bloquean la UI.
    - Usar siempre el sistema de modales personalizados (`openModal` y `confirmAction`).
    - Las acciones de borrado deben ser no-bloqueantes: feedback instantáneo en UI mientras el proceso corre en segundo plano.

## 📊 Reglas de Datos y Estadísticas

- **Normalización de Nombres**:
    - Se debe usar **estrictamente** el formato de "Solo Apellidos" (ej: 'Blanco' en lugar de 'Tomas Blanco').
    - El sistema debe ser **insensible a tildes y mayúsculas** (Normalización NFD). "de León", "De Leon" y "DE LEON" son la misma persona.
- **Fuentes de Verdad (Fallback)**:
    - El administrador debe ser resiliente. Siempre debe consultar:
        1. Supabase (Nube).
        2. Arraigos locales (`data/players.json` y `data/matches.json`) como respaldo/maestro.
    - Nunca recalcular estadísticas basándose solo en la nube si hay riesgo de perder historial local.
- **Formatos de Fecha**:
    - Para guardar en Supabase, usar siempre formato ISO (`AAAA-MM-DD`). 
    - Formatos como `D/M/A` causan que los días y meses se inviertan en el servidor.
- **Regla de Oro de Fusión (Merge)**:
    - **NUNCA sumar** datos de diferentes fuentes para el año **'ALL'** (Histórico). 
    - La fuente de verdad para 2021-2025 es el Excel Máster (`PLAYERS_EXCEL_DATA`).
    - La fuente para 2026+ son los registros en la tabla `matches` de Supabase.
    - El "ALL" se recalcula íntegramente sumando ambas fuentes cada vez que hay un cambio.
- **Sincronización Automática**:
    - Cualquier cambio en un partido (crear, editar, borrar) debe disparar automáticamente `recalculateAllStats()`. No delegar esto a scripts externos para la operación diaria.

## 🕒 Historial de Errores y Lecciones

- **Regresión de Login (14/Abr/2026)**: Un error de sintaxis (llave olvidada en `normalizeName`) bloqueó todo el panel. **Lección**: Siempre verificar la integridad del script antes de finalizar grandes cambios.
- **Duplicidad de Perfiles**: Los nombres con tildes generaban perfiles dobles. **Lección**: La normalización de nombres debe limpiar tildes antes de cualquier mapeo.
- **Pérdida de Partidos**: Se borraron estadísticas históricas al recalcular solo desde la nube. **Lección**: Los archivos JSON locales son el "Master" y deben integrarse en el cálculo.
- **Problema de Parpadeo (Abr/2026)**: Los diálogos `confirm()` nativos causaban que la UI se refrescara mal en móviles. **Lección**: Los modales custom son obligatorios para una experiencia "Premium".
- **Sincronización Pesada**: Recalcular estadísticas globales puede tardar. **Lección**: Ejecutar estas tareas de forma asíncrona (`await`) tras dar feedback visual inmediato al usuario.

## Migración de seguridad — Junio 2026

Se detectó que el repo tenía credenciales de admin hardcodeadas en js/admin.js
(visibles en código fuente público) y RLS deshabilitado en todas las tablas de
Supabase (config, matches, notifications, players_stats, upcoming), permitiendo
lectura/escritura sin restricción a cualquiera con la publishable key.

Resuelto hasta ahora:
- RLS habilitado en las 5 tablas.
- Políticas de SOLO LECTURA pública creadas:
  - matches, players_stats, upcoming, notifications: SELECT con USING (true)
  - config: SELECT con USING (key = 'league_table' or key = 'roster') — las
    keys 'users' y 'finances' quedan bloqueadas incluso para lectura.
- Login migrado de sistema hardcodeado/PBKDF2 a Supabase Auth real
  (signInWithPassword). 4 usuarios creados: admin, oso, feli, justi
  (emails ficticios @labufarra.local). Mismo permiso para los 4.
- Eliminadas showChangePassword() y doChangePassword() de admin.js (cambio de
  contraseña ahora se hace desde Supabase dashboard, Authentication → Users).
- SDK de Supabase JS agregado vía CDN en admin.html.
- Verificado en producción (Netlify): login nuevo funciona, contraseñas viejas
  rechazadas, persistencia de sesión y logout funcionan correctamente.

PENDIENTE — próxima sesión:
- Políticas de ESCRITURA (INSERT/UPDATE/DELETE) en todas las tablas siguen sin
  restricción para rol anon. Esto significa que cualquiera con la publishable
  key (pública en el código) puede escribir directo en Supabase sin pasar por
  el login, aunque el panel admin ya esté protegido. Falta crear políticas
  con condición auth.role() = 'authenticated' en: matches, players_stats,
  upcoming, notifications, y las keys finances/roster/league_table de config.
- La fila config key='users' (contraseñas hasheadas viejas) ya no se usa para
  login pero sigue existiendo en la tabla — candidata a eliminar más adelante.
- render.yaml y Procfile en la raíz parecen ser de un intento de deploy en
  Render que no se usa — el deploy real activo es Netlify. Confirmar si se
  puede limpiar.
- Detectado: un jugador nuevo (para el torneo intermedio) que otro admin
  intentó cargar no aparece en roster. Investigar al cargarlo si fue tema de
  timing con el cambio de RLS o un bug de sincronización aparte.

Después de la seguridad, retomar lo que disparó toda esta sesión:
- Cierre de Torneo Apertura: revisar jugadores (altas/bajas, el caso del
  jugador nuevo), cuotas.
- Limpieza de tabla finances / ingresos y egresos — "chorizo de movimientos"
  a limpiar, empezar de cero con los números actuales (puede que Feli ya
  haya puesto esto en 0, confirmar si fue intencional).
