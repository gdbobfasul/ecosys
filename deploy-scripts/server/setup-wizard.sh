#!/bin/bash
# Version: 1.0060
##############################################################################
# KCY Ecosystem - Interactive Setup Wizard
# 
# Този скрипт води стъпка по стъпка през целия setup процес:
# - Копиране на файлове
# - Настройка на домейни
# - Проверка и инсталация на сървиси
# - Setup на база данни
# - Конфигуриране на .env файлове
#
# Usage: sudo ./setup-wizard.sh
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/var/www/kcy-ecosystem"
CHAT_DIR="$PROJECT_DIR/private/chat"
TOKEN_DIR="$PROJECT_DIR/private/token"
MULTISIG_DIR="$PROJECT_DIR/private/multisig"
MOBILE_DIR="$PROJECT_DIR/private/mobile-chat"

CURRENT_STEP=0
TOTAL_STEPS=7

##############################################################################
# Helper Functions
##############################################################################

print_header() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}║         ${MAGENTA}KCY Ecosystem - Setup Wizard${CYAN}                  ║${NC}"
    echo -e "${CYAN}║                                                            ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Step $CURRENT_STEP of $TOTAL_STEPS${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

check_service() {
    local service=$1
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

check_command() {
    local cmd=$1
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

press_enter() {
    echo ""
    read -p "Press ENTER to continue..."
}

##############################################################################
# STEP 0: Welcome
##############################################################################

welcome() {
    CURRENT_STEP=0
    print_header
    
    echo -e "${MAGENTA}Welcome to KCY Ecosystem Setup Wizard!${NC}"
    echo ""
    echo "This wizard will guide you through:"
    echo ""
    echo "  1. Copying files to server"
    echo "  2. Setting up domains"
    echo "  3. Installing required services"
    echo "  4. Setting up database"
    echo "  5. Configuring environment variables"
    echo "  6. Starting services"
    echo ""
    echo -e "${YELLOW}⚠️  Requirements:${NC}"
    echo "  • Ubuntu/Debian server"
    echo "  • Root access (sudo)"
    echo "  • Internet connection"
    echo ""
    
    press_enter
}

##############################################################################
# STEP 1: File Upload
##############################################################################

step_file_upload() {
    CURRENT_STEP=1
    print_header
    
    print_section "📁 STEP 1: Upload Files to Server"
    
    echo -e "${YELLOW}You need to copy your KCY ecosystem files to the server.${NC}"
    echo ""
    
    # Check if files already exist
    if [ -d "$PROJECT_DIR" ]; then
        echo -e "${GREEN}✓ Files already exist at: $PROJECT_DIR${NC}"
        echo ""
        read -p "Re-upload files? (y/n): " reupload
        if [ "$reupload" != "y" ] && [ "$reupload" != "Y" ]; then
            echo -e "${GREEN}Skipping file upload.${NC}"
            press_enter
            return
        fi
    fi
    
    echo -e "${CYAN}Choose your deployment method:${NC}"
    echo ""
    echo -e "  ${GREEN}A)${NC} Upload from Windows"
    echo -e "     Script: ${YELLOW}deploy-scripts/windows/deploy.ps1${NC}"
    echo -e "     Command: ${YELLOW}.\deploy.ps1${NC}"
    echo ""
    echo -e "  ${GREEN}B)${NC} Upload from Linux/Mac"
    echo -e "     Script: ${YELLOW}deploy-scripts/deploy.sh${NC}"
    echo -e "     Command: ${YELLOW}./deploy.sh${NC}"
    echo ""
    echo -e "  ${GREEN}C)${NC} Manual upload (SCP/SFTP)"
    echo -e "     Example: ${YELLOW}scp -r ./kcy-ecosystem root@server:/var/www/${NC}"
    echo ""
    echo -e "  ${GREEN}D)${NC} Files already uploaded"
    echo ""
    
    read -p "Your choice [A/B/C/D]: " choice
    
    case $choice in
        A|a)
            echo ""
            echo -e "${CYAN}On your Windows machine, run:${NC}"
            echo -e "${YELLOW}  cd deploy-scripts${NC}"
            echo -e "${YELLOW}  .\windows\deploy.ps1${NC}"
            echo ""
            echo "The script will:"
            echo "  • Ask for project root directory"
            echo "  • Upload to /var/www/html (public)"
            echo "  • Upload to /var/www/kcy-ecosystem (private)"
            echo ""
            ;;
        B|b)
            echo ""
            echo -e "${CYAN}On your Linux/Mac machine, run:${NC}"
            echo -e "${YELLOW}  cd deploy-scripts${NC}"
            echo -e "${YELLOW}  ./deploy.sh${NC}"
            echo ""
            echo "The script will:"
            echo "  • Use rsync for efficient upload"
            echo "  • Exclude node_modules, .git, .env"
            echo "  • Upload to correct directories"
            echo ""
            ;;
        C|c)
            echo ""
            echo -e "${CYAN}Manual upload commands:${NC}"
            echo -e "${YELLOW}  scp -r ./public/* root@server:/var/www/html/${NC}"
            echo -e "${YELLOW}  scp -r ./private/* root@server:/var/www/kcy-ecosystem/${NC}"
            echo ""
            ;;
        D|d)
            echo ""
            echo -e "${GREEN}Great! Continuing to next step...${NC}"
            ;;
        *)
            echo -e "${YELLOW}Invalid choice. Please run wizard again.${NC}"
            exit 1
            ;;
    esac
    
    press_enter
}

##############################################################################
# STEP 2: Domain Configuration
##############################################################################

step_domain_config() {
    CURRENT_STEP=2
    print_header
    
    print_section "🌐 STEP 2: Domain Configuration"
    
    echo -e "${YELLOW}You need to configure domains for your services.${NC}"
    echo ""
    
    echo -e "${CYAN}Current domain setup:${NC}"
    echo "  • Main: alsec.strangled.net"
    echo "  • Token: alsec.strangled.net/token"
    echo "  • Chat: alsec.strangled.net/chat"
    echo "  • Multisig: alsec.strangled.net/multisig"
    echo ""
    
    read -p "Do you want to change domains? (y/n): " change_domain
    
    if [ "$change_domain" = "y" ] || [ "$change_domain" = "Y" ]; then
        echo ""
        echo -e "${CYAN}Domain configuration files:${NC}"
        echo ""
        echo -e "  ${YELLOW}1. Nginx configuration:${NC}"
        echo -e "     /etc/nginx/sites-available/kcy-ecosystem"
        echo ""
        echo -e "  ${YELLOW}2. Environment files:${NC}"
        echo -e "     $CHAT_DIR/.env"
        echo -e "     $TOKEN_DIR/.env"
        echo -e "     $MULTISIG_DIR/.env"
        echo ""
        echo -e "${YELLOW}Would you like to edit nginx config now?${NC}"
        read -p "(y/n): " edit_nginx
        
        if [ "$edit_nginx" = "y" ] || [ "$edit_nginx" = "Y" ]; then
            if [ -f "/etc/nginx/sites-available/kcy-ecosystem" ]; then
                nano /etc/nginx/sites-available/kcy-ecosystem
            else
                echo -e "${RED}Nginx config not found. Run domain setup script first.${NC}"
            fi
        fi
    fi
    
    press_enter
}

##############################################################################
# STEP 3: Services Check & Install
##############################################################################

step_services() {
    CURRENT_STEP=3
    print_header
    
    print_section "🔧 STEP 3: Required Services"
    
    echo -e "${CYAN}Checking required services...${NC}"
    echo ""
    
    # Services list
    declare -A services
    services[nginx]="Web server"
    services[postgresql]="Database (optional)"
    services[nodejs]="Runtime (Node.js)"
    
    # Commands list
    declare -A commands
    commands[git]="Version control"
    commands[npm]="Package manager"
    commands[pm2]="Process manager"
    
    missing_services=()
    missing_commands=()
    
    # Check services
    echo -e "${BLUE}System Services:${NC}"
    for service in "${!services[@]}"; do
        printf "  %-20s %-30s " "$service" "${services[$service]}"
        if check_service "$service"; then
            echo -e " ${GREEN}Running${NC}"
        else
            echo -e " ${RED}Not installed/running${NC}"
            missing_services+=("$service")
        fi
    done
    
    echo ""
    echo -e "${BLUE}Command Line Tools:${NC}"
    for cmd in "${!commands[@]}"; do
        printf "  %-20s %-30s " "$cmd" "${commands[$cmd]}"
        if check_command "$cmd"; then
            echo -e " ${GREEN}Installed${NC}"
        else
            echo -e " ${RED}Not installed${NC}"
            missing_commands+=("$cmd")
        fi
    done
    
    # Install missing
    if [ ${#missing_services[@]} -gt 0 ] || [ ${#missing_commands[@]} -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Missing components detected.${NC}"
        echo ""
        read -p "Install missing components? (y/n): " install_missing
        
        if [ "$install_missing" = "y" ] || [ "$install_missing" = "Y" ]; then
            echo ""
            echo -e "${GREEN}Installing...${NC}"
            
            # Update apt
            apt-get update -qq
            
            # Install missing services
            for service in "${missing_services[@]}"; do
                case $service in
                    nginx)
                        apt-get install -y nginx
                        systemctl start nginx
                        systemctl enable nginx
                        ;;
                    postgresql)
                        echo -e "${YELLOW}PostgreSQL will be installed via database setup script.${NC}"
                        ;;
                esac
            done
            
            # Install missing commands
            for cmd in "${missing_commands[@]}"; do
                case $cmd in
                    git)
                        apt-get install -y git
                        ;;
                    npm)
                        # Install Node.js (includes npm)
                        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
                        apt-get install -y nodejs
                        ;;
                    pm2)
                        npm install -g pm2
                        ;;
                esac
            done
            
            echo ""
            echo -e "${GREEN}✓ Installation complete${NC}"
        fi
    else
        echo ""
        echo -e "${GREEN}✓ All services are installed and ready!${NC}"
    fi
    
    press_enter
}

##############################################################################
# STEP 4: Database Setup
##############################################################################

step_database() {
    CURRENT_STEP=4
    print_header
    
    print_section "🗄️  STEP 4: Database Setup"
    
    echo -e "${CYAN}Checking database status...${NC}"
    echo ""
    
    # Check PostgreSQL
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✓ PostgreSQL is installed${NC}"
        PG_STATUS="installed"
    else
        echo -e "${YELLOW}! PostgreSQL is NOT installed${NC}"
        PG_STATUS="not-installed"
    fi
    
    # Check SQLite database
    SQLITE_DB="$CHAT_DIR/database/ams_db.sqlite"
    if [ -f "$SQLITE_DB" ]; then
        echo -e "${GREEN}✓ SQLite database exists${NC}"
        SQLITE_STATUS="exists"
    else
        echo -e "${YELLOW}! SQLite database NOT found${NC}"
        SQLITE_STATUS="not-found"
    fi
    
    echo ""
    echo -e "${CYAN}Database setup options:${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} Run database setup script (automatic)"
    echo -e "  ${GREEN}2)${NC} Use PostgreSQL (production)"
    echo -e "  ${GREEN}3)${NC} Use SQLite (development)"
    echo -e "  ${GREEN}4)${NC} Reset database (DELETE all data)"
    echo -e "  ${GREEN}5)${NC} Skip (database already configured)"
    echo ""
    
    read -p "Your choice [1-5]: " db_choice
    
    case $db_choice in
        1)
            echo ""
            echo -e "${GREEN}Running database setup script...${NC}"
            cd "$PROJECT_DIR/deploy-scripts/server"
            chmod +x 01-setup-database.sh
            ./01-setup-database.sh
            ;;
        2)
            echo ""
            echo -e "${GREEN}Setting up PostgreSQL...${NC}"
            cd "$PROJECT_DIR/deploy-scripts/server"
            chmod +x 01-setup-database.sh
            ./01-setup-database.sh --force-postgresql
            ;;
        3)
            echo ""
            echo -e "${GREEN}Setting up SQLite...${NC}"
            cd "$PROJECT_DIR/deploy-scripts/server"
            chmod +x 01-setup-database.sh
            ./01-setup-database.sh --force-sqlite
            ;;
        4)
            echo ""
            echo -e "${RED}⚠️  RESET MODE - This will DELETE all data!${NC}"
            cd "$PROJECT_DIR/deploy-scripts/server"
            chmod +x 01-setup-database.sh
            ./01-setup-database.sh --reset
            ;;
        5)
            echo ""
            echo -e "${GREEN}Skipping database setup.${NC}"
            ;;
        *)
            echo -e "${YELLOW}Invalid choice. Skipping.${NC}"
            ;;
    esac
    
    press_enter
}

##############################################################################
# STEP 5: Environment Configuration
##############################################################################

step_env_config() {
    CURRENT_STEP=5
    print_header
    
    print_section "⚙️  STEP 5: Environment Configuration"
    
    echo -e "${YELLOW}Configure .env files for each project.${NC}"
    echo ""
    
    # List projects
    declare -A projects
    projects["$CHAT_DIR"]="Chat Backend"
    projects["$TOKEN_DIR"]="Token Smart Contract"
    projects["$MULTISIG_DIR"]="MultiSig Wallet"
    projects["$MOBILE_DIR"]="Mobile Chat App"
    
    for project_path in "${!projects[@]}"; do
        project_name="${projects[$project_path]}"
        env_file="$project_path/.env"
        
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}$project_name${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        if [ -f "$env_file" ]; then
            echo -e "${GREEN}✓ .env exists: $env_file${NC}"
            echo ""
            read -p "Edit this .env file? (y/n): " edit_env
            
            if [ "$edit_env" = "y" ] || [ "$edit_env" = "Y" ]; then
                nano "$env_file"
            fi
        else
            echo -e "${YELLOW}! .env NOT found: $env_file${NC}"
            echo ""
            read -p "Create .env file? (y/n): " create_env
            
            if [ "$create_env" = "y" ] || [ "$create_env" = "Y" ]; then
                # Create basic .env
                touch "$env_file"
                chmod 600 "$env_file"
                nano "$env_file"
            fi
        fi
        
        echo ""
    done
    
    press_enter
}

##############################################################################
# STEP 6: Start Services
##############################################################################

step_start_services() {
    CURRENT_STEP=6
    print_header
    
    print_section "🚀 STEP 6: Start Services"
    
    echo -e "${CYAN}Installing dependencies and starting services...${NC}"
    echo ""
    
    # Install dependencies for each project
    for project_path in "$CHAT_DIR" "$TOKEN_DIR" "$MULTISIG_DIR" "$MOBILE_DIR"; do
        if [ -f "$project_path/package.json" ]; then
            project_name=$(basename "$project_path")
            echo -e "${YELLOW}Installing dependencies for $project_name...${NC}"
            cd "$project_path"
            npm install --production 2>&1 | grep -v "npm WARN" || true
            echo -e "${GREEN}✓ Done${NC}"
            echo ""
        fi
    done
    
    # Start with PM2
    echo -e "${CYAN}Starting services with PM2...${NC}"
    echo ""
    
    # Chat service
    if [ -f "$CHAT_DIR/server.js" ]; then
        cd "$CHAT_DIR"
        pm2 start server.js --name kcy-chat || pm2 restart kcy-chat
        echo -e "${GREEN}✓ Chat service started${NC}"
    fi
    
    # Save PM2 configuration
    pm2 save
    pm2 startup
    
    echo ""
    echo -e "${GREEN}✓ Services started${NC}"
    echo ""
    echo -e "${CYAN}Check service status:${NC} ${YELLOW}pm2 list${NC}"
    echo -e "${CYAN}View logs:${NC} ${YELLOW}pm2 logs kcy-chat${NC}"
    
    press_enter
}

##############################################################################
# STEP 7: Final Summary
##############################################################################

step_summary() {
    CURRENT_STEP=7
    print_header
    
    print_section "✅ SETUP COMPLETE!"
    
    echo -e "${GREEN}Your KCY Ecosystem is now configured!${NC}"
    echo ""
    
    echo -e "${CYAN}Next steps:${NC}"
    echo ""
    echo "  1. Test your services:"
    echo -e "     ${YELLOW}curl http://localhost:3000${NC}"
    echo ""
    echo "  2. Check service status:"
    echo -e "     ${YELLOW}pm2 list${NC}"
    echo ""
    echo "  3. View logs:"
    echo -e "     ${YELLOW}pm2 logs kcy-chat${NC}"
    echo ""
    echo "  4. Configure domain (if not done):"
    echo -e "     ${YELLOW}./02-setup-domain.sh${NC}"
    echo ""
    echo "  5. Setup SSL certificate:"
    echo -e "     ${YELLOW}certbot --nginx -d alsec.strangled.net${NC}"
    echo ""
    
    echo -e "${CYAN}Important files:${NC}"
    echo "  • Chat .env: $CHAT_DIR/.env"
    echo "  • Database credentials: $PROJECT_DIR/database-credentials.txt"
    echo "  • PM2 config: ~/.pm2"
    echo ""
    
    echo -e "${YELLOW}⚠️  Security reminders:${NC}"
    echo "  • Delete database-credentials.txt after saving"
    echo "  • Setup firewall (ufw enable)"
    echo "  • Keep .env files secure (chmod 600)"
    echo "  • Regular backups!"
    echo ""
    
    echo -e "${GREEN}Thank you for using KCY Ecosystem Setup Wizard!${NC}"
    echo ""
}

##############################################################################
# Main Flow
##############################################################################

# Check root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run as root: sudo $0${NC}"
    exit 1
fi

# Run wizard steps
welcome
step_file_upload
step_domain_config
step_services
step_database
step_env_config
step_start_services
step_summary

echo ""
