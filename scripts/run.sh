#!/bin/bash

# SnapSchool Dev Runner (Docker-free / Supabase edition)
# Designed for macOS

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear

echo -e "${CYAN}${BOLD}"
echo "=================================================="
echo "         SnapSchool 🏫 Dev Suite Launcher         "
echo "=================================================="
echo -e "${NC}"

echo -e "${BOLD}Select an action to launch:${NC}"
echo -e "  ${GREEN}[1]${NC} 🌐 Start Web Dashboard (Next.js Dev Server)"
echo -e "  ${GREEN}[2]${NC} 📱 Start Mobile App (Expo Metro Bundler)"
echo -e "  ${GREEN}[3]${NC} 🚀 Launch Both (Web + Mobile in new tabs)"
echo -e "  ${RED}[q]${NC} ❌ Exit Launcher"
echo

read -p "Select choice [1-3 or q]: " choice

start_web() {
    echo -e "\n${CYAN}🌐 Starting Next.js Web Dashboard...${NC}"
    cd "/Users/faresselmi/projects/hi/SnapSchool_Web" || exit
    npm run dev
}

start_mobile() {
    echo -e "\n${YELLOW}📱 Starting Expo Mobile App...${NC}"
    cd "/Users/faresselmi/projects/hi/SnapSchool_App" || exit
    npx expo start
}

case $choice in
    1)
        start_web
        ;;
    2)
        start_mobile
        ;;
    3)
        echo -e "\n${GREEN}🚀 Launching Web and Mobile in new terminal tabs...${NC}"
        
        osascript -e 'tell application "Terminal"
            activate
            -- Launch Web Dashboard
            do script "cd /Users/faresselmi/projects/hi/SnapSchool_Web && npm run dev"
            
            -- Launch Mobile App
            do script "cd /Users/faresselmi/projects/hi/SnapSchool_App && npx expo start"
        end tell'
        
        echo -e "${GREEN}🎉 Both services launched successfully!${NC}"
        ;;
    q|Q)
        echo -e "${BLUE}Exiting dev runner. Have a productive coding session! 🚀${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option selected. Please run the script again.${NC}"
        ;;
esac
