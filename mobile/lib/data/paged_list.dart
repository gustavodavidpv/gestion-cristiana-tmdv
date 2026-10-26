import 'package:flutter/foundation.dart';

import 'models.dart';

/// Lista con scroll infinito sobre el contrato `page/limit/pagination`.
/// Descarta respuestas obsoletas cuando cambian los filtros a mitad de carga.
class PagedList<T> extends ChangeNotifier {
  PagedList(this._fetch);

  final Future<Paged<T>> Function(int page) _fetch;

  final List<T> items = [];
  int total = 0;
  int _page = 0;
  int _pages = 1;
  bool loading = false;
  Object? error;
  int _generation = 0;
  bool _disposed = false;

  bool get hasMore => _page < _pages;
  bool get initialLoading => loading && items.isEmpty;

  Future<void> refresh() async {
    _generation++;
    items.clear();
    _page = 0;
    _pages = 1;
    error = null;
    loading = false;
    await loadMore();
  }

  Future<void> loadMore() async {
    if (loading || !hasMore) return;
    final gen = _generation;
    loading = true;
    error = null;
    _notify();
    try {
      final res = await _fetch(_page + 1);
      if (gen != _generation) return;
      items.addAll(res.items);
      total = res.total;
      _page = res.page;
      _pages = res.pages == 0 ? res.page : res.pages;
    } catch (e) {
      if (gen != _generation) return;
      error = e;
    } finally {
      if (gen == _generation) {
        loading = false;
        _notify();
      }
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
