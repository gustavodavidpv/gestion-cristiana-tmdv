# Registro de hand-off — App Móvil TMDV

Bitácora del proyecto. **Cada tarjeta terminada añade una entrada aquí, arriba del todo (más reciente primero).**
Plantilla y protocolo: [PLAN_APP_MOVIL.md](PLAN_APP_MOVIL.md) §0.2 y §9.1.

---

## [T2.x + T3.x] App Flutter: fundaciones y módulos MVP — 2026-09-24

- **Agente:** Mobile (sesión principal de Claude Code)
- **Rama / PR:** `mobile/flutter-app-v1` · PR pendiente
- **Qué se hizo:**
  - Proyecto Flutter en `mobile/` (Android + iOS), bundle provisional `org.tmdv.gestioncristiana`, solo vertical, es-419.
  - **ADR-01 revisado:** Flutter en lugar de Expo por decisión del PO (equivalencias en el ADR y en `mobile/README.md`).
  - Diseño del handoff "Broadsheet" (Source Serif 4, cian `#006786`, magenta `#aa0b56`, papel `#f3f2f2`, iconos Phosphor duotone) con las variantes por defecto: Login *Portada*, Inicio *Rejilla*, Evento *Ficha*, Registrar *Lista*, Club *Contadores*.
  - Fundaciones: cliente Dio (Bearer, `X-App-Version`, `X-Platform`, timeout 15 s, errores en español), sesión en Keychain/Keystore con copia del perfil para abrir sin red, refresh de token con cola única (listo para T1.3), comprobación de versión mínima (listo para T1.4), permisos desde `my-permissions`, selector de iglesia para SuperAdmin, banda "Sin conexión", estados de carga/vacío/error/sin permiso.
  - Módulos: Login + recuperar contraseña · Inicio (métricas del año, resumen de la iglesia, próximos eventos, accesos rápidos, comparativo por iglesia para SuperAdmin) · Miembros (búsqueda, filtros, scroll infinito, ficha, llamar/WhatsApp, crear/editar/eliminar) · Eventos (mes/lista, detalle, crear/editar/eliminar, PDF del mes y de ventas) · **Registrar asistencia** (decisiones de fe, visitante nuevo) · Asistencia semanal (estadísticas, teclado propio, reemplazo de semana existente) · Club Bíblico (hoja de puntos con +/−, mantener = +5, canje, historial, PDF de posiciones) · Actas (lista, detalle, descargar, adjuntar foto/galería/documento con progreso) · Más (perfil, módulos, web, privacidad, eliminar cuenta, cerrar sesión).
  - Pruebas: 15 unitarias (hora de Panamá, formatos, pestañas por permisos). `flutter analyze` sin incidencias.
- **Contrato usado:** exactamente el de §1.3/§1.4; nada nuevo en `server/`. Campos extra al login (`device_id`, `platform`) que el backend actual ignora.
- **Decisiones tomadas:**
  - Orden de pestañas por permiso, no por rol: si `events.attendance` y no `members.create` → Eventos antes que Miembros (lo que el diseño pide para "Asistencia").
  - La pestaña Club aparece con `bible_club.view`. Ojo: con los DEFAULTS del servidor, `Asistencia` **sí** tiene `bible_club.view/create`, así que verá Club (el diseño la oculta). Si no debe verlo, se cambia el permiso del rol en la web, no la app.
  - Canje: el servidor no tiene catálogo de artículos → se escribe artículo + puntos (como la web). Los artículos del prototipo eran ficticios.
  - Filtro "Con cargo" del diseño → chip "Cargo ▾" con el catálogo (el backend no filtra "tiene cargo"); se oculta sin `positions.view`.
  - "Nuevo visitante" solo aparece con `members.create` (el backend lo exige).
  - **Versiones de plugins alineadas con SamsCuisine / la caché de Gradle del equipo** (la red del equipo rompe las descargas de Maven por SSL): `flutter_secure_storage 9.2.4`, `connectivity_plus ^6.1.5`, `share_plus 11.1.0`, `package_info_plus 8.3.1`, `printing 5.14.3`. Se reemplazó `file_picker` (fija AGP 8.5.2) por `file_selector` (oficial) y `open_filex` (fija AGP 7.3.1) por `printing` para ver PDFs + visor de fotos propio. No subir estas versiones sin comprobar que `./gradlew assembleDebug --offline` sigue pasando.
  - Registrar semana existente usa `PUT` (requiere `weekly_attendance.edit`; si el rol no lo tiene, se muestra el 403 del servidor).
- **Lo que NO se hizo / deuda:**
  - Biometría (Face ID) y variante de Login "Regreso"; modo offline con cola de escritura; OCR (backlog).
  - Icono, splash y fuentes empaquetadas (hoy `google_fonts` descarga Source Serif 4 en el primer arranque y la guarda en caché) → T5.1.
  - Firma de release, CI de compilación iOS (Codemagic/GitHub Actions macOS) y perfiles por entorno → T2.2/T6.1.
  - Sentry/monitoreo de errores (T2.7) sin integrar: requiere decisión del PO sobre terceros.
  - Deep links (`gctmdv://`) declarados pero sin verificar.
- **Riesgos para quien sigue:**
  - El SDK de Android del equipo está en una ruta con espacios; `flutter doctor` lo marca (la compilación de depuración pasa igual).
  - `flutter build apk --debug` compila ✅ (2026-09-24) usando solo artefactos ya cacheados.
  - Hasta T1.3 el token dura 24 h: al vencer, la app vuelve al Login con "Tu sesión expiró".
  - Los DoD de T2/T3 exigen pruebas en dispositivo real contra el backend: pendientes.
- **Desbloquea:** T4.1 (ampliar pruebas), T4.2/T4.3 (E2E y matriz de permisos en dispositivo), T5.2 (capturas).
- **Cómo verificar:** `cd mobile && flutter analyze && flutter test`; con `npm run server` corriendo, `flutter run` en un emulador Android y recorrer login → registrar asistencia → cargar puntos → registrar semana → adjuntar foto a un acta.

---

## [T0.1] Decisiones de producto y marca — pendiente

- **Agente:** 🧍 PO
- **Estado:** ☐ sin iniciar
- **Qué falta:** completar la tabla de decisiones de §5/T0.1 (nombre en tiendas, bundle ID, titular de las cuentas, distribución pública o no listada, alcance v1.0, correo y URL de soporte).
- **Bloquea a:** T0.2, T0.3, T0.4, T0.5, T2.1, T5.1, T5.3

---

<!--
Copia esta plantilla para cada entrada nueva:

## [ID] Título de la tarjeta — AAAA-MM-DD
- **Agente:**
- **Rama / PR:**
- **Qué se hizo:**
- **Contrato entregado:** (endpoints, payloads, nombres de campos — pegar exacto)
- **Decisiones tomadas:**
- **Lo que NO se hizo / deuda:**
- **Riesgos para quien sigue:**
- **Desbloquea:**
- **Cómo verificar:**
-->
