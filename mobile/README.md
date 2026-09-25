# Gestión Cristiana TMDV — App móvil (Flutter)

App nativa iOS/Android que consume la misma API de `server/`. Plan y bitácora:
[`docs/mobile/PLAN_APP_MOVIL.md`](../docs/mobile/PLAN_APP_MOVIL.md) · [`docs/mobile/HANDOFF_LOG.md`](../docs/mobile/HANDOFF_LOG.md).
Diseño: handoff "Broadsheet" (serif sobre papel, cian/magenta) — variantes elegidas: Login *Portada*, Inicio *Rejilla*,
Evento *Ficha*, Registrar *Lista*, Club *Contadores*.

## Requisitos (Windows)

- Flutter estable (probado con 3.38 / Dart 3.10): `flutter doctor`.
- Android Studio con un emulador, o un teléfono Android con *Depuración USB*.
- ⚠️ El SDK de Android **no debe estar en una ruta con espacios** (p. ej. `C:\Users\Gustavo Polanco\...`).
  Muévelo a algo como `C:\Android\sdk` y ejecuta `flutter config --android-sdk C:\Android\sdk`.
- iOS se compila en la nube o en una Mac (Codemagic / GitHub Actions macOS); no hace falta Mac para desarrollar la parte Android.

## Correr en desarrollo

```bash
# 1) Backend local (en otra terminal, desde la raíz del repo)
npm run server

# 2) App contra el backend local
cd mobile
flutter pub get
flutter run                                   # emulador Android → usa http://10.0.2.2:5000/api
flutter run --dart-define=API_URL=http://192.168.1.20:5000/api   # teléfono físico en la misma red
```

Variables de compilación (`--dart-define`):

| Variable    | Por defecto                  | Uso |
|-------------|------------------------------|-----|
| `API_URL`   | `http://10.0.2.2:5000/api`   | URL base de la API (con `/api`). Producción: `https://api.<dominio>/api` (T0.4). |
| `CHURCH_ID` | `1`                          | Iglesia cuyo branding se muestra en el Login antes del primer inicio de sesión. |

El tráfico `http://` solo está permitido en compilaciones de depuración (Android `src/debug`) y en red local (iOS `NSAllowsLocalNetworking`).

## Versiones de plugins fijadas

Algunas versiones están fijadas a propósito para usar las mismas dependencias de Gradle (AGP/Kotlin) que ya
compila `SamsCuisineSA/mobile` en este equipo: `flutter_secure_storage 9.2.4`, `connectivity_plus ^6.1.5`,
`share_plus 11.1.0`, `package_info_plus 8.3.1`, `printing 5.14.3`. Se evitan `file_picker` y `open_filex` porque
fijan versiones de AGP que no están en caché. Antes de subir una versión, comprueba:

```bash
cd android && gradlew.bat assembleDebug --offline
```

## Pruebas y calidad

```bash
flutter analyze
flutter test          # 47 pruebas, ~15 s, sin emulador ni base de datos
```

| Suite | Qué verifica |
|---|---|
| `test/app/auth_flow_test.dart` | Login correcto/incorrecto, cuenta desactivada, sin red, recuperar contraseña, sesión recordada, token vencido (al abrir y en uso), arranque sin red con perfil guardado, cerrar sesión, versión mínima |
| `test/app/roles_test.dart` | Matriz de permisos (T4.3) para los 6 roles con los DEFAULTS del servidor: pestañas, FAB, ⋮, editar/eliminar, registrar asistencia, visitante, club editable, módulos de "Más", y **ninguna llamada a un endpoint que el rol no puede usar** |
| `test/app/flows_test.dart` | Registrar asistencia (reemplazo, decisiones, búsqueda, visitante, sin red), crear evento (ISO `-05:00`), crear/editar miembro (degradación sin cargos), Club (+1, mantener +5, lote, canje), asistencia semanal (teclado, PUT al reemplazar, 403 para Asistencia) |
| `test/app/accessibility_test.dart` | Fuente del sistema al 130% sin desbordes (T4.4) |
| `test/contract/permissions_sync_test.dart` | La copia de permisos de las pruebas coincide con `server/config/permissions.js` (usa `node`) |
| `test/*_test.dart` | Hora de Panamá, formatos en español, orden de pestañas |

Las pruebas de `test/app/` montan la app completa contra un **backend simulado**
(`test/support/fake_backend.dart`) que replica rutas, forma de las respuestas, paginación y la
autorización por ruta del servidor. El CI (`.github/workflows/mobile.yml`) corre `analyze` + `test` en cada PR que toque `mobile/`.

## Estructura

```
lib/
  main.dart               arranque, tema, localización es-419, banda "Sin conexión"
  app/                    router (go_router), tab bar filtrada por permisos, pantallas de sistema
  core/
    api/                  cliente Dio (Bearer, X-App-Version, X-Platform, 401 → refresh/expira), errores en español
    auth/                 sesión en Keychain/Keystore, usuario y mapa de permisos
    church_scope.dart     selector de iglesia para SuperAdmin (inyecta church_id)
    theme/                tokens Broadsheet y tema Material
    utils/                hora de Panamá (ISO con -05:00), formatos en español, llamadas/WhatsApp/PDF
  data/                   modelos y repositorio por endpoint (PLAN §1.3)
  features/               auth, home, members, events, club, weekly, minutes, more
  widgets/                componentes compartidos (botones, chips, filas, estados, hojas, snackbar)
test/                     hora de Panamá, formatos y pestañas por permisos
```

## Reglas que respeta el código

- **Permisos:** la UI decide solo con `GET /api/auth/my-permissions` (`Permissions.can(módulo, acción)`), nunca por nombre de rol.
  Los botones sin permiso **no existen** (no se muestran deshabilitados).
- **Fechas:** se envían como hora de pared de Panamá en ISO con offset (`2026-04-26T19:00:00-05:00`); ver `core/utils/panama_time.dart`.
- **Tokens:** solo en `flutter_secure_storage`; nunca en logs.
- **Asistencia a eventos:** el servidor reemplaza la lista completa → la app envía registrados + nuevos.
- **Cargos (hallazgo 1.5.d):** si `GET /ministerial-positions` da 403, el campo se oculta y no se envía (se conserva el valor).

## Pendiente que depende del backend

| Función en la app | Tarjeta backend | Comportamiento mientras tanto |
|---|---|---|
| Refresh token / logout remoto | T1.3 | La app manda `device_id` al login y ya sabe refrescar; hoy un 401 lleva al Login con “Tu sesión expiró”. |
| Versión mínima (“Actualiza la app”) | T1.4 | Consulta `/api/app/config`; si no existe, no bloquea. |
| Código de recuperación por correo | T1.5 | El flujo funciona; en producción el correo aún no se envía. |
| Eliminar mi cuenta | T1.6 | Llama `DELETE /api/auth/me`; si da 404, pide acudir al administrador. |
| Logos con URL absoluta | T1.7 | La app antepone el origen del servidor a `/uploads/...`. |
| Aviso de privacidad | T1.9 | Abre `<web>/privacidad.html`. |
