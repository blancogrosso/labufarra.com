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

RESUELTO (sesión de continuación, mismo día):
- Políticas de ESCRITURA (INSERT/UPDATE/DELETE) creadas en las 5 tablas
  (matches, players_stats, upcoming, notifications, config), condición
  auth.role() = 'authenticated'. Cierra el agujero de escritura sin
  autenticación.
- Eliminada fila config key='users' (contraseñas viejas, ya sin uso).
- Bug encontrado y resuelto: las funciones de escritura usaban fetch crudo con
  la anon key en vez del JWT de sesión (spFetch no consultaba
  supabaseClient.auth.getSession()). Esto rompía recalculateAllStats() y el
  upsert de stats tras migrar el login. Fix: spFetch ahora inyecta el JWT real
  como Bearer token, con fallback a anon key solo para GET. Las escrituras sin
  sesión activa ahora fallan con error explícito en vez de silencio.
- Bug encontrado y resuelto: 12 funciones (savePago, toggleMulta,
  saveEditCuota, saveCostoFecha, saveMulta, deleteMulta, saveTransaccion,
  deleteTransaccion, saveDeadline, deleteDeadline, addRosterPlayer,
  deleteRosterPlayer) mostraban toast de "guardado" sin chequear el resultado
  real de spFetch. Con RLS bloqueando, PostgREST devuelve 200 OK con array
  vacío en vez de error — el toast de éxito se disparaba igual. Fix: las 12
  funciones ahora chequean if (res !== null) y muestran toast de error si
  falla, sin cerrar el modal en el camino de error.
- Bug encontrado y resuelto: loadRoster() en admin.js tenía hardcodeada una
  lista fija de 14 jugadores ("Forzado para evitar históricos"), ignorando
  config.roster de Supabase por completo. Esto rompía Finanzas/Cuotas, carga
  de partido, y gestor de plantel para cualquier jugador agregado dinámicamente
  vía addRosterPlayer. Fix: loadRoster() ahora lee config.roster de Supabase,
  con fallback al hardcode si la llamada falla. config.roster en Supabase fue
  limpiado de 24 a los 15 jugadores activos reales (14 originales + Rodriguez).
- Bug de datos encontrado y resuelto: jugadores duplicados en players_stats por
  desync entre dos sistemas de normalización de nombres independientes
  (normalizeName() en admin.js vs normalizePlayerName()/PLAYER_MAP en db.js).
  "Bruno Silva"/"Silva" y "Gaston Silva"/"Silva, Gaston" existían como filas
  separadas. Fusionados (eran datos idénticos duplicados, sin pérdida).
  Agregadas las entradas faltantes en normalizeName() de admin.js para evitar
  recurrencia.
- Confirmado: el jugador "Rodriguez" (alta nueva post-Apertura) ya tenía
  player_name='Rodriguez' limpio en su historial viejo — sin duplicados, va a
  sumar correctamente con partidos nuevos.

PENDIENTE — próxima sesión:
- Bug funcional: en Próximos Partidos, el aviso automático de "partido vencido,
  falta cargar" no funciona al tocarlo — hay que cargar el partido manualmente
  desde cero. Sin diagnosticar todavía.
- Deuda técnica estructural: existen dos sistemas de normalización de nombres
  independientes (admin.js y db.js) que pueden desincronizarse de nuevo con
  futuros jugadores. Candidato a unificar en una sola fuente de verdad más
  adelante.
- data/players.json y db.js → rosterBase siguen con listas hardcodeadas viejas,
  afectan al HOME (no al admin). No se tocó en esta sesión a propósito.
- Cierre de Torneo Apertura: actualizar montos de cuotas para el torneo nuevo
  (hoy están hardcodeados/viejos de Apertura, hay que poder editarlos desde el
  admin).
- Tabla de Liga en el home sigue mostrando la tabla vieja de Apertura — hay que
  sacarla/resetear ahora que terminó el torneo.
- Feature nueva pedida: generador de resumen mensual de finanzas en texto,
  formato listo para copiar/pegar a WhatsApp (hoy lo hace manualmente un
  compañero).
- Mobile/UX: reportados problemas de scroll y elementos corridos en el admin
  usado desde celular (es el dispositivo más usado a diario) — sin detalle
  específico todavía, pendiente de capturas o recorrido guiado para precisar
  qué arreglar.
- render.yaml y Procfile en la raíz del proyecto parecen ser de un intento de
  deploy en Render no usado — el deploy activo real es Netlify. Confirmar si
  se puede limpiar.

## Sesión de continuación — Finanzas, Roster y UX del Admin (mismo día, tercera parte)

RESUELTO:
- Bug funcional: convertUpcoming() comparaba u.id (number) con upcomingId
  (string) con igualdad estricta, fallando en silencio. Fix: parseInt() del
  argumento, mismo patrón que ya usaba showUpcomingForm(). Pendiente de
  confirmar con un caso real el próximo domingo.
- Nueva función "Crear Cierre" en Finanzas: archiva transacciones/multas/
  cuotas actuales en una key nueva de config (finances_cierre_<nombre
  sanitizado>_<timestamp>), con nombre libre editable por el usuario. Resetea
  transacciones, multas, deadlines, y cuotas (vuelven a paid:0/multas:0)
  manteniendo el roster y respetando cuotaObjetivo. Pantalla para LISTAR/VER
  cierres archivados queda pendiente para otra sesión (la data ya se guarda
  bien, solo falta la UI de consulta).
- Bug de diseño encontrado y resuelto: renderBalance() sumaba solo
  transacciones activas, así que el primer "Cierre" vació el balance visible
  a $0 aunque los datos reales seguían guardados. Fix: nuevo campo
  financesData.balanceHistorico = { ingresos, egresos } que se acumula en
  confirmarCierre() antes del reset, y que renderBalance() lee sumándolo a
  las transacciones activas. El balance del primer cierre (que se hizo antes
  del fix) se restauró manualmente vía SQL con los valores reales: ingresos
  $58.860, egresos $47.259.
- Nuevo panel "Configuración de Cuotas del Torneo" en Finanzas:
  - Campo cuotaObjetivo editable + botón "Aplicar a todos" (actualiza el
    total de los 15 jugadores del roster sin tocar paid/multas, con
    confirmación modal).
  - 3 campos editables para los "precios rápidos" del modal de pago
    (financesData.preciosRapidos), reemplazando los literales hardcodeados
    $495/$990/$2970. showPagoForm() ahora los lee dinámicamente con fallback
    a esos valores si el campo no existe.
- Eliminado el panel "Costo por Fecha" (financesData.costoFecha) — era
  puramente decorativo, no se usaba en ningún cálculo.
- Fix de estilo: los 3 inputs de precios rápidos no tenían el wrapper
  form-group, se veían con estilo default del navegador. Corregido.
- Configuración aplicada para el torneo nuevo (Copa, fase de grupos, 3
  fechas): cuotaObjetivo = 880, aplicado a los 15 jugadores. Excepciones:
  De Leon, Sparkov y Olarte no juegan fase de grupos — deben editarse a mano
  con total:0 vía el editor individual de cuotas.

PENDIENTE — próxima sesión:
- Confirmar fix de convertUpcoming() con un partido real vencido (próximo
  domingo).
- Ajustar manualmente total:0 para De Leon, Sparkov y Olarte en cuotas (si
  no se hizo ya).
- Pantalla de listado/consulta de cierres archivados (finances_cierre_*).
- Auditoría de notificaciones WhatsApp: revisar en qué acciones aparece el
  botón "Avisar por WhatsApp" y decidir cuáles sacar.
- Generador de resumen mensual de finanzas en texto para WhatsApp (reemplaza
  trabajo manual de un compañero).
- Tabla de Liga en el home sigue mostrando la tabla vieja de Apertura — hay
  que sacarla/resetearla.
- Mobile/UX: fecha/hora se desborda de la tabla al cargar partido en celular;
  reportados otros problemas de scroll/elementos corridos sin detalle
  específico todavía — pendiente de capturas o recorrido guiado.
- Feature propuesta (no diseñada todavía): trazabilidad de quién y cuándo
  creó/editó cada dato (partidos, movimientos de plata, etc.) — campos tipo
  creadoPor/creadoEn/editadoPor/editadoEn. Transversal a varias tablas,
  requiere sesión dedicada de diseño.
- Deuda técnica estructural: dos sistemas de normalización de nombres
  independientes (admin.js y db.js) pueden desincronizarse con futuros
  jugadores nuevos.
- data/players.json y db.js → rosterBase siguen con listas hardcodeadas
  viejas, afectan al HOME (no al admin).
- render.yaml y Procfile parecen código muerto de un intento de deploy en
  Render — deploy activo real es Netlify. Confirmar si se puede limpiar.

## Sesión — Admin: Reportes, Finanzas, Notificaciones, UX Mobile (Jul 2026)

RESUELTO:
- Buscador de jugadores: bug de nombre de propiedad corregido, ahora busca
  por clave + fullName + aliases via PLAYER_MAP.
- Pastillas de jugadores: muestran nombre completo via PLAYER_MAP, clave
  interna intacta.
- js/player-map.js creado (window.PLAYER_MAP aislado, sin auto-arranque) e
  incluido en admin.html.
- Modales de WhatsApp post-guardado de partido y próximo partido eliminados.
- Plantillas "Horario Confirmado" y "Convocatoria" eliminadas.
- Pestaña "Notificaciones" renombrada a "Reportes".
- Nueva sección Reportes: filtro año + torneo, tres vistas (Asistencia por
  jugador / Asistencia por partido / Detalle por partido), botones Copiar y
  Enviar por WhatsApp. Pretemporada excluida. Orden cronológico. Header con
  récord del equipo en Detalle.
- Reorganización Finanzas: Config. Cuotas como modal junto a Administrar
  Plantel; Cierre de Período dentro de Gastos e Ingresos.
- Historial de cierres archivados clickeable con detalle por categoría.
- Generador de informe por rango libre: combina transacciones archivadas +
  activas, agrupa por categoría, muestra ingresos/egresos/balance, campo de
  observaciones, botones Copiar y Enviar por WhatsApp.
- Modal "Recordatorio de Cuota" reestructurado: montos con botones rápidos
  (financesData.preciosRapidos) + input libre + agregar montos, fecha límite
  con calendario + hora (default 16hs), botones Copiar y Enviar por WhatsApp.
- UX Mobile resueltos: inputs date/time iOS, metadata partido en una línea,
  instancia unificada como dropdown (INSTANCIA_OPTIONS), botones cuotas iOS,
  layout config cuotas mobile, botón guardar partido, íconos partido
  compactos horizontal.

PENDIENTE AL CIERRE DE HOY:
- Confirmar fix convertUpcoming() con partido real — este domingo.
- Fix botones modal Recordatorio de Cuota mal alineados en mobile (Cancelar
  cortado, botones desproporcionados).
- Revisar sección Reportes cuando arranque el Intermedio con datos reales.
- Generador de recordatorio de pago por saldo — en pausa hasta definir
  manejo de fechas de corte.
- Desktop UX — revisión general pendiente de relevar.
- Web pública — secciones sin terminar, trabajo aparte para cuando cerremos
  el admin.
- Trazabilidad creadoPor/editadoPor — requiere sesión de diseño propia.
- Unificar sistemas de normalización de nombres (admin.js vs db.js).
- data/players.json y rosterBase desactualizados (afectan home).
- render.yaml/Procfile — confirmar si son código muerto.
- Tabla de Liga vieja de Apertura en el home — resetear cuando arranque
  la Copa y se confirmen los equipos de fase de grupos.
- Filtro por torneo en Jugadores — dejado para cuando haya historial
  completo por partido (2021-2025 sin desglose por partido todavía).
- Automatización tabla de posiciones ligapro.uy — investigar con Claude
  para Chrome (pestaña Network para encontrar API interna).
