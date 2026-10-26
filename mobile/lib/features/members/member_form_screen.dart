import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import 'member_detail_screen.dart';
import 'members_screen.dart';

/// Crear / editar miembro. Si el rol no puede leer el catálogo de cargos
/// (hallazgo 1.5.d), el campo se oculta y no se envía: el servidor conserva
/// el valor existente.
class MemberFormScreen extends ConsumerWidget {
  const MemberFormScreen({super.key, this.member, this.memberId});
  final Member? member;
  final int? memberId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (memberId != null && member == null) {
      return ref.watch(memberProvider(memberId!)).when(
            loading: () => const Scaffold(body: SafeArea(child: SkeletonList())),
            error: (e, _) => Scaffold(body: SafeArea(child: StateView.fromError(e, onRetry: () => ref.invalidate(memberProvider(memberId!))))),
            data: (m) => _MemberForm(member: m),
          );
    }
    return _MemberForm(member: member);
  }
}

class _MemberForm extends ConsumerStatefulWidget {
  const _MemberForm({this.member});
  final Member? member;
  @override
  ConsumerState<_MemberForm> createState() => _MemberFormState();
}

class _MemberFormState extends ConsumerState<_MemberForm> {
  late final _first = TextEditingController(text: widget.member?.firstName);
  late final _last = TextEditingController(text: widget.member?.lastName);
  late final _age = TextEditingController(text: widget.member?.age?.toString());
  late final _phone = TextEditingController(text: widget.member?.phone);
  late final _email = TextEditingController(text: widget.member?.email);
  late final _address = TextEditingController(text: widget.member?.address);
  late String _type = widget.member?.memberType ?? 'Miembro';
  late String? _sex = widget.member?.sex;
  late bool _baptized = widget.member?.baptized ?? false;
  int? _bMonth;
  int? _bDay;
  late Set<int> _positionIds = {...?widget.member?.positions.map((p) => p.id)};
  bool _saving = false;
  bool _tried = false;
  String? _error;

  bool get _editing => widget.member != null;

  @override
  void initState() {
    super.initState();
    final b = widget.member?.birthDate;
    if (b != null && RegExp(r'^\d{2}-\d{2}$').hasMatch(b)) {
      _bMonth = int.parse(b.substring(0, 2));
      _bDay = int.parse(b.substring(3));
    }
  }

  @override
  void dispose() {
    for (final c in [_first, _last, _age, _phone, _email, _address]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save(List<Position>? catalog) async {
    setState(() => _tried = true);
    if (_first.text.trim().isEmpty || _last.text.trim().isEmpty) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    final data = <String, dynamic>{
      'first_name': _first.text.trim(),
      'last_name': _last.text.trim(),
      'member_type': _type,
      'sex': _sex ?? '',
      'age': _age.text.trim(),
      'baptized': _baptized,
      'birth_date': _bMonth != null && _bDay != null
          ? '${_bMonth.toString().padLeft(2, '0')}-${_bDay.toString().padLeft(2, '0')}'
          : '',
      'phone': _phone.text.trim(),
      'email': _email.text.trim(),
      'address': _address.text.trim(),
      if (catalog != null) 'position_ids': _positionIds.toList(),
      if (!_editing) ...ref.read(churchQueryProvider),
    };
    try {
      final saved = await ref.read(repoProvider).saveMember(widget.member?.id, data);
      ref.read(membersVersionProvider.notifier).bump();
      ref.invalidate(memberProvider(saved.id));
      showAppSnack(_editing ? 'Cambios guardados.' : '${saved.fullName} fue agregado.');
      if (mounted) context.pop();
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _pickType() async {
    final t = await showOptionsSheet<String>(context, title: 'Tipo', selected: _type, options: [for (final t in memberTypes) SheetOption(t, t)]);
    if (t != null) setState(() => _type = t);
  }

  Future<void> _pickBirthMonth() async {
    final m = await showOptionsSheet<int>(context, title: 'Mes de cumpleaños', selected: _bMonth ?? 0, options: [
      const SheetOption('Sin cumpleaños', 0),
      for (var i = 1; i <= 12; i++) SheetOption(Fmt.cap(Fmt.monthName(i)), i),
    ]);
    if (m == null) return;
    setState(() {
      _bMonth = m == 0 ? null : m;
      if (_bMonth == null) _bDay = null;
      _bDay ??= _bMonth != null ? 1 : null;
      final max = _bMonth == null ? 31 : DateUtils.getDaysInMonth(2024, _bMonth!);
      if (_bDay != null && _bDay! > max) _bDay = max;
    });
  }

  Future<void> _pickBirthDay() async {
    if (_bMonth == null) return _pickBirthMonth();
    final max = DateUtils.getDaysInMonth(2024, _bMonth!);
    final d = await showAppSheet<int>(context, builder: (ctx) {
      return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Día', style: AppText.base(size: 20, weight: FontWeight.w600)),
        const SizedBox(height: 12),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (var i = 1; i <= max; i++)
            SizedBox(
              width: 44,
              height: 44,
              child: Material(
                color: i == _bDay ? AppColors.cyan700 : AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.md),
                child: InkWell(
                  onTap: () => Navigator.of(ctx).pop(i),
                  child: Center(child: Text('$i', style: AppText.base(size: 16, color: i == _bDay ? AppColors.bg : AppColors.text))),
                ),
              ),
            ),
        ]),
      ]);
    });
    if (d != null) setState(() => _bDay = d);
  }

  Future<void> _pickPositions(List<Position> catalog) async {
    final result = await showAppSheet<Set<int>>(context, builder: (ctx) {
      final sel = {..._positionIds};
      return StatefulBuilder(builder: (ctx, setSheet) {
        return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Cargos ministeriales', style: AppText.base(size: 20, weight: FontWeight.w600)),
          Flexible(
            child: ListView(shrinkWrap: true, children: [
              for (final p in catalog)
                InkWell(
                  onTap: () => setSheet(() => sel.contains(p.id) ? sel.remove(p.id) : sel.add(p.id)),
                  child: SizedBox(
                    height: 56,
                    child: Row(children: [
                      Expanded(child: Text(p.name, style: AppText.base(size: 17))),
                      if (sel.contains(p.id)) const Ic(PhosphorIconsBold.check, size: 18, color: AppColors.cyan700),
                    ]),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 8),
          PrimaryButton(label: 'Listo', onPressed: () => Navigator.of(ctx).pop(sel)),
        ]);
      });
    });
    if (result != null) setState(() => _positionIds = result);
  }

  Widget _selector(String value, VoidCallback onTap, {bool placeholder = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(AppRadii.md)),
        child: Row(children: [
          Expanded(child: Text(value, style: AppText.base(size: 17, color: placeholder ? AppColors.neutral500 : AppColors.text), overflow: TextOverflow.ellipsis)),
          const Ic(PhosphorIconsDuotone.caretDown, size: 16, color: AppColors.neutral700),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(positionsProvider).value;
    final firstErr = _tried && _first.text.trim().isEmpty;
    final lastErr = _tried && _last.text.trim().isEmpty;
    final positionsLabel = catalog?.where((p) => _positionIds.contains(p.id)).map((p) => p.name).join(', ');

    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          BackHeader(label: _editing ? 'Ficha' : 'Miembros'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 24),
              children: [
                Text(_editing ? 'Editar miembro' : 'Nuevo miembro', style: AppText.title(30)),
                const SizedBox(height: 18),
                LabeledField(
                  label: 'Nombres *',
                  error: firstErr ? 'Escribe los nombres.' : null,
                  child: AppTextField(controller: _first, hasError: firstErr, textCapitalization: TextCapitalization.words, textInputAction: TextInputAction.next),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: 'Apellidos *',
                  error: lastErr ? 'Escribe los apellidos.' : null,
                  child: AppTextField(controller: _last, hasError: lastErr, textCapitalization: TextCapitalization.words, textInputAction: TextInputAction.next),
                ),
                const SizedBox(height: 14),
                LabeledField(label: 'Tipo', child: _selector(_type, _pickType)),
                const SizedBox(height: 14),
                LabeledField(
                  label: 'Sexo',
                  child: Segmented(
                    options: const ['Sin dato', 'Masculino', 'Femenino'],
                    index: _sex == 'M' ? 1 : _sex == 'F' ? 2 : 0,
                    onChanged: (i) => setState(() => _sex = i == 1 ? 'M' : i == 2 ? 'F' : null),
                  ),
                ),
                const SizedBox(height: 14),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(
                    width: 96,
                    child: LabeledField(
                      label: 'Edad',
                      child: AppTextField(
                        controller: _age,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(3)],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: LabeledField(
                      label: 'Cumpleaños',
                      child: Row(children: [
                        Expanded(child: _selector(_bMonth == null ? 'Mes' : Fmt.cap(Fmt.monthName(_bMonth!)), _pickBirthMonth, placeholder: _bMonth == null)),
                        const SizedBox(width: 8),
                        SizedBox(width: 76, child: _selector(_bDay?.toString() ?? 'Día', _pickBirthDay, placeholder: _bDay == null)),
                      ]),
                    ),
                  ),
                ]),
                const SizedBox(height: 6),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _baptized,
                  onChanged: (v) => setState(() => _baptized = v),
                  title: Text('Bautizado', style: AppText.base(size: 17)),
                ),
                if (catalog != null && catalog.isNotEmpty) ...[
                  LabeledField(
                    label: 'Cargo ministerial',
                    child: _selector(positionsLabel!.isEmpty ? 'Sin cargo' : positionsLabel, () => _pickPositions(catalog), placeholder: positionsLabel.isEmpty),
                  ),
                  const SizedBox(height: 14),
                ],
                LabeledField(
                  label: 'Teléfono',
                  child: AppTextField(controller: _phone, keyboardType: TextInputType.phone, textInputAction: TextInputAction.next),
                ),
                const SizedBox(height: 14),
                LabeledField(
                  label: 'Correo',
                  child: AppTextField(controller: _email, keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.next),
                ),
                const SizedBox(height: 14),
                LabeledField(label: 'Dirección', child: AppTextField(controller: _address, maxLines: 2)),
                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700)),
                ],
              ],
            ),
          ),
          FooterBar(
            child: PrimaryButton(
              label: _saving ? 'Guardando…' : (_editing ? 'Guardar cambios' : 'Agregar miembro'),
              loading: _saving,
              onPressed: () => _save(catalog),
            ),
          ),
        ]),
      ),
    );
  }
}
