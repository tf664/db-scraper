import cron from 'node-cron';
import { scrapeDBNavigator } from './db-scraper.js';

const departureStation = "Leipzig Hbf";  
const arrivalStation = "Dresden Hbf";   
const date = "2025-10-10";  
const time = "19:00";  


cron.schedule('*/2 * * * *', () => { // Every 2 minutes
    try {
        scrapeDBNavigator(departureStation, arrivalStation, date, time);

        console.log('Scraping completed successfully');
    } catch (error) {
        console.error('Error during scraping:', error);
    }
});
