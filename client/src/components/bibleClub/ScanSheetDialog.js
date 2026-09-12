/**
 * ScanSheetDialog.js - Escanea la hoja de asistencia con la cámara
 *
 * Flujo pensado para el celular:
 *   1. Tomar la foto de la hoja (o elegirla de la galería)
 *   2. Ajustar dónde empiezan las columnas de puntos (línea azul sobre la foto)
 *   3. El OCR lee la hoja en el propio teléfono (tesseract.js, sin subir nada)
 *   4. Pantalla de revisión: cada fila muestra lo que se leyó, a quién se
 *      emparejó y cuántos puntos suman — todo editable
 *   5. "Aplicar" rellena la hoja de puntos; guardar sigue siendo un paso aparte
 *
 * El OCR de letra manuscrita se equivoca: por eso NADA se guarda directo.
 * Las filas dudosas se marcan y las que no se emparejan quedan en blanco.
 */
import React, { useState, useRef } from 'react';
import {
  Box, Button, Dialog, DialogContent, DialogActions, Typography, TextField,
  Select, MenuItem, FormControl, InputLabel, LinearProgress, Alert, Chip,
  IconButton, Slider, AppBar, Toolbar, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import {
  Close as CloseIcon, PhotoCamera as PhotoCameraIcon,
  PhotoLibrary as PhotoLibraryIcon, Refresh as RefreshIcon,
} from '@mui/icons-material';
import { scanAttendanceSheet } from '../../utils/sheetOcr';

/** Colores del chip de confianza de cada fila leída */
const CONFIDENCE = {
  alta: { label: 'Seguro', color: 'success' },
  media: { label: 'Revisar', color: 'warning' },
  baja: { label: 'Dudoso', color: 'error' },
};

const ScanSheetDialog = ({ open, onClose, students, onApply }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [splitAt, setSplitAt] = useState(0.62);
  const [rows, setRows] = useState(null);
  const [progress, setProgress] = useState(null); // { phase, pct }
  const [error, setError] = useState(null);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRows(null);
    setProgress(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickFile = (event) => {
    const picked = event.target.files?.[0];
    event.target.value = ''; // permite volver a elegir la misma foto
    if (!picked) return;
    setRows(null);
    setError(null);
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const runScan = async () => {
    if (!file) return;
    setError(null);
    setRows(null);
    setProgress({ phase: 'Preparando', pct: 0 });
    try {
      const result = await scanAttendanceSheet(file, students, {
        splitAt,
        onProgress: (phase, pct) => setProgress({ phase, pct: Math.round(pct) }),
      });
      setPreview(result.preview);
      setRows(result.rows);
      if (result.rows.length === 0) {
        setError('No se reconoció ninguna fila. Prueba con más luz, la hoja plana y la foto más de cerca.');
      }
    } catch (e) {
      setError(`No se pudo leer la hoja: ${e.message}`);
    } finally {
      setProgress(null);
    }
  };

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  /** Filas listas para aplicar: con participante elegido y puntos distintos de cero */
  const applicable = (rows || []).filter((r) => r.studentId && parseInt(r.points, 10));

  const apply = () => {
    const values = {};
    for (const row of applicable) {
      const points = parseInt(row.points, 10);
      // Si el OCR repitió un participante, se suman sus filas
      values[row.studentId] = (values[row.studentId] || 0) + points;
    }
    onApply(values);
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth fullScreen={isMobile}>
      <AppBar position="sticky" elevation={0} color="inherit"
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={handleClose} aria-label="Cerrar"><CloseIcon /></IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>Escanear hoja</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {rows ? `${rows.length} fila(s) leída(s)` : 'Lista de asistencia'}
            </Typography>
          </Box>
          {rows && (
            <IconButton onClick={runScan} aria-label="Volver a leer"><RefreshIcon /></IconButton>
          )}
        </Toolbar>
      </AppBar>

      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 3 } }}>
        {/* ===== PASO 1: elegir la foto ===== */}
        {!file && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              La lectura ocurre <strong>dentro de tu teléfono</strong>: la foto no se sube a ningún lado.
              La letra a mano es difícil para el OCR, así que revisa todo antes de aplicar.
            </Alert>

            <Typography variant="subtitle2" fontWeight={700} gutterBottom>Para que lea mejor:</Typography>
            <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2.5, mt: 0 }}>
              <li>Hoja plana, sin dobleces ni sombra encima</li>
              <li>Buena luz y la foto derecha, no inclinada</li>
              <li>Que se vea la tabla completa: nombres y columnas de puntos</li>
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
              <Button variant="contained" size="large" startIcon={<PhotoCameraIcon />}
                onClick={() => cameraRef.current?.click()}>
                Tomar foto de la hoja
              </Button>
              <Button variant="outlined" size="large" startIcon={<PhotoLibraryIcon />}
                onClick={() => galleryRef.current?.click()}>
                Elegir de la galería
              </Button>
            </Box>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              onChange={pickFile} style={{ display: 'none' }} />
            <input ref={galleryRef} type="file" accept="image/*"
              onChange={pickFile} style={{ display: 'none' }} />
          </Box>
        )}

        {/* ===== PASO 2: ajuste y lectura ===== */}
        {file && !rows && (
          <Box>
            <Box sx={{ position: 'relative', mb: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <img src={preview} alt="Hoja" style={{ width: '100%', display: 'block' }} />
              {/* Línea que marca dónde empiezan las columnas de puntos */}
              <Box sx={{
                position: 'absolute', top: 0, bottom: 0, left: `${splitAt * 100}%`,
                width: 2, bgcolor: 'primary.main', boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
              }} />
            </Box>

            <Typography variant="body2" fontWeight={600}>
              Mueve la línea hasta donde empiezan las columnas de puntos
            </Typography>
            <Typography variant="caption" color="text.secondary">
              A la izquierda quedan los nombres; a la derecha, los números.
            </Typography>
            <Slider
              value={splitAt} min={0.3} max={0.85} step={0.01}
              onChange={(_, v) => setSplitAt(v)}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
              sx={{ mt: 1 }}
            />

            {progress ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>{progress.phase}… {progress.pct}%</Typography>
                <LinearProgress variant="determinate" value={progress.pct} />
                <Typography variant="caption" color="text.secondary">
                  La primera vez descarga el idioma, puede tardar un poco más.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button variant="contained" fullWidth size="large" onClick={runScan}>
                  Leer la hoja
                </Button>
                <Button onClick={reset}>Cambiar foto</Button>
              </Box>
            )}
          </Box>
        )}

        {/* ===== PASO 3: revisión ===== */}
        {rows && (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Revisa fila por fila antes de aplicar. Lo que quede sin participante no se registra.
            </Alert>

            {rows.map((row) => {
              const conf = CONFIDENCE[row.confidence] || CONFIDENCE.baja;
              return (
                <Box key={row.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                    <Chip label={conf.label} color={conf.color} size="small" sx={{ height: 20 }} />
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                      leído: “{row.rawName || '—'}” · “{row.rawPoints || '—'}”
                      {row.parts.length > 1 && ` = ${row.parts.join('+')}`}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
                      <InputLabel>Participante</InputLabel>
                      <Select
                        label="Participante"
                        value={row.studentId}
                        onChange={(e) => updateRow(row.id, { studentId: e.target.value })}
                      >
                        <MenuItem value=""><em>Ignorar esta fila</em></MenuItem>
                        {students.map((s) => (
                          <MenuItem key={s.id} value={s.id}>{s.full_name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small" type="number" inputMode="numeric" label="Puntos"
                      sx={{ width: 100 }}
                      value={row.points}
                      onChange={(e) => updateRow(row.id, { points: e.target.value })}
                    />
                  </Box>
                </Box>
              );
            })}

            <Divider sx={{ my: 2 }} />
            <Button startIcon={<RefreshIcon />} onClick={reset}>Escanear otra hoja</Button>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {rows ? `${applicable.length} fila(s) se aplicarán` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button variant="contained" onClick={apply} disabled={!rows || applicable.length === 0}>
            Aplicar a la hoja
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ScanSheetDialog;
