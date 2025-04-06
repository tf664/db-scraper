import puppeteer from "puppeteer";
import { stationData } from './stationData.js';

export const scrapeDBNavigator = async (departureStation, arrivalStation, date, time) => {
    const browser = await puppeteer.launch({ headless: false }); // false for debugging
    const page = await browser.newPage();

    // Open the DB Navigator website
    const url = generateURL(departureStation, arrivalStation, date, time);
    //const url = generateBookingURL(departureStation, arrivalStation, date, time)

    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('Page loaded, waiting for departure data... \n');
    console.log("Generated URL:", url); // debug

    try {
        await page.screenshot({ path: '1 beginning.png' }); // debug

        // Wait for the shadow host (main container that contains the shadow root)
        await page.waitForSelector("body > div:nth-child(1)", { visible: true });
        const shadowHost = await page.$("body > div:nth-child(1)");
        const shadowRootHandle = await shadowHost.evaluateHandle(el => el.shadowRoot);

        // Select and click the "Only allow necessary cookies" button inside the shadow DOM
        const acceptCookiesButton = await shadowRootHandle.$(
            "#consent-layer > div.consent-layer__btn-container > button.btn.btn--secondary.js-accept-essential-cookies"
        );

        if (acceptCookiesButton) {
            await acceptCookiesButton.click();
            console.log("2 Accepted cookies");
        } else {
            console.log("Cookie button not found");
        }


        await page.screenshot({ path: '3 afterCookie.png' }); // debug

        const selector = "#ReiseloesungList > div.loading-indicator.loading-indicator--full-width > div.reiseloesung-list-page__wrapper > div:nth-child(1) > div > h2";
        const element = await page.$(selector);
        if (element) {
            logError(departureStation, arrivalStation, date, time, "No connection found for this ");
            await page.screenshot({ path: '3.5 noConnection.png' }); // debug

        } else {
            await page.screenshot({ path: '4 preDetails.png' }); // debug

            // Missing error handling for "Unerwarteter Fehler"

            // Wait for the "Details" button to appear
            await page.waitForSelector('button.db-web-expansion-toggle__button', { visible: true, timeout: 10000 });

            // Scroll to the button to ensure it's in the viewport
            await page.evaluate(() => {
                document.querySelector('button.db-web-expansion-toggle__button').scrollIntoView();
            });

            console.log('Clicking the Details button...');
            let retries = 3;
            while (retries > 0) {
                try {
                    await page.screenshot({ path: '5 before-click.png' }); // debug

                    await page.click('button.db-web-expansion-toggle__button');

                    await page.screenshot({ path: '6 after-click.png' }); // debug

                    console.log('Details button clicked successfully.');
                    break; // Exit loop if successful
                } catch (error) {
                    console.error('Error clicking the Details button ', error);
                }
            }

            // Wait for the travel sections to load
            // Optionally, scroll to the bottom to trigger lazy loading
            await page.evaluate(() => {
                window.scrollTo(0, document.body.scrollHeight);
            });

            await page.waitForSelector('.verbindungs-abschnitt', { visible: true });

            try {
                // Scraping the data
                const data = await page.evaluate(() => {
                    // Select all elements with the class `verbindungs-abschnitt`
                    const rows = Array.from(document.querySelectorAll('.verbindungs-abschnitt'));

                    // Map over each row to extract the required information
                    return rows.map(row => {
                        const departure = row.querySelector('.verbindungs-halt__zeit-abfahrt')?.innerText.trim() || 'N/A';
                        const arrival = row.querySelector('.verbindungs-halt__zeit-ankunft')?.innerText.trim() || 'N/A';
                        const departureStation = row.querySelector('.verbindungs-halt-bahnhofsinfos__name--abfahrt ._text')?.innerText.trim() || 'N/A';
                        const arrivalStation = row.querySelector('.verbindungs-halt-bahnhofsinfos__name--ankunft ._text')?.innerText.trim() || 'N/A';
                        const platform = row.querySelector('.verbindungs-abschnitt-zeile__gleis span')?.innerText.trim() || 'N/A';
                        const transferDuration = row.querySelector('.verbindungs-transfer__dauer')?.innerText.trim() || 'N/A';
                        const trainInfo = row.querySelector('.verbindungs-transfer__description-zuginfo-wrapper')?.innerText.trim() || 'N/A';

                        return {
                            departure,
                            arrival,
                            departureStation,
                            arrivalStation,
                            platform,
                            transferDuration,
                            trainInfo
                        };
                    });
                });

                console.log('Scraped Data:', data);

            } catch (error) {
                console.error('Error during scraping data:', error);
            }
        }
    } catch (error) {
        console.error('Error during scraping:', error);
    }

    await browser.close();
};

const generateURL = (departureStation, arrivalStation, date, time) => {
    const baseURL = "https://www.bahn.com/de"; // Replace with the actual base URL of DB Navigator
    const params = new URLSearchParams({
        start: departureStation,
        destination: arrivalStation,
        date: date,
        time: time,
    });

    //return `${baseURL}/search?${params.toString()}`;
    return 'https://www.bahn.de/buchung/fahrplan/suche#sts=true&so=D%C3%BCsseldorf%20Hbf&zo=Wuppertal%20Hbf&kl=2&r=13:16:KLASSENLOS:1&soid=A%3D1%40O%3DD%C3%BCsseldorf%20Hbf%40X%3D6794317%40Y%3D51219960%40U%3D80%40L%3D8000085%40B%3D1%40p%3D1742845592%40i%3DU%C3%97008008094%40&zoid=A%3D1%40O%3DWuppertal%20Hbf%40X%3D7149544%40Y%3D51254362%40U%3D80%40L%3D8000266%40B%3D1%40p%3D1741637184%40i%3DU%C3%97008008143%40&sot=ST&zot=ST&soei=8000085&zoei=8000266&hd=2025-04-07T07:15:07&hza=D&hz=%5B%5D&ar=false&s=true&d=false&vm=00,01,02,03,04,05,06,07,08,09&fm=false&bp=false&dlt=false&dltv=false';
};

function generateBookingURL(departureStation, arrivalStation, date, time) {
    // Fetch station details
    const dep = stationData[departureStation];
    const arr = stationData[arrivalStation];

    if (!dep || !arr) {
        console.error("Station not found in stationData.");
        return null;
    }

    // Construct URL parameters
    const params = new URLSearchParams({
        sts: "true", // Always true for valid searches
        so: encodeURIComponent(dep.name), // Encoded departure station name
        zo: encodeURIComponent(arr.name), // Encoded arrival station name
        kl: "2", // Second class (can be adjusted if needed)
        r: "13:16:KLASSENLOS:1", // Example travel time and class type
        soid: encodeURIComponent(dep.soid), // Encoded departure station ID
        zoid: encodeURIComponent(arr.soid), // Encoded arrival station ID
        sot: "ST", // Departure search type (can be adjusted if needed)
        zot: "ST", // Arrival search type (can be adjusted if needed)
        soei: dep.id, // Departure station ID
        zoei: arr.id, // Arrival station ID
        hd: `${date}T${time}:00`, // Date and time of departure in the correct format
        hza: "D", // Custom setting (D for direct train search)
        hz: "[]", // Empty array for any special filtering (no filters in this case)
        ar: "false", // No return trip (can be adjusted if needed)
        s: "true", // Valid for standard searches
        d: "false", // No departure time constraints (can be adjusted if needed)
        vm: "00,01,02,03,04,05,06,07,08,09", // Time slots for the train (default set)
        fm: "false", // Filtering method for the trains (if needed)
        bp: "false", // No additional settings for price breakdown (if needed)
        dlt: "false", // No additional delays (if needed)
        dltv: "false" // No additional delays (if needed)
    });

    // Return the final URL
    return `https://www.bahn.de/buchung/fahrplan/suche#${params.toString()}`;
}


function logError(departureStation, arrivalStation, date, time, errorMessage) {
    const errorLog = `
    [ERROR] No connection found
    ------------------------------------
    Departure Station: ${departureStation}
    Arrival Station: ${arrivalStation}
    Date: ${date}
    Time: ${time}
    Error Message: ${errorMessage}
    Timestamp: ${new Date().toISOString()}
    ------------------------------------
    `;

    console.error(errorLog);
}