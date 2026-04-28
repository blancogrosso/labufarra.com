# Memoria Técnica: Arquitectura y Flujo de Datos La Bufarra (v6.5)

Este documento detalla la arquitectura técnica vigente de **La Bufarra**, actualizada en abril de 2026.

## 1. Arquitectura de Alta Disponibilidad (Híbrida v2)
La web utiliza un modelo mixto para máxima velocidad y datos en tiempo real:
1. **Base Local (data/):** Los archivos `players.json` y `matches.json` en la carpeta `data/` son el motor principal. Son generados automáticamente por el script de Python a partir de los balances en Supabase y los Excels locales.
2. **Supabase (Tiempo Real):** Se utiliza para ingestar partidos nuevos, gestionar partidos próximos (`upcoming`), finanzas y la tabla de posiciones de la liga.
3. **Fusión Dinámica (db.js):** Al cargar, la web descarga los últimos partidos de Supabase y los mezcla con el JSON local. Si hay discrepancias, **Supabase tiene prioridad**.

## 2. Gestión de la Liga (Orden Manual y Tendencias)
A diferencia de otros años, la tabla de posiciones es **manualmente gestionada** para permitir flexibilidad total (puntos, sanciones, etc.):
- **Ordenación:** El administrador usa flechas para mover equipos arriba o abajo.
- **Tendencias:** El sistema registra la `lastPos` (posición anterior). Si al guardar un equipo cambió de lugar, la web mostrará automáticamente una flecha verde (subió) o roja (bajó).
- **DG (Diferencia de Goles):** Eliminada por solicitud del usuario para simplificar la carga; el orden es 100% criterio del administrador.

## 3. Notificaciones Manuales (WhatsApp Ecosystem)
Se han eliminado las notificaciones Push (OneSignal/PWA) por ser poco prácticas.
- **Flujo:** Al cargar un resultado o confirmar un horario, el Admin ofrece un botón para "Avisar por WhatsApp".
- **Plantillas:** El sistema genera un texto preformateado listo para pegar en el grupo de los jugadores.

## 4. Sincronización Maestra y Motor de Estadísticas
El sistema ha evolucionado de scripts manuales a un motor de cálculo integrado:
- **Motor JS (`recalculateAllStats`):** Es el responsable de la integridad diaria. Cada vez que se toca un partido en el Admin, este motor suma el histórico (Excel 2021-2025) con lo nuevo (Supabase 2026) y genera un **UPSERT** masivo a la tabla `players_stats`.
- **Script Python (`sincronizar_stats.py`):** Se mantiene como herramienta de respaldo y auditoría. Sirve para bajar los datos de la nube y re-escribir los archivos `.csv` y `.json` maestros para el control offline del usuario.
- **Matemática Exacta:** La estadística "Histórico (ALL)" ya no es un acumulado ciego, sino una derivada exacta de la suma de todos los años, garantizando error cero.

## 5. El "Truco Infranqueable" de la Hora
La tabla `matches` en Supabase no posee columna `hora`.
- Se guarda dentro del JSON de la columna `jugadores` bajo la clave secreta `__hora`.
- El sistema de cargado la extrae y la formatea para la UI automáticamente.

## 6. Accesos de Emergencia
Cuentas maestras habilitadas en `admin.js`:
- `admin` / `bufarra2026`
- `oso` / `oso2018`
- `feli` / `feli2018`
- `justi` / `justi2018`
