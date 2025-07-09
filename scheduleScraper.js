import cron from 'node-cron';
import { scrapeDBNavigator } from './db-scraper.js';
import { stations } from "./stationData.js";

cron.schedule('*/1 * * * *', () => { // Every 1 minute
    try {
        (async () => {
            const date = "2025-07-10";
            const time = "07:00:00";
            const debug = true;

            const startStation = stations.duesseldorfHbf;
            const endStation = stations.wuppertalHbf;

            const data = await scrapeDBNavigator({ date, time, startStation, endStation, debug });
            console.log("🚂 Ergebnis:", data);
        })();
    } catch (error) {
        console.error('| Scheduling error:', error);
    }
});




