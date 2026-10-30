# Despliegue en un servidor (VPS) con Docker

Todo corre con `docker compose`: **PostgreSQL**, un paso de **migraciones** (y administrador inicial), la **app** Next.js y **Caddy**, que publica el sitio con HTTPS automático (Let's Encrypt).

```
Internet ──443/80──▶ Caddy ──▶ app:3000 (Next.js) ──▶ db:5432 (PostgreSQL, volumen pgdata)
                                   ▲
                    migrate (una vez por arranque: migraciones + semilla si la base está vacía)
```

## 1. Requisitos

- VPS Linux con al menos **2 GB de RAM** (por ejemplo Ubuntu 24.04 en DigitalOcean, Contabo, Hetzner, Vultr o AWS Lightsail). La compilación de la imagen es lo que más memoria consume.
- Docker y el plugin Compose:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- Un dominio con un **registro A** apuntando a la IP del servidor (también `www` si se va a usar).
- Puertos **80 y 443** abiertos en el firewall:
  ```bash
  ufw allow OpenSSH && ufw allow 80 && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
  ```

## 2. Instalación

```bash
git clone https://github.com/robertcelye/ClaudeProjects.git /opt/gallardo-repo
cd /opt/gallardo-repo/produccionesgallardo
cp .env.production.example .env
nano .env
```

En `.env`, complete como mínimo:

| Variable | Valor |
|---|---|
| `DOMAIN` | `produccionesgallardo.com` (o `produccionesgallardo.com, www.produccionesgallardo.com`) |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Administrador que se crea en el primer arranque |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude (sin ella el agente usa respuestas de respaldo) |
| `WHATSAPP_*` | Credenciales de WhatsApp Cloud API (ver sección 4) |

Proteja el archivo: `chmod 600 .env`.

```bash
docker compose up -d --build
docker compose ps          # db, app y caddy "running"; migrate "exited (0)"
docker compose logs -f migrate app
```

En el primer arranque, `migrate` aplica las migraciones y, como la base está vacía, carga la **semilla base**: administrador, configuración, inventario de ejemplo, cantones de El Oro y marcas. No crea solicitudes de demostración. En los arranques siguientes solo aplica migraciones nuevas.

Abra `https://SU-DOMINIO`. El certificado se emite solo en unos segundos; si falla, revise el DNS y los puertos 80/443 con `docker compose logs caddy`. Entre al panel en `/admin` con `ADMIN_EMAIL` / `ADMIN_PASSWORD` y, en **Configuración**, cree los usuarios de Ventas y Logística.

> Después del primer arranque puede borrar `ADMIN_PASSWORD` de `.env`: ya no se usa. La contraseña se cambia desde **Configuración → Gestión de accesos**.

## 3. Operación diaria

| Tarea | Comando (en `/opt/gallardo-repo/produccionesgallardo`) |
|---|---|
| Actualizar a una nueva versión | `git pull && docker compose up -d --build` |
| Ver logs | `docker compose logs -f app` |
| Reiniciar la app | `docker compose restart app` |
| Estado / salud | `docker compose ps` · `curl -s 127.0.0.1:3000/api/health` |
| Consola SQL | `docker compose exec db psql -U gallardo -d gallardo` |
| Detener todo | `docker compose down` (los datos persisten en el volumen `pgdata`) |

### Respaldos

```bash
sh scripts/backup.sh                                      # crea backups/gallardo-AAAAMMDD-HHMMSS.sql.gz (guarda los 14 últimos)
sh scripts/restore.sh backups/gallardo-…sql.gz            # restaura (pide confirmación; reemplaza los datos)
```

Respaldo diario automático (`crontab -e`):

```
15 3 * * * cd /opt/gallardo-repo/produccionesgallardo && sh scripts/backup.sh >> backups/backup.log 2>&1
```

Copie periódicamente la carpeta `backups/` fuera del servidor (por ejemplo con `rclone` a Google Drive o S3).

## 4. WhatsApp Cloud API (Meta)

1. En [developers.facebook.com](https://developers.facebook.com), cree una app de tipo **Business** y agregue el producto **WhatsApp**. Registre el número de la empresa.
2. Genere un **token permanente**: Business Settings → System users → token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese valor va en `WHATSAPP_TOKEN`.
3. Copie el **Phone number ID** en `WHATSAPP_PHONE_NUMBER_ID` y el **App secret** en `WHATSAPP_APP_SECRET`.
4. En WhatsApp → Configuration → **Webhook**:
   - Callback URL: `https://SU-DOMINIO/api/whatsapp/webhook`
   - Verify token: el mismo valor que puso en `WHATSAPP_VERIFY_TOKEN`
   - Suscríbase al campo **messages**.
5. Cree y espere la aprobación de una **plantilla de mensaje** (categoría *Utility*) para el primer contacto, con dos variables: `{{1}}` nombre y `{{2}}` ticket. Por ejemplo:
   > Hola {{1}}, recibimos tu solicitud {{2}} en Producciones Gallardo. Responde a este mensaje para coordinar la reunión técnica.

   Ponga su nombre en `WHATSAPP_TEMPLATE_NAME`. Sin plantilla, Meta solo permite escribir a clientes que ya le escribieron en las últimas 24 h.
6. Aplique los cambios con `docker compose up -d` (recrea la app con el nuevo `.env`) y compruebe en **Configuración** que los tres indicadores estén en verde.

## 5. Video reel y archivos

Coloque el video en `public/media/reel.mp4` antes de construir, o use una URL externa (CDN, Bunny, Cloudflare R2). Luego configure la URL en **Configuración → Portal público**. Lo mismo aplica a fotos de equipos y fichas PDF: los campos de URL están en **Inventario → Editar**.

## Solución de problemas

- **`migrate` termina con error** → `docker compose logs migrate`. Revise `POSTGRES_PASSWORD` y que `ADMIN_PASSWORD` tenga al menos 8 caracteres en el primer arranque.
- **Cambié `POSTGRES_PASSWORD` después del primer arranque** → PostgreSQL conserva la contraseña original del volumen. Vuelva al valor anterior, o cámbiela dentro de la base con `ALTER USER gallardo PASSWORD '…';`.
- **No se puede iniciar sesión** → verifique que entra por `https://`: la cookie de sesión es segura y no viaja por http.
- **Poca memoria al compilar** → agregue swap (`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`).
