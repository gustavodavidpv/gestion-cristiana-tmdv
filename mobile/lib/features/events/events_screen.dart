import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/church_scope.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launchers.dart';
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import 'event_row.dart';

const eventTypes = ['Culto', 'Culto Especial', 'Evangelismo', 'Reunión', 'Jornada', 'Conferencia', 'Campamento', 'Ventas', 'Otro'];

/// Señal para recargar agendas tras crear/editar/eliminar/registrar asistencia.
class EventsVersion extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state++;
}

final eventsVersionProvider = NotifierProvider<EventsVersion, int>(EventsVersion.new);

typedef EventsRange = ({DateTime from, DateTime to, String? type});

final eventsRangeProvider = FutureProvider.family<List<ChurchEvent>, EventsRange>((ref, r) {
  ref.watch(eventsVersionProvider);
  final scope = ref.watch(churchQueryProvider);
  return ref.read(repoProvider).eventsBetween(r.from, r.to, type: r.type, scope: scope);
});

/// Descarga un PDF autenticado, lo abre y ofrece compartirlo.
Future<void> downloadPdf(BuildContext context, WidgetRef ref, String path, String fileName, {Map<String, dynamic>? query}) async {
  showAppSnack('Descargando $fileName…');
  try {
    final file = await Launchers.download(ref.read(apiClientProvider), path, fileName, query: query);
    if (!context.mounted) return;
    await Launchers.open(context, file);
    showAppSnack('$fileName listo.', actionLabel: 'Compartir', onAction: () => Launchers.share(file, title: fileName));
  } catch (e) {
    showAppSnack(ApiException.from(e).message, error: true);
  }
}

class EventsScreen extends ConsumerStatefulWidget {
  const EventsScreen({super.key});
  @override
  ConsumerState<EventsScreen> createState() => _EventsScreenState();
}

class _EventsScreenState extends ConsumerState<EventsScreen> {
  bool _monthMode = true;
  late DateTime _month; // primer día del mes (hora de pared)
  late DateTime _selected;
  String? _type;

  @override
  void initState() {
    super.initState();
    final t = PanamaTime.today();
    _month = DateTime.utc(t.year, t.month);
    _selected = t;
  }

  EventsRange get _range {
    if (_monthMode) {
      return (from: _month, to: DateTime.utc(_month.year, _month.month + 1).subtract(const Duration(seconds: 1)), type: _type);
    }
    return (from: _month, to: DateTime.utc(_month.year, _month.month + 6).subtract(const Duration(seconds: 1)), type: _type);
  }

  void _shiftMonth(int delta) {
    setState(() {
      _month = DateTime.utc(_month.year, _month.month + delta);
      final today = PanamaTime.today();
      _selected = (_month.year == today.year && _month.month == today.month) ? today : _month;
    });
  }

  Future<void> _menu() async {
    final action = await showOptionsSheet<String>(context, title: 'Calendarios en PDF', options: [
      SheetOption('Calendario de ${Fmt.monthName(_month.month)} ${_month.year}', 'month', icon: PhosphorIconsDuotone.filePdf),
      SheetOption('Calendario de ventas ${_month.year}', 'sales', icon: PhosphorIconsDuotone.filePdf),
    ]);
    if (!mounted) return;
    if (action == 'month') {
      await downloadPdf(context, ref, '/events/calendar-pdf', 'Calendario ${Fmt.monthName(_month.month)} ${_month.year}.pdf',
          query: {'year': _month.year, 'month': _month.month, ...ref.read(churchQueryProvider)});
    } else if (action == 'sales') {
      await downloadPdf(context, ref, '/events/sales-calendar-pdf', 'Calendario de ventas ${_month.year}.pdf',
          query: {'year': _month.year, ...ref.read(churchQueryProvider)});
    }
  }

  void _open(ChurchEvent e) => context.push(Routes.evento(e.id), extra: 'Eventos');

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(permissionsProvider);
    final async = ref.watch(eventsRangeProvider(_range));
    final canCreate = perms.can('events', 'create');

    return Scaffold(
      floatingActionButton: canCreate
          ? AppFab(label: 'Nuevo evento', onPressed: () => context.push(Routes.eventoNuevo, extra: _monthMode ? _selected : null))
          : null,
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ScreenHeader(
                kicker: '${ref.watch(churchLabelProvider)} · ${_month.year}',
                title: 'Eventos',
                trailing: Transform.translate(offset: const Offset(12, 0), child: MoreButton(onPressed: _menu)),
              ),
              Segmented(options: const ['Mes', 'Lista'], index: _monthMode ? 0 : 1, onChanged: (i) => setState(() => _monthMode = i == 0)),
            ]),
          ),
          const SizedBox(height: 12),
          ChipScroller(children: [
            AppChip(label: 'Todos', selected: _type == null, onTap: () => setState(() => _type = null)),
            for (final t in eventTypes.take(4))
              AppChip(label: t, dot: EventTypeStyle.of(t).dot, selected: _type == t, onTap: () => setState(() => _type = _type == t ? null : t)),
          ]),
          const SizedBox(height: 4),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.cyan700,
              onRefresh: () => ref.refresh(eventsRangeProvider(_range).future),
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(20, 0, 20, canCreate ? 96 : 24),
                children: _monthMode ? _monthView(async) : _listView(async),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  List<Widget> _monthView(AsyncValue<List<ChurchEvent>> async) {
    final events = async.value ?? const <ChurchEvent>[];
    final today = PanamaTime.today();
    final daysInMonth = DateUtils.getDaysInMonth(_month.year, _month.month);
    final leading = _month.weekday % 7; // domingo primero
    final byDay = <int, List<ChurchEvent>>{};
    for (final e in events) {
      if (e.start.month == _month.month && e.start.year == _month.year) byDay.putIfAbsent(e.start.day, () => []).add(e);
    }
    final dayEvents = byDay[_selected.day] ?? const [];
    final sameMonth = _selected.month == _month.month && _selected.year == _month.year;

    final cells = <Widget>[];
    for (var i = 0; i < leading; i++) {
      cells.add(const SizedBox());
    }
    for (var d = 1; d <= daysInMonth; d++) {
      final date = DateTime.utc(_month.year, _month.month, d);
      final isSel = sameMonth && _selected.day == d;
      final isToday = PanamaTime.sameDay(date, today);
      final dots = (byDay[d] ?? const []).take(3).map((e) => EventTypeStyle.of(e.eventType).dot).toList();
      cells.add(Semantics(
        button: true,
        selected: isSel,
        label: '${Fmt.longDateNoYear(date)}${dots.isEmpty ? '' : ', ${Fmt.plural(byDay[d]!.length, 'evento', 'eventos')}'}',
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _selected = date),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSel ? AppColors.cyan700 : null,
                border: !isSel && isToday ? Border.all(color: AppColors.cyan, width: 1.5) : null,
              ),
              child: Text('$d',
                  style: AppText.base(size: 16, weight: isSel || isToday ? FontWeight.w600 : FontWeight.w400, color: isSel ? AppColors.bg : AppColors.text)),
            ),
            const SizedBox(height: 3),
            SizedBox(
              height: 6,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                for (var j = 0; j < dots.length; j++) ...[if (j > 0) const SizedBox(width: 3), Dot(dots[j], size: 6)],
              ]),
            ),
          ]),
        ),
      ));
    }

    return [
      Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Row(children: [
          Transform.translate(offset: const Offset(-12, 0), child: SquareIconButton(icon: PhosphorIconsDuotone.caretLeft, size: 22, label: 'Mes anterior', onPressed: () => _shiftMonth(-1))),
          Expanded(child: Text(Fmt.monthYear(_month), textAlign: TextAlign.center, style: AppText.base(size: 20, weight: FontWeight.w600))),
          Transform.translate(offset: const Offset(12, 0), child: SquareIconButton(icon: PhosphorIconsDuotone.caretRight, size: 22, label: 'Mes siguiente', onPressed: () => _shiftMonth(1))),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          for (final l in const ['D', 'L', 'M', 'M', 'J', 'V', 'S'])
            Expanded(child: Text(l, textAlign: TextAlign.center, style: AppText.base(size: 13, color: AppColors.neutral700))),
        ]),
      ),
      for (var w = 0; w < cells.length; w += 7)
        Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Row(children: [
            for (var k = w; k < w + 7; k++) Expanded(child: SizedBox(height: 48, child: k < cells.length ? cells[k] : null)),
          ]),
        ),
      const SizedBox(height: 22),
      Kicker(Fmt.longDateNoYear(_selected)),
      const SizedBox(height: 2),
      if (async.isLoading && !async.hasValue)
        const SkeletonList(rows: 2, avatar: false, padding: EdgeInsets.zero)
      else if (async.hasError && !async.hasValue)
        _inlineError(async.error!)
      else if (dayEvents.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text('No hay eventos este día.', style: AppText.base(size: 16, color: AppColors.neutral700)),
        )
      else
        for (final e in dayEvents) EventRow(event: e, colorBar: true, onTap: () => _open(e)),
    ];
  }

  Widget _inlineError(Object e) {
    final ex = ApiException.from(e);
    return InlineEmpty(
      icon: ex.isNetwork ? PhosphorIconsDuotone.wifiSlash : PhosphorIconsDuotone.warningCircle,
      title: ex.isNetwork ? 'No pudimos conectar.' : ex.message,
      actionLabel: 'Reintentar',
      onAction: () => ref.invalidate(eventsRangeProvider(_range)),
    );
  }

  List<Widget> _listView(AsyncValue<List<ChurchEvent>> async) {
    if (async.isLoading && !async.hasValue) return [const SkeletonList(avatar: false, padding: EdgeInsets.zero)];
    if (async.hasError && !async.hasValue) return [_inlineError(async.error!)];
    final events = async.value!;
    if (events.isEmpty) {
      return [
        const InlineEmpty(
          icon: PhosphorIconsDuotone.calendarBlank,
          title: 'No hay eventos en los próximos meses.',
        ),
      ];
    }
    final out = <Widget>[];
    int? lastMonth;
    for (final e in events) {
      final key = e.start.year * 100 + e.start.month;
      if (key != lastMonth) {
        out.add(Padding(padding: const EdgeInsets.only(top: 22, bottom: 2), child: Text(Fmt.monthYear(e.start), style: AppText.h2)));
        lastMonth = key;
      }
      out.add(EventRow(event: e, onTap: () => _open(e)));
    }
    return out;
  }
}
