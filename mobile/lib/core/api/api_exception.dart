import 'package:dio/dio.dart';

enum ApiErrorKind { network, timeout, unauthorized, forbidden, notFound, conflict, validation, rateLimited, server, unknown }

/// Error de API con mensaje en español listo para mostrar al usuario.
class ApiException implements Exception {
  final ApiErrorKind kind;
  final int? status;
  final String message;

  const ApiException(this.kind, this.message, {this.status});

  bool get isNetwork => kind == ApiErrorKind.network || kind == ApiErrorKind.timeout;

  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) return _fromDio(error);
    return const ApiException(ApiErrorKind.unknown, 'Algo salió mal. Intenta de nuevo.');
  }

  static ApiException _fromDio(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiException(ApiErrorKind.timeout, 'El servidor tardó demasiado en responder.');
      case DioExceptionType.connectionError:
        return const ApiException(ApiErrorKind.network, 'No pudimos conectar. Revisa tu conexión.');
      case DioExceptionType.cancel:
        return const ApiException(ApiErrorKind.unknown, 'Operación cancelada.');
      default:
        break;
    }
    final status = e.response?.statusCode;
    final serverMsg = _serverMessage(e.response?.data);
    switch (status) {
      case 400:
      case 422:
        return ApiException(ApiErrorKind.validation, serverMsg ?? 'Revisa los datos ingresados.', status: status);
      case 401:
        return ApiException(ApiErrorKind.unauthorized, serverMsg ?? 'Tu sesión expiró. Inicia sesión otra vez.', status: status);
      case 403:
        return ApiException(ApiErrorKind.forbidden, serverMsg ?? 'No tienes permiso para esta acción.', status: status);
      case 404:
        return ApiException(ApiErrorKind.notFound, serverMsg ?? 'No encontramos lo que buscas.', status: status);
      case 409:
        return ApiException(ApiErrorKind.conflict, serverMsg ?? 'El registro ya existe.', status: status);
      case 429:
        return const ApiException(ApiErrorKind.rateLimited, 'Demasiados intentos. Espera unos minutos.', status: 429);
    }
    if (status != null && status >= 500) {
      return ApiException(ApiErrorKind.server, 'Algo salió mal de nuestro lado. Intenta de nuevo en un momento.', status: status);
    }
    if (e.error != null && e.response == null) {
      return const ApiException(ApiErrorKind.network, 'No pudimos conectar. Revisa tu conexión.');
    }
    return ApiException(ApiErrorKind.unknown, serverMsg ?? 'Algo salió mal. Intenta de nuevo.', status: status);
  }

  static String? _serverMessage(dynamic data) {
    if (data is Map && data['message'] is String && (data['message'] as String).isNotEmpty) {
      return data['message'] as String;
    }
    return null;
  }

  @override
  String toString() => message;
}
