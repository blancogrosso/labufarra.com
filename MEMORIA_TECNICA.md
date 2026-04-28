# Memoria Técnica: Arquitectura y Flujo de Datos La Bufarra

Este documento documenta la arquitectura técnica vigente de **La Bufarra**, actualizada en abril de 2026. Sirve como guía de referencia para cualquier futuro desarrollador o administrador.

## 1. Arquitectura de Alta Disponibilidad (Híbrida)
La web utiliza un modelo mixto para ser ultra-rápida y a la vez tener los datos "en vivo":
1. **El Motor Local (Fallback y Base Histórica):** Los archivos en la carpeta `js/` (como `players_data.js` y `matches_data.js`) contienen el histórico puro. Le permiten a la web cargar al instante sin depender de una base de datos externa.
2. **Supabase (El Motor en Vivo):** Se utiliza exclusivamente para ingestar los datos de **2026 en adelante**. 
3. **Fusión Dinámica:** En `db.js`, la web **siempre** descarga los últimos partidos de Supabase y los "mezcla" dinámicamente con el archivo local. Esto asegura que al cargar un partido nuevo en el Admin, todos los usuarios lo vean inmediatamente en vivo sin recargar el servidor.

## 2. El Flujo de Carga de Partidos
- Los Partidos se anuncian desde Supabase en la tabla `upcoming`.
- Cuando la fecha de un partido "próximo" se cumple o se pasa, el Admin arroja una "Alerta de Carga Rápida".
- **Automatización**: Si se borra la alerta con la 'x', el partido próximo se descarta (solo se elimina de `upcoming`). Si se completa el partido utilizando "Nuevo Partido", el sistema revisará silenciosamente la tabla `upcoming` y si hay un partido pendiente con ese rival y fecha, lo borrará automáticamente para evitar dobles avisos.

## 3. Sincronización Maestra (El Script Python)
Puesto que Javascript desde el navegador no puede re-escribir los `.csv` que están guardados en tu computadora localmente, se ha diseñado un script de consolidación: **`sincronizar_stats.py`** (ubicado en la raíz).

**Uso:** Una vez que se hayan cargado varios partidos en el Admin y se quiera re-armar el "Master Backup":
- Abrir la terminal en la carpeta del proyecto.
- Ejecutar: `python3 sincronizar_stats.py`
- **¿Qué hace?** Se conecta a Supabase, descarga todos los partidos de 2026, los "masajea" en formato Excel, y reescribe completamente los bloques del 2026 de los 3 archivos base de `DATOS EXCEL/` (`DETALLE`, `PARTIDOS` y `JUGADORES`), manteniéndote la matemática en orden de forma perpetua.

## 4. El "Truco Infranqueable" de la Hora
La tabla `matches` en Supabase no tiene una columna `hora`. Para evitar errores de esquema:
- **Guardado**: La hora se introduce maliciosamente dentro del campo `jugadores` (que es un JSON) bajo la clave secreta `__hora`.
- **Carga**: Al leer, el script interroga al JSON. Si halla `__hora`, la asume como la hora oficial del partido. Ningún bucle debe intentar mapear a un jugador llamado "__hora".

## 5. Accesos y Permisos Administrativos
A falta de cuentas seguras, el archivo `admin.js` utiliza validación por Hashes de Contraseña (`config.json`), pero hay Override "Puertas Traseras" habilitadas en el código duro para que nunca pierdan el acceso los principales responsables:
- Administrador general (`admin` : `bufarra2026`)
- Oso (`oso` : `oso2018`)
- Feli (`feli` : `feli2018`)
- Justi (`justi` : `justi2018`)

## 6. Notificaciones OneSignal
*Nota: Este apartado está listo para ser re-evaluado en las próximas fases del proyecto.* La plataforma por defecto actual para alertas móviles, que usa su propio ServiceWorker inyectado en el `manifest.json`.
