# Version: 1.0056
#!/bin/bash

# KCY Chat Development Helper
# Quick commands for local development

case "$1" in
    "start")
        echo "🚀 Starting development server..."
        npm run dev
        ;;
    
    "db:setup")
        echo "🗄️  Setting up database..."
        sudo -u postgres psql -f database/db_setup.sql
        echo "✅ Database setup complete!"
        ;;
    
    "db:reset")
        echo "⚠️  Resetting database..."
        read -p "Are you sure? This will delete all data! (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo -u postgres psql -c "DROP DATABASE IF EXISTS amschat;"
            sudo -u postgres psql -f database/db_setup.sql
            echo "✅ Database reset complete!"
        fi
        ;;
    
    "db:backup")
        BACKUP_FILE="backups/amschat_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p backups
        pg_dump -U postgres amschat > $BACKUP_FILE
        echo "✅ Backup saved to $BACKUP_FILE"
        ;;
    
    "test:stripe")
        echo "💳 Stripe Test Cards:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ Success: 4242 4242 4242 4242"
        echo "❌ Declined: 4000 0000 0000 0002"
        echo "🔄 3D Secure: 4000 0027 6000 3184"
        echo ""
        echo "Expiry: Any future date (12/25)"
        echo "CVV: Any 3 digits (123)"
        ;;
    
    "logs")
        echo "📋 Showing logs..."
        if [ -f "logs/app.log" ]; then
            tail -f logs/app.log
        else
            echo "No logs found. Run 'npm start' first."
        fi
        ;;
    
    "clean")
        echo "🧹 Cleaning..."
        rm -rf node_modules package-lock.json
        npm cache clean --force
        echo "✅ Clean complete! Run 'npm install' to reinstall."
        ;;
    
    "icons")
        if [ -z "$2" ]; then
            echo "Usage: ./dev.sh icons [source-image.png]"
            exit 1
        fi
        
        if ! command -v convert &> /dev/null; then
            echo "❌ ImageMagick not found. Install with:"
            echo "   Ubuntu: sudo apt install imagemagick"
            echo "   macOS: brew install imagemagick"
            exit 1
        fi
        
        echo "🎨 Generating icons from $2..."
        convert "$2" -resize 192x192 -background none -gravity center -extent 192x192 public/icon-192.png
        convert "$2" -resize 512x512 -background none -gravity center -extent 512x512 public/icon-512.png
        echo "✅ Icons generated!"
        ;;
    
    "env:generate")
        echo "🔐 Generating secure secrets..."
        echo ""
        echo "Add these to your .env file:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
        echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
        ;;
    
    "check")
        echo "🔍 Checking setup..."
        echo ""
        
        # Check Node.js
        if command -v node &> /dev/null; then
            echo "✅ Node.js $(node -v)"
        else
            echo "❌ Node.js not found"
        fi
        
        # Check npm
        if command -v npm &> /dev/null; then
            echo "✅ npm $(npm -v)"
        else
            echo "❌ npm not found"
        fi
        
        # Check PostgreSQL
        if command -v psql &> /dev/null; then
            echo "✅ PostgreSQL $(psql --version | awk '{print $3}')"
        else
            echo "❌ PostgreSQL not found"
        fi
        
        # Check .env
        if [ -f ".env" ]; then
            echo "✅ .env file exists"
            
            # Check required vars
            source .env
            if [ -z "$STRIPE_SECRET_KEY" ]; then
                echo "⚠️  STRIPE_SECRET_KEY not set"
            fi
            if [ -z "$DATABASE_URL" ]; then
                echo "⚠️  DATABASE_URL not set"
            fi
        else
            echo "❌ .env file missing (copy from .env.example)"
        fi
        
        # Check database
        if psql -lqt | cut -d \| -f 1 | grep -qw amschat; then
            echo "✅ Database 'amschat' exists"
        else
            echo "❌ Database 'amschat' not found"
        fi
        
        # Check node_modules
        if [ -d "node_modules" ]; then
            echo "✅ Dependencies installed"
        else
            echo "❌ Dependencies not installed (run 'npm install')"
        fi
        ;;
    
    *)
        echo "KCY Chat Development Helper"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Commands:"
        echo "  start           - Start development server"
        echo "  db:setup        - Setup database"
        echo "  db:reset        - Reset database (deletes all data!)"
        echo "  db:backup       - Backup database"
        echo "  test:stripe     - Show Stripe test cards"
        echo "  logs            - Show application logs"
        echo "  clean           - Clean node_modules and cache"
        echo "  icons [image]   - Generate icons from image"
        echo "  env:generate    - Generate secure secrets for .env"
        echo "  check           - Check if everything is setup correctly"
        echo ""
        echo "Usage: ./dev.sh [command]"
        ;;
esac
