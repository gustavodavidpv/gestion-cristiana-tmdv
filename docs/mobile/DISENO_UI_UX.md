# Diseño UI/UX — App Móvil "Gestión Cristiana TMDV"

> **Para qué sirve este documento:** es el brief con el que se diseñan las pantallas de la app **en Claude** (prototipos visuales) y la especificación que después implementa el Agente Mobile.
>
> **Documento hermano:** [PLAN_APP_MOVIL.md](PLAN_APP_MOVIL.md) — orquestación, fases y hand-off técnico.

| Campo | Valor |
|---|---|
| Versión | 1.0 · 2026-09-24 |
| Plataformas | iOS 15+ · Android 8+ · **solo teléfono, solo vertical** en v1.0 |
| Idioma | Español (es-419, Panamá) |
| Base visual | Material Design 3 vía React Native Paper, con los tokens de marca de `client/src/theme.js` |
| Tema | Claro en v1.0 (oscuro en v1.1, pero **los tokens ya se definen en pares**) |

---

## 1. Cómo diseñar esto en Claude

### 1.1 Flujo de trabajo recomendado

1. **Una pantalla por conversación/artefacto.** Pega el prompt de §11 correspondiente. Claude devuelve un artefacto HTML que simula el teléfono (marco de 390×844 px) con la pantalla dentro.
2. **Itera con cambios concretos:** “sube la acción principal al alcance del pulgar”, “muestra el estado vacío”, “versión para el rol Asistencia”.
3. **Pide siempre los estados**, no solo el caso feliz: cargando (esqueleto), vacío, error, sin conexión, sin permiso, lista larga.
4. **Agrupa al final** un artefacto “mapa de pantallas” con todas las capturas en miniatura para revisar coherencia.
5. **Entrega al Agente Mobile:** el HTML del prototipo + los tokens de §3 en JSON + las notas de comportamiento de §8. El prototipo **no se convierte en código de la app**: es referencia visual; la implementación usa React Native Paper.

### 1.2 Reglas para todo lo que se genere

- Marco de teléfono **390×844** (iPhone 14/15) con áreas seguras marcadas: 44 px arriba (notch), 34 px abajo (barra de gestos).
- Usar **exclusivamente** los tokens de §3. Nada de colores inventados.
- Textos reales en español, **nunca *lorem ipsum***, y **nunca datos reales de personas**: usar el juego de datos ficticios de §9.4.
- Tipografía del sistema (`-apple-system`, `Roboto`), tamaños de §3.2.
- Áreas táctiles mínimas de **48×48 px**.
- Nada de efectos que React Native no pueda reproducir fácilmente (filtros CSS complejos, `backdrop-filter`, animaciones de scroll exóticas).

---

## 2. Principios y contexto de uso

**Dónde se va a usar esta app, de verdad:** de pie en el templo, con una sola mano, a veces con poca luz o con el sol de frente, con datos móviles inestables, entre el saludo de dos hermanos, y a menudo por personas de 45–70 años que no usan apps complejas.

| # | Principio | Cómo se ve en la pantalla |
|---|---|---|
| 1 | **Una tarea por pantalla** | Nada de pantallas que hacen tres cosas. El registro de asistentes solo registra asistentes |
| 2 | **Lo importante, al alcance del pulgar** | Acciones principales en el tercio inferior: botón ancho fijo o FAB; nunca en la esquina superior |
| 3 | **Legible a distancia de brazo** | Texto base 16 px, títulos 22–28 px, nunca gris claro sobre blanco para información esencial |
| 4 | **Rápido de verdad** | El registro semanal en ≤3 toques; 20 asistentes en <2 minutos; búsqueda que filtra mientras se escribe |
| 5 | **Nunca castigar el error** | Confirmación solo en lo destructivo, con “Deshacer” cuando se pueda; los formularios guardan borrador si la red falla |
| 6 | **Lo que no puedes hacer, no se ve** | Si el permiso está en falso, la opción no aparece (no aparece en gris) |
| 7 | **Honesto con el estado** | Siempre queda claro si algo se guardó, está guardándose o falló, y qué iglesia/año se está viendo |
| 8 | **Respetuoso con los datos** | Datos de miembros y de menores: sin capturas de pantalla promocionales con datos reales, sin exponer teléfonos en listas cuando no hacen falta |

---

## 3. Tokens de diseño

### 3.1 Color

| Token | Claro | Oscuro (v1.1) | Uso |
|---|---|---|---|
| `primary` | `#1565C0` | `#90CAF9` | Acciones principales, barra superior, activos |
| `primaryDark` | `#0D47A1` | `#64B5F6` | Estados presionados |
| `primaryLight` | `#42A5F5` | `#BBDEFB` | Realces suaves |
| `onPrimary` | `#FFFFFF` | `#0A2A4A` | Texto sobre primario |
| `primaryContainer` | `#E3F0FC` | `#1B3A5C` | Fondos de chip/badge informativo |
| `secondary` | `#2E7D32` | `#81C784` | Confirmaciones, “presente”, puntos ganados |
| `error` | `#C62828` | `#EF9A9A` | Errores, eliminar, puntos descontados |
| `warning` | `#E65100` | `#FFB74D` | Avisos, “revisar” |
| `success` | `#2E7D32` | `#81C784` | Guardado correcto |
| `background` | `#F5F7FA` | `#121417` | Fondo de pantalla |
| `surface` | `#FFFFFF` | `#1C1F24` | Tarjetas, hojas, campos |
| `surfaceAlt` | `#EEF2F7` | `#23272E` | Filas alternas, separadores suaves |
| `textPrimary` | `#212121` | `#ECEFF1` | Texto principal |
| `textSecondary` | `#616161` | `#B0BEC5` | Texto de apoyo |
| `textDisabled` | `#9E9E9E` | `#78909C` | Deshabilitado |
| `border` | `#E0E0E0` | `#333941` | Bordes y divisores |
| `overlay` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.6)` | Fondo de modales |

**Colores por tipo de evento** (chips en agenda y detalle): Culto `#1565C0` · Culto Especial `#6A1B9A` · Evangelismo `#2E7D32` · Reunión `#455A64` · Otro `#616161`.

**Regla de contraste:** cualquier texto sobre fondo de color debe llegar a 4.5:1 (AA). `#1565C0` sobre blanco cumple; `#42A5F5` **no** sirve para texto.

### 3.2 Tipografía

| Rol | Tamaño / peso | Uso |
|---|---|---|
| `display` | 28 / 700 | Cifra grande de una métrica |
| `title` | 22 / 700 | Título de pantalla |
| `subtitle` | 18 / 600 | Cabecera de sección, nombre en ficha |
| `body` | 16 / 400 | Texto general (**mínimo para datos**) |
| `bodyStrong` | 16 / 600 | Valor destacado en fila |
| `caption` | 14 / 400 | Apoyo, metadatos |
| `overline` | 12 / 600 / +0.5 espaciado / MAYÚSCULAS | Etiquetas de sección |

Familia: `-apple-system` en iOS, `Roboto` en Android. **Los botones no van en mayúsculas** (igual que la web). Interlineado 1.4. Todo debe sobrevivir al tamaño de fuente del sistema al 130%.

### 3.3 Espaciado, forma y elevación

- Escala de espaciado (px): **4, 8, 12, 16, 20, 24, 32, 40**. Margen lateral estándar: **16**.
- Radios: campos y botones **8**, tarjetas **10**, hojas inferiores **20** (arriba), chips **16** (píldora).
- Elevación: tarjetas `0 1px 3px rgba(0,0,0,0.08)`; barra superior con línea de 1 px `border`; hojas y FAB `0 4px 12px rgba(0,0,0,0.15)`. Sin sombras coloreadas.
- Altura de fila de lista: **72** (con avatar y dos líneas) u **88** (tres líneas).
- Barra superior: **56** + área segura. Barra de pestañas: **60** + área segura.

### 3.4 Iconografía

Material Symbols (los mismos conceptos que ya usa la web): Dashboard, Miembros (people), Iglesias (church), Eventos (event), Asistencia (groups), Actas (description), Club Bíblico (menu_book), Perfil (account_circle). Tamaño 24 px en listas y pestañas, 20 px dentro de chips. **Siempre acompañados de texto** en la navegación principal.

---

## 4. Arquitectura de información

### 4.1 Navegación

**Pestañas inferiores (máx. 5, filtradas por permiso)** — el orden se decide por rol al iniciar sesión:

| Rol | Pestañas |
|---|---|
| Administrador / SuperAdmin | Inicio · Miembros · Eventos · Club · Más |
| Secretaría | Inicio · Miembros · Eventos · Actas · Más |
| Líder | Inicio · Miembros · Eventos · Club · Más |
| Asistencia | Inicio · Eventos · Miembros · Más |
| Visitante | Inicio · Miembros · Más |

**“Más”** es una lista que contiene lo que no cupo (Asistencia semanal, Actas, Club Bíblico, Iglesia) + Perfil, Ajustes, Acerca de, y un enlace “Abrir el sistema completo en la web” para los módulos de administración que no están en la app (usuarios, roles, permisos, branding, notificaciones).

### 4.2 Mapa de pantallas

```
Arranque
├── Actualiza la app (bloqueante)      ├── Bloqueo biométrico
└── Login ── Olvidé mi contraseña ── Código y nueva contraseña
      │
      └── App
          ├── Inicio (Dashboard) ── [SuperAdmin] Comparativo por iglesia
          ├── Miembros ── Filtros · Ficha ── Editar/Crear
          ├── Eventos ── Detalle ── Editar/Crear
          │        └── Registrar asistentes ── Nuevo visitante
          │        └── Exportar calendario (PDF)
          ├── Asistencia semanal ── Registrar semana
          ├── Club Bíblico ── Salón ── Hoja de puntos · Canje · Historial · Posiciones (PDF)
          ├── Actas ── Detalle ── Adjuntar archivo · Ver/descargar archivo
          └── Más ── Perfil · Ajustes · Acerca de · Eliminar cuenta · Cerrar sesión
```

### 4.3 Encabezado

Barra superior con: título de la pantalla + (si el usuario es SuperAdmin) **selector de iglesia** siempre visible como chip bajo el título, porque equivocarse de iglesia es el error más caro de esta app. Si el usuario pertenece a una sola iglesia, se muestra el nombre corto/iniciales sin ser interactivo.

---

## 5. Componentes base (inventario)

| Componente | Anatomía | Estados |
|---|---|---|
| **Botón principal** | Ancho completo, alto 52, radio 8, `primary`/`onPrimary` | normal, presionado, cargando (spinner + texto “Guardando…”), deshabilitado |
| **Botón secundario** | Contorno 1 px `primary` | idem |
| **Botón destructivo** | Texto/contorno `error` | idem |
| **FAB** | 56 px, esquina inferior derecha, 16 de margen, sobre la barra de pestañas | normal, oculto al hacer scroll hacia abajo |
| **Tarjeta de métrica** | Icono + cifra `display` + etiqueta `caption` + variación opcional | normal, esqueleto |
| **Fila de lista** | Avatar/iniciales 40 px · título `bodyStrong` · subtítulo `caption` · chip o valor a la derecha · chevron | normal, presionada, seleccionada (Club/asistentes), deshabilitada |
| **Chip de filtro** | Píldora, texto 14, `primaryContainer` cuando está activo | inactivo, activo, contador (“3”) |
| **Campo de texto** | Etiqueta arriba, alto 52, radio 8, ayuda/error debajo | normal, foco (borde `primary` 2 px), error (`error` + mensaje), solo lectura |
| **Selector (bottom sheet)** | Hoja con lista y buscador si >8 opciones | — |
| **Selector de fecha/hora** | Nativo del sistema, **siempre** con zona Panamá visible en el resumen | — |
| **Buscador** | Lupa + campo + limpiar; con *debounce* de 300 ms | vacío, escribiendo, sin resultados |
| **Hoja de acciones** | Lista de acciones con icono; destructiva en `error` al final | — |
| **Diálogo de confirmación** | Título en pregunta, cuerpo con consecuencia, botones “Cancelar” / acción | — |
| **Snackbar** | Abajo, 4 s, con “Deshacer” cuando aplique | éxito (`success`), error (`error`) |
| **Estado vacío** | Ilustración simple o icono 64 px + título + frase + acción sugerida | — |
| **Esqueleto de carga** | Bloques `surfaceAlt` con pulso; **nunca** spinner de pantalla completa salvo en el arranque | — |
| **Banner sin conexión** | Franja `warning` bajo el encabezado: “Sin conexión — viendo datos guardados” | — |
| **Selector de año** | Chip con año + flechas ‹ ›; usado en Inicio, Asistencia y Eventos | — |
| **Contador de puntos** | `−` valor `+` con toque largo para ±5 | — |

---

## 6. Patrones de interacción

- **Listas largas:** carga por páginas al llegar al 80% del scroll (la API ya pagina), “deslizar para actualizar”, y contador total arriba (“128 miembros”).
- **Búsqueda:** siempre visible en Miembros y en la selección de asistentes; filtra por nombre y por teléfono.
- **Filtros:** en hoja inferior, con chips de los filtros activos bajo el buscador y un “Limpiar”.
- **Selección múltiple** (asistentes, puntos): toque en la fila alterna la selección, barra inferior fija con “N seleccionados” + acción principal. Nunca perder la selección al buscar.
- **Formularios:** una columna, etiquetas arriba, teclado adecuado por campo (`phone-pad`, `email-address`, `numeric`), botón de guardar fijo abajo, validación **al salir del campo** y resumen de errores al intentar guardar. Al cerrar con cambios sin guardar: “¿Descartar los cambios?”.
- **Acciones destructivas:** diálogo con el nombre del elemento (“¿Eliminar a María Pérez?”) y consecuencia explícita.
- **Archivos:** al tocar “Adjuntar” → hoja con *Tomar foto · Elegir de la galería · Elegir documento*. Progreso de subida por archivo y posibilidad de reintentar el que falle.
- **PDF:** botón “Descargar” → barra de progreso → hoja nativa de compartir/abrir. Nunca dejar el archivo “en la nada”.
- **Permisos:** si falta el permiso de vista, el módulo no aparece. Si falta el de acción, no aparece el botón. Si la API devuelve 403 igualmente, mostrar “No tienes permiso para esta acción. Pide a tu administrador que lo habilite”.
- **Sesión:** el refresh es invisible; si la sesión caduca de verdad, volver a Login con “Tu sesión expiró, inicia sesión otra vez” (sin perder lo que estaba escrito, si es posible).

---

## 7. Estados globales obligatorios

| Estado | Qué se muestra |
|---|---|
| **Cargando** | Esqueletos con la forma del contenido real |
| **Vacío** | Icono + “Aún no hay <cosa>” + qué hacer (“Toca + para registrar la primera semana”) |
| **Vacío por filtro** | “Ningún miembro coincide con la búsqueda” + botón “Limpiar filtros” |
| **Error de red** | “No pudimos conectar. Revisa tu conexión.” + “Reintentar” |
| **Error del servidor** | “Algo salió mal de nuestro lado. Intenta de nuevo en un momento.” + “Reintentar” |
| **Sin conexión** | Banner + datos cacheados; las acciones de escritura se deshabilitan con explicación |
| **Sin permiso** | Pantalla neutra: “No tienes acceso a este módulo” + “Volver al inicio” |
| **Mantenimiento / versión mínima** | Pantalla bloqueante con logo, mensaje del servidor y botón a la tienda |

---

## 8. Especificación por pantalla

> Formato: **Propósito · Estructura · Acciones · Detalles**. Las pantallas marcadas ⭐ son las que definen el valor de la app: diséñalas primero y con más cuidado.

### 8.1 Login ⭐
**Propósito:** entrar rápido, transmitiendo que esto es de *su* iglesia.
**Estructura:** logo de la iglesia (de `GET /api/branding/:id`) o círculo con iniciales sobre `primary` · título de la iglesia · campos Correo y Contraseña (con ojo para mostrar) · botón “Entrar” ancho · “¿Olvidaste tu contraseña?” · pie con versión de la app.
**Acciones:** entrar · recuperar · (si estaba activada) desbloquear con huella/rostro.
**Detalles:** el correo recuerda el último usado; error de credenciales en línea bajo los campos, no en un diálogo; si el servidor no responde: “No pudimos conectar con el servidor de tu iglesia”.

### 8.2 Inicio / Dashboard ⭐
**Propósito:** una foto del estado de la obra en 5 segundos.
**Estructura:** saludo (“Buenos días, Gustavo”) + nombre de la iglesia · selector de año · **rejilla 2×2 de tarjetas de métrica**: Miembros, Eventos del año, Actas, Decisiones de fe · tarjeta “Resumen de la iglesia” (responsable, membresía, asistencia promedio semanal, predicadores y diáconos ordenados/no ordenados) · sección “Próximos eventos” (3 filas) · accesos rápidos según permiso: *Registrar asistencia · Cargar puntos · Registrar semana*.
**Detalles SuperAdmin:** arriba, selector de iglesia; abajo, tabla/tarjetas comparativas por iglesia con la métrica seleccionable.

### 8.3 Miembros — lista
**Estructura:** buscador fijo · fila de chips (Tipo, Cargo, Bautizado, Cumpleaños del mes, con contador de filtros activos) · contador de resultados · filas: avatar con iniciales, nombre completo, `caption` con tipo · cargo, a la derecha iconos de llamar y WhatsApp (solo si hay teléfono) · FAB “+” si tiene `members.create`.
**Detalles:** el toque en la fila abre la ficha; el toque en el icono de teléfono **no** abre la ficha.

### 8.4 Miembro — ficha
**Estructura:** cabecera con iniciales grandes, nombre, chips de tipo/cargo/bautizado · botones de acción rápidos (Llamar · WhatsApp · Editar) · secciones: Datos personales (edad, cumpleaños, sexo), Contacto (teléfono, correo, dirección), Iglesia (cargo ministerial, tipo, fecha de registro).
**Detalles:** eliminar vive en el menú ⋮ del encabezado, nunca como botón grande.

### 8.5 Miembro — formulario
Campos en este orden: Nombres*, Apellidos*, Tipo* (selector), Sexo, Edad, Cumpleaños (día y mes, sin año), Bautizado (interruptor), Cargo ministerial (selector; **se oculta si la API responde 403**), Teléfono, Correo, Dirección.
**Detalles:** `*` obligatorios; guardar fijo abajo; al crear desde “Registrar asistentes” vuelve a esa pantalla con el visitante ya seleccionado.

### 8.6 Eventos — agenda
**Estructura:** conmutador **Mes | Lista** · si es Mes: cabecera de mes con ‹ ›, rejilla con puntos de color por tipo, y bajo el calendario la lista del día elegido · si es Lista: próximos eventos agrupados por mes · chips de filtro por tipo · FAB “+”.
**Detalles:** en el encabezado, menú ⋮ → “Descargar calendario del mes” y “Calendario de ventas del año”.

### 8.7 Evento — detalle ⭐
**Estructura:** título, chip de tipo, fecha y hora en formato largo (“Domingo 26 de abril, 7:00 p. m.”), lugar, descripción · si es culto: tarjetas de **Predicador / Dirige adoración / Canta** con nombre y foto-iniciales · bloque de cifras: asistentes registrados y decisiones de fe · **botón principal fijo abajo: “Registrar asistencia”** (si tiene `events.attendance`).
**Detalles:** editar/eliminar en ⋮.

### 8.8 Registrar asistentes ⭐ (la pantalla más importante)
**Propósito:** marcar quién vino, de pie, rápido, sin errores.
**Estructura:** buscador arriba · contador fijo “12 seleccionados” · lista de miembros con casilla grande a la izquierda y, a la derecha, un botón pequeño “✝ Decisión” que se resalta en `secondary` al activarse · abajo, barra fija: “Guardar asistencia (12)” + enlace “Nuevo visitante”.
**Detalles:** los ya registrados aparecen arriba, marcados y con etiqueta “Ya registrado”; la selección sobrevive a la búsqueda; al guardar, snackbar “Asistencia guardada · 12 personas, 2 decisiones de fe”; si falla la red, se conserva la selección y se ofrece reintentar.

### 8.9 Asistencia semanal
**Estructura:** selector de año · tres tarjetas pequeñas (Promedio · Semanas registradas · Máx/Mín) · lista de semanas (fecha, cantidad grande, notas, quién registró) · FAB “+”.
**Formulario:** Fecha de la semana* (por defecto el domingo más cercano), Cantidad* (teclado numérico grande), Notas, “Registrado por” (prellenado con el usuario).

### 8.10 Club Bíblico — hoja de puntos ⭐
**Estructura:** cabecera con salón y fecha de la actividad (editable) · lista de participantes: nombre, puntos acumulados en `caption`, y a la derecha el **contador − 0 +** · pie fijo: “Guardar N movimientos”.
**Detalles:** toque largo en `+` suma de 5 en 5; las filas en 0 se ignoran al guardar (así lo hace la API); al guardar, snackbar con el total y opción “Ver posiciones”. **Canje:** hoja inferior con artículo, puntos a descontar (siempre en `error` y en negativo) y nota.
**Historial del participante:** línea de tiempo con fecha, motivo/artículo, y el valor en `secondary` (ganó) o `error` (canjeó), con el saldo arriba.

### 8.11 Actas
**Lista:** título, fecha de reunión, autor, chips con número de archivos y de acuerdos.
**Detalle:** objetivo, asistentes (fichas pequeñas), motivos/acuerdos con su estado (chip “Aprobado” en `success`), archivos con icono por tipo, tamaño y botón de descarga · botón “Adjuntar archivo” si tiene `minutes.edit`.

### 8.12 Perfil y Más
**Perfil:** iniciales, nombre, correo, chips de rol e iglesia · “Cambiar contraseña” · “Cerrar sesión” (en `error`, al final).
**Ajustes:** desbloqueo biométrico, año por defecto, limpiar caché.
**Acerca de:** versión y número de compilación, aviso de privacidad, términos, soporte, **“Eliminar mi cuenta”**.
**Eliminar cuenta:** explica en dos frases qué pasa (se desactiva el acceso; los datos de la iglesia y de los miembros permanecen porque pertenecen al ministerio), pide la contraseña y confirma con un diálogo.

---

## 9. Contenido, tono y datos de ejemplo

### 9.1 Tono
Cercano, claro y respetuoso. Tuteo (“Tu sesión expiró”). Sin jerga técnica (“error 500”, “token”), sin signos de admiración en cadena, sin humor en mensajes de error.

### 9.2 Microcopy de referencia

| Situación | Texto |
|---|---|
| Login fallido | “Correo o contraseña incorrectos.” |
| Servidor caído | “No pudimos conectar con el servidor de tu iglesia. Intenta de nuevo en unos minutos.” |
| Sin conexión | “Sin conexión — estás viendo datos guardados.” |
| Guardado | “Miembro guardado.” · “Asistencia guardada · 12 personas, 2 decisiones de fe.” |
| Eliminar | “¿Eliminar a María Pérez? Esta acción no se puede deshacer.” |
| Sin permiso | “No tienes permiso para esta acción. Pide a tu administrador que la habilite.” |
| Vacío (semanas) | “Aún no registras semanas de este año. Toca + para empezar.” |
| Vacío (búsqueda) | “Ningún miembro coincide con tu búsqueda.” |
| Sesión expirada | “Tu sesión expiró. Inicia sesión otra vez.” |
| Versión mínima | “Hay una versión nueva de la app. Actualízala para continuar.” |

### 9.3 Etiquetas fijas
Usar **exactamente** las mismas palabras que la web para no confundir: *Miembros, Visitante, Familiar, Infante, Candidato a bautismo · Cargo ministerial · Decisiones de fe · Acta · Motivo/Acuerdo · Culto, Culto Especial, Evangelismo, Reunión · Club Bíblico, salón, participante, puntos, canje · Asistencia semanal*.

### 9.4 Juego de datos ficticios (para prototipos y capturas de tienda)
Iglesia **“Iglesia Central TMDV — Ciudad de Panamá”**, responsable **Pastor Elías Moreno**. Miembros: Ana Batista, Carlos Him, Daniela Ortega, Eduardo Sánchez, Fátima Ruiz, Gabriel Mendoza, Rosa Núñez. Eventos: “Culto de adoración” (dom 7:00 p. m.), “Evangelismo en San Miguelito” (sáb 9:00 a. m.), “Reunión de líderes”. Club Bíblico: salones **Exploradores** y **Conquistadores**. Cifras: 128 miembros, asistencia promedio 96, 14 decisiones de fe, 23 eventos, 9 actas. **Teléfonos siempre `+507 6000-0000`.**

---

## 10. Marca y assets de tienda

| Asset | Especificación | Notas de diseño |
|---|---|---|
| **Icono** | 1024×1024 PNG sin transparencia ni bordes redondeados (iOS los aplica); Android adaptativo: capa de fondo + capa de contenido con 66% de zona segura | Símbolo simple y legible a 48 px: monograma **TMDV** o una cruz/iglesia geométrica sobre `#1565C0`. Nada de texto largo ni degradados sutiles |
| **Splash** | Logo centrado sobre `#FFFFFF` (o `#1565C0` con logo blanco), sin texto de carga | Debe encadenar visualmente con la pantalla de Login |
| **Gráfico destacado (Play)** | 1024×500 | Nombre de la app + una frase (“La gestión de tu iglesia, en tu bolsillo”) sobre `#1565C0` con una captura ladeada |
| **Capturas** | iOS 6.9" (1320×2868) y Android teléfono; 6–8 por tienda | Orden sugerido: 1) Inicio con métricas · 2) Registrar asistencia · 3) Miembros · 4) Club Bíblico · 5) Eventos/calendario · 6) Actas. Cada una con un titular de ≤6 palabras arriba y el marco del teléfono sobre fondo `#E3F0FC` |
| **Datos en capturas** | Solo el juego ficticio de §9.4 | **Requisito legal y de privacidad**, no es opcional |

---

## 11. Prompts listos para Claude

### 11.1 Prompt base (pegar antes del específico)

```text
Diseña una pantalla de app móvil como artefacto HTML: un marco de teléfono de 390×844 px,
área segura de 44 px arriba y 34 px abajo, contenido dentro del marco, fondo de la página #E3F0FC.

Sistema de diseño (úsalo estrictamente, no inventes colores):
- primary #1565C0, primaryDark #0D47A1, primaryContainer #E3F0FC, onPrimary #FFFFFF
- secondary/success #2E7D32, error #C62828, warning #E65100
- background #F5F7FA, surface #FFFFFF, surfaceAlt #EEF2F7, border #E0E0E0
- textPrimary #212121, textSecondary #616161
- Tipografía del sistema. Tamaños: display 28/700, título 22/700, subtítulo 18/600,
  cuerpo 16/400, fuerte 16/600, caption 14/400.
- Espaciado 4/8/12/16/24/32, margen lateral 16. Radios: botón y campo 8, tarjeta 10, hoja 20, chip 16.
- Altura: barra superior 56, fila de lista 72, botón principal 52, área táctil mínima 48.
- Sombra de tarjeta: 0 1px 3px rgba(0,0,0,.08). Botones sin mayúsculas.

Contexto: app de gestión de iglesias, en español de Panamá, para personas de 25 a 70 años que la
usan de pie y con una mano. La acción principal siempre en el tercio inferior.
Usa datos ficticios (Iglesia Central TMDV, Ana Batista, Carlos Him…), nunca lorem ipsum.
Iconos: Material Symbols en línea o SVG simple.
```

### 11.2 Prompts por pantalla (añadir al base)

| Pantalla | Prompt |
|---|---|
| Login | “Pantalla de inicio de sesión: círculo de 88 px con las iniciales ‘TMDV’ sobre primary, título ‘Iglesia Central TMDV’, subtítulo ‘Gestión Cristiana’, campos Correo y Contraseña (con icono de ojo), botón ancho ‘Entrar’, enlace ‘¿Olvidaste tu contraseña?’, pie con ‘Versión 1.0.0’. Muestra también, al lado, la variante con error ‘Correo o contraseña incorrectos.’” |
| Inicio | “Dashboard: barra superior azul con ‘Inicio’ y avatar; saludo ‘Buenos días, Gustavo’ y nombre de la iglesia; chip selector de año 2026 con flechas; rejilla 2×2 de tarjetas de métrica (Miembros 128, Eventos 23, Actas 9, Decisiones de fe 14) con icono y cifra grande; tarjeta ‘Resumen de la iglesia’ con responsable, membresía, asistencia promedio 96 y predicadores/diáconos; sección ‘Próximos eventos’ con 3 filas; barra de pestañas inferior con Inicio, Miembros, Eventos, Club, Más.” |
| Miembros | “Lista de miembros: buscador fijo, fila de chips de filtro (Tipo, Cargo, Bautizado, Cumpleaños) con uno activo, texto ‘128 miembros’, filas de 72 px con avatar de iniciales, nombre, ‘Miembro · Diácono ordenado’, e iconos de llamar y WhatsApp a la derecha; FAB azul con +. Incluye una segunda versión con el estado vacío de búsqueda.” |
| Registrar asistentes | “Pantalla de registro de asistencia de un evento: encabezado con ‘Culto de adoración · dom 26 abr, 7:00 p. m.’; buscador; barra con ‘12 seleccionados’; lista con casillas grandes a la izquierda, nombre, y a la derecha un botón pequeño ‘✝ Decisión’ (dos de ellos activados en verde); dos filas superiores con etiqueta ‘Ya registrado’; barra inferior fija con botón ancho ‘Guardar asistencia (12)’ y enlace ‘Nuevo visitante’.” |
| Evento detalle | “Detalle de evento: título ‘Culto de adoración’, chip azul ‘Culto’, fecha larga, lugar; tres tarjetas de rol (Predicador, Dirige adoración, Canta) con iniciales y nombre; dos cifras grandes (Asistentes 96, Decisiones de fe 2); botón fijo abajo ‘Registrar asistencia’; menú ⋮ en el encabezado.” |
| Club Bíblico | “Hoja de puntos: encabezado ‘Salón Exploradores · 21 de septiembre’; lista de 7 participantes con nombre, ‘Acumulado: 45 pts’ en caption y un contador − 0 + a la derecha (tres con valores 10, 5 y 20); pie fijo ‘Guardar 3 movimientos’. Añade al lado la hoja inferior de canje con artículo, puntos en rojo y nota.” |
| Asistencia semanal | “Lista de asistencia semanal del año 2026: selector de año, tres tarjetas pequeñas (Promedio 96, Semanas 34, Máx/Mín 132/71), filas con fecha, cifra grande, nota ‘Culto y escuela dominical’ y ‘Registró: Secretaría’; FAB +. Incluye la variante del formulario de registro con teclado numérico.” |
| Actas | “Lista de actas y, al lado, el detalle: objetivo, asistentes como fichas pequeñas, acuerdos con chip verde ‘Aprobado’, archivos adjuntos con icono PDF, tamaño y botón de descarga, botón ‘Adjuntar archivo’.” |
| Estados | “En un solo artefacto, seis marcos de teléfono mostrando: carga con esqueletos, lista vacía, error de red, sin conexión (banner), sin permiso, y pantalla bloqueante ‘Actualiza la app’.” |
| Mapa | “Une todas las pantallas ya diseñadas en un artefacto tipo mapa: miniaturas agrupadas por sección (Acceso, Inicio, Miembros, Eventos, Club Bíblico, Actas, Perfil) con flechas de navegación entre ellas.” |
| Icono | “Diseña 6 propuestas de icono de app en SVG, 1024×1024, para ‘Gestión Cristiana TMDV’: monograma TMDV y símbolos de iglesia/cruz geométricos sobre #1565C0, legibles a 48 px, sin texto pequeño ni degradados. Muéstralas en una rejilla con vista previa a 48, 96 y 512 px.” |
| Capturas de tienda | “Genera 6 capturas para tienda (1320×2868, fondo #E3F0FC) con el marco del teléfono ladeado, un titular de ≤6 palabras arriba en #0D47A1 y las pantallas de Inicio, Registrar asistencia, Miembros, Club Bíblico, Eventos y Actas.” |

### 11.3 Cómo pedir variantes
“Muéstrame esta misma pantalla para el rol **Asistencia** (sin botones de crear/editar)” · “…con 3 filtros activos” · “…con el nombre más largo posible para probar el desbordamiento” · “…con el tamaño de fuente del sistema al 130%” · “…en modo oscuro usando la columna oscura de los tokens”.

---

## 12. Checklist de revisión de diseño (DoD de cada pantalla)

- [ ] Cabe en 390×844 sin scroll para el contenido esencial, y funciona también en 360×640
- [ ] La acción principal está en el tercio inferior y mide ≥48 px de alto
- [ ] Están diseñados los estados: carga, vacío, error, sin conexión, sin permiso
- [ ] Todo el texto usa tokens de color con contraste ≥4.5:1
- [ ] Ninguna información depende solo del color (los chips llevan texto)
- [ ] Los textos son los de §9 y usan el vocabulario de la web
- [ ] Se ve siempre **qué iglesia** y **qué año** se está viendo cuando aplica
- [ ] No hay datos reales de personas en ninguna captura
- [ ] Hay versión para al menos un rol restringido
- [ ] El Agente Mobile puede implementarla con React Native Paper sin inventar nada

---

## 13. Entregables de diseño

| Entregable | Formato | Destino |
|---|---|---|
| Prototipos de pantalla | Artefactos HTML (uno por pantalla o agrupados) | `docs/mobile/diseno/` (exportar y versionar) |
| Tokens | `mobile/src/theme/tokens.json` + `theme.ts` | Implementación (T2.5) |
| Mapa de pantallas | Un artefacto con todas las miniaturas | Revisión con el PO |
| Icono y splash | SVG + PNG 1024 y capas de Android | T5.1 |
| Capturas de tienda | PNG por tamaño exigido | T5.2 |
| Este documento actualizado | Markdown | Fuente de verdad del diseño |
