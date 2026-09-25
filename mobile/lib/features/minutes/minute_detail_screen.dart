import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launchers.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

final minuteProvider = FutureProvider.autoDispose.family<Minute, int>((ref, id) => ref.read(repoProvider).minute(id));

class MinuteDetailScreen extends ConsumerStatefulWidget {
  const MinuteDetailScreen({super.key, required this.minuteId});
  final int minuteId;
  @override
  ConsumerState<MinuteDetailScreen> createState() => _MinuteDetailScreenState();
}

class _MinuteDetailScreenState extends ConsumerState<MinuteDetailScreen> {
  /// Subida en curso: nombre del archivo y progreso 0..1.
  ({String name, double progress})? _upload;
  int? _downloading;

  Future<void> _download(Minute m, MinuteFile f) async {
    setState(() => _downloading = f.id);
    try {
      final path = await Launchers.download(ref.read(apiClientProvider), '/minutes/${m.id}/files/${f.id}/download', f.name);
      if (mounted) await Launchers.open(context, path);
    } catch (e) {
      showAppSnack(ApiException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _downloading = null);
    }
  }

  Future<void> _attach(Minute m) async {
    final source = await showOptionsSheet<String>(context, title: 'Adjuntar archivo', options: const [
      SheetOption('Tomar foto', 'camera', icon: PhosphorIconsDuotone.camera),
      SheetOption('Elegir de la galería', 'gallery', icon: PhosphorIconsDuotone.image),
      SheetOption('Elegir documento', 'document', icon: PhosphorIconsDuotone.file),
    ]);
    if (source == null) return;

    List<({String path, String name})> files = [];
    try {
      if (source == 'document') {
        const group = XTypeGroup(
          label: 'Documentos',
          extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
          mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png',
          ],
          uniformTypeIdentifiers: ['com.adobe.pdf', 'com.microsoft.word.doc', 'org.openxmlformats.wordprocessingml.document', 'public.image'],
        );
        final picked = await openFiles(acceptedTypeGroups: [group]);
        files = [for (final f in picked.take(5)) (path: f.path, name: f.name)];
      } else {
        // Compresión previa: 2000 px y calidad 80 bastan para leer un acta firmada.
        final img = await ImagePicker().pickImage(
          source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
          maxWidth: 2000,
          maxHeight: 2000,
          imageQuality: 80,
        );
        if (img != null) {
          final ext = img.name.contains('.') ? img.name.split('.').last : 'jpg';
          final name = 'Acta ${m.date != null ? Fmt.shortDate(m.date!) : m.id} - foto.$ext';
          files = [(path: img.path, name: name)];
        }
      }
    } catch (_) {
      showAppSnack('No pudimos abrir la cámara o los archivos. Revisa los permisos de la app.', error: true);
      return;
    }
    if (files.isEmpty) return;

    setState(() => _upload = (name: files.first.name, progress: 0));
    try {
      await ref.read(repoProvider).uploadMinuteFiles(m.id, files, (p) {
        if (mounted) setState(() => _upload = (name: files.first.name, progress: p));
      });
      ref.invalidate(minuteProvider(m.id));
      showAppSnack(files.length == 1 ? 'Archivo adjuntado.' : '${files.length} archivos adjuntados.');
    } catch (e) {
      showAppSnack(ApiException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _upload = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(permissionsProvider);
    final online = ref.watch(isOnlineProvider);
    final async = ref.watch(minuteProvider(widget.minuteId));

    return Scaffold(
      bottomNavigationBar: perms.can('minutes', 'edit') && async.hasValue
          ? FooterBar(
              child: SecondaryButton(
                label: 'Adjuntar archivo',
                icon: PhosphorIconsDuotone.paperclip,
                accent: true,
                expand: true,
                height: 52,
                onPressed: _upload == null && online ? () => _attach(async.value!) : null,
              ),
            )
          : null,
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Actas'),
          Expanded(
            child: async.when(
              skipLoadingOnRefresh: true,
              loading: () => const SkeletonList(avatar: false),
              error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(minuteProvider(widget.minuteId))),
              data: (m) => _content(m),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _content(Minute m) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      children: [
        Kicker('Acta${m.date != null ? ' · ${Fmt.shortDate(m.date!)}' : ''}'),
        const SizedBox(height: 6),
        Text(m.title, style: AppText.title(30)),
        if (m.createdBy != null) ...[
          const SizedBox(height: 6),
          Text('Redactó ${m.createdBy}', style: AppText.base(size: 15, color: AppColors.neutral800)),
        ],
        if (m.objective != null) ...[
          _section('Objetivo'),
          Text(m.objective!, style: AppText.base(size: 17, height: 1.5)),
        ],
        if (m.attendees.isNotEmpty) ...[
          _section('Asistentes', bottom: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final p in m.attendees)
              Container(
                height: 32,
                padding: const EdgeInsets.fromLTRB(4, 0, 10, 0),
                decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  InitialsAvatar(p.initials, size: 24, background: AppColors.neutral300),
                  const SizedBox(width: 6),
                  Text(p.fullName, style: AppText.base(size: 14)),
                ]),
              ),
          ]),
        ],
        if (m.motions.isNotEmpty) ...[
          _section('Motivos y acuerdos', bottom: 2),
          for (var i = 0; i < m.motions.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(
                  width: 22,
                  child: Text('${i + 1}', style: AppText.base(size: 20, weight: FontWeight.w600, height: 1.2, color: AppColors.neutral600)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.motions[i].title, style: AppText.base(size: 16, height: 1.4)),
                    if (m.motions[i].description != null)
                      Text(m.motions[i].description!, style: AppText.base(size: 14, color: AppColors.neutral700, height: 1.4)),
                  ]),
                ),
                const SizedBox(width: 12),
                switch (m.motions[i].result) {
                  'Aprobado' => const AppTag.accent('Aprobado', fontSize: 13),
                  'Rechazado' => const AppTag.magenta('Rechazado', fontSize: 13),
                  _ => const AppTag('Pendiente', fontSize: 13),
                },
              ]),
            ),
        ],
        _section('Archivos', bottom: 2),
        if (m.files.isEmpty && _upload == null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text('Sin archivos adjuntos.', style: AppText.base(size: 16, color: AppColors.neutral700)),
          ),
        for (final f in m.files)
          _FileRow(
            icon: f.isPdf ? PhosphorIconsDuotone.filePdf : f.isImage ? PhosphorIconsDuotone.image : PhosphorIconsDuotone.file,
            name: f.name,
            detail: Fmt.fileSize(f.size),
            trailing: _downloading == f.id
                ? const SizedBox(width: 48, child: Center(child: Spinner(color: AppColors.cyan700)))
                : SquareIconButton(icon: PhosphorIconsDuotone.downloadSimple, label: 'Descargar ${f.name}', onPressed: () => _download(m, f)),
          ),
        if (_upload != null)
          _FileRow(
            icon: PhosphorIconsDuotone.file,
            name: _upload!.name,
            progress: _upload!.progress,
          ),
      ],
    );
  }

  Widget _section(String title, {double bottom = 6}) => Padding(
        padding: EdgeInsets.only(top: 26, bottom: bottom),
        child: Kicker(title),
      );
}

class _FileRow extends StatelessWidget {
  const _FileRow({required this.icon, required this.name, this.detail, this.trailing, this.progress});
  final IconData icon;
  final String name;
  final String? detail;
  final Widget? trailing;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
      child: Row(children: [
        Ic(icon, size: 30, color: AppColors.cyan),
        const SizedBox(width: 12),
        Expanded(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name, style: AppText.base(size: 16, weight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
            if (progress != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(value: progress, minHeight: 4, backgroundColor: AppColors.neutral200, color: AppColors.cyan),
                ),
              )
            else if (detail != null && detail!.isNotEmpty)
              Text(detail!, style: AppText.rowSub),
          ]),
        ),
        ?trailing,
      ]),
    );
  }
}
