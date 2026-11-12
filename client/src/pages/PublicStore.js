/**
 * PublicStore.js - Página pública de la tiendita del Club Bíblico
 *
 * Ruta: /tienda/:code (sin iniciar sesión). Es el enlace que los maestros
 * comparten por WhatsApp para que los muchachos vean:
 *  - Los premios con foto, costo en puntos y si quedan disponibles
 *  - La tabla de posiciones de cada salón (nombres abreviados)
 *
 * No usa el cliente `api` con token: un visitante no tiene sesión y un token
 * vencido no debe mandarlo al login.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Container, Typography, Grid, Paper, Chip, Tabs, Tab, CircularProgress,
  Avatar, Dialog, DialogContent, IconButton, Alert,
} from '@mui/material';
import {
  Storefront as StorefrontIcon, EmojiEvents as EmojiEventsIcon, Close as CloseIcon,
  Redeem as RedeemIcon,
} from '@mui/icons-material';
import { ItemPhoto } from '../components/bibleClub/StoreDialog';

const API = process.env.REACT_APP_API_URL || '/api';

/** Las URLs del servidor empiezan con /api o /uploads; si la API vive en otro dominio se antepone */
const assetUrl = (url) => {
  if (!url) return null;
  if (!/^https?:/i.test(API)) return url;
  return API.replace(/\/api\/?$/, '') + url;
};

const PODIUM = ['#F9A825', '#90A4AE', '#A1887F'];

/** "2026-11-07" → "07/11" sin que el timezone corra el día */
const shortDate = (d) => {
  if (!d) return '';
  const [, m, day] = String(d).split('T')[0].split('-');
  return `${day}/${m}`;
};

const PublicStore = () => {
  const { code } = useParams();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [tab, setTab] = useState(0);
  const [groupId, setGroupId] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/public/store/${encodeURIComponent(code)}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.message || 'No se pudo cargar la tiendita.');
        return body;
      })
      .then((data) => {
        if (!alive) return;
        setState({ loading: false, error: null, data });
        if (data.groups?.length) setGroupId(data.groups[0].id);
        document.title = data.store.title;
      })
      .catch((err) => alive && setState({ loading: false, error: err.message, data: null }));
    return () => { alive = false; };
  }, [code]);

  const group = useMemo(
    () => state.data?.groups?.find((g) => g.id === groupId) || null,
    [state.data, groupId],
  );

  if (state.loading) {
    return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (state.error) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <StorefrontIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h6" sx={{ mt: 1 }}>{state.error}</Typography>
        <Typography color="text.secondary">Pide el enlace actualizado a tu maestro.</Typography>
      </Container>
    );
  }

  const { store, items, groups } = state.data;
  const hasStandings = groups.length > 0;
  const showingItems = !hasStandings || tab === 0;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FFFBF2', pb: 'calc(32px + env(safe-area-inset-bottom))' }}>
      {/* ===== ENCABEZADO ===== */}
      <Box sx={{
        background: 'linear-gradient(135deg, #F57C00 0%, #FFB300 100%)', color: '#fff',
        pt: 'calc(24px + env(safe-area-inset-top))', pb: hasStandings ? 6 : 4, px: 2,
      }}>
        <Container maxWidth="md" disableGutters sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={assetUrl(store.logo_url) || undefined}
            sx={{ width: 56, height: 56, bgcolor: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.7)' }}>
            <StorefrontIcon />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.15 }}>{store.title}</Typography>
            {store.church_name && <Typography variant="body2" sx={{ opacity: 0.9 }}>{store.church_name}</Typography>}
          </Box>
        </Container>
        {store.message && (
          <Container maxWidth="md" disableGutters>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.18)', fontWeight: 600 }}>
              📣 {store.message}
            </Box>
          </Container>
        )}
      </Box>

      <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 3 } }}>
        {hasStandings && (
          <Paper elevation={2} sx={{ mt: -3.5, mb: 2, borderRadius: 3, position: 'relative' }}>
            <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="fullWidth"
              TabIndicatorProps={{ sx: { bgcolor: '#F57C00', height: 3 } }}
              sx={{ '& .Mui-selected': { color: '#E65100 !important' } }}>
              <Tab icon={<RedeemIcon />} iconPosition="start" label="Premios" sx={{ fontWeight: 700, minHeight: 56 }} />
              <Tab icon={<EmojiEventsIcon />} iconPosition="start" label="Posiciones" sx={{ fontWeight: 700, minHeight: 56 }} />
            </Tabs>
          </Paper>
        )}

        {!store.is_open ? (
          <Alert severity="info" sx={{ mt: 3 }}>La tiendita está cerrada por ahora. ¡Sigue juntando puntos!</Alert>
        ) : showingItems ? (
          /* ===== PREMIOS ===== */
          items.length === 0 ? (
            <Alert severity="info" sx={{ mt: 3 }}>Pronto habrá premios aquí. ¡Sigue juntando puntos!</Alert>
          ) : (
            <Grid container spacing={1.5} sx={{ mt: hasStandings ? 0 : 2 }}>
              {items.map((item) => (
                <Grid item xs={6} sm={4} md={3} key={item.id}>
                  <Paper
                    component="button" type="button" onClick={() => setZoom(item)}
                    sx={{
                      width: '100%', p: 0, border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer',
                      borderRadius: 3, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
                      opacity: item.available ? 1 : 0.75,
                    }}>
                    <ItemPhoto src={assetUrl(item.image_url)} alt={item.name} soldOut={!item.available} height={150} />
                    <Box sx={{ p: 1.25, width: '100%' }}>
                      <Typography variant="body2" fontWeight={700}
                        sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6em' }}>
                        {item.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75, gap: 0.5 }}>
                        <Chip size="small" label={`${item.points_cost} pts`}
                          sx={{ bgcolor: '#F57C00', color: '#fff', fontWeight: 800 }} />
                        {item.available && item.stock !== null && (
                          <Typography variant="caption" color="text.secondary">Quedan {item.stock}</Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )
        ) : (
          /* ===== POSICIONES ===== */
          <>
            {groups.length > 1 && (
              <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, mb: 1 }}>
                {groups.map((g) => (
                  <Chip key={g.id} label={g.name} onClick={() => setGroupId(g.id)}
                    color={g.id === groupId ? 'warning' : 'default'}
                    variant={g.id === groupId ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700, flexShrink: 0 }} />
                ))}
              </Box>
            )}
            {group && (
              <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#FFF3E0' }}>
                  <Typography fontWeight={800}>{group.name}</Typography>
                  {group.last_round_date && (
                    <Typography variant="caption" color="text.secondary">Última clase: {shortDate(group.last_round_date)}</Typography>
                  )}
                </Box>
                {group.students.map((s) => (
                  <Box key={s.position} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                    borderTop: '1px solid', borderColor: 'divider',
                  }}>
                    <Avatar sx={{
                      width: 32, height: 32, fontSize: 14, fontWeight: 800,
                      bgcolor: PODIUM[s.position - 1] || 'grey.200',
                      color: s.position <= 3 ? '#fff' : 'text.secondary',
                    }}>
                      {s.position}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>{s.name}</Typography>
                      {s.level && (
                        <Chip size="small" label={s.level.name}
                          sx={{ bgcolor: s.level.color, color: '#fff', fontWeight: 700, height: 20, fontSize: 11 }} />
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1, color: '#E65100' }}>{s.balance}</Typography>
                      <Typography variant="caption" color={s.last_round ? 'success.main' : 'text.secondary'} fontWeight={s.last_round ? 700 : 400}>
                        {s.last_round ? `+${s.last_round}` : 'puntos'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Paper>
            )}
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, textAlign: 'center' }}>
              Puntos disponibles para canjear. El nivel no baja al canjear.
            </Typography>
          </>
        )}
      </Container>

      {/* ===== DETALLE DEL PREMIO ===== */}
      <Dialog open={!!zoom} onClose={() => setZoom(null)} maxWidth="xs" fullWidth>
        {zoom && (
          <>
            <IconButton onClick={() => setZoom(null)} aria-label="Cerrar"
              sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: '#fff' } }}>
              <CloseIcon />
            </IconButton>
            <ItemPhoto src={assetUrl(zoom.image_url)} alt={zoom.name} soldOut={!zoom.available} height={300} />
            <DialogContent>
              <Typography variant="h6" fontWeight={800}>{zoom.name}</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', my: 1 }}>
                <Chip label={`${zoom.points_cost} puntos`} sx={{ bgcolor: '#F57C00', color: '#fff', fontWeight: 800 }} />
                {!zoom.available ? <Chip label="Agotado" color="error" size="small" />
                  : zoom.stock !== null && <Typography variant="body2" color="text.secondary">Quedan {zoom.stock}</Typography>}
              </Box>
              {zoom.description && <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{zoom.description}</Typography>}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default PublicStore;
