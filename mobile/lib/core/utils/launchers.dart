import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';

/// Acciones nativas: llamar, WhatsApp, abrir web, descargar/abrir/compartir.
class Launchers {
  Launchers._();

  static String _digits(String phone) => phone.replaceAll(RegExp(r'[^0-9+]'), '');

  static Future<bool> call(String phone) => launchUrl(Uri(scheme: 'tel', path: _digits(phone)));

  /// Abre WhatsApp. Los números de 7–8 dígitos se asumen de Panamá (+507).
  static Future<bool> whatsapp(String phone) {
    var d = _digits(phone).replaceAll('+', '');
    if (d.length <= 8) d = '507$d';
    return launchUrl(Uri.parse('https://wa.me/$d'), mode: LaunchMode.externalApplication);
  }

  static Future<bool> openUrl(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

  /// Descarga con autenticación a la carpeta temporal y devuelve la ruta.
  static Future<String> download(ApiClient api, String path, String fileName, {Map<String, dynamic>? query}) async {
    final dir = await getTemporaryDirectory();
    final safe = fileName.replaceAll(RegExp(r'[\\/:*?"<>|]'), '_');
    final file = File('${dir.path}/$safe');
    await api.download(path, file.path, query: query);
    return file.path;
  }

  /// Abre un archivo descargado:
  /// - PDF → vista previa nativa de impresión/compartir (`printing`, igual que SamsCuisine).
  /// - Imagen → visor a pantalla completa con zoom dentro de la app.
  /// - Otro tipo → hoja de compartir del sistema ("Abrir con…").
  static Future<void> open(BuildContext context, String filePath) async {
    final lower = filePath.toLowerCase();
    final name = filePath.split(RegExp(r'[\/]')).last;
    if (lower.endsWith('.pdf')) {
      final bytes = await File(filePath).readAsBytes();
      await Printing.layoutPdf(onLayout: (_) async => bytes, name: name);
    } else if (RegExp(r'\.(jpe?g|png|webp|heic|gif)$').hasMatch(lower)) {
      if (!context.mounted) return;
      await Navigator.of(context, rootNavigator: true).push(MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (ctx) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
            title: Text(name, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                tooltip: 'Compartir',
                icon: const Icon(Icons.ios_share),
                onPressed: () => share(filePath, title: name),
              ),
            ],
          ),
          body: InteractiveViewer(maxScale: 5, child: Center(child: Image.file(File(filePath)))),
        ),
      ));
    } else {
      await share(filePath, title: name);
    }
  }

  static Future<void> share(String filePath, {String? title}) =>
      SharePlus.instance.share(ShareParams(files: [XFile(filePath)], title: title));
}
