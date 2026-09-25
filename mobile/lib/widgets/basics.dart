import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';

/// Icono Phosphor (duotone por defecto, con la capa secundaria al 20%).
class Ic extends StatelessWidget {
  const Ic(this.icon, {super.key, this.size = 24, this.color, this.semanticLabel});
  final IconData icon;
  final double size;
  final Color? color;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) =>
      PhosphorIcon(icon, size: size, color: color ?? IconTheme.of(context).color, semanticLabel: semanticLabel);
}

/// Kicker / eyebrow: 12, 600, MAYÚSCULAS, tracking 0.08em.
class Kicker extends StatelessWidget {
  const Kicker(this.text, {super.key, this.color = AppColors.neutral700});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Text(text.toUpperCase(), style: AppText.kicker(color));
}

/// Encabezado de pantalla raíz: kicker + H1 (+ acción opcional a la derecha).
class ScreenHeader extends StatelessWidget {
  const ScreenHeader({super.key, this.kicker, required this.title, this.trailing, this.titleSize = 34, this.bottomGap = 14});
  final String? kicker;
  final String title;
  final Widget? trailing;
  final double titleSize;
  final double bottomGap;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (kicker != null) Kicker(kicker!),
              Padding(
                padding: EdgeInsets.only(top: kicker != null ? 6 : 0, bottom: bottomGap),
                child: Text(title, style: AppText.title(titleSize)),
              ),
            ],
          ),
        ),
        ?trailing,
      ],
    );
  }
}

/// Barra superior de pantallas hijas: "‹ Anterior" en cian 17 pt, alto 48; acción opcional.
class BackHeader extends StatelessWidget {
  const BackHeader({super.key, required this.label, this.trailing, this.onBack});
  final String label;
  final Widget? trailing;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Row(
        children: [
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: 'Volver a $label',
            child: InkWell(
              onTap: onBack ?? () => Navigator.of(context).maybePop(),
              child: SizedBox(
                height: 48,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Ic(PhosphorIconsDuotone.caretLeft, size: 24, color: AppColors.cyan700),
                    const SizedBox(width: 2),
                    Text(label, style: AppText.base(size: 17, color: AppColors.cyan700)),
                    const SizedBox(width: 8),
                  ],
                ),
              ),
            ),
          ),
          const Spacer(),
          ?trailing,
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}

/// Botón ⋮ de 48×48.
class MoreButton extends StatelessWidget {
  const MoreButton({super.key, required this.onPressed});
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => SquareIconButton(
        icon: PhosphorIconsDuotone.dotsThreeVertical,
        size: 26,
        color: AppColors.text,
        label: 'Más opciones',
        onPressed: onPressed,
      );
}

/// Botón de icono con área táctil mínima 44–48 pt.
class SquareIconButton extends StatelessWidget {
  const SquareIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.label,
    this.size = 24,
    this.color = AppColors.cyan700,
    this.width = 48,
    this.height = 48,
    this.opacity = 1,
  });
  final IconData icon;
  final VoidCallback? onPressed;
  final String label;
  final double size;
  final Color color;
  final double width;
  final double height;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Opacity(
        opacity: onPressed == null ? 0.3 : opacity,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: SizedBox(width: width, height: height, child: Center(child: Ic(icon, size: size, color: color))),
        ),
      ),
    );
  }
}

/// Línea separadora entre filas (texto al 8%).
class RowLine extends StatelessWidget {
  const RowLine({super.key});
  @override
  Widget build(BuildContext context) => const Divider(height: 1, thickness: 1, color: AppColors.rowLine);
}

/// Regla editorial de periódico (3 pt + 1 pt).
class Masthead extends StatelessWidget {
  const Masthead({super.key, required this.left, required this.right});
  final String left;
  final Widget right;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(height: 3, color: AppColors.text),
        const SizedBox(height: 3),
        Container(height: 1, color: AppColors.text),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            children: [
              Expanded(child: Text(left, style: AppText.base(size: 13, color: AppColors.neutral800))),
              DefaultTextStyle(style: AppText.base(size: 13, color: AppColors.neutral800), child: right),
            ],
          ),
        ),
        Container(height: 1, color: AppColors.text),
      ],
    );
  }
}

/// Avatar circular con iniciales.
class InitialsAvatar extends StatelessWidget {
  const InitialsAvatar(this.initials, {super.key, this.size = 40, this.background = AppColors.neutral200});
  final String initials;
  final double size;
  final Color background;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: background, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: AppText.base(size: size * 0.375, weight: FontWeight.w600, color: AppColors.neutral900),
      ),
    );
  }
}

/// Fila clave/valor con regla inferior al 8%.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow(this.k, this.v, {super.key, this.vertical = 10});
  final String k;
  final String v;
  final double vertical;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(vertical: vertical),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(k, style: AppText.base(size: 16, color: AppColors.neutral800)),
          const SizedBox(width: 16),
          Expanded(
            child: Text(v, textAlign: TextAlign.right, style: AppText.base(size: 16, weight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

/// Tag pequeño (tipo, cargo, estado).
class AppTag extends StatelessWidget {
  const AppTag(this.text, {super.key, this.bg = AppColors.neutral200, this.fg = AppColors.neutral800, this.fontSize = 14});
  const AppTag.accent(this.text, {super.key, this.fontSize = 14})
      : bg = AppColors.cyan100,
        fg = AppColors.cyan800;
  const AppTag.magenta(this.text, {super.key, this.fontSize = 14})
      : bg = AppColors.magenta100,
        fg = AppColors.magenta800;
  final String text;
  final Color bg;
  final Color fg;
  final double fontSize;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadii.md)),
      child: Text(text, style: AppText.base(size: fontSize, color: fg, height: 1.2)),
    );
  }
}

/// Punto de color de 8 pt (tipo de evento).
class Dot extends StatelessWidget {
  const Dot(this.color, {super.key, this.size = 8});
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) =>
      Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

/// Cifra grande con efecto de planchas CMYK (versión simplificada para móvil:
/// cifra en tinta con dos sombras de color desplazadas).
class CmykNumber extends StatelessWidget {
  const CmykNumber(this.value, {super.key, this.size = 56});
  final String value;
  final double size;
  @override
  Widget build(BuildContext context) {
    final style = AppText.base(size: size, weight: FontWeight.w600, height: 1, letterSpacing: -0.03 * size);
    return Semantics(
      label: value,
      excludeSemantics: true,
      child: Stack(
        children: [
          Transform.translate(
            offset: const Offset(1.5, 1),
            child: Text(value, style: style.copyWith(color: AppColors.cyan.withValues(alpha: 0.55))),
          ),
          Transform.translate(
            offset: const Offset(-1, 1.5),
            child: Text(value, style: style.copyWith(color: AppColors.magenta.withValues(alpha: 0.45))),
          ),
          Transform.translate(
            offset: const Offset(0.5, -1),
            child: Text(value, style: style.copyWith(color: AppColors.processYellow.withValues(alpha: 0.45))),
          ),
          Text(value, style: style),
        ],
      ),
    );
  }
}

/// Pie fijo con sombra superior suave (CTA de pantallas de detalle).
class FooterBar extends StatelessWidget {
  const FooterBar({super.key, required this.child, this.color = AppColors.bg, this.shadow = true});
  final Widget child;
  final Color color;
  final bool shadow;
  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: color, boxShadow: shadow ? AppShadows.footer : null),
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
      child: SafeArea(top: false, child: child),
    );
  }
}
