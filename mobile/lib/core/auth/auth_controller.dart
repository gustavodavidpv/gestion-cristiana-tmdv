import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_exception.dart';
import '../providers.dart';
import 'models.dart';

enum AuthStatus { loading, signedOut, signedIn, updateRequired }

class AuthState {
  final AuthStatus status;
  final AppUser? user;
  final Permissions permissions;

  /// El usuario salió por sesión vencida (se muestra el aviso en Login).
  final bool expired;

  /// Enlace a la tienda cuando la versión instalada es menor a la mínima.
  final String? storeUrl;

  const AuthState._(this.status, {this.user, this.permissions = Permissions.empty, this.expired = false, this.storeUrl});

  const AuthState.loading() : this._(AuthStatus.loading);
  const AuthState.signedOut({bool expired = false}) : this._(AuthStatus.signedOut, expired: expired);
  const AuthState.signedIn(AppUser user, Permissions permissions)
      : this._(AuthStatus.signedIn, user: user, permissions: permissions);
  const AuthState.updateRequired(String? storeUrl) : this._(AuthStatus.updateRequired, storeUrl: storeUrl);

  bool get isSignedIn => status == AuthStatus.signedIn;
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Atajos de lectura.
final currentUserProvider = Provider<AppUser?>((ref) => ref.watch(authProvider).user);
final permissionsProvider = Provider<Permissions>((ref) => ref.watch(authProvider).permissions);

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    ref.read(apiClientProvider).onSessionExpired = expire;
    Future.microtask(_bootstrap);
    return const AuthState.loading();
  }

  Future<void> _bootstrap() async {
    final store = ref.read(sessionStoreProvider);
    await store.load();

    final storeUrl = await _checkMinVersion();
    if (storeUrl != null) {
      state = AuthState.updateRequired(storeUrl.isEmpty ? null : storeUrl);
      return;
    }

    if (store.token == null) {
      state = const AuthState.signedOut();
      return;
    }
    try {
      await _loadProfile();
    } on ApiException catch (e) {
      if (e.kind == ApiErrorKind.unauthorized) {
        await store.clear();
        state = const AuthState.signedOut(expired: true);
        return;
      }
      // Sin red o servidor caído: abrir con el perfil guardado.
      final cached = await store.readProfile();
      if (cached != null) {
        state = AuthState.signedIn(AppUser.fromJson(cached.$1), Permissions.fromJson(cached.$2));
      } else {
        state = const AuthState.signedOut();
      }
    }
  }

  /// Consulta `/app/config` (T1.4). Devuelve la URL de tienda si hay que
  /// actualizar ('' si no hay URL), o null si la versión es válida o el
  /// endpoint aún no existe.
  Future<String?> _checkMinVersion() async {
    try {
      final cfg = await ref.read(apiClientProvider).get('/app/config', skipAuth: true);
      final platform = Platform.isIOS ? 'ios' : 'android';
      final min = (cfg['min_version'] is Map) ? cfg['min_version'][platform] as String? : null;
      if (min == null) return null;
      if (_compareVersions(ref.read(appVersionProvider), min) < 0) {
        final urls = cfg['store_urls'];
        return (urls is Map ? urls[platform] as String? : null) ?? '';
      }
    } catch (_) {
      // Endpoint no disponible todavía: no bloquear.
    }
    return null;
  }

  static int _compareVersions(String a, String b) {
    List<int> parse(String v) => v.split('+').first.split('.').map((p) => int.tryParse(p) ?? 0).toList();
    final pa = parse(a), pb = parse(b);
    for (var i = 0; i < 3; i++) {
      final x = i < pa.length ? pa[i] : 0;
      final y = i < pb.length ? pb[i] : 0;
      if (x != y) return x.compareTo(y);
    }
    return 0;
  }

  Future<void> _loadProfile() async {
    final api = ref.read(apiClientProvider);
    final me = await api.get('/auth/me');
    final perms = await api.get('/auth/my-permissions');
    final userJson = (me['user'] as Map).cast<String, dynamic>();
    final permsJson = (perms['permissions'] as Map).cast<String, dynamic>();
    await ref.read(sessionStoreProvider).saveProfile(userJson, permsJson);
    state = AuthState.signedIn(AppUser.fromJson(userJson), Permissions.fromJson(permsJson));
  }

  Future<void> login(String email, String password) async {
    final api = ref.read(apiClientProvider);
    final store = ref.read(sessionStoreProvider);
    final res = await api.post('/auth/login', skipAuth: true, data: {
      'email': email.trim(),
      'password': password,
      // Campos para T1.3; el backend actual los ignora (retrocompatible).
      'device_id': await store.deviceId(),
      'platform': Platform.isIOS ? 'ios' : 'android',
    });
    await store.saveTokens(token: res['token'] as String, refreshToken: res['refresh_token'] as String?);
    final userJson = (res['user'] as Map).cast<String, dynamic>();
    final permsRes = await api.get('/auth/my-permissions');
    final permsJson = (permsRes['permissions'] as Map).cast<String, dynamic>();
    await store.saveProfile(userJson, permsJson);
    await store.setLastEmail(email.trim());
    final user = AppUser.fromJson(userJson);
    if (user.churchId != null) await store.setLastChurchId(user.churchId!);
    state = AuthState.signedIn(user, Permissions.fromJson(permsJson));
  }

  Future<void> logout() async {
    final store = ref.read(sessionStoreProvider);
    final refresh = store.refreshToken;
    if (refresh != null) {
      try {
        await ref.read(apiClientProvider).post('/auth/logout', data: {'refresh_token': refresh});
      } catch (_) {
        // T1.3 pendiente o sin red: se limpia la sesión local igualmente.
      }
    }
    await store.clear();
    state = const AuthState.signedOut();
  }

  /// Llamado por el cliente HTTP ante un 401 irrecuperable.
  Future<void> expire() async {
    if (state.status != AuthStatus.signedIn) return;
    await ref.read(sessionStoreProvider).clear();
    state = const AuthState.signedOut(expired: true);
  }

  /// Recarga usuario y permisos (p. ej. al volver a la app).
  Future<void> refreshProfile() async {
    try {
      await _loadProfile();
    } catch (_) {}
  }
}
