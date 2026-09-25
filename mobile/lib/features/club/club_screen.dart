import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import '../events/events_screen.dart' show downloadPdf;

final clubGroupsProvider = FutureProvider<(List<ClubGroup>, List<String>)>((ref) {
  final scope = ref.watch(churchQueryProvider);
  return ref.read(repoProvider).clubGroups(scope: scope);
});

final clubStudentsProvider = FutureProvider.family<List<ClubStudent>, int>((ref, groupId) {
  final scope = ref.watch(churchQueryProvider);
  return ref.read(repoProvider).clubStudents(groupId, scope: scope);
});

/// Club Bíblico — hoja de puntos, variante "Contadores".
class ClubScreen extends ConsumerStatefulWidget {
  const ClubScreen({super.key});
  @override
  ConsumerState<ClubScreen> createState() => _ClubScreenState();
}

class _ClubScreenState extends ConsumerState<ClubScreen> {
  int? _groupId;
  late DateTime _activity = PanamaTime.lastWeekday(DateTime.saturday);
  String? _reason;
  final Map<int, int> _deltas = {};
  bool _saving = false;

  int get _movements => _deltas.values.where((v) => v > 0).length;
  int get _pointsTotal => _deltas.values.fold(0, (a, v) => a + v);

  Future<bool> _confirmDiscard() async {
    if (_movements == 0) return true;
    return showConfirmDialog(
      context,
      title: '¿Descartar los puntos sin guardar?',
      body: 'Tienes ${Fmt.plural(_movements, 'movimiento', 'movimientos')} sin guardar en esta hoja.',
      action: 'Descartar',
    );
  }

  Future<void> _changeGroup(int id) async {
    if (id == _groupId || !await _confirmDiscard()) return;
    setState(() {
      _groupId = id;
      _deltas.clear();
    });
  }

  Future<void> _changeDate(int weeks) async {
    final next = _activity.add(Duration(days: 7 * weeks));
    if (next.isAfter(PanamaTime.today()) || !await _confirmDiscard()) return;
    setState(() {
      _activity = next;
      _deltas.clear();
    });
  }

  void _add(int id, int n) {
    HapticFeedback.selectionClick();
    setState(() => _deltas[id] = ((_deltas[id] ?? 0) + n).clamp(0, 999));
  }

  Future<void> _save(ClubGroup group) async {
    final reason = _reason;
    setState(() => _saving = true);
    try {
      final entries = [
        for (final e in _deltas.entries)
          if (e.value > 0) {'student_id': e.key, 'points': e.value, 'type': 'earn', 'reason': reason},
      ];
      await ref.read(repoProvider).clubTransactions(_activity, entries);
      final movements = entries.length;
      final pts = _pointsTotal;
      setState(() => _deltas.clear());
      ref.invalidate(clubStudentsProvider(group.id));
      showAppSnack(
        '${Fmt.plural(movements, 'movimiento guardado', 'movimientos guardados')} · +$pts pts',
        actionLabel: 'Ver posiciones',
        onAction: () => _standings(group),
      );
    } catch (e) {
      showAppSnack(ApiException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _standings(ClubGroup g) =>
      downloadPdf(context, ref, '/bible-club/groups/${g.id}/standings.pdf', 'Posiciones ${g.name}.pdf', query: ref.read(churchQueryProvider));

  Future<void> _menu(ClubGroup g) async {
    final a = await showOptionsSheet<String>(context, title: g.name, options: const [
      SheetOption('Tabla de posiciones (PDF)', 'pdf', icon: PhosphorIconsDuotone.filePdf),
    ]);
    if (a == 'pdf') _standings(g);
  }

  Future<void> _openStudent(ClubStudent s, bool canCreate) async {
    if (!canCreate) {
      context.push(Routes.participante(s.id), extra: s.fullName);
      return;
    }
    final redeemed = await showAppSheet<bool>(context, builder: (ctx) => _RedeemSheet(student: s, activityDate: _activity));
    if (redeemed == true) ref.invalidate(clubStudentsProvider(s.groupId));
  }

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(permissionsProvider);
    final canCreate = perms.can('bible_club', 'create');
    final groupsAsync = ref.watch(clubGroupsProvider);
    final online = ref.watch(isOnlineProvider);

    return groupsAsync.when(
      loading: () => Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.only(top: 60), child: const SkeletonList()))),
      error: (e, _) => Scaffold(body: SafeArea(child: StateView.fromError(e, onRetry: () => ref.invalidate(clubGroupsProvider)))),
      data: (data) {
        final (groups, reasons) = data;
        if (groups.isEmpty) {
          return const Scaffold(
            body: SafeArea(
              child: StateView(
                icon: PhosphorIconsDuotone.bookOpenText,
                title: 'Aún no hay salones del club.',
                body: 'Créalos desde el sistema web; aquí aparecerán para cargar puntos.',
              ),
            ),
          );
        }
        final group = groups.firstWhere((g) => g.id == _groupId, orElse: () => groups.first);
        _reason ??= reasons.isNotEmpty ? reasons.first : null;
        final studentsAsync = ref.watch(clubStudentsProvider(group.id));
        final today = PanamaTime.today();
        final canNext = !_activity.add(const Duration(days: 7)).isAfter(today);

        return Scaffold(
          bottomNavigationBar: canCreate
              ? FooterBar(
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        !online
                            ? 'Sin conexión. Tus puntos se conservan; guarda cuando vuelva la red.'
                            : _movements == 0
                                ? 'Toca + para sumar 1 punto; mantén presionado para sumar 5. Toca un nombre para canjear.'
                                : 'Motivo: ${_reason ?? 'sin motivo'} · ${Fmt.activityDate(_activity)}',
                        style: AppText.base(size: 14, color: online ? AppColors.neutral700 : AppColors.magenta700),
                      ),
                    ),
                    PrimaryButton(
                      label: _movements == 0 ? 'Sin movimientos' : 'Guardar ${Fmt.plural(_movements, 'movimiento', 'movimientos')}',
                      loading: _saving,
                      onPressed: _movements > 0 && online ? () => _save(group) : null,
                    ),
                  ]),
                )
              : null,
          body: SafeArea(
            bottom: false,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  ScreenHeader(
                    kicker: '${ref.watch(churchLabelProvider)} · ${_activity.year}',
                    title: 'Club Bíblico',
                    bottomGap: 12,
                    trailing: Transform.translate(offset: const Offset(12, 0), child: MoreButton(onPressed: () => _menu(group))),
                  ),
                  if (groups.length <= 3)
                    Segmented(
                      options: [for (final g in groups) g.name],
                      index: groups.indexOf(group),
                      onChanged: (i) => _changeGroup(groups[i].id),
                    ),
                ]),
              ),
              if (groups.length > 3) ...[
                const SizedBox(height: 4),
                ChipScroller(children: [
                  for (final g in groups) AppChip(label: g.name, selected: g.id == group.id, onTap: () => _changeGroup(g.id)),
                ]),
              ],
              if (canCreate) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 6, 8, 0),
                  child: Row(children: [
                    Expanded(
                      child: Text.rich(TextSpan(style: AppText.base(size: 16), children: [
                        const TextSpan(text: 'Actividad del '),
                        TextSpan(text: Fmt.activityDate(_activity), style: const TextStyle(fontWeight: FontWeight.w600)),
                      ])),
                    ),
                    SquareIconButton(icon: PhosphorIconsDuotone.caretLeft, size: 20, width: 44, label: 'Semana anterior', onPressed: () => _changeDate(-1)),
                    SquareIconButton(icon: PhosphorIconsDuotone.caretRight, size: 20, width: 44, label: 'Semana siguiente', onPressed: canNext ? () => _changeDate(1) : null),
                  ]),
                ),
                const SizedBox(height: 2),
                ChipScroller(children: [
                  for (final r in reasons) AppChip(label: r, selected: r == _reason, onTap: () => setState(() => _reason = r)),
                ]),
              ],
              const SizedBox(height: 8),
              Expanded(
                child: studentsAsync.when(
                  skipLoadingOnRefresh: true,
                  loading: () => const SkeletonList(avatar: false),
                  error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(clubStudentsProvider(group.id))),
                  data: (students) {
                    if (students.isEmpty) {
                      return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: const [
                        InlineEmpty(
                          icon: PhosphorIconsDuotone.usersThree,
                          title: 'Este salón no tiene participantes.',
                          body: 'Agrégalos desde el sistema web.',
                        ),
                      ]);
                    }
                    return RefreshIndicator(
                      color: AppColors.cyan700,
                      onRefresh: () => ref.refresh(clubStudentsProvider(group.id).future),
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
                        itemCount: students.length,
                        itemBuilder: (context, i) {
                          final s = students[i];
                          return _CounterRow(
                            student: s,
                            delta: _deltas[s.id] ?? 0,
                            editable: canCreate,
                            onName: () => _openStudent(s, canCreate),
                            onPlus: () => _add(s.id, 1),
                            onPlusLong: () => _add(s.id, 5),
                            onMinus: () => _add(s.id, -1),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ]),
          ),
        );
      },
    );
  }
}

class _CounterRow extends StatelessWidget {
  const _CounterRow({
    required this.student,
    required this.delta,
    required this.editable,
    required this.onName,
    required this.onPlus,
    required this.onPlusLong,
    required this.onMinus,
  });
  final ClubStudent student;
  final int delta;
  final bool editable;
  final VoidCallback onName;
  final VoidCallback onPlus;
  final VoidCallback onPlusLong;
  final VoidCallback onMinus;

  @override
  Widget build(BuildContext context) {
    final sub = 'Acumulado: ${student.balance} pts${student.levelName != null ? ' · ${student.levelName}' : ''}';
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
      child: Row(children: [
        Expanded(
          child: InkWell(
            onTap: onName,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 72),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(student.fullName, style: AppText.rowName),
                Text(sub, style: AppText.rowSub),
              ]),
            ),
          ),
        ),
        if (editable) ...[
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: 'Restar un punto a ${student.fullName}',
            excludeSemantics: true,
            child: Opacity(
              opacity: delta > 0 ? 1 : 0.3,
              child: GestureDetector(
                onTap: delta > 0 ? onMinus : null,
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(AppRadii.md)),
                  child: const Center(child: Ic(PhosphorIconsBold.minus, size: 18, color: AppColors.text)),
                ),
              ),
            ),
          ),
          SizedBox(
            width: 40,
            child: Text(
              '$delta',
              textAlign: TextAlign.center,
              style: AppText.base(size: 24, weight: FontWeight.w600, color: delta > 0 ? AppColors.cyan700 : AppColors.neutral500),
            ),
          ),
          _PlusButton(label: 'Sumar un punto a ${student.fullName}', onTap: onPlus, onLong: onPlusLong),
        ],
      ]),
    );
  }
}

/// Botón + : toque suma 1; mantener 450 ms suma 5.
class _PlusButton extends StatefulWidget {
  const _PlusButton({required this.label, required this.onTap, required this.onLong});
  final String label;
  final VoidCallback onTap;
  final VoidCallback onLong;
  @override
  State<_PlusButton> createState() => _PlusButtonState();
}

class _PlusButtonState extends State<_PlusButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: widget.label,
      onLongPressHint: 'sumar 5',
      excludeSemantics: true,
      child: RawGestureDetector(
        gestures: {
          TapGestureRecognizer: GestureRecognizerFactoryWithHandlers<TapGestureRecognizer>(
            TapGestureRecognizer.new,
            (r) => r
              ..onTapDown = ((_) => setState(() => _down = true))
              ..onTapUp = ((_) => setState(() => _down = false))
              ..onTapCancel = (() => setState(() => _down = false))
              ..onTap = widget.onTap,
          ),
          LongPressGestureRecognizer: GestureRecognizerFactoryWithHandlers<LongPressGestureRecognizer>(
            () => LongPressGestureRecognizer(duration: const Duration(milliseconds: 450)),
            (r) => r
              ..onLongPress = () {
                setState(() => _down = false);
                widget.onLong();
              },
          ),
        },
        child: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(color: _down ? AppColors.cyan900 : AppColors.cyan700, borderRadius: BorderRadius.circular(AppRadii.md)),
          child: const Center(child: Ic(PhosphorIconsBold.plus, size: 18, color: AppColors.bg)),
        ),
      ),
    );
  }
}

/// Hoja de canje. El servidor no tiene catálogo de artículos: se escribe el
/// artículo y sus puntos (igual que en la web). El canje descuenta saldo, no
/// puntos ganados (el nivel no baja).
class _RedeemSheet extends ConsumerStatefulWidget {
  const _RedeemSheet({required this.student, required this.activityDate});
  final ClubStudent student;
  final DateTime activityDate;
  @override
  ConsumerState<_RedeemSheet> createState() => _RedeemSheetState();
}

class _RedeemSheetState extends ConsumerState<_RedeemSheet> {
  final _item = TextEditingController();
  final _points = TextEditingController();
  final _note = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _item.dispose();
    _points.dispose();
    _note.dispose();
    super.dispose();
  }

  int get _pts => int.tryParse(_points.text) ?? 0;
  bool get _short => _pts > widget.student.balance;
  bool get _valid => _item.text.trim().isNotEmpty && _pts > 0 && !_short;

  Future<void> _redeem() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(repoProvider).clubTransactions(PanamaTime.today(), [
        {
          'student_id': widget.student.id,
          'points': _pts,
          'type': 'redeem',
          'reason': 'Canje',
          'item': _item.text.trim(),
          'notes': _note.text.trim(),
        },
      ]);
      showAppSnack('${widget.student.fullName} canjeó ${_item.text.trim()} · −$_pts pts');
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.student;
    return SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Kicker('Canje · saldo ${s.balance} pts'),
        const SizedBox(height: 4),
        Row(children: [
          Expanded(child: Text(s.fullName, style: AppText.base(size: 24, weight: FontWeight.w600))),
          LinkButton(
            label: 'Historial',
            icon: PhosphorIconsDuotone.clockCounterClockwise,
            fontSize: 15,
            onPressed: () {
              Navigator.of(context).pop();
              context.push(Routes.participante(s.id), extra: s.fullName);
            },
          ),
        ]),
        const SizedBox(height: 8),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: LabeledField(
              label: 'Artículo',
              child: AppTextField(controller: _item, hint: 'Ej. Biblia de bolsillo', textCapitalization: TextCapitalization.sentences, onChanged: (_) => setState(() {})),
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            width: 96,
            child: LabeledField(
              label: 'Puntos',
              child: AppTextField(
                controller: _points,
                keyboardType: TextInputType.number,
                hasError: _short,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                onChanged: (_) => setState(() {}),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        AppTextField(controller: _note, hint: 'Nota (opcional)'),
        if (_short) ...[
          const SizedBox(height: 8),
          Text('Saldo insuficiente para este artículo.', style: AppText.base(size: 14, color: AppColors.magenta700)),
        ],
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: AppText.base(size: 14, color: AppColors.magenta700)),
        ],
        const SizedBox(height: 14),
        PrimaryButton(label: _pts > 0 ? 'Canjear $_pts pts' : 'Canjear', loading: _saving, onPressed: _valid ? _redeem : null),
      ]),
    );
  }
}
