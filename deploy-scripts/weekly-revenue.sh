#!/usr/bin/env bash
# СЕДМИЧЕН обход на приходите (Scheduled Task). БОТЪТ обхожда RuStore + Huawei, сумира, деплойва в pupikes.app.
cd /g/wrk/2026-06-02-toks
LOG="deploy-scripts/.weekly-revenue.log"; echo "[$(date)] START" >> "$LOG"
# 1) RuStore приходи (--insights чете доход/продажби)
node deploy-scripts/rustore-release-bot.cjs --insights >> "$LOG" 2>&1
# 2) Huawei приходи (--metrics)
node deploy-scripts/huawei-release-bot.cjs --metrics >> "$LOG" 2>&1
# 3) обедини → catalog.revenue
node deploy-scripts/gen-catalog-revenue.cjs >> "$LOG" 2>&1
# 4) деплой каталога в pupikes.app (директен scp като root — надеждно)
scp -o StrictHostKeyChecking=no -P 2222 apk/catalog.json root@take.offbitch.com:/var/www/html/apk/catalog.json >> "$LOG" 2>&1
echo "[$(date)] DONE" >> "$LOG"
