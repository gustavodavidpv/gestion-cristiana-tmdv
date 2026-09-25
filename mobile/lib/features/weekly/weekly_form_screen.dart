import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

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
import 'weekly_screen.dart';

class WeeklyFormArgs {
  final WeeklyRecord? editing;
  const WeeklyFormArgs({this.editing});
}

/// Registrar semana: fecha con ‹ › (paso de 7 días, sin futuro), cantidad con
/// teclado numérico propio, notas. Si la semana ya existe, se reemplaza.
class WeeklyFormScreen extends ConsumerStatefulWidget {
  const WeeklyFormScreen({super.key, this.existing});
  final WeeklyFormArgs? existing;
  @override
  ConsumerState<WeeklyFormScreen> createState() => _WeeklyFormScreenState();
}

class _WeeklyFormScreenState extends ConsumerState<WeeklyFormScreen> {
  late DateTime _date = widget.existing?.editing?.weekDate ?? PanamaTime.lastWeekday(DateTime.sunday);
  late String _qty = widget.existing?.editing?.count.toString() ?? '';
  late final _notes = TextEditingController(text: widget.existing?.editing?.notes);
  bool _tried = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  void _key(String k) {
    HapticFeedback.selectionClick();
    setState(() {
      if (k == '⌫') {
        if (_qty.isNotEmpty) _qty = _qty.substring(0, _qty.length - 1);
      } else if (_qty.length < 4) {
        _qty = _qty == '0' ? k : _qty + k;
      }
    });
  }

  Future<void> _save() async {
    setState(() => _tried = true);
    if (_qty.isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final churchId = ref.read(effectiveChurchIdProvider);
      // Si ya existe un registro para esa fecha, se reemplaza (PUT).
      final records = await ref.read(weeklyProvider(_date.year).future);
      final existing = widget.existing?.editing ?? records.where((r) => PanamaTime.sameDay(r.weekDate, _date)).firstOrNull;
      final count = int.parse(_qty);
      final id = await ref.read(repoProvider).saveWeekly(
            id: existing?.id,
            date: _date,
            count: count,
            notes: _notes.text.trim(),
            churchId: churchId,
          );
      ref.read(lastSavedWeekProvider.notifier).set(id);
      ref.invalidate(weeklyProvider(_date.year));
      showAppSnack('Semana registrada · ${Fmt.plural(count, 'asistente', 'asistentes')}.');
      if (mounted) context.pop();
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider)!;
    final online = ref.watch(isOnlineProvider);
    final qtyErr = _tried && _qty.isEmpty;
    final nextDate = _date.add(const Duration(days: 7));
    final canNext = !nextDate.isAfter(PanamaTime.today());

    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Asistencia semanal'),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 2, 20, 14),
            child: Text(widget.existing?.editing != null ? 'Editar semana' : 'Registrar semana', style: AppText.title(30)),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                Text('Fecha de la semana *', style: AppText.base(size: 15, color: AppColors.neutral800)),
                Transform.translate(
                  offset: const Offset(12, 0),
                  child: Stepper3(
                    arrowsRight: true,
                    label: Fmt.longDateNoYear(_date),
                    prevLabel: 'Semana anterior',
                    nextLabel: 'Semana siguiente',
                    onPrev: () => setState(() => _date = _date.subtract(const Duration(days: 7))),
                    onNext: canNext ? () => setState(() => _date = nextDate) : null,
                  ),
                ),
                const SizedBox(height: 12),
                Text('Cantidad de asistentes *', style: AppText.base(size: 15, color: AppColors.neutral800)),
                Semantics(
                  label: 'Cantidad de asistentes: ${_qty.isEmpty ? 'vacío' : _qty}',
                  excludeSemantics: true,
                  child: Container(
                    padding: const EdgeInsets.only(top: 4, bottom: 6),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: qtyErr ? AppColors.magenta700 : AppColors.cyan700, width: 2))),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(_qty.isEmpty ? '0' : _qty,
                          style: AppText.base(size: 52, weight: FontWeight.w600, height: 1, color: _qty.isEmpty ? AppColors.neutral400 : AppColors.text)),
                      const SizedBox(width: 4),
                      const _Caret(),
                    ]),
                  ),
                ),
                if (qtyErr) ...[
                  const SizedBox(height: 6),
                  Text('Escribe la cantidad de asistentes.', style: AppText.base(size: 14, color: AppColors.magenta700)),
                ],
                const SizedBox(height: 16),
                LabeledField(label: 'Notas', child: AppTextField(controller: _notes, hint: 'Ej. Culto y escuela dominical', textCapitalization: TextCapitalization.sentences)),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Row(children: [
                    Expanded(child: Text('Registrado por', style: AppText.base(size: 15, color: AppColors.neutral800))),
                    Text('${user.firstName} · ${user.roleName}', style: AppText.base(size: 15, weight: FontWeight.w600)),
                  ]),
                ),
                if (_error != null) Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700)),
                if (!online) Text('Sin conexión. Guarda cuando vuelva la red.', style: AppText.base(size: 14, color: AppColors.magenta700)),
                const SizedBox(height: 12),
              ],
            ),
          ),
          Container(
            color: AppColors.surface,
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Column(children: [
              for (final row in const [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['', '0', '⌫'],
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(children: [
                    for (var i = 0; i < 3; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(child: row[i].isEmpty ? const SizedBox(height: 48) : _KeyButton(label: row[i], onTap: () => _key(row[i]))),
                    ],
                  ]),
                ),
              const SizedBox(height: 4),
              PrimaryButton(label: _saving ? 'Guardando…' : 'Guardar semana', loading: _saving, onPressed: online ? _save : null),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final isDel = label == '⌫';
    return Semantics(
      button: true,
      label: isDel ? 'Borrar' : label,
      excludeSemantics: true,
      child: Material(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: InkWell(
          onTap: onTap,
          highlightColor: AppColors.neutral300,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: SizedBox(
            height: 48,
            child: Center(
              child: isDel
                  ? const Ic(PhosphorIconsDuotone.backspace, size: 24, color: AppColors.text)
                  : Text(label, style: AppText.base(size: 22, weight: FontWeight.w600)),
            ),
          ),
        ),
      ),
    );
  }
}

class _Caret extends StatefulWidget {
  const _Caret();
  @override
  State<_Caret> createState() => _CaretState();
}

class _CaretState extends State<_Caret> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, _) => Opacity(
          opacity: _c.value < 0.5 ? 1 : 0,
          child: Container(width: 2, height: 44, margin: const EdgeInsets.only(bottom: 2), color: AppColors.cyan),
        ),
      );
}
