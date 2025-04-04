import puppeteer from "puppeteer";

export const scrapeDBNavigator = async (departureStation, arrivalStation, date, time) => {
    const browser = await puppeteer.launch({ headless: false, slowMo: 100 }); // false for debugging
    const page = await browser.newPage();

    // Open the DB Navigator website
    const url = generateURL(departureStation, arrivalStation, date, time);
    await page.goto(url, { waitUntil: 'networkidle2' });

    console.log('Page loaded, waiting for departure data... \n');
    console.log("Generated URL:", url); // debug

    try {
        await page.screenshot({ path: 'beginning.png' }); // debug

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
            console.log("Accepted cookies");
        } else {
            console.log("Cookie button not found");
        }


        await page.screenshot({ path: 'afterCookie.png' }); // debug

        const selector = "#ReiseloesungList > div.loading-indicator.loading-indicator--full-width > div.reiseloesung-list-page__wrapper > div:nth-child(1) > div > h2";
        const element = await page.$(selector);
        if (element) {
            logError(departureStation, arrivalStation, date, time, "No connection found for this ");
            await page.screenshot({ path: 'noConnection.png' }); // debug

        } else {
            await page.screenshot({ path: 'preDetails.png' }); // debug


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
                    await page.screenshot({ path: 'before-click.png' }); // debug

                    await page.click('button.db-web-expansion-toggle__button');

                    await page.screenshot({ path: 'after-click.png' }); // debug

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

const generateURLL = (departureStation, arrivalStation, date, time) => {
    const baseURL = "https://www.bahn.com/en"; // Replace with the actual base URL of DB Navigator
    const params = new URLSearchParams({
        start: departureStation,
        destination: arrivalStation,
        date: date,
        time: time,
    });

    //return `${baseURL}/search?${params.toString()}`;
    return 'https://www.bahn.de/buchung/fahrplan/suche#sts=true&so=D%C3%BCsseldorf%20Hbf&zo=Wuppertal%20Hbf&kl=2&r=13:16:KLASSENLOS:1&soid=A%3D1%40O%3DD%C3%BCsseldorf%20Hbf%40X%3D6794317%40Y%3D51219960%40U%3D80%40L%3D8000085%40B%3D1%40p%3D1742845592%40i%3DU%C3%97008008094%40&zoid=A%3D1%40O%3DWuppertal%20Hbf%40X%3D7149544%40Y%3D51254362%40U%3D80%40L%3D8000266%40B%3D1%40p%3D1741637184%40i%3DU%C3%97008008143%40&sot=ST&zot=ST&soei=8000085&zoei=8000266&hd=2025-04-07T07:15:07&hza=D&hz=%5B%5D&ar=false&s=true&d=false&vm=00,01,02,03,04,05,06,07,08,09&fm=false&bp=false&dlt=false&dltv=false';
};


const generateURL = (departureStation, arrivalStation, date, time) => {
    const baseURL = "https://www.bahn.de/buchung/fahrplan/suche";

    // Ensure time is formatted correctly (adds leading zero if missing)
    const formattedTime = time.padStart(5, "0"); // Ensures "7:10" → "07:10"

    // Encode station names to match Bahn.de's expected format
    const encodedDeparture = encodeURIComponent(departureStation);
    const encodedArrival = encodeURIComponent(arrivalStation);

    // Construct URL parameters
    const params = new URLSearchParams({
        sts: "true",   // Enable station search
        so: encodedDeparture,   // Departure station
        zo: encodedArrival,     // Arrival station
        hd: `${date}T${formattedTime}:00`, // Full date-time format (YYYY-MM-DDTHH:MM:SS)
        kl: 2,        // 2nd class ticket
        ar: "false",  // One-way trip
        s: "true",    // Activate search
        d: "false",   // No flexible tickets
        vm: "00,01,02,03,04,05,06,07,08,09", // Enable all train types
        fm: "false",  // No mobility restrictions
        bp: "false",  // No bicycle transport
        dlt: "false",
        dltv: "false"
    });

    return `${baseURL}#${params.toString()}`;
};

function logError(departure, arrival, date, time, errorMessage) {
    const errorLog = `
    [ERROR] No connection found
    ------------------------------------
    Departure Station: ${departure}
    Arrival Station: ${arrival}
    Date: ${date}
    Time: ${time}
    Error Message: ${errorMessage}
    Timestamp: ${new Date().toISOString()}
    ------------------------------------
    `;

    console.error(errorLog);
}