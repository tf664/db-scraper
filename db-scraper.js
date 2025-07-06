import puppeteer from "puppeteer";
import { stationData } from './stationData.js';

export const scrapeDBNavigator = async (departureStation, arrivalStation, date, time) => {
    const browser = await puppeteer.launch({ headless: false }); // false for debugging
    const page = await browser.newPage();

    // Open the DB Navigator website
    //const url = generateURL(departureStation, arrivalStation, date, time);
    const url = generateBookingURL(departureStation, arrivalStation, date, time)

    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('Page loaded, waiting for departure data... \n');
    console.log("Generated URL:", url); // debug

    try {
        await page.screenshot({ path: 'debug/1 beginning.png' }); // debug

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
            console.log(" Accepted cookies");
        } else {
            console.log("Cookie button not found");
        }


        await page.screenshot({ path: 'debug/3 afterCookie.png' }); // debug

        const selector = "#ReiseloesungList > div.loading-indicator.loading-indicator--full-width > div.reiseloesung-list-page__wrapper > div:nth-child(1) > div > h2";
        const element = await page.$(selector);
        if (element) {
            logError(departureStation, arrivalStation, date, time, "No connection found for this ");
            await page.screenshot({ path: 'debug/3.5 noConnection.png' }); // debug

        } else {
            await page.screenshot({ path: 'debug/4 preDetails.png' }); // debug

            // Missing error handling for "Unerwarteter Fehler"

            // Wait for the "Details" button to appear
            const detailsButton = await page.waitForSelector('button.db-web-expansion-toggle__button', { visible: true, timeout: 15000 }).catch(() => null);

            // Scroll to the button to ensure it's in the viewport
            await page.evaluate(() => {
                document.querySelector('button.db-web-expansion-toggle__button').scrollIntoView();
            });

            if (!detailsButton) {
                console.log('Clicking the Details button...');
                let retries = 3;
                while (retries > 0) {
                    try {
                        await page.screenshot({ path: 'debug/5 before-click.png' }); // debug

                        await page.click('button.db-web-expansion-toggle__button');

                        await page.screenshot({ path: 'debug/6 after-click.png' }); // debug

                        console.log('Details button clicked successfully.');
                        break; // Exit loop if successful
                    } catch (error) {
                        console.error('Error clicking the Details button ', error);
                    }
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

function generateBookingURL(departureStation, arrivalStation, date, time) {
    const dep = stationData[departureStation];
    const arr = stationData[arrivalStation];

    if (!dep || !arr) {
        console.error("Station not found in stationData.");
        return null;
    }

    const params = new URLSearchParams({
        sts: "true",
        so: dep.name,
        zo: arr.name,
        kl: "2",
        r: "13:16:KLASSENLOS:1",
        soid: dep.soid,
        zoid: arr.soid,
        sot: "ST",
        zot: "ST",
        soei: dep.id,
        zoei: arr.id,
        hd: `${date}T${time}:00`,
        hza: "D",
        hz: "[]",
        ar: "false",
        s: "true",
        d: "false",
        vm: "00,01,02,03,04,05,06,07,08,09",
        fm: "false",
        bp: "false",
        dlt: "false",
        dltv: "false"
    });

    return `https://www.bahn.de/buchung/fahrplan/suche?${params.toString()}`;
}

function getFutureTime(minutesOffset = 5) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesOffset);
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
}

function getCurrentDate() {
    return new Date().toISOString().split('T')[0];
}
