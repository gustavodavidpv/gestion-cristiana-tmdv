import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import 'events_screen.dart';

final eventProvider = FutureProvider.autoDispose.family<ChurchEvent, int>((ref, id) {
  ref.watch(eventsVersionProvider);
  return ref.read(repoProvider).event(id);
});

/// "Domingo 27 de septiembre de 2026 · 7:00 p. m. – 9:00 p. m."
String eventWhen(ChurchEvent e) {
  final end = e.end;
  final range = end != null && end.isAfter(e.start) && end.day == e.start.day
      ? '${Fmt.time(e.start)} – ${Fmt.time(end)}'
      : Fmt.time(e.start);
  return '${Fmt.longDate(e.start)} · $range';
}

/// Evento — variante "Ficha".
class EventDetailScreen extends ConsumerWidget {
  const EventDetailScreen({super.key, required this.eventId, this.backLabel = 'Eventos'});
  final int eventId;
  final String backLabel;

  Future<void> _menu(BuildContext context, WidgetRef ref, ChurchEvent e) async {
    final perms = ref.read(permissionsProvider);
    final action = await showOptionsSheet<String>(context, title: e.title, options: [
      if (perms.can('events', 'edit')) const SheetOption('Editar evento', 'edit', icon: PhosphorIconsDuotone.pencilSimple),
      if (perms.can('events', 'delete')) const SheetOption('Eliminar evento', 'delete', icon: PhosphorIconsDuotone.trash, danger: true),
    ]);
    if (!context.mounted) return;
    if (action == 'edit') {
      context.push(Routes.eventoEditar(e.id), extra: e);
    } else if (action == 'delete') {
      final ok = await showConfirmDialog(
        context,
        title: '¿Eliminar "${e.title}"?',
        body: 'También se borra la asistencia registrada y sus decisiones de fe. Esta acción no se puede deshacer.',
        action: 'Eliminar',
      );
      if (!ok) return;
      try {
        await ref.read(repoProvider).deleteEvent(e.id);
        ref.read(eventsVersionProvider.notifier).bump();
        showAppSnack('Evento eliminado.');
        if (context.mounted) context.pop();
      } catch (err) {
        showAppSnack(ApiException.from(err).message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);
    final async = ref.watch(eventProvider(eventId));
    final canMenu = perms.can('events', 'edit') || perms.can('events', 'delete');

    return Scaffold(
      bottomNavigationBar: perms.can('events', 'attendance') && async.hasValue
          ? FooterBar(
              child: PrimaryButton(
                label: 'Registrar asistencia',
                icon: PhosphorIconsDuotone.usersThree,
                onPressed: () => context.push(Routes.registrar(eventId)),
              ),
            )
          : null,
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          BackHeader(
            label: backLabel,
            trailing: canMenu && async.hasValue ? MoreButton(onPressed: () => _menu(context, ref, async.value!)) : null,
          ),
          Expanded(
            child: async.when(
              skipLoadingOnRefresh: true,
              loading: () => const SkeletonList(rows: 5, avatar: false),
              error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(eventProvider(eventId))),
              data: (e) => _content(ref, e),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _content(WidgetRef ref, ChurchEvent e) {
    final style = EventTypeStyle.of(e.eventType);
    final roles = <(String, MemberRef?)>[
      ('Predica', e.preacher),
      ('Dirige adoración', e.worshipLeader),
      ('Canta', e.singer),
    ];
    return RefreshIndicator(
      color: AppColors.cyan700,
      onRefresh: () => ref.refresh(eventProvider(eventId).future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
        children: [
          if (e.eventType != null) Align(alignment: Alignment.centerLeft, child: AppTag(e.eventType!, bg: style.tagBg, fg: style.tagFg)),
          const SizedBox(height: 12),
          Text(e.title, style: AppText.base(size: 36, weight: FontWeight.w600, height: 1.02, letterSpacing: -0.72)),
          const SizedBox(height: 16),
          _iconLine(PhosphorIconsDuotone.calendarBlank, eventWhen(e)),
          if (e.location != null) ...[const SizedBox(height: 8), _iconLine(PhosphorIconsDuotone.mapPin, e.location!)],
          if (e.description != null) ...[
            const SizedBox(height: 16),
            Text(e.description!, style: AppText.base(size: 16, height: 1.5, color: AppColors.neutral800)),
          ],
          if (e.isCulto) ...[
            const SizedBox(height: 28),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < roles.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    InitialsAvatar(roles[i].$2?.initials ?? '—', size: 48),
                    const SizedBox(height: 6),
                    Text(roles[i].$1, style: AppText.base(size: 13, color: AppColors.neutral700)),
                    Text(roles[i].$2?.fullName ?? 'Sin asignar',
                        style: AppText.base(size: 16, weight: FontWeight.w600, height: 1.25, color: roles[i].$2 == null ? AppColors.neutral600 : AppColors.text)),
                  ]),
                ),
              ],
            ]),
          ],
          const SizedBox(height: 34),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _bigStat('${e.attendeesCount}', 'Asistentes registrados')),
            const SizedBox(width: 20),
            Expanded(child: _bigStat('${e.faithDecisions}', 'Decisiones de fe')),
          ]),
        ],
      ),
    );
  }

  Widget _iconLine(IconData icon, String text) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Ic(icon, size: 22, color: AppColors.cyan),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: AppText.base(size: 16, height: 1.35))),
      ]);

  Widget _bigStat(String value, String label) => Semantics(
        label: '$label: $value',
        excludeSemantics: true,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          CmykNumber(value, size: 60),
          const SizedBox(height: 10),
          Text(label, style: AppText.base(size: 15, color: AppColors.neutral800)),
        ]),
      );
}
