# Memoria Técnica: Funcionamiento y Arquitectura La Bufarra

Este documento detalla las convenciones, trucos técnicos y arquitectura de la web de **La Bufarra** para garantizar su mantenimiento futuro.

## 1. Sincronización de Datos (Excel vs. Cloud)
La web maneja dos fuentes de verdad que deben convivir:
- **Excel Maestro (`js/players_data.js`)**: Contiene el historial "vitalicio" (sección ALL) de los jugadores. **NUNCA** se debe recalcular el historial ALL basándose solo en los partidos de la nube, ya que el Excel incluye años (2021-2024) que no están completos en Supabase.
- **Supabase (Cloud)**: Se usa para el año activo (actualmente 2026), finanzas y próximos partidos.

### Flujo de Carga de Jugadores:
1. Se carga el objeto `PLAYERS_EXCEL_DATA` (Fuente: Excel).
2. Se cargan los partidos de 2026 desde Supabase.
3. El sistema **suma** los goles/asistencias de 2026 a los del Excel solo para visualización dinámica.

## 2. El Truco de la "Hora Invisible" en Partidos
La tabla `matches` en Supabase no tiene una columna `hora`. Para evitar errores de esquema y permitir que el Admin "recuerde" la hora:
- **Guardado**: La hora se guarda dentro del campo `jugadores` (que es un JSON) bajo la clave secreta `__hora`.
- **Carga**: Al cargar los partidos, el JS busca si existe `m.jugadores.__hora` y lo asigna a `m.hora`.
- **Filtrado**: Al recorrer la lista de jugadores para mostrar goles, el código tiene un `continue` para ignorar la clave `__hora`.

## 3. Navegación Responsive
Se implementó un sistema unificado en `js/navigation.js`:
- **Desktop**: Tres columnas (`nav-left`, `nav-center`, `nav-right`).
- **Mobile**: Menú hamburguesa (`ph-list`) que activa la clase `.nav-active` en el `header`.
- **Efecto Scroll**: El sombreado del header se activa automáticamente al bajar 50px.

## 4. Notificaciones (Push)
- Utiliza **OneSignal** para el envío masivo.
- El Admin permite enviar mensajes globales que se disparan a través de la API de OneSignal.
- **Safari**: Requiere que la web sea añadida a la pantalla de inicio (PWA) o que el usuario interactúe explícitamente para habilitar el Service Worker.

## 5. Finanzas
- Se gestionan en la tabla `config` de Supabase, bajo el registro `key = 'finances'`.
- El objeto contiene cuotas, multas y transacciones en un solo campo JSON llamado `value`.
