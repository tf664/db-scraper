# db-scraper
A small Node.js project that scrapes data using Puppeteer with a scheduled scraper (uses node-cron).
The intend is to connect this project to a raspberry pi to display the current depature times for the regular train traveler

## Current status
> This repository is currently not functioning as intended. The code and scripts are in development and may be incomplete or broken.

## Gallery


## File Structure
- `db-scraper.js` — primary scraper script (Puppeteer-based)
- `scheduleScraper.js` — schedules scraping jobs (uses node-cron)
- `stationData.js` — helper or data-processing script
- `db-daten.json` — sample data file (JSON)
- `testData.txt`, `test.html`, `cookiebanner.html` — miscellaneous test inputs
- `package.json` — dependency list (puppeteer, node-cron)

