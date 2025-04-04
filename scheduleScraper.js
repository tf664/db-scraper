import cron from 'node-cron';
import { scrapeDBNavigator } from './db-scraper.js';

const departureStation = "Düsseldorf Hbf";  
const arrivalStation = "Wuppertal Hbf";   
const date = "2025-05-07";                // (format: YYYY-MM-DD)
const time = "7:10";                   // (format: HH:mm)


cron.schedule('* */2 * * *', () => { // Every 2 minutes
    try {
        scrapeDBNavigator(departureStation, arrivalStation, date, time);

        console.log('Scraping completed successfully');
    } catch (error) {
        console.error('Error during scraping:', error);
    }
});
