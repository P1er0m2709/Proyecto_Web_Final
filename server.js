/**
 * Servidor estático ligero para ElectroBot (compatible con AI Studio y ejecución local).
 * Expone los archivos HTML, CSS y JS en el puerto 3000 y mantiene rutas de compatibilidad
 * para enlaces antiguos (css/, js/ y componentes/).
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Rutas de compatibilidad en caso de acceder a rutas heredadas (css/, js/, componentes/)
app.get("/css/style.css", (_req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/js/app.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "app.js"));
});

app.get("/componentes/:archivo", (req, res, next) => {
  const nombreSeguro = path.basename(req.params.archivo);
  if (!nombreSeguro.endsWith(".html")) {
    return next();
  }
  res.sendFile(path.join(__dirname, nombreSeguro), (err) => {
    if (err) next();
  });
});

// Servir archivos estáticos desde la raíz del proyecto
app.use(express.static(__dirname));

// Ruta raíz explícita
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Manejo de rutas no encontradas (404 amigable)
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, "index.html"));
});

// Iniciar servidor en 0.0.0.0:3000
app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ ElectroBot activo en http://0.0.0.0:${PORT}`);
});
