import cron from 'node-cron';
import { scrapeDBNavigator } from './db-scraper.js';

const departureStation = "Düsseldorf Hbf";  
const arrivalStation = "Dülmen";   
const date = "2025-04-05";                // (format: YYYY-MM-DD)
const time = "11:10";                   // (format: HH:mm)


cron.schedule('*/2 * * * *' , () => { // Every 2 minutes
    try {
        scrapeDBNavigator(departureStation, arrivalStation, date, time);

        console.log('Scraping completed successfully');
    } catch (error) {
        console.error('Error during scraping:', error);
    }
});
