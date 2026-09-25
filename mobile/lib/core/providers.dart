import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'auth/session_store.dart';

/// Versión de la app (package_info); se sobrescribe en `main()`.
final appVersionProvider = Provider<String>((ref) => '1.0.0');

final sessionStoreProvider = Provider<SessionStore>((ref) => SessionStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.watch(sessionStoreProvider), appVersion: ref.watch(appVersionProvider));
});

/// `true` cuando el teléfono tiene alguna red disponible.
final onlineProvider = StreamProvider<bool>((ref) async* {
  final connectivity = Connectivity();
  bool online(List<ConnectivityResult> r) => r.any((c) => c != ConnectivityResult.none);
  yield online(await connectivity.checkConnectivity());
  yield* connectivity.onConnectivityChanged.map(online);
});

/// Lectura síncrona cómoda: asume en línea mientras no se sepa lo contrario.
final isOnlineProvider = Provider<bool>((ref) => ref.watch(onlineProvider).value ?? true);
