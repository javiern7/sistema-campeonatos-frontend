# Sprint 2 - Avance inicial

Fecha: 2026-03-21
Proyecto: `sistema-campeonatos-frontend`
Hilo maestro relacionado: `Arquitectura Multideporte Maestro`

## 1. Diagnostico inicial

Estado observado al iniciar:

- El frontend validaba credenciales con `Basic Auth` contra `/sports`.
- La sesion solo guardaba `username` y `basicToken`.
- No existia modelo de roles o permisos en frontend.
- La UI mostraba acciones de escritura aunque el backend ya restringia varias por rol.
- El backend ya expone autorizacion real por `SUPER_ADMIN` y `TOURNAMENT_ADMIN`.
- El backend ya expone `DELETE` en multiples modulos, pero el frontend aun no lo consumia en varios casos.
- Los listados trabajaban con pagina fija y varios catalogos auxiliares cargaban `size: 100`.
- Persistian textos con problemas de codificacion en parte de la UI.

Conclusion de arranque:

`Sprint 2 debia priorizar autorizacion operativa sobre el contrato temporal existente, sin inventar un flujo final que backend aun no expone.`

## 2. Decision de arquitectura aplicada

Se mantuvo `Basic Auth` como contrato temporal activo, pero ahora queda explicitado en frontend como:

- validacion de credenciales contra endpoint protegido configurable
- resolucion temporal de roles por perfil de autorizacion configurable en `environment`
- guard de rutas de escritura basado en permisos frontend
- visibilidad de acciones alineada con el nivel de autorizacion disponible

Nota de alineacion:

- El backend aplica roles reales.
- El frontend todavia no consume un endpoint `me` o equivalente.
- Por eso se adopto un `temporary-profile contract` en frontend, para no asumir un JWT o un endpoint inexistente.

## 3. Plan priorizado ejecutado

1. Formalizar el contrato temporal de autenticacion y sesion.
2. Incorporar roles/permisos en frontend con capa reusable.
3. Alinear bloqueo y visibilidad de acciones de escritura.
4. Implementar eliminacion en modulos priorizados ya soportados por backend.
5. Mejorar paginacion y carga incremental de catalogos auxiliares.
6. Corregir textos visibles tocados durante el sprint.

## 4. Bloques implementados

### Bloque A - Auth y autorizacion

Se implemento:

- sesion enriquecida con `roles`, `authorizationSource` y `validatedAt`
- contrato temporal configurable en `environment`
- `AuthorizationService` reusable por recurso y accion
- `authorizationGuard` para rutas de alta y edicion
- topbar con usuario y roles activos
- login con mensaje explicito del contrato temporal

### Bloque B - Visibilidad y bloqueo por permisos

Se alineo visibilidad de escritura en listados priorizados:

- `teams`
- `players`
- `tournaments`
- `tournament-teams`
- `rosters`
- `matches`

Cambios aplicados:

- ocultar boton `Nuevo` cuando no hay permiso de gestion
- ocultar `Editar` cuando no hay permiso de gestion
- ocultar `Eliminar` cuando no hay permiso `SUPER_ADMIN`
- bloquear rutas `new` y `edit` aunque se intente navegar manualmente

### Bloque C - Eliminacion integrada

Se conecto `DELETE` en frontend para:

- `teams`
- `players`
- `tournaments`
- `tournament-teams`
- `rosters`
- `matches`

Patron aplicado:

- confirmacion previa en UI
- llamada real al backend
- mensaje de exito o error consistente
- recarga del listado luego de eliminar

### Bloque D - Paginacion y catalogos auxiliares

Se implemento:

- paginacion real en listados priorizados mediante `MatPaginator`
- preservacion de `pageIndex` y `pageSize`
- carga incremental de catalogos auxiliares con `CatalogLoaderService`

Catalogos mejorados en esta iteracion:

- torneos
- equipos
- jugadores
- etapas
- grupos

## 5. Validacion tecnica

Validacion ejecutada:

- `npm run build`

Resultado:

`OK`

Observacion:

- el build dentro del sandbox fallo por `spawn EPERM`
- el build fuera del sandbox compilo correctamente

## 6. Riesgos y siguientes pasos

Riesgos abiertos:

- el frontend aun no obtiene roles desde backend; usa contrato temporal configurable
- algunos modulos secundarios todavia no consumen la nueva capa visual completa
- quedan textos/encoding por normalizar fuera de las pantallas tocadas

Siguientes pasos sugeridos:

1. exponer en backend un endpoint tipo `GET /auth/session` o `GET /me`
2. reemplazar el `temporary-profile contract` por roles reales del backend
3. extender autorizacion visual y paginacion al resto de listados y formularios
4. completar eliminacion y afinado UX en `stage-groups` y `tournament-stages`
5. barrer textos con encoding incorrecto en todo el frontend
