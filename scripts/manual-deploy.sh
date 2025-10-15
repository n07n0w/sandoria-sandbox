#!/bin/bash
# Manual deployment script for EC2 Ubuntu server
# Usage: ./scripts/manual-deploy.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Sandoria Sandbox Deployment Script${NC}"
echo ""

# Check if running on server
if [ ! -f /etc/lsb-release ]; then
    echo -e "${RED}❌ This script should be run on the Ubuntu server${NC}"
    exit 1
fi

# Define variables
APP_DIR="$HOME/sandoria-sandbox"
REPO_URL="https://github.com/yourusername/sandoria-sandbox.git"  # Update this!
BRANCH="${1:-master}"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "  App Directory: $APP_DIR"
echo "  Repository: $REPO_URL"
echo "  Branch: $BRANCH"
echo ""

# Install Node.js 18 if not present
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo -e "${GREEN}✓ Node.js $(node --version) already installed${NC}"
fi

# Install Git if not present
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Git...${NC}"
    sudo apt-get update
    sudo apt-get install -y git
else
    echo -e "${GREEN}✓ Git already installed${NC}"
fi

# Install MySQL if not present
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}📦 Installing MySQL...${NC}"
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server
    sudo systemctl start mysql
    sudo systemctl enable mysql
else
    echo -e "${GREEN}✓ MySQL already installed${NC}"
fi

# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    sudo npm install -g pm2
else
    echo -e "${GREEN}✓ PM2 already installed${NC}"
fi

# Clone or update repository
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📥 Updating existing repository...${NC}"
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/$BRANCH
    git checkout $BRANCH
else
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    git clone -b $BRANCH "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing Node.js dependencies...${NC}"
npm install --production

# Setup MySQL database and user
echo -e "${YELLOW}🗄️  Setting up MySQL database...${NC}"
DB_USER="sandboxuser"
DB_PASSWORD="sandbox_secure_pass_$(date +%s)"
DB_NAME="sandbox"

# Create database and user
echo -e "${YELLOW}Creating database and user...${NC}"
sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};" 2>/dev/null || true
sudo mysql -e "DROP USER IF EXISTS '${DB_USER}'@'localhost';" 2>/dev/null || true
sudo mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo -e "${GREEN}✅ Database '${DB_NAME}' and user '${DB_USER}' created${NC}"

# Import backup if exists
if [ -f "$APP_DIR/DB/timeweb.sandbox.sql" ]; then
    echo -e "${YELLOW}📥 Importing database backup from DB/timeweb.sandbox.sql...${NC}"
    sudo mysql ${DB_NAME} < "$APP_DIR/DB/timeweb.sandbox.sql"
    echo -e "${GREEN}✅ Database backup imported successfully${NC}"
elif [ -f "$APP_DIR/DB/sandbox.sql" ]; then
    echo -e "${YELLOW}📥 Importing database schema from DB/sandbox.sql...${NC}"
    sudo mysql ${DB_NAME} < "$APP_DIR/DB/sandbox.sql"
    echo -e "${GREEN}✅ Database schema imported successfully${NC}"
else
    echo -e "${RED}⚠️  No database backup found (DB/timeweb.sandbox.sql or DB/sandbox.sql)${NC}"
    exit 1
fi

# Setup environment file
echo -e "${YELLOW}⚙️  Creating .env file...${NC}"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

cat > .env << ENV_FILE
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# Application URLs
BASE_URL=http://${PUBLIC_IP}:3000
MAIN_SITE_URL=https://sandoria.org/

# Server Configuration
PORT=3000
NODE_ENV=production

# PeerJS Server Configuration
PEER_SERVER_HOST=peer-server.sandoria.org
PEER_SERVER_PORT=80
PEER_SERVER_PATH=/
PEER_SERVER_SECURE=false
ENV_FILE

echo -e "${GREEN}✅ Environment file created with database credentials${NC}"
echo -e "${YELLOW}📝 Database credentials:${NC}"
echo -e "   User: ${DB_USER}"
echo -e "   Password: ${DB_PASSWORD}"
echo -e "   Database: ${DB_NAME}"

# Configure firewall if ufw is available
if command -v ufw &> /dev/null; then
    echo -e "${YELLOW}🔥 Configuring firewall...${NC}"
    sudo ufw allow 3000/tcp
    sudo ufw allow 22/tcp
    sudo ufw --force enable
    echo -e "${GREEN}✓ Firewall configured (ports 22, 3000 open)${NC}"
fi

# Stop existing PM2 process if running
echo -e "${YELLOW}🔄 Managing PM2 process...${NC}"
pm2 delete sandoria-sandbox 2>/dev/null || true

# Start application with PM2
pm2 start bin/www --name sandoria-sandbox --time
pm2 save

# Setup PM2 to run on startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo ""
echo -e "${GREEN}📊 Application status:${NC}"
pm2 status
echo ""
echo -e "${GREEN}🌐 Application URL: http://${PUBLIC_IP}:3000${NC}"
echo ""
echo -e "${YELLOW}📝 Useful PM2 commands:${NC}"
echo "  pm2 logs sandoria-sandbox      # View application logs"
echo "  pm2 restart sandoria-sandbox   # Restart application"
echo "  pm2 stop sandoria-sandbox      # Stop application"
echo "  pm2 status                     # Check status"
echo "  pm2 monit                      # Monitor CPU/Memory"
