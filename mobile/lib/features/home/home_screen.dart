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
import '../events/event_row.dart';

class HomeData {
  final YearSummary summary;
  final int? membersTotal;
  final ChurchInfo? church;
  final List<(ChurchInfo, YearSummary)>? perChurch;
  final List<ChurchEvent> upcoming;
  final ChurchEvent? today;
  const HomeData({required this.summary, this.membersTotal, this.church, this.perChurch, this.upcoming = const [], this.today});
}

class HomeYear extends Notifier<int> {
  @override
  int build() => PanamaTime.now().year;
  void set(int y) => state = y;
}

final homeYearProvider = NotifierProvider<HomeYear, int>(HomeYear.new);

final homeDataProvider = FutureProvider.family<HomeData, int>((ref, year) async {
  final repo = ref.read(repoProvider);
  final user = ref.watch(currentUserProvider);
  if (user == null) return const HomeData(summary: YearSummary());
  final perms = ref.watch(permissionsProvider);
  final scope = ref.watch(churchQueryProvider);
  final selected = ref.watch(selectedChurchProvider).id;

  YearSummary summary = const YearSummary();
  ChurchInfo? church;
  List<(ChurchInfo, YearSummary)>? perChurch;

  if (user.isSuperAdmin) {
    final stats = await repo.dashboardStats(year);
    if (selected != null) {
      final row = stats.where((r) => r.$1.id == selected).firstOrNull;
      summary = row?.$2 ?? const YearSummary();
      church = row?.$1;
    } else {
      perChurch = stats;
      final withAvg = stats.where((s) => s.$2.avgWeeklyAttendance > 0).toList();
      summary = YearSummary(
        eventsCount: stats.fold(0, (a, s) => a + s.$2.eventsCount),
        minutesCount: stats.fold(0, (a, s) => a + s.$2.minutesCount),
        faithDecisions: stats.fold(0, (a, s) => a + s.$2.faithDecisions),
        avgWeeklyAttendance: withAvg.isEmpty ? 0 : (withAvg.fold(0, (a, s) => a + s.$2.avgWeeklyAttendance) / withAvg.length).round(),
      );
    }
  } else {
    summary = await repo.mySummary(year);
    if (perms.can('churches') && user.churchId != null) {
      try {
        church = await repo.church(user.churchId!);
      } catch (_) {}
    }
  }

  int? membersTotal;
  if (perms.can('members')) {
    try {
      membersTotal = (await repo.members(limit: 1, scope: scope)).total;
    } catch (_) {}
  }

  var upcoming = <ChurchEvent>[];
  ChurchEvent? today;
  if (perms.can('events')) {
    try {
      final start = PanamaTime.today();
      final events = await repo.eventsBetween(start, start.add(const Duration(days: 60)), scope: scope);
      today = events.where((e) => PanamaTime.sameDay(e.start, start)).firstOrNull;
      upcoming = events.where((e) => e.id != today?.id).take(3).toList();
    } catch (_) {}
  }

  return HomeData(summary: summary, membersTotal: membersTotal, church: church, perChurch: perChurch, upcoming: upcoming, today: today);
});

/// Inicio — variante "Rejilla".
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const SizedBox.shrink(); // cerrando sesión
    final year = ref.watch(homeYearProvider);
    final data = ref.watch(homeDataProvider(year));
    final currentYear = PanamaTime.now().year;
    const minYear = 2020;

    final header = Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Kicker(ref.watch(churchLabelProvider)),
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 6),
            child: Text('${Fmt.greeting()}, ${user.firstName}', style: AppText.title(32)),
          ),
          Transform.translate(
            offset: const Offset(-12, 0),
            child: Stepper3(
              label: '$year',
              prevLabel: 'Año anterior',
              nextLabel: 'Año siguiente',
              onPrev: year > minYear ? () => ref.read(homeYearProvider.notifier).set(year - 1) : null,
              onNext: year < currentYear ? () => ref.read(homeYearProvider.notifier).set(year + 1) : null,
            ),
          ),
        ],
      ),
    );

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: AppColors.cyan700,
          onRefresh: () => ref.refresh(homeDataProvider(year).future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
            children: [
              header,
              ...data.when(
                skipLoadingOnRefresh: true,
                data: (d) => _content(context, ref, d),
                loading: () => [const SizedBox(height: 22), const _MetricsSkeleton()],
                error: (e, _) => [
                  SizedBox(height: 420, child: StateView.fromError(e, onRetry: () => ref.invalidate(homeDataProvider(year)))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _content(BuildContext context, WidgetRef ref, HomeData d) {
    final perms = ref.watch(permissionsProvider);
    final metrics = <(IconData, String, String)>[
      if (d.membersTotal != null) (PhosphorIconsDuotone.users, Fmt.number(d.membersTotal!), 'Miembros'),
      (PhosphorIconsDuotone.calendarBlank, Fmt.number(d.summary.eventsCount), 'Eventos del año'),
      if (perms.can('minutes'))
        (PhosphorIconsDuotone.fileText, Fmt.number(d.summary.minutesCount), 'Actas')
      else
        (PhosphorIconsDuotone.chartBar, Fmt.number(d.summary.avgWeeklyAttendance), 'Asistencia promedio'),
      (PhosphorIconsDuotone.cross, Fmt.number(d.summary.faithDecisions), 'Decisiones de fe'),
    ];

    final quick = <(IconData, String, VoidCallback)>[
      if (perms.can('events', 'attendance'))
        (
          PhosphorIconsDuotone.usersThree,
          'Registrar asistencia',
          () => d.today != null ? context.push(Routes.registrar(d.today!.id)) : context.go(Routes.eventos),
        ),
      if (perms.can('bible_club', 'create')) (PhosphorIconsDuotone.star, 'Cargar puntos', () => context.go(Routes.club)),
      if (perms.can('weekly_attendance', 'create')) (PhosphorIconsDuotone.calendarPlus, 'Registrar semana', () => context.push(Routes.semanalNueva)),
    ];

    final c = d.church;
    return [
      const SizedBox(height: 22),
      _MetricsGrid(metrics: metrics),
      if (d.today != null) ...[
        const SizedBox(height: 40),
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Kicker('Hoy · ${Fmt.time(d.today!.start)}', color: AppColors.cyan700),
              const SizedBox(height: 4),
              Text(d.today!.title, style: AppText.base(size: 22, weight: FontWeight.w600, height: 1.2)),
            ]),
          ),
          const SizedBox(width: 14),
          if (perms.can('events', 'attendance'))
            PrimaryButton(label: 'Registrar', expand: false, height: 48, fontSize: 16, onPressed: () => context.push(Routes.registrar(d.today!.id)))
          else
            SecondaryButton(label: 'Ver', onPressed: () => context.push(Routes.evento(d.today!.id), extra: 'Inicio')),
        ]),
      ],
      if (c != null) ...[
        Padding(padding: const EdgeInsets.only(top: 40, bottom: 10), child: Text('Resumen de la iglesia', style: AppText.h2)),
        KeyValueRow('Membresía', Fmt.number(c.membershipCount), vertical: 9),
        KeyValueRow('Asistencia semanal promedio', Fmt.number(c.avgWeeklyAttendance), vertical: 9),
        KeyValueRow('Predicadores ordenados', '${c.ordainedPreachers}', vertical: 9),
        KeyValueRow('Predicadores no ordenados', '${c.unordainedPreachers}', vertical: 9),
        KeyValueRow('Diáconos ordenados', '${c.ordainedDeacons}', vertical: 9),
        KeyValueRow('Diáconos no ordenados', '${c.unordainedDeacons}', vertical: 9),
        if (c.responsible != null) KeyValueRow('Responsable', c.responsible!, vertical: 9),
      ],
      if (d.perChurch != null && d.perChurch!.isNotEmpty) ...[
        Padding(padding: const EdgeInsets.only(top: 40, bottom: 4), child: Text('Por iglesia', style: AppText.h2)),
        for (final (info, s) in d.perChurch!)
          InkWell(
            onTap: () => ref.read(selectedChurchProvider.notifier).select(info.id, info.name),
            highlightColor: AppColors.neutral200,
            child: Container(
              constraints: const BoxConstraints(minHeight: 72),
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(info.name, style: AppText.rowName),
                    Text('${Fmt.plural(info.membershipCount, 'miembro', 'miembros')} · ${Fmt.plural(s.eventsCount, 'evento', 'eventos')} · ${s.faithDecisions} dec. de fe',
                        style: AppText.rowSub),
                  ]),
                ),
                const Ic(PhosphorIconsDuotone.caretRight, size: 18, color: AppColors.neutral600),
              ]),
            ),
          ),
      ],
      if (perms.can('events')) ...[
        Padding(padding: const EdgeInsets.only(top: 36, bottom: 4), child: Text('Próximos eventos', style: AppText.h2)),
        if (d.upcoming.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text('No hay eventos en los próximos 60 días.', style: AppText.base(size: 16, color: AppColors.neutral700)),
          ),
        for (final e in d.upcoming) EventRow(event: e, onTap: () => context.push(Routes.evento(e.id), extra: 'Inicio')),
      ],
      if (quick.isNotEmpty) ...[
        const SizedBox(height: 32),
        const Kicker('Accesos rápidos'),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [for (final (icon, label, go) in quick) SecondaryButton(label: label, icon: icon, onPressed: go)],
        ),
      ],
    ];
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.metrics});
  final List<(IconData, String, String)> metrics;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < metrics.length; i += 2) {
      rows.add(Padding(
        padding: EdgeInsets.only(top: i == 0 ? 0 : 30),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: _Metric(metrics[i])),
          const SizedBox(width: 20),
          Expanded(child: i + 1 < metrics.length ? _Metric(metrics[i + 1]) : const SizedBox()),
        ]),
      ));
    }
    return Column(children: rows);
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.m);
  final (IconData, String, String) m;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '${m.$3}: ${m.$2}',
      excludeSemantics: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Ic(m.$1, size: 26, color: AppColors.cyan),
        const SizedBox(height: 12),
        FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: CmykNumber(m.$2, size: 56)),
        const SizedBox(height: 12),
        Text(m.$3, style: AppText.base(size: 15, color: AppColors.neutral800)),
      ]),
    );
  }
}

class _MetricsSkeleton extends StatelessWidget {
  const _MetricsSkeleton();
  @override
  Widget build(BuildContext context) {
    Widget cell() => const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SkeletonBlock(width: 26, height: 26),
          SizedBox(height: 12),
          SkeletonBlock(width: 90, height: 52),
          SizedBox(height: 12),
          SkeletonBlock(width: 110, height: 14),
        ]);
    return Column(children: [
      Row(children: [Expanded(child: cell()), const SizedBox(width: 20), Expanded(child: cell())]),
      const SizedBox(height: 30),
      Row(children: [Expanded(child: cell()), const SizedBox(width: 20), Expanded(child: cell())]),
      const SizedBox(height: 40),
      const SkeletonList(rows: 3, avatar: false, padding: EdgeInsets.zero),
    ]);
  }
}
