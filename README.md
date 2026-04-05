# Sistema Campeonatos Frontend

Frontend Angular del sistema multideporte. Esta base nace como continuidad del hilo maestro de Arquitectura Multideporte Maestro y debe mantenerse alineada con el backend Spring Boot y la base de datos del proyecto principal.

## Objetivo del repositorio

Este repositorio concentra la interfaz web operativa para administrar el sistema de campeonatos, sin perder el contexto funcional del ecosistema completo:

- Backend: `sistema-campeonatos-backend`
- Base de datos: modelo transaccional del sistema multideporte
- Frontend: operacion interna para gestion de catalogos, torneos, equipos, jugadores y fases

La intencion es que nuevos hilos de trabajo puedan partir desde aqui con una base clara, ordenada y conectada al contrato del backend.

## Stack actual

- Angular 20 standalone
- Angular Router
- HttpClient con interceptores funcionales
- Reactive Forms
- Angular Material
- Signals para estado local simple

## Estado funcional actual

Actualmente el frontend incluye:

- Login formal contra `POST /api/auth/login`
- Bootstrap de sesion desde `GET /api/auth/session`
- Renovacion de access token con `POST /api/auth/refresh`
- Logout formal con `POST /api/auth/logout`
- Shell autenticado con sidebar y topbar
- Dashboard inicial
- Modulo de sports conectado al backend
- Modulo de teams con listado, creacion y edicion
- Modulo de players con listado, creacion y edicion
- Estructura de trabajo para tournaments, tournament teams, tournament stages, stage groups, rosters, matches y standings

## Integracion esperada con backend

Contrato esperado del backend:

- Base URL local de desarrollo: `http://localhost:8080/api`
- Autenticacion protegida: `Authorization: Bearer <token>`
- Endpoints de auth: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/session`
- Respuesta estandar: `ApiResponse<T>`

Entornos configurados:

- Desarrollo: `http://localhost:8080/api`
- Produccion: `/api`

## Relacion con backend y base de datos

Este frontend no debe evolucionar aislado. Cada cambio funcional deberia revisar al menos estos tres puntos:

- Endpoint disponible o pendiente en `sistema-campeonatos-backend`
- DTOs, filtros y respuestas realmente expuestos por el backend
- Impacto sobre el modelo de datos multideporte y reglas de negocio persistidas

Si se abre un nuevo hilo para una funcionalidad, conviene validar primero:

1. Que endpoint del backend la soporta.
2. Que entidades o tablas participan.
3. Que pantalla del frontend la consumira o administrara.

## Inicio del proyecto

Requisitos locales:

- Node.js 20 o superior
- npm 10 o superior

Comandos base:

```bash
npm install
npm start
```

Build de produccion:

```bash
npm run build
```

## Estado tecnico observado

- La arquitectura base del frontend esta ordenada por `core`, `layout`, `shared` y `features`.
- La sesion ya se alinea con backend `Bearer-only`, usando tokens persistidos, bootstrap de identidad y permisos efectivos entregados por backend.
- La visibilidad de navegacion, rutas y acciones sensibles responde a permisos efectivos del backend.
- Este repositorio debe mantenerse sincronizado con el proyecto maestro para evitar divergencias entre frontend, backend y base de datos.

## Repositorio remoto

Repositorio destino del frontend:

- [https://github.com/javiern7/sistema-campeonatos-frontend](https://github.com/javiern7/sistema-campeonatos-frontend)
