import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth/auth_controller.dart';
import 'providers.dart';

/// Iglesia elegida por un SuperAdmin (null = todas). Para el resto de roles
/// el backend filtra solo por su iglesia (`applyTenantFilter`), así que este
/// valor se ignora.
class SelectedChurch {
  final int? id;
  final String? name;
  const SelectedChurch(this.id, this.name);
}

final selectedChurchProvider = NotifierProvider<SelectedChurchController, SelectedChurch>(SelectedChurchController.new);

class SelectedChurchController extends Notifier<SelectedChurch> {
  @override
  SelectedChurch build() {
    ref.listen(authProvider.select((s) => s.user?.id), (_, _) => state = const SelectedChurch(null, null));
    Future.microtask(() async {
      final id = await ref.read(sessionStoreProvider).selectedChurchId();
      if (id != null && state.id == null) state = SelectedChurch(id, null);
    });
    return const SelectedChurch(null, null);
  }

  Future<void> select(int? id, String? name) async {
    state = SelectedChurch(id, name);
    await ref.read(sessionStoreProvider).setSelectedChurchId(id);
  }
}

/// Parámetros `church_id` a inyectar en consultas y altas.
/// - SuperAdmin con iglesia elegida → esa iglesia.
/// - Resto → vacío (el backend usa la iglesia del usuario).
final churchQueryProvider = Provider<Map<String, dynamic>>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null || !user.isSuperAdmin) return const {};
  final id = ref.watch(selectedChurchProvider).id;
  return id == null ? const {} : {'church_id': id};
});

/// Id de iglesia efectivo (para endpoints que lo exigen, como asistencia semanal).
final effectiveChurchIdProvider = Provider<int?>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  if (user.isSuperAdmin) return ref.watch(selectedChurchProvider).id ?? user.churchId;
  return user.churchId;
});

/// Nombre de la iglesia a mostrar en los kickers.
final churchLabelProvider = Provider<String>((ref) {
  final user = ref.watch(currentUserProvider);
  if (user == null) return '';
  if (user.isSuperAdmin) {
    final sel = ref.watch(selectedChurchProvider);
    if (sel.id != null) return sel.name ?? user.churchName ?? 'Iglesia';
    return 'Todas las iglesias';
  }
  return user.churchName ?? 'Mi iglesia';
});
