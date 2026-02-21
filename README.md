# Gestión Cristiana – TMV

Sistema web para la **gestión administrativa de una iglesia** (multi-iglesia), con panel de control, miembros, asistencia semanal, actas de reuniones, eventos y administración de usuarios por roles.

> Enfocado en llevar el control de la obra de forma clara, rápida y ordenada: **membresía, cargos ministeriales, asistencia y decisiones de fe** con estadísticas automáticas.

---

## Módulos principales

### ✅ Dashboard
- Resumen general con indicadores:
  - **Miembros**
  - **Eventos**
  - **Actas**
  - **Decisiones de Fe (por año)**
- “Resumen de la Iglesia” con métricas clave:
  - Responsable de la Obra
  - Membresía
  - Asistencia promedio semanal
  - Conteo de predicadores/diáconos (ordenados y no ordenados)

### ✅ Miembros
- Listado con búsqueda y filtros:
  - Buscar por **nombre / email**
  - Filtrar por **Tipo** (Miembro, Visitante, etc.)
  - Filtrar por **Cargo ministerial**
- Campos visibles: nombre, edad, fecha de nacimiento, sexo, tipo, cargo, bautizado, teléfono.
- Acciones rápidas: **editar** y **eliminar**.

### ✅ Iglesia (Configuración + Estadísticas automáticas)
- Datos principales editables:
  - Nombre, dirección, teléfono, responsable de la obra, etc.
- Sección de **“Estadísticas Automáticas”** (no editables):
  - Membresía total (desde Miembros)
  - Asistencia promedio semanal (desde Asistencia)
  - Decisiones de fe (desde Eventos)
  - Predicadores y diáconos (desde Miembros)

### ✅ Asistencia Semanal
- Registro de semanas con:
  - Año seleccionable
  - Notas (ej. “Culto y escuela dominical”)
  - “Registrado por”
- Indicadores automáticos:
  - Promedio semanal
  - Semanas registradas
  - Máxima y mínima del año

### ✅ Actas de Reuniones
- Gestión de actas con vista detallada en modal:
  - Fecha, creado por, objetivo
  - Asistentes
  - Motivos / acuerdos con estado (ej. **Aprobado**)

### ✅ Usuarios (Roles y acceso)
- Listado de usuarios con búsqueda y filtro por rol.
- Muestra: nombre, email, rol, iglesia, estado.
- Acciones típicas de administración (editar/gestionar credenciales/estado/eliminar, según configuración).

---

## Control de acceso (RBAC)
El sistema maneja **roles** para restringir acciones y datos. Ejemplos vistos:
- **Administrador**
- **Secretaría**
- **Visitante**

Además, cuando el usuario no es administrador, el sistema puede limitar los datos a su **iglesia asignada**.

---

## Stack (general)
- **Frontend:** React (UI tipo dashboard administrativo)
- **Backend:** Node.js + Express
- **ORM:** Sequelize
- **Base de datos:** PostgreSQL

> Si quieres, dime si usas Vite o CRA, y el puerto del backend, y lo dejo 100% exacto.

---

## Capturas
Guarda tus imágenes en `docs/screenshots/` y enlázalas aquí:

- `docs/screenshots/dashboard.png`
- `docs/screenshots/members.png`
- `docs/screenshots/church-stats.png`
- `docs/screenshots/attendance.png`
- `docs/screenshots/minutes-modal.png`
- `docs/screenshots/users.png`

Ejemplo:

```bash
docs/
  screenshots/
    dashboard.png
    members.png
    church-stats.png
    attendance.png
    minutes-modal.png
    users.png
