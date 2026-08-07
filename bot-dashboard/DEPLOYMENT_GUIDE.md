# Deployment Guide for Next.js App to VPS using aaPanel

This guide covers deploying your Next.js dashboard (with Supabase backend) to a VPS using **aaPanel's Node.js Project Manager**.

---

## Prerequisites

- **VPS Setup**: aaPanel installed. If not:
  ```bash
  curl -sSO http://www.aapanel.com/script/install_7.0_en.sh && bash install_7.0_en.sh
  ```
- **Node.js 18+**: Install via aaPanel **Software Store** → Search "Node.js" → Install
- **Domain**: Configure in aaPanel (Website > Sites > Add Site)
- **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Step 1: Upload Your Code

### Option A: Using Git (Recommended)

1. SSH into your server or use aaPanel's Terminal
2. Navigate to www directory and clone:
   ```bash
   cd /www/wwwroot
   git clone https://github.com/drjimmy1990/bot-dashboard.git dashboard
   ```

### Option B: Manual Upload

1. In aaPanel, go to **Files** (file manager)
2. Create directory: `/www/wwwroot/dashboard`
3. Upload all files **except**: `node_modules`, `.next`, `.env.local`

---

## Step 2: Create Environment File

1. In aaPanel **Files**, navigate to `/www/wwwroot/dashboard`
2. Create a new file: `.env.local`
3. Add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 3: Install Dependencies

1. In aaPanel, go to **Terminal** (or SSH)
2. Run:
   ```bash
   cd /www/wwwroot/dashboard
   npm install
   ```

---

## Step 4: Build the Application

```bash
cd /www/wwwroot/dashboard
npm run build
```

> **Note**: This creates the `.next` folder required for production.

---

## Step 5: Configure aaPanel Node.js Project Manager

1. Go to **Website** → **Node.js Project** → **Add Project**

2. Fill in the form:

   | Field | Value |
   |-------|-------|
   | Project Name | `dashboard` |
   | Root Directory | `/www/wwwroot/dashboard` |
   | Node.js Version | `18` or `20` |
   | Package Manager | `npm` |
   | Run Command | `next start -p 3099` |

3. **Environment Variables** (Add these):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key-here`

4. Click **Submit** to save

5. Click **Start** to run the project

---

## Step 6: Configure Reverse Proxy

1. Go to **Website** → **Sites** → **Add Site**
2. Enter your domain name
3. Select the site → Click **Reverse Proxy** tab
4. Click **Add Reverse Proxy**:

   | Field | Value |
   |-------|-------|
   | Name | `dashboard` |
   | Target URL | `http://127.0.0.1:3099` |

5. Save

---

## Step 7: Enable SSL (HTTPS)

1. Go to **Website** → **Sites** → Select your domain
2. Click **SSL** tab
3. Click **Let's Encrypt** → Apply
4. Enable **Force HTTPS**

---

## Port Configuration

| Service | Port | Description |
|---------|------|-------------|
| Next.js App | **3099** | Internal application port |
| Nginx HTTP | 80 | Public HTTP (redirects to 443) |
| Nginx HTTPS | 443 | Public HTTPS access |

> **Changing the port**: Edit the Run Command in Node.js Project Manager:
> `next start -p YOUR_PORT`

---

## Managing the Application

### In aaPanel Node.js Project Manager:

| Action | How |
|--------|-----|
| Start | Click **Start** button |
| Stop | Click **Stop** button |
| Restart | Click **Restart** button |
| View Logs | Click **Logs** button |

### Updating the Application:

1. SSH into server or use aaPanel Terminal
2. Run:
   ```bash
   cd /www/wwwroot/dashboard
   git pull origin main
   npm install
   npm run build
   ```
3. In **Node.js Project Manager**, click **Restart**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in Run Command (e.g., `next start -p 3100`) |
| Build fails | Check Node.js version: needs 18+ |
| App not accessible | Verify Reverse Proxy points to correct port (3099) |
| 502 Bad Gateway | App not running - click Start in Node.js Project Manager |
| Environment vars not working | Add them in Node.js Project Manager settings |
| `.next` folder missing | Run `npm run build` first |

---

## System Requirements

- **RAM**: Minimum 1GB (2GB recommended)
- **Disk**: 2GB free space
- **Node.js**: Version 18 or higher
- **aaPanel**: Latest version with Node.js Project Manager plugin

---

## Quick Reference: Run Command

```
next start -p 3099
```

This is the exact command used in aaPanel's Node.js Project Manager to start the production server on port 3099.

---
---

# Alternative: Terminal-Only Deployment (No aaPanel)

If you prefer deploying directly via SSH without aaPanel, follow this guide.

---

## Step 1: Server Setup

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node -v   # Should show v20.x
npm -v    # Should show 10.x

# Install PM2 (process manager — keeps your app alive)
npm install -g pm2

# Install Nginx (reverse proxy)
apt install -y nginx
```

---

## Step 2: Clone & Configure

```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone the repo
git clone https://github.com/drjimmy1990/bot-dashboard.git dashboard
cd dashboard

# Create environment file
nano .env.local
```

Paste your environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://supabase.bestlifeeg.store
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_N8N_AGENT_WEBHOOK_URL=https://n8n.bestlifeeg.store/webhook/agent-send-message
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## Step 3: Build

```bash
cd /var/www/dashboard
npm install
npm run build
```

> This creates the `.next` folder required for production.

---

## Step 4: Start with PM2

```bash
# Start the app on port 3099
pm2 start npm --name "dashboard" -- start -- -p 3099

# Verify it's running
pm2 status

# Save PM2 process list (survives server reboot)
pm2 save

# Enable PM2 to start on boot
pm2 startup
```

### PM2 Quick Reference

| Command | Action |
|---------|--------|
| `pm2 status` | See all running processes |
| `pm2 logs dashboard` | View live logs |
| `pm2 restart dashboard` | Restart the app |
| `pm2 stop dashboard` | Stop the app |
| `pm2 delete dashboard` | Remove from PM2 |

---

## Step 5: Configure Nginx Reverse Proxy

```bash
# Create Nginx config
nano /etc/nginx/sites-available/dashboard
```

Paste this config (replace `yourdomain.com`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3099;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
# Create symlink to enable the site
ln -s /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/

# Test config
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## Step 6: Enable SSL (HTTPS)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get certificate (auto-configures Nginx)
certbot --nginx -d yourdomain.com

# Verify auto-renewal
certbot renew --dry-run
```

---

## Updating the App (Terminal)

```bash
cd /var/www/dashboard
git pull origin main
npm install
npm run build
pm2 restart dashboard
```

### One-Liner Update

```bash
cd /var/www/dashboard && git pull origin main && npm install && npm run build && pm2 restart dashboard
```

---

## Database Migrations (Terminal)

Run SQL migrations against your Supabase project using `psql`:

```bash
# Connect to your Supabase DB (get connection string from Supabase Dashboard → Settings → Database)
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Once connected, run migration files:
\i /var/www/dashboard/database/settings_upgrade_v2.sql
\i /var/www/dashboard/database/schema_upgrade_v2.sql
\i /var/www/dashboard/database/rbac_migration.sql
```

Or run them directly from the command line:

```bash
# Run a single migration
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f /var/www/dashboard/database/settings_upgrade_v2.sql

# Run all migrations in order
for f in settings_upgrade_v2.sql schema_upgrade_v2.sql rbac_migration.sql; do
  echo "Running $f..."
  psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
    -f /var/www/dashboard/database/$f
done
```

> **Tip:** You can also paste the SQL directly into the **Supabase Dashboard → SQL Editor** if you prefer a GUI.

---

## Troubleshooting (Terminal)

| Issue | Command |
|-------|---------|
| Check if app is running | `pm2 status` |
| View app logs | `pm2 logs dashboard --lines 50` |
| Check port 3099 | `ss -tlnp | grep 3099` |
| Check Nginx status | `systemctl status nginx` |
| Check Nginx error log | `tail -50 /var/log/nginx/error.log` |
| Restart everything | `pm2 restart dashboard && systemctl reload nginx` |
| Check disk space | `df -h` |
| Check memory | `free -h` |

---

## Quick Update — Copy & Paste

```bash
cd /www/wwwroot/dashboard
git pull origin main
pm2 stop dashboard
npm install
npm run build
pm2 start dashboard
rm -rf /www/server/nginx/proxy_cache_dir/*



cd /www/wwwroot/dashboard
git pull origin feature/rbac-media-upgrades
npm run build
pm2 restart dashboard
rm -rf /www/server/nginx/proxy_cache_dir/*
```