import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/api/api_exception.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import 'basics.dart';
import 'controls.dart';

/// Patrón de estado global: icono duotone 64 neutral-500, título 26/600,
/// cuerpo 17 neutral-800, botón primario a todo el ancho; alineado a la izquierda.
class StateView extends StatelessWidget {
  const StateView({
    super.key,
    required this.icon,
    required this.title,
    this.body,
    this.buttonLabel,
    this.onPressed,
    this.leading,
    this.iconColor = AppColors.neutral500,
  });
  final IconData icon;
  final String title;
  final String? body;
  final String? buttonLabel;
  final VoidCallback? onPressed;
  final Widget? leading;
  final Color iconColor;

  factory StateView.fromError(Object error, {VoidCallback? onRetry}) {
    final e = ApiException.from(error);
    if (e.isNetwork) {
      return StateView(
        icon: PhosphorIconsDuotone.wifiSlash,
        title: 'No pudimos conectar.',
        body: 'Revisa tu conexión.',
        buttonLabel: onRetry != null ? 'Reintentar' : null,
        onPressed: onRetry,
      );
    }
    if (e.kind == ApiErrorKind.forbidden) {
      return const StateView(
        icon: PhosphorIconsDuotone.lockSimple,
        title: 'No tienes acceso a este módulo',
        body: 'Pide a tu administrador que lo habilite.',
      );
    }
    if (e.kind == ApiErrorKind.server) {
      return StateView(
        icon: PhosphorIconsDuotone.cloudSlash,
        title: 'Algo salió mal de nuestro lado.',
        body: 'Intenta de nuevo en un momento.',
        buttonLabel: onRetry != null ? 'Reintentar' : null,
        onPressed: onRetry,
      );
    }
    return StateView(
      icon: PhosphorIconsDuotone.warningCircle,
      title: e.message,
      buttonLabel: onRetry != null ? 'Reintentar' : null,
      onPressed: onRetry,
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: c.maxHeight.isFinite ? c.maxHeight : 0),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(28, 24, 28, 80),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (leading != null) ...[leading!, const SizedBox(height: 12)],
                Ic(icon, size: 64, color: iconColor),
                const SizedBox(height: 12),
                Text(title, style: AppText.base(size: 26, weight: FontWeight.w600, height: 1.15)),
                if (body != null) ...[
                  const SizedBox(height: 12),
                  Text(body!, style: AppText.base(size: 17, height: 1.45, color: AppColors.neutral800)),
                ],
                if (buttonLabel != null) ...[
                  const SizedBox(height: 24),
                  PrimaryButton(label: buttonLabel!, onPressed: onPressed),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bloque con pulso de opacidad 1 → 0.45 en 1.2 s.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 600))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: Tween<double>(begin: 1, end: 0.45).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)), child: widget.child);
}

Widget _bar(double w, double h, {double radius = AppRadii.sm}) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(color: AppColors.neutral200, borderRadius: BorderRadius.circular(radius)),
    );

/// Esqueleto de lista: filas de 72 pt con avatar 40 y dos barras.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.rows = 7, this.avatar = true, this.padding = const EdgeInsets.symmetric(horizontal: 20)});
  final int rows;
  final bool avatar;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) {
    const widths = [0.62, 0.48, 0.7, 0.55, 0.66, 0.44, 0.58, 0.5, 0.64];
    return _Pulse(
      child: LayoutBuilder(builder: (context, c) {
        final w = c.maxWidth - padding.horizontal - (avatar ? 54 : 0);
        return Padding(
          padding: padding,
          child: Column(
            children: [
              for (var i = 0; i < rows; i++)
                SizedBox(
                  height: 72,
                  child: Row(children: [
                    if (avatar) ...[
                      Container(width: 40, height: 40, decoration: const BoxDecoration(color: AppColors.neutral200, shape: BoxShape.circle)),
                      const SizedBox(width: 14),
                    ],
                    Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _bar(w * widths[i % widths.length], 14),
                        const SizedBox(height: 8),
                        _bar(w * widths[(i + 3) % widths.length] * 0.7, 11),
                      ],
                    ),
                  ]),
                ),
            ],
          ),
        );
      }),
    );
  }
}

/// Bloque de esqueleto genérico (cifras del dashboard, detalle).
class SkeletonBlock extends StatelessWidget {
  const SkeletonBlock({super.key, required this.width, required this.height});
  final double width;
  final double height;
  @override
  Widget build(BuildContext context) => _Pulse(child: _bar(width, height, radius: AppRadii.md));
}

/// "Cargando más…" al final de una lista paginada.
class LoadingMore extends StatelessWidget {
  const LoadingMore({super.key, this.label = 'Cargando más…'});
  final String label;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 64,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spinner(size: 18, color: AppColors.neutral700),
          const SizedBox(width: 8),
          Text(label, style: AppText.base(size: 14, color: AppColors.neutral700)),
        ],
      ),
    );
  }
}

/// Vacío en línea (dentro de una lista): icono 56, título y acción opcional.
class InlineEmpty extends StatelessWidget {
  const InlineEmpty({super.key, required this.title, this.body, this.icon, this.actionLabel, this.onAction});
  final String title;
  final String? body;
  final IconData? icon;
  final String? actionLabel;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[Ic(icon!, size: 56, color: AppColors.neutral500), const SizedBox(height: 10)],
          Text(title, style: AppText.base(size: 21, weight: FontWeight.w600, height: 1.2)),
          if (body != null) ...[
            const SizedBox(height: 8),
            Text(body!, style: AppText.base(size: 16, color: AppColors.neutral800)),
          ],
          if (actionLabel != null) ...[
            const SizedBox(height: 14),
            SecondaryButton(label: actionLabel!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}
