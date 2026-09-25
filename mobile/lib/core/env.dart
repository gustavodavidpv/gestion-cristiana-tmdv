/// Configuración de entorno inyectada en compilación con `--dart-define`.
///
/// Ejemplos:
///   flutter run --dart-define=API_URL=http://192.168.1.20:5000/api
///   flutter build appbundle --dart-define=API_URL=https://api.tmdv.org/api
///
/// Nunca se guardan secretos aquí: solo URLs públicas.
class Env {
  Env._();

  /// URL base de la API (incluye `/api`). Por defecto apunta al servidor local
  /// visto desde el emulador de Android (10.0.2.2 = localhost del PC).
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
  );

  /// Iglesia cuyo branding se muestra en el Login antes de iniciar sesión.
  /// La web usa `1` fijo; tras el primer login se recuerda la iglesia del usuario.
  static const int defaultChurchId = int.fromEnvironment('CHURCH_ID', defaultValue: 1);

  /// Origen del servidor (sin `/api`), para archivos estáticos como logos.
  static String get serverOrigin => Uri.parse(apiUrl).origin;

  /// URL del sistema web completo (mismo servidor que sirve el build de React).
  static String get webUrl => serverOrigin;

  /// Convierte una ruta relativa del servidor (`/uploads/...`) en URL absoluta.
  /// Si ya es absoluta la devuelve tal cual (preparado para T1.7).
  static String? absoluteUrl(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '$serverOrigin${path.startsWith('/') ? '' : '/'}$path';
  }
}
