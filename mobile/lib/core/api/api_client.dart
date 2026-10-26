import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';

import '../auth/session_store.dart';
import '../env.dart';
import 'api_exception.dart';

/// Cliente HTTP único de la app.
///
/// - `Authorization: Bearer <token>` en cada petición.
/// - Cabeceras `X-App-Version` y `X-Platform` (T1.4 las registrará en el servidor).
/// - Ante un 401: si hay refresh token (T1.3) intenta UN refresh compartido y
///   reintenta; si no, notifica sesión expirada con [onSessionExpired].
class ApiClient {
  ApiClient(this._store, {required this.appVersion, HttpClientAdapter? adapter}) {
    _dio = Dio(BaseOptions(
      baseUrl: Env.apiUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 60),
      headers: {
        'X-App-Version': appVersion,
        'X-Platform': Platform.isIOS ? 'ios' : 'android',
      },
    ));
    // Las pruebas inyectan un backend simulado aquí.
    if (adapter != null) _dio.httpClientAdapter = adapter;
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = _store.token;
        if (token != null && options.extra['skipAuth'] != true) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: _onError,
    ));
  }

  final SessionStore _store;
  final String appVersion;
  late final Dio _dio;

  /// Lo asigna el controlador de sesión para volver al Login.
  void Function()? onSessionExpired;

  Future<bool>? _refreshing;

  Future<void> _onError(DioException e, ErrorInterceptorHandler handler) async {
    final req = e.requestOptions;
    final is401 = e.response?.statusCode == 401;
    final isAuthCall = req.path.startsWith('/auth/login') || req.path.startsWith('/auth/refresh');
    if (!is401 || isAuthCall || req.extra['skipAuth'] == true || req.extra['retried'] == true) {
      return handler.next(e);
    }
    final refreshed = await _tryRefresh();
    if (refreshed) {
      try {
        req.extra['retried'] = true;
        req.headers['Authorization'] = 'Bearer ${_store.token}';
        final response = await _dio.fetch<dynamic>(req);
        return handler.resolve(response);
      } on DioException catch (retryError) {
        return handler.next(retryError);
      }
    }
    onSessionExpired?.call();
    handler.next(e);
  }

  /// Un único refresh en vuelo; las peticiones concurrentes esperan el mismo.
  Future<bool> _tryRefresh() {
    final refresh = _store.refreshToken;
    if (refresh == null) return Future.value(false);
    return _refreshing ??= () async {
      try {
        final deviceId = await _store.deviceId();
        final res = await _dio.post<Map<String, dynamic>>(
          '/auth/refresh',
          data: {'refresh_token': refresh, 'device_id': deviceId},
          options: Options(extra: {'skipAuth': true}),
        );
        final token = res.data?['token'] as String?;
        if (token == null) return false;
        await _store.saveTokens(token: token, refreshToken: res.data?['refresh_token'] as String?);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<T> _wrap<T>(Future<Response<dynamic>> Function() call, T Function(dynamic data) parse) async {
    try {
      final res = await call();
      return parse(res.data);
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Map<String, dynamic> _asMap(dynamic d) => d is Map<String, dynamic> ? d : <String, dynamic>{};

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query, bool skipAuth = false}) =>
      _wrap(() => _dio.get<dynamic>(path, queryParameters: _clean(query), options: Options(extra: {'skipAuth': skipAuth})), _asMap);

  Future<Map<String, dynamic>> post(String path, {Object? data, bool skipAuth = false}) =>
      _wrap(() => _dio.post<dynamic>(path, data: data, options: Options(extra: {'skipAuth': skipAuth})), _asMap);

  Future<Map<String, dynamic>> put(String path, {Object? data}) => _wrap(() => _dio.put<dynamic>(path, data: data), _asMap);

  Future<Map<String, dynamic>> delete(String path, {Object? data}) => _wrap(() => _dio.delete<dynamic>(path, data: data), _asMap);

  /// Subida multipart (campo `files`) con progreso 0..1.
  Future<Map<String, dynamic>> upload(
    String path, {
    required List<({String path, String name})> files,
    String field = 'files',
    void Function(double progress)? onProgress,
  }) async {
    final form = FormData();
    for (final f in files) {
      form.files.add(MapEntry(field, await MultipartFile.fromFile(f.path, filename: f.name)));
    }
    return _wrap(
      () => _dio.post<dynamic>(
        path,
        data: form,
        onSendProgress: (sent, total) {
          if (total > 0) onProgress?.call(sent / total);
        },
      ),
      _asMap,
    );
  }

  /// Descarga autenticada de un binario (PDF, archivo de acta) a [savePath].
  Future<void> download(String path, String savePath, {Map<String, dynamic>? query}) =>
      _wrap(() => _dio.download(path, savePath, queryParameters: _clean(query)), (_) {});

  Map<String, dynamic>? _clean(Map<String, dynamic>? q) {
    if (q == null) return null;
    final out = <String, dynamic>{};
    q.forEach((k, v) {
      if (v == null) return;
      if (v is String && v.isEmpty) return;
      out[k] = v is bool ? v.toString() : v;
    });
    return out;
  }
}
