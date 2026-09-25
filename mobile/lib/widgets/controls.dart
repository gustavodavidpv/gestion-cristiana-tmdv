import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import 'basics.dart';

/// Spinner pequeño que gira (equivalente a `ph-circle-notch` animado).
class Spinner extends StatelessWidget {
  const Spinner({super.key, this.size = 20, this.color = AppColors.bg});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: CircularProgressIndicator(strokeWidth: 2, color: color),
      );
}

/// Botón primario: relleno cian-700, texto papel, 52 pt; deshabilitado al 45%.
class PrimaryButton extends StatefulWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.height = 52,
    this.color = AppColors.cyan700,
    this.fontSize = 17,
    this.expand = true,
  });

  /// Variante destructiva (magenta-700).
  const PrimaryButton.danger({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.height = 48,
    this.fontSize = 16,
    this.expand = true,
  }) : color = AppColors.magenta700;

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool loading;
  final double height;
  final Color color;
  final double fontSize;
  final bool expand;

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.loading;
    final bg = _pressed && widget.color == AppColors.cyan700 ? AppColors.cyan900 : widget.color;
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      excludeSemantics: true,
      child: Opacity(
        opacity: widget.onPressed == null && !widget.loading ? 0.45 : 1,
        child: GestureDetector(
          onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
          onTapCancel: () => setState(() => _pressed = false),
          onTapUp: (_) => setState(() => _pressed = false),
          onTap: enabled ? widget.onPressed : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 90),
            height: widget.height,
            width: widget.expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(AppRadii.md)),
            child: Row(
              mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (widget.loading) ...[const Spinner(), const SizedBox(width: 10)],
                if (!widget.loading && widget.icon != null) ...[
                  Ic(widget.icon!, size: 22, color: AppColors.bg),
                  const SizedBox(width: 10),
                ],
                Flexible(
                  child: Text(
                    widget.label,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.base(size: widget.fontSize, weight: FontWeight.w600, color: AppColors.bg),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón secundario: contorno divisor, texto tinta.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = 48,
    this.accent = false,
    this.expand = false,
  });
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;

  /// Contorno y texto cian-700 (p. ej. "Adjuntar archivo").
  final bool accent;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final fg = accent ? AppColors.cyan700 : AppColors.text;
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(AppRadii.md),
          highlightColor: accent ? AppColors.cyan100 : AppColors.neutral200,
          child: Container(
            height: height,
            width: expand ? double.infinity : null,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: Border.all(color: accent ? AppColors.cyan700 : AppColors.divider),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Row(
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[Ic(icon!, size: 20, color: accent ? AppColors.cyan700 : AppColors.cyan), const SizedBox(width: 8)],
                Text(label, style: AppText.base(size: accent ? 17 : 16, weight: accent ? FontWeight.w600 : FontWeight.w400, color: fg)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Enlace de texto cian 48 pt ("¿Olvidaste tu contraseña?", "Limpiar filtros").
class LinkButton extends StatelessWidget {
  const LinkButton({super.key, required this.label, required this.onPressed, this.icon, this.height = 48, this.fontSize = 17, this.color = AppColors.cyan700});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;
  final double fontSize;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onPressed,
      child: SizedBox(
        height: height,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[Ic(icon!, size: 20, color: color), const SizedBox(width: 8)],
            Text(label, style: AppText.base(size: fontSize, color: color)),
          ],
        ),
      ),
    );
  }
}

/// FAB 56×56 a 16 pt de los bordes.
class AppFab extends StatelessWidget {
  const AppFab({super.key, required this.onPressed, required this.label, this.icon = PhosphorIconsDuotone.plus});
  final VoidCallback onPressed;
  final String label;
  final IconData icon;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onPressed,
        child: Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.cyan700,
            borderRadius: BorderRadius.circular(AppRadii.lg),
            boxShadow: AppShadows.md,
          ),
          child: Center(child: Ic(icon, size: 28, color: AppColors.bg)),
        ),
      ),
    );
  }
}

/// Chip de filtro 40 pt; activo = fondo cian-100, texto cian-800, borde cian.
class AppChip extends StatelessWidget {
  const AppChip({super.key, required this.label, required this.selected, required this.onTap, this.caret = false, this.dot, this.icon});
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool caret;
  final Color? dot;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final fg = selected ? AppColors.cyan800 : AppColors.text;
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: selected ? AppColors.cyan100 : AppColors.bg,
            border: Border.all(color: selected ? AppColors.cyan : AppColors.divider),
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (dot != null) ...[Dot(dot!), const SizedBox(width: 8)],
              if (icon != null) ...[Ic(icon!, size: 18, color: selected ? AppColors.magenta800 : AppColors.text), const SizedBox(width: 6)],
              Text(label, style: AppText.base(size: 15, color: fg)),
              if (caret) ...[const SizedBox(width: 6), Ic(PhosphorIconsDuotone.caretDown, size: 14, color: fg)],
            ],
          ),
        ),
      ),
    );
  }
}

/// Fila horizontal de chips sin salto de línea, que sangra hasta los bordes.
class ChipScroller extends StatelessWidget {
  const ChipScroller({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.gutter),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (_, i) => children[i],
      ),
    );
  }
}

/// Control segmentado (44 pt; activo relleno cian-700, texto blanco).
class Segmented extends StatelessWidget {
  const Segmented({super.key, required this.options, required this.index, required this.onChanged, this.height = 44});
  final List<String> options;
  final int index;
  final ValueChanged<int> onChanged;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.divider),
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          for (var i = 0; i < options.length; i++)
            Expanded(
              child: Semantics(
                button: true,
                selected: i == index,
                child: GestureDetector(
                  onTap: () => onChanged(i),
                  child: Container(
                    height: height,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: i == index ? AppColors.cyan700 : AppColors.bg,
                      border: i > 0 ? const Border(left: BorderSide(color: AppColors.divider)) : null,
                    ),
                    child: Text(
                      options[i],
                      overflow: TextOverflow.ellipsis,
                      style: AppText.base(size: 16, color: i == index ? AppColors.bg : AppColors.text),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Selector ‹ valor › (año, mes, semana). Flechas al 30% en los límites.
class Stepper3 extends StatelessWidget {
  const Stepper3({
    super.key,
    required this.label,
    required this.onPrev,
    required this.onNext,
    this.labelStyle,
    this.prevLabel = 'Anterior',
    this.nextLabel = 'Siguiente',
    this.arrowsRight = false,
    this.iconSize = 20,
  });
  final String label;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final TextStyle? labelStyle;
  final String prevLabel;
  final String nextLabel;

  /// true: "Etiqueta   ‹ ›" (fecha a la izquierda, flechas a la derecha).
  final bool arrowsRight;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final prev = SquareIconButton(icon: PhosphorIconsDuotone.caretLeft, size: iconSize, label: prevLabel, onPressed: onPrev, width: arrowsRight ? 44 : 48);
    final next = SquareIconButton(icon: PhosphorIconsDuotone.caretRight, size: iconSize, label: nextLabel, onPressed: onNext, width: arrowsRight ? 44 : 48);
    final text = Text(label, style: labelStyle ?? AppText.base(size: 18, weight: FontWeight.w600));
    if (arrowsRight) {
      return Row(children: [Expanded(child: text), prev, next]);
    }
    return Row(mainAxisSize: MainAxisSize.min, children: [prev, text, next]);
  }
}

/// Campo de búsqueda 48 pt con lupa y ✕ para limpiar (con debounce opcional).
class SearchField extends StatefulWidget {
  const SearchField({super.key, required this.hint, required this.onChanged, this.debounce = const Duration(milliseconds: 350), this.initial = ''});
  final String hint;
  final ValueChanged<String> onChanged;
  final Duration debounce;
  final String initial;

  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  late final _ctrl = TextEditingController(text: widget.initial);
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  void _changed(String v) {
    setState(() {});
    _timer?.cancel();
    if (widget.debounce == Duration.zero) {
      widget.onChanged(v.trim());
    } else {
      _timer = Timer(widget.debounce, () => widget.onChanged(v.trim()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: _ctrl,
      onChanged: _changed,
      textInputAction: TextInputAction.search,
      style: AppText.base(size: 17),
      decoration: InputDecoration(
        hintText: widget.hint,
        contentPadding: const EdgeInsets.symmetric(vertical: 13),
        prefixIcon: const Padding(
          padding: EdgeInsets.only(left: 14, right: 10),
          child: Ic(PhosphorIconsDuotone.magnifyingGlass, size: 20, color: AppColors.neutral700),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 44, minHeight: 48),
        suffixIcon: _ctrl.text.isEmpty
            ? null
            : SquareIconButton(
                icon: PhosphorIconsDuotone.xCircle,
                size: 22,
                color: AppColors.neutral700,
                label: 'Limpiar búsqueda',
                onPressed: () {
                  _ctrl.clear();
                  _changed('');
                },
              ),
      ),
    );
  }
}

/// Etiqueta + campo (patrón `.field` de Broadsheet).
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child, this.error});
  final String label;
  final Widget child;
  final String? error;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(label, style: AppText.base(size: 15, color: AppColors.neutral800)),
        ),
        child,
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(children: [
              const Ic(PhosphorIconsDuotone.warningCircle, size: 18, color: AppColors.magenta700),
              const SizedBox(width: 6),
              Expanded(child: Text(error!, style: AppText.base(size: 14, color: AppColors.magenta700))),
            ]),
          ),
      ],
    );
  }
}

/// Campo de texto con el estilo de la app.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.controller,
    this.hint,
    this.keyboardType,
    this.textInputAction,
    this.obscure = false,
    this.suffix,
    this.hasError = false,
    this.maxLines = 1,
    this.autofillHints,
    this.onSubmitted,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.onChanged,
  });
  final TextEditingController controller;
  final String? hint;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscure;
  final Widget? suffix;
  final bool hasError;
  final int maxLines;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onSubmitted;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final errorBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadii.md),
      borderSide: const BorderSide(color: AppColors.magenta700, width: 1.5),
    );
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      obscureText: obscure,
      maxLines: obscure ? 1 : maxLines,
      autofillHints: autofillHints,
      onSubmitted: onSubmitted,
      onChanged: onChanged,
      inputFormatters: inputFormatters,
      textCapitalization: textCapitalization,
      style: AppText.base(size: 17),
      decoration: InputDecoration(
        hintText: hint,
        suffixIcon: suffix,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        enabledBorder: hasError ? errorBorder : null,
        focusedBorder: hasError ? errorBorder : null,
      ),
    );
  }
}
