import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persistencia segura de la sesión (Keychain en iOS, Keystore en Android).
///
/// Nunca se escriben tokens en logs. Además del token se guarda una copia del
/// usuario y sus permisos para poder abrir la app sin conexión.
class SessionStore {
  SessionStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _kToken = 'auth.token';
  static const _kRefresh = 'auth.refresh_token';
  static const _kUser = 'auth.user';
  static const _kPermissions = 'auth.permissions';
  static const _kDeviceId = 'app.device_id';
  static const _kLastChurch = 'app.last_church_id';
  static const _kLastEmail = 'app.last_email';
  static const _kSelectedChurch = 'app.selected_church_id';

  // Copia en memoria para no leer el almacenamiento en cada petición.
  String? _token;
  String? _refreshToken;

  String? get token => _token;
  String? get refreshToken => _refreshToken;

  Future<void> load() async {
    _token = await _storage.read(key: _kToken);
    _refreshToken = await _storage.read(key: _kRefresh);
  }

  Future<void> saveTokens({required String token, String? refreshToken}) async {
    _token = token;
    await _storage.write(key: _kToken, value: token);
    if (refreshToken != null) {
      _refreshToken = refreshToken;
      await _storage.write(key: _kRefresh, value: refreshToken);
    }
  }

  Future<void> saveProfile(Map<String, dynamic> user, Map<String, dynamic> permissions) async {
    await _storage.write(key: _kUser, value: jsonEncode(user));
    await _storage.write(key: _kPermissions, value: jsonEncode(permissions));
  }

  Future<(Map<String, dynamic>, Map<String, dynamic>)?> readProfile() async {
    final u = await _storage.read(key: _kUser);
    final p = await _storage.read(key: _kPermissions);
    if (u == null || p == null) return null;
    try {
      return (jsonDecode(u) as Map<String, dynamic>, jsonDecode(p) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Borra todo lo relativo a la sesión (conserva preferencias no sensibles).
  Future<void> clear() async {
    _token = null;
    _refreshToken = null;
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kUser);
    await _storage.delete(key: _kPermissions);
    await _storage.delete(key: _kSelectedChurch);
  }

  /// Identificador estable del dispositivo para los refresh tokens (T1.3).
  Future<String> deviceId() async {
    final existing = await _storage.read(key: _kDeviceId);
    if (existing != null) return existing;
    final rnd = Random.secure();
    final id = List.generate(16, (_) => rnd.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
    await _storage.write(key: _kDeviceId, value: id);
    return id;
  }

  Future<int?> lastChurchId() async => int.tryParse(await _storage.read(key: _kLastChurch) ?? '');
  Future<void> setLastChurchId(int id) => _storage.write(key: _kLastChurch, value: '$id');

  Future<String?> lastEmail() => _storage.read(key: _kLastEmail);
  Future<void> setLastEmail(String email) => _storage.write(key: _kLastEmail, value: email);

  Future<int?> selectedChurchId() async => int.tryParse(await _storage.read(key: _kSelectedChurch) ?? '');
  Future<void> setSelectedChurchId(int? id) async {
    if (id == null) {
      await _storage.delete(key: _kSelectedChurch);
    } else {
      await _storage.write(key: _kSelectedChurch, value: '$id');
    }
  }
}
