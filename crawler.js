const fs = require('fs');
const puppeteer = require('puppeteer');
const { WebClient } = require('@slack/web-api');

const oldStatistics = require('./old-statistics.json');

const {
  DEBUG,
  SLACK_TOKEN,
} = process.env;

const sourceUrl = 'https://coronavirus.app/tracking/mexico';
const conversationId = 'CUW14R946';
const webClient = new WebClient(SLACK_TOKEN);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(sourceUrl, {
    waitUntil: 'networkidle0',
  });

  await page.waitForSelector('.drawer-inner');

  const statistics = await getStatistics(page);

  if (await didStatisticsChange(oldStatistics, statistics)) {
    const {
      totalCases,
      deaths,
      fatalityRate,
      recoveries
    } = statistics;

    const message = '🇲🇽\n' +
      `Total cases: ${totalCases}\n` +
      `Deaths: ${deaths}\n` +
      `Fatality rate: ${fatalityRate}\n` +
      `Recoveries: ${recoveries}\n` +
      sourceUrl;

    debug(message);

    await sendSlackMessage(message);

    fs.writeFileSync('./old-statistics.json', JSON.stringify(statistics));
  } else {
    debug('Nothing changed!');
  }

  await browser.close();
})();

async function getStatistics(page) {
  const totalCases = await getNumberFromSelector(page, '.section-el .section-el-number');
  const deaths = await getNumberFromSelector(page, '.section-el:nth-child(5) .section-el-number');
  const fatalityRate = await getNumberFromSelector(page, '.section-el:nth-child(10) .section-el-number');
  const recoveries = await getNumberFromSelector(page, '.section-el:nth-child(6) .section-el-number');

  return {
    totalCases,
    deaths,
    fatalityRate,
    recoveries
  };
}

async function didStatisticsChange(oldStatistics, newStatistics) {
  const properties = [
    'totalCases',
    'deaths',
    'fatalityRate',
    'recoveries'
  ];

  for (let property of properties) {
    debug(`Comparing prop ${property}, ${oldStatistics[property]} vs ${newStatistics[property]}`);

    if (oldStatistics[property] !== newStatistics[property]) {
      return true;
    }
  }

  return false;
}

async function getNumberFromSelector(page, selector) {
  const element = await page.$(selector);

  return page.evaluate(e => e.textContent, element);
}

async function sendSlackMessage(message) {
  // See: https://api.slack.com/methods/chat.postMessage
  const result = await webClient.chat.postMessage({ channel: conversationId, text: message });

  debug('Message sent:', result);
}

function debug(...args) {
  if (DEBUG) {
    console.debug.apply(null, args);
  }
}
