Render deployment guide

1. Prepare repository
- Ensure the repository contains your PHP app root (index.php, pages/, scripts/, styling/, media/).
- Ensure `scripts/db/config.php` reads DB configuration from environment variables (already done).
- Ensure `scripts/db/ca.pem` is present (SSL CA for Aiven). Do not commit other secrets.

2. Files added
- `Dockerfile` - builds a PHP 8.2 + Apache image with `pdo_mysql` extension.
- `render.yaml` - optional Render service configuration. It contains non-sensitive defaults; DO NOT commit secrets for `DB_USER` or `DB_PASS`.
- `.dockerignore` - reduce build context size.

3. Set environment variables in Render dashboard
- `DB_HOST` = secretary-ai-secretaryai.g.aivencloud.com
- `DB_PORT` = 17780
- `DB_NAME` = defaultdb
- `DB_USER` = <set in Render Secrets>
- `DB_PASS` = <set in Render Secrets>
- Optional: `DB_SSL_CA` = /var/www/html/scripts/db/ca.pem (defaults to repository path if unset)

4. Deploy on Render
- In Render dashboard: New -> Web Service -> Connect your GitHub repo -> Select branch `main`.
- Choose Environment: Docker (Render will use the `Dockerfile`).
- Set environment variables (see above). Set `DB_USER` and `DB_PASS` via the dashboard (not in git).
- Deploy and monitor build logs.

5. Local testing (optional)
Build the image locally and run it with env vars:

```bash
docker build -t secretaryai .

docker run --rm -p 8000:80 \
  -e DB_HOST=secretary-ai-secretaryai.g.aivencloud.com \
  -e DB_PORT=17780 \
  -e DB_NAME=defaultdb \
  -e DB_USER=avnadmin \
  -e DB_PASS='yourpw' \
  -e DB_SSL_CA=/var/www/html/scripts/db/ca.pem \
  secretaryai
```

6. Troubleshooting
- Check Render logs for PHP errors and DB connection failures.
- Confirm `scripts/db/ca.pem` exists inside container; `DB_SSL_CA` may need to be `/var/www/html/scripts/db/ca.pem`.
- Ensure `scripts/db/config.php` can throw an exception if DB env vars are missing; set them in dashboard.

7. Security
- Never commit `DB_PASS` or other secrets. Use Render Dashboard Secrets.
- Set `display_errors = 0` in production.

If you'd like, I can also create a GitHub Action to automatically deploy or push these changes to your repo now.