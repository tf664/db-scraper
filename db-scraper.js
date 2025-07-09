import puppeteer from "puppeteer";
import { stationData } from './stationData.js';

export const scrapeDBNavigator = async (date, time) => {
    const browser = await puppeteer.launch({ headless: true }); // false for debugging
    const page = await browser.newPage();

    const departureTime = new Date("2025-07-07T08:45:00");

    // Generate URL
    const bookingUrl = generateBookingUrl(startStation, endStation, departureTime);

    await page.goto(bookingUrl, { waitUntil: 'networkidle2' });

    console.log('Page loaded, waiting for departure data... \n'); // debug
    console.log("Generated URL:", bookingUrl); // debug

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
            console.log("Accepted cookies"); // debug
        } else {
            console.log("Cookie button not found"); // debug
        }


        await page.screenshot({ path: 'debug/3 afterCookie.png' }); // debug

        const selector = "#ReiseloesungList > div.loading-indicator.loading-indicator--full-width > div.reiseloesung-list-page__wrapper > div:nth-child(1) > div > h2";
        const element = await page.$(selector);
        if (element) {
            logError(departureStation, arrivalStation, date, time, "No connection found for this ");
            await page.screenshot({ path: 'debug/3.5 noConnection.png' }); // debug

        } else {
            await page.screenshot({ path: 'debug/4 pre-Details.png' }); // debug

            const detailsButton = await page.evaluateHandle(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.find(btn =>
                    btn.textContent.trim().toLowerCase() === 'details'
                );
            });

            if (detailsButton) {
                console.log("detais-button found, scrolling into view"); // debug
                await detailsButton.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                // await page.waitForTimeout(500); // Kurzes Warten für Rendering

                try {
                    await detailsButton.click();
                    console.log("🟢 Details-Button erfolgreich geklickt.");
                    await page.screenshot({ path: 'debug/6 after-Dtails.png' });
                } catch (err) {
                    console.error("Error | clicking details button:", err);
                }
            } else {
                console.error("Error | no details button found.");
                await page.screenshot({ path: 'debug/6 no-details-found.png' });
            }


            // Wait for the travel sections to load
            // Optionally, scroll to the bottom to trigger lazy loading
            //            await page.evaluate(() => {
            //                window.scrollTo(0, document.body.scrollHeight);
            //            });

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

function generateBookingUrl(startStation, endStation, datetime) {
    const timePart = datetime.toTimeString().slice(0, 5);
    const timeString = `${timePart}:KLASSENLOS:1`;
    // ISO-Date for 'hd' parameter (e.g. "2025-07-07T08:45:00")
    const hd = datetime.toISOString().slice(0, 19);

    // help function for soid/zoid:
    const createStationId = (station) =>
        `A=1@O=${station.name}@X=${station.x}@Y=${station.y}@U=${station.u}@L=${station.l}@B=${station.b}@p=${station.p}@i=${station.i}@`;

    const params = new URLSearchParams({
        sts: "true",
        so: startStation.name,
        zo: endStation.name,
        kl: "2",
        r: timeString,
        soid: createStationId(startStation),
        zoid: createStationId(endStation),
        sot: "ST",
        zot: "ST",
        soei: startStation.evaNr.toString(),
        zoei: endStation.evaNr.toString(),
        hd: hd,
        hza: "D",
        hz: "[]",
        ar: "false",
        s: "true",
        d: "false",
        vm: "00,01,02,03,04,05,06,07,08,09",
        fm: "false",
        bp: "false",
        dlt: "true",
        dltv: "false"
    });

    return "https://www.bahn.de/buchung/fahrplan/suche#" + params.toString();
}

const startStation = {
    name: "Düsseldorf Hbf",
    x: 6794317,
    y: 51219960,
    u: 80,
    l: 8000085,
    b: 1,
    p: 1742845592,
    i: "U~008000085",
    evaNr: 8000085
};


const endStation = {
    name: "Wuppertal Hbf",
    x: 7043300,       // Ost-Koordinate
    y: 51161000,      // Nord-Koordinate
    u: 80,
    l: 8000296,       // LocoNet-ID
    b: 1,
    p: 1742845525,    // beliebiger Timestamp-Wert
    i: "U~008000296", // interne ID
    evaNr: 8000296    // EVA-Nummer für Wuppertal Hbf
};


const startStationForTramNotYetPossible = { // TODO
    name: "Lennéstraße, Düsseldorf",
    x: 6803500,
    y: 51220000,
    u: 80,
    l: 8089021,
    b: 1,
    p: 1742845511,
    i: "U~008089021",
    evaNr: 8089021
};
const endStationForTramNotYetPossible = { // TODO
    name: "Färberstraße, Düsseldorf",
    x: 6802900,
    y: 51228000,
    u: 80,
    l: 8089022,
    b: 1,
    p: 1742845522,
    i: "U~008089022",
    evaNr: 8089022
};
