import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import 'basics.dart';
import 'controls.dart';

/// Clave global para mostrar snackbars incluso después de cerrar una pantalla.
final scaffoldMessengerKey = GlobalKey<ScaffoldMessengerState>();

/// Snackbar: 12 pt de los lados, fondo superficie, radio 4, sombra lg,
/// icono check-circle cian, acción opcional. Dura 4 s.
void showAppSnack(String text, {String? actionLabel, VoidCallback? onAction, bool error = false}) {
  final messenger = scaffoldMessengerKey.currentState;
  if (messenger == null) return;
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(SnackBar(
    behavior: SnackBarBehavior.floating,
    margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
    padding: EdgeInsets.zero,
    elevation: 0,
    backgroundColor: Colors.transparent,
    duration: const Duration(seconds: 4),
    content: Container(
      constraints: const BoxConstraints(minHeight: 52),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        boxShadow: AppShadows.lg,
      ),
      child: Row(
        children: [
          Ic(error ? PhosphorIconsDuotone.warningCircle : PhosphorIconsDuotone.checkCircle,
              size: 22, color: error ? AppColors.magenta700 : AppColors.cyan),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: AppText.base(size: 15, height: 1.35))),
          if (actionLabel != null)
            TextButton(
              onPressed: () {
                messenger.hideCurrentSnackBar();
                onAction?.call();
              },
              style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
              child: Text(actionLabel, style: AppText.base(size: 15, weight: FontWeight.w600, color: AppColors.cyan700)),
            ),
        ],
      ),
    ),
  ));
}

/// Hoja inferior: fondo papel, radio superior 4, asa 40×4, velo neutral-900 al 50%.
Future<T?> showAppSheet<T>(BuildContext context, {required WidgetBuilder builder}) {
  return showModalBottomSheet<T>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: AppColors.bg,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.5),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.lg))),
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(color: AppColors.neutral300, borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Flexible(child: builder(ctx)),
            ],
          ),
        ),
      ),
    ),
  );
}

class SheetOption<T> {
  final String label;
  final T value;
  final IconData? icon;
  final bool danger;
  const SheetOption(this.label, this.value, {this.icon, this.danger = false});
}

/// Hoja de opciones de 56 pt con check en la seleccionada.
Future<T?> showOptionsSheet<T>(BuildContext context, {String? title, required List<SheetOption<T>> options, T? selected}) {
  return showAppSheet<T>(context, builder: (ctx) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(title, style: AppText.base(size: 20, weight: FontWeight.w600)),
            ),
          for (final o in options)
            InkWell(
              onTap: () => Navigator.of(ctx).pop(o.value),
              highlightColor: AppColors.neutral200,
              child: SizedBox(
                height: 56,
                child: Row(children: [
                  if (o.icon != null) ...[
                    Ic(o.icon!, size: 24, color: o.danger ? AppColors.magenta700 : AppColors.text),
                    const SizedBox(width: 14),
                  ],
                  Expanded(
                    child: Text(o.label, style: AppText.base(size: 17, color: o.danger ? AppColors.magenta700 : AppColors.text)),
                  ),
                  if (selected != null && selected == o.value)
                    const Ic(PhosphorIconsBold.check, size: 18, color: AppColors.cyan700),
                ]),
              ),
            ),
        ],
      ),
    );
  });
}

/// Diálogo de confirmación. Si [danger], la acción va en magenta-700 relleno.
Future<bool> showConfirmDialog(BuildContext context, {required String title, required String body, required String action, bool danger = true}) async {
  final ok = await showDialog<bool>(
    context: context,
    useRootNavigator: true,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.5),
    builder: (ctx) => Dialog(
      backgroundColor: AppColors.bg,
      insetPadding: const EdgeInsets.all(24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.lg)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: AppText.base(size: 22, weight: FontWeight.w600, height: 1.2)),
            const SizedBox(height: 10),
            Text(body, style: AppText.base(size: 16, height: 1.45, color: AppColors.neutral800)),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: SecondaryButton(label: 'Cancelar', expand: true, onPressed: () => Navigator.of(ctx).pop(false))),
              const SizedBox(width: 10),
              Expanded(
                child: danger
                    ? PrimaryButton.danger(label: action, onPressed: () => Navigator.of(ctx).pop(true))
                    : PrimaryButton(label: action, height: 48, fontSize: 16, onPressed: () => Navigator.of(ctx).pop(true)),
              ),
            ]),
          ],
        ),
      ),
    ),
  );
  return ok ?? false;
}
