import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import '../members/member_picker.dart';
import 'event_detail_screen.dart';
import 'events_screen.dart';

/// Crear / editar evento. Las horas se eligen en hora de Panamá y se envían en
/// ISO 8601 con offset `-05:00` (contrato de eventController).
class EventFormScreen extends ConsumerWidget {
  const EventFormScreen({super.key, this.event, this.eventId, this.initialDate});
  final ChurchEvent? event;
  final int? eventId;
  final DateTime? initialDate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (eventId != null && event == null) {
      return ref.watch(eventProvider(eventId!)).when(
            loading: () => const Scaffold(body: SafeArea(child: SkeletonList(avatar: false))),
            error: (e, _) => Scaffold(body: SafeArea(child: StateView.fromError(e, onRetry: () => ref.invalidate(eventProvider(eventId!))))),
            data: (e) => _EventForm(event: e),
          );
    }
    return _EventForm(event: event, initialDate: initialDate);
  }
}

class _EventForm extends ConsumerStatefulWidget {
  const _EventForm({this.event, this.initialDate});
  final ChurchEvent? event;
  final DateTime? initialDate;
  @override
  ConsumerState<_EventForm> createState() => _EventFormState();
}

class _EventFormState extends ConsumerState<_EventForm> {
  late final _title = TextEditingController(text: widget.event?.title);
  late final _location = TextEditingController(text: widget.event?.location);
  late final _description = TextEditingController(text: widget.event?.description);
  late String _type = widget.event?.eventType ?? 'Culto';
  late DateTime _date;
  late TimeOfDay _startTime;
  TimeOfDay? _endTime;
  late MemberRef? _preacher = widget.event?.preacher;
  late MemberRef? _worship = widget.event?.worshipLeader;
  late MemberRef? _singer = widget.event?.singer;
  bool _saving = false;
  bool _tried = false;
  String? _error;

  bool get _editing => widget.event != null;
  bool get _isCulto => _type == 'Culto' || _type == 'Culto Especial';

  @override
  void initState() {
    super.initState();
    final e = widget.event;
    if (e != null) {
      _date = PanamaTime.startOfDay(e.start);
      _startTime = TimeOfDay(hour: e.start.hour, minute: e.start.minute);
      if (e.end != null) _endTime = TimeOfDay(hour: e.end!.hour, minute: e.end!.minute);
    } else {
      final today = PanamaTime.today();
      final init = widget.initialDate;
      _date = init != null && !init.isBefore(today) ? PanamaTime.startOfDay(init) : today;
      _startTime = const TimeOfDay(hour: 19, minute: 0);
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _location.dispose();
    _description.dispose();
    super.dispose();
  }

  DateTime _wall(TimeOfDay t) => DateTime.utc(_date.year, _date.month, _date.day, t.hour, t.minute);

  String _timeLabel(TimeOfDay t) => Fmt.time(DateTime.utc(2000, 1, 1, t.hour, t.minute));

  Future<void> _pickDate() async {
    final d = await showDatePicker(
      context: context,
      initialDate: DateTime(_date.year, _date.month, _date.day),
      firstDate: DateTime(2020),
      lastDate: DateTime(PanamaTime.now().year + 2, 12, 31),
      helpText: 'Fecha del evento',
      cancelText: 'Cancelar',
      confirmText: 'Listo',
    );
    if (d != null) setState(() => _date = DateTime.utc(d.year, d.month, d.day));
  }

  Future<TimeOfDay?> _pickTime(TimeOfDay initial, String help) => showTimePicker(
        context: context,
        initialTime: initial,
        helpText: help,
        cancelText: 'Cancelar',
        confirmText: 'Listo',
      );

  Future<void> _pickType() async {
    final t = await showOptionsSheet<String>(context, title: 'Tipo de evento', selected: _type, options: [
      for (final t in eventTypes) SheetOption(t, t),
    ]);
    if (t != null) setState(() => _type = t);
  }

  Future<void> _pickRole(String title, void Function(MemberRef?) set) async {
    final m = await pickMember(context, ref, title: title);
    if (m == null) return;
    setState(() => set(m.id == 0 ? null : m));
  }

  Future<void> _save() async {
    setState(() => _tried = true);
    if (_title.text.trim().isEmpty) return;
    final start = _wall(_startTime);
    final end = _endTime == null ? null : _wall(_endTime!);
    if (end != null && end.isBefore(start)) {
      setState(() => _error = 'La hora de fin no puede ser anterior a la de inicio.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final data = <String, dynamic>{
      'title': _title.text.trim(),
      'event_type': _type,
      'start_date': PanamaTime.toIso(start),
      'end_date': end == null ? '' : PanamaTime.toIso(end),
      'location': _location.text.trim(),
      'description': _description.text.trim(),
      'preacher_id': _isCulto ? (_preacher?.id ?? '') : '',
      'worship_leader_id': _isCulto ? (_worship?.id ?? '') : '',
      'singer_id': _isCulto ? (_singer?.id ?? '') : '',
      if (!_editing) ...ref.read(churchQueryProvider),
    };
    try {
      final saved = await ref.read(repoProvider).saveEvent(widget.event?.id, data);
      ref.read(eventsVersionProvider.notifier).bump();
      showAppSnack(_editing ? 'Evento actualizado.' : 'Evento creado.');
      if (!mounted) return;
      if (_editing) {
        context.pop();
      } else {
        context.pushReplacement('/evento/${saved.id}', extra: 'Eventos');
      }
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _selector(String value, VoidCallback onTap, {IconData? icon, bool placeholder = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(border: Border.all(color: AppColors.divider), borderRadius: BorderRadius.circular(AppRadii.md)),
        child: Row(children: [
          if (icon != null) ...[Ic(icon, size: 20, color: AppColors.cyan), const SizedBox(width: 10)],
          Expanded(child: Text(value, overflow: TextOverflow.ellipsis, style: AppText.base(size: 17, color: placeholder ? AppColors.neutral500 : AppColors.text))),
          const Ic(PhosphorIconsDuotone.caretDown, size: 16, color: AppColors.neutral700),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final titleErr = _tried && _title.text.trim().isEmpty;
    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          BackHeader(label: _editing ? 'Evento' : 'Eventos'),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 2, 20, 24),
              children: [
                Text(_editing ? 'Editar evento' : 'Nuevo evento', style: AppText.title(30)),
                const SizedBox(height: 18),
                LabeledField(
                  label: 'Título *',
                  error: titleErr ? 'Escribe el título del evento.' : null,
                  child: AppTextField(controller: _title, hasError: titleErr, textCapitalization: TextCapitalization.sentences),
                ),
                const SizedBox(height: 14),
                LabeledField(label: 'Tipo', child: _selector(_type, _pickType, icon: null)),
                const SizedBox(height: 14),
                LabeledField(label: 'Fecha *', child: _selector(Fmt.longDate(_date), _pickDate, icon: PhosphorIconsDuotone.calendarBlank)),
                const SizedBox(height: 14),
                Row(children: [
                  Expanded(
                    child: LabeledField(
                      label: 'Hora de inicio *',
                      child: _selector(_timeLabel(_startTime), () async {
                        final t = await _pickTime(_startTime, 'Hora de inicio');
                        if (t != null) setState(() => _startTime = t);
                      }),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: LabeledField(
                      label: 'Hora de fin',
                      child: _selector(_endTime == null ? 'Opcional' : _timeLabel(_endTime!), () async {
                        final t = await _pickTime(_endTime ?? _startTime.replacing(hour: (_startTime.hour + 2) % 24), 'Hora de fin');
                        if (t != null) setState(() => _endTime = t);
                      }, placeholder: _endTime == null),
                    ),
                  ),
                ]),
                if (_endTime != null)
                  Align(
                    alignment: Alignment.centerRight,
                    child: LinkButton(label: 'Quitar hora de fin', fontSize: 15, height: 44, onPressed: () => setState(() => _endTime = null)),
                  ),
                const SizedBox(height: 14),
                LabeledField(label: 'Lugar', child: AppTextField(controller: _location, textCapitalization: TextCapitalization.sentences)),
                const SizedBox(height: 14),
                LabeledField(label: 'Descripción', child: AppTextField(controller: _description, maxLines: 3, textCapitalization: TextCapitalization.sentences)),
                if (_isCulto) ...[
                  const SizedBox(height: 26),
                  const Kicker('Roles del culto'),
                  const SizedBox(height: 10),
                  for (final (label, value, setter) in [
                    ('Predica', _preacher, (MemberRef? m) => _preacher = m),
                    ('Dirige adoración', _worship, (MemberRef? m) => _worship = m),
                    ('Canta', _singer, (MemberRef? m) => _singer = m),
                  ]) ...[
                    LabeledField(
                      label: label,
                      child: _selector(value?.fullName ?? 'Sin asignar', () => _pickRole(label, setter), icon: PhosphorIconsDuotone.user, placeholder: value == null),
                    ),
                    const SizedBox(height: 14),
                  ],
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700)),
                ],
              ],
            ),
          ),
          FooterBar(
            child: PrimaryButton(
              label: _saving ? 'Guardando…' : (_editing ? 'Guardar cambios' : 'Crear evento'),
              loading: _saving,
              onPressed: _save,
            ),
          ),
        ]),
      ),
    );
  }
}
