import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import 'weekly_form_screen.dart';

final weeklyProvider = FutureProvider.family<List<WeeklyRecord>, int>((ref, year) {
  final churchId = ref.watch(effectiveChurchIdProvider);
  return ref.read(repoProvider).weekly(year, churchId: churchId);
});

/// Id del último registro guardado (se pinta en cian-700).
class LastSavedWeek extends Notifier<int?> {
  @override
  int? build() => null;
  void set(int? id) => state = id;
}

final lastSavedWeekProvider = NotifierProvider<LastSavedWeek, int?>(LastSavedWeek.new);

class WeeklyScreen extends ConsumerStatefulWidget {
  const WeeklyScreen({super.key});
  @override
  ConsumerState<WeeklyScreen> createState() => _WeeklyScreenState();
}

class _WeeklyScreenState extends ConsumerState<WeeklyScreen> {
  int _year = PanamaTime.now().year;

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(permissionsProvider);
    final async = ref.watch(weeklyProvider(_year));
    final currentYear = PanamaTime.now().year;
    final lastSaved = ref.watch(lastSavedWeekProvider);
    final canCreate = perms.can('weekly_attendance', 'create');
    final canEdit = perms.can('weekly_attendance', 'edit');

    return Scaffold(
      floatingActionButton: canCreate && (async.value?.isNotEmpty ?? false)
          ? AppFab(label: 'Registrar semana', onPressed: () => context.push(Routes.semanalNueva))
          : null,
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Más'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Kicker(ref.watch(churchLabelProvider)),
              const SizedBox(height: 6),
              Text('Asistencia semanal', style: AppText.title(30)),
              Transform.translate(
                offset: const Offset(-12, 0),
                child: Stepper3(
                  label: '$_year',
                  prevLabel: 'Año anterior',
                  nextLabel: 'Año siguiente',
                  onPrev: _year > 2020 ? () => setState(() => _year--) : null,
                  onNext: _year < currentYear ? () => setState(() => _year++) : null,
                ),
              ),
            ]),
          ),
          Expanded(
            child: async.when(
              skipLoadingOnRefresh: true,
              loading: () => const SkeletonList(avatar: false),
              error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(weeklyProvider(_year))),
              data: (records) {
                if (records.isEmpty) {
                  return Stack(children: [
                    StateView(
                      icon: PhosphorIconsDuotone.calendarPlus,
                      title: 'Aún no registras semanas de este año.',
                      body: canCreate ? 'Toca + para empezar.' : null,
                    ),
                    if (canCreate)
                      Positioned(
                        right: 16,
                        bottom: 16,
                        child: AppFab(label: 'Registrar semana', onPressed: () => context.push(Routes.semanalNueva)),
                      ),
                  ]);
                }
                final counts = records.map((r) => r.count).toList();
                final avg = (counts.reduce((a, b) => a + b) / counts.length).round();
                final max = counts.reduce((a, b) => a > b ? a : b);
                final min = counts.reduce((a, b) => a < b ? a : b);
                return RefreshIndicator(
                  color: AppColors.cyan700,
                  onRefresh: () => ref.refresh(weeklyProvider(_year).future),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(20, 6, 20, 110),
                    children: [
                      Row(children: [
                        for (final (k, v) in [('Promedio', '$avg'), ('Semanas registradas', '${records.length}'), ('Máx / Mín', '$max / $min')])
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(v, style: AppText.base(size: 30, weight: FontWeight.w600, height: 1)),
                              const SizedBox(height: 6),
                              Text(k, style: AppText.base(size: 14, color: AppColors.neutral800)),
                            ]),
                          ),
                      ]),
                      const SizedBox(height: 10),
                      for (final r in records)
                        InkWell(
                          onTap: canEdit ? () => context.push(Routes.semanalNueva, extra: WeeklyFormArgs(editing: r)) : null,
                          highlightColor: AppColors.neutral200,
                          child: Container(
                            constraints: const BoxConstraints(minHeight: 72),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
                            child: Row(children: [
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(Fmt.shortDowDate(r.weekDate), style: AppText.rowName),
                                  Text([?r.notes, if (r.createdBy != null) 'Registró: ${r.createdBy}'].join(' · '), style: AppText.rowSub),
                                ]),
                              ),
                              Text('${r.count}',
                                  style: AppText.base(size: 30, weight: FontWeight.w600, color: r.id == lastSaved ? AppColors.cyan700 : AppColors.text)),
                            ]),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}
