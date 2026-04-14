# Memoria de Desarrollo — La Bufarra

Este documento es la "memoria técnica" del proyecto. Contiene reglas críticas, decisiones de diseño y lecciones aprendidas para evitar regresiones y errores repetidos.

## 🛡️ Reglas Críticas de UI

- **Panel de Ingreso (Login)**:
    - El botón flotante (+) (`fabContainer`) **NUNCA** debe ser visible en la pantalla de login.
    - Debe estar oculto por defecto en el HTML/CSS (`display: none`).
    - Solo se activa mediante JS dentro de la función `showApp()` tras un ingreso exitoso.
- **Botones de Sincronización**:
    - No añadir botones manuales de "Sincronizar" en la cabecera a menos que se pida explícitamente. La sincronización debe ser automática o controlada.

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
    - Siempre usar `Math.max()` para elegir el valor más alto y actualizado entre la Nube y el Archivo Local. Esto evita inflar las estadísticas por registros duplicados o desactualizados.

## 🕒 Historial de Errores y Lecciones

- **Regresión de Login (14/Abr/2026)**: Un error de sintaxis (llave olvidada en `normalizeName`) bloqueó todo el panel. **Lección**: Siempre verificar la integridad del script antes de finalizar grandes cambios.
- **Duplicidad de Perfiles**: Los nombres con tildes generaban perfiles dobles. **Lección**: La normalización de nombres debe limpiar tildes antes de cualquier mapeo.
- **Pérdida de Partidos**: Se borraron estadísticas históricas al recalcular solo desde la nube. **Lección**: Los archivos JSON locales son el "Master" y deben integrarse en el cálculo.
