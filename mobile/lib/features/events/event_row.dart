import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../widgets/widgets.dart';

/// Fila de evento: día de la semana 13 + número 24 | título 17/600 | punto + "hora · tipo".
class EventRow extends StatelessWidget {
  const EventRow({super.key, required this.event, required this.onTap, this.colorBar = false});
  final ChurchEvent event;
  final VoidCallback onTap;

  /// Variante del calendario mensual: barra de color de 4 pt a la izquierda.
  final bool colorBar;

  @override
  Widget build(BuildContext context) {
    final style = EventTypeStyle.of(event.eventType);
    final isToday = PanamaTime.sameDay(event.start, PanamaTime.now());
    final meta = [Fmt.time(event.start), ?event.eventType].join(' · ');
    return InkWell(
      onTap: onTap,
      highlightColor: AppColors.neutral200,
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (colorBar)
                Container(width: 4, decoration: BoxDecoration(color: style.dot, borderRadius: BorderRadius.circular(AppRadii.sm)))
              else
                SizedBox(
                  width: 48,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(isToday ? 'HOY' : Fmt.dowShort(event.start),
                          style: AppText.base(size: 13, letterSpacing: 0.8, color: isToday ? AppColors.cyan700 : AppColors.neutral700)),
                      Text('${event.start.day}', style: AppText.base(size: 24, weight: FontWeight.w600, height: 1)),
                    ],
                  ),
                ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(event.title, style: AppText.rowName, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Row(children: [
                      if (!colorBar) ...[Dot(style.dot), const SizedBox(width: 6)],
                      Expanded(child: Text(meta, style: AppText.rowSub, overflow: TextOverflow.ellipsis)),
                    ]),
                  ],
                ),
              ),
              const Center(child: Ic(PhosphorIconsDuotone.caretRight, size: 18, color: AppColors.neutral600)),
            ],
          ),
        ),
      ),
    );
  }
}
