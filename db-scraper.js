import puppeteer from "puppeteer";

export const scrapeDBNavigator = async ({ date, time, startStation, endStation, debug = false }) => {
    const browser = await puppeteer.launch({ headless: !debug });
    const page = await browser.newPage();

    const departureTime = new Date(`${date}T${time}`);

    const bookingUrl = generateBookingUrl(startStation, endStation, departureTime);
    console.log("O | Generated URL:", bookingUrl);

    await page.goto(bookingUrl, { waitUntil: 'networkidle2' });
    console.log("O | Page loaded, waiting for departure data...");
    console.log("O | Generated URL:", bookingUrl); // debug

    await page.screenshot({ path: 'debug/1 beginning.png' }); // debug screenshot

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
        console.log("🟢 | Accepted cookies"); // debug
    } else {
        console.log("Cookie button not found"); // debug
    }


    await page.screenshot({ path: 'debug/3 afterCookie.png' }); // debug screenshot

    const selector = "#ReiseloesungList > div.loading-indicator.loading-indicator--full-width > div.reiseloesung-list-page__wrapper > div:nth-child(1) > div > h2";
    const element = await page.$(selector);
    if (element) {
        logError(departureStation, arrivalStation, date, time, "No connection found for this ");
        await page.screenshot({ path: 'debug/3.5 noConnection.png' }); // debug screenshot

    } else {
        await page.screenshot({ path: 'debug/4 pre-Details.png' }); // debug screenshot

        const detailsButton = await page.evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.find(btn =>
                btn.textContent.trim().toLowerCase() === 'details'
            );
        });

        if (detailsButton) {
            console.log("🟢 | detais-button found, scrolling into view"); // debug
            await detailsButton.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
            await page.waitForTimeout(500);

            try {
                await detailsButton.click();
                console.log("🟢 | details-button clicked"); // debug
                await page.screenshot({ path: 'debug/6 after-Dtails.png' });
            } catch (err) {
                console.error("Error | clicking details button:", err);
            }
        } else {
            console.error("Error | no details button found.");
            await page.screenshot({ path: 'debug/6 no-details-found.png' }); // debug screenshot
        }


        // Wait for the travel sections to load
        // Optionally, scroll to the bottom to trigger lazy loading
        //            await page.evaluate(() => {
        //                window.scrollTo(0, document.body.scrollHeight);
        //            });

        await page.waitForSelector('.verbindungs-abschnitt', { visible: true });

        // Scraping the data
        const data = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.verbindungs-abschnitt'))
                .filter(row => row.querySelector('.verbindungs-halt__zeit-abfahrt'));
            return rows.map(row => {
                const departure = row.querySelector('.verbindungs-halt__zeit-abfahrt')?.innerText.trim() || 'N/A';
                const arrival = row.querySelector('.verbindungs-halt__zeit-ankunft')?.innerText.trim() || 'N/A';
                const departureStation = row.querySelector('.verbindungs-halt-bahnhofsinfos__name--abfahrt ._text')?.innerText.trim() || 'N/A';
                const arrivalStation = row.querySelector('.verbindungs-halt-bahnhofsinfos__name--ankunft ._text')?.innerText.trim() || 'N/A';
                const platform = row.querySelector('.verbindungs-abschnitt-zeile__gleis span')?.innerText.trim() || 'N/A';
                const transferDuration = row.querySelector('.verbindungs-transfer__dauer')?.innerText.trim() || 'N/A';
                const trainInfo = row.querySelector('.verbindungs-transfer__description-zuginfo-wrapper')?.innerText.trim() || 'N/A';

                return { departure, arrival, departureStation, arrivalStation, platform, transferDuration, trainInfo };
            });
        });

        console.log("O | Scraped Data:", data);

        await browser.close();
        return data;
    };
}
function generateBookingUrl(startStation, endStation, datetime) {
    const timePart = datetime.toTimeString().slice(0, 5);
    const timeString = `${timePart}:KLASSENLOS:1`;
    const hd = datetime.toISOString().slice(0, 19);

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