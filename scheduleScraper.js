import cron from 'node-cron';
import { scrapeDBNavigator } from './db-scraper.js';

const departureStation = "Düsseldorf Hbf";  
const arrivalStation = "Epe Westf";   
const date = "2025-05-10";                // (format: YYYY-MM-DD)
const time = "10:00";                   // (format: HH:mm)


cron.schedule('*/1 * * * *' , () => { // Every 2 minutes
    try {
        scrapeDBNavigator(departureStation, arrivalStation, date, time);
    } catch (error) {
        console.error('Error during scraping:', error);
    }
});
