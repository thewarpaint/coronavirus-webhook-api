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

const statisticProperties = [
  'totalCases',
  'deaths',
  'fatalityRate',
  'recoveries'
];

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(sourceUrl, {
    waitUntil: 'networkidle0',
  });

  await page.waitForSelector('.drawer-inner');

  const newStatistics = await getStatistics(page);

  if (await didStatisticsChange(oldStatistics, newStatistics)) {
    const message = getMessage(oldStatistics, newStatistics);

    await sendSlackMessage(message);
    updateStatistics(newStatistics);
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
    totalCases: sanitizeAndParseInt(totalCases),
    deaths: sanitizeAndParseInt(deaths),
    fatalityRate: sanitizeAndParseFloat(fatalityRate),
    recoveries: sanitizeAndParseInt(recoveries)
  };
}

async function didStatisticsChange(oldStatistics, newStatistics) {
  for (let property of statisticProperties) {
    debug(`Comparing prop ${property}, ${oldStatistics[property]} vs ${newStatistics[property]}`);

    if (oldStatistics[property] !== newStatistics[property]) {
      return true;
    }
  }

  return false;
}

function getStatisticsDelta(oldStatistics, newStatistics) {
  return statisticProperties.reduce((deltaMap, property) => {
    deltaMap[`${property}Delta`] = newStatistics[property] - oldStatistics[property];

    return deltaMap;
  }, {});
}

function updateStatistics(statistics) {
  fs.writeFileSync('./old-statistics.json', JSON.stringify(statistics));
}

async function getNumberFromSelector(page, selector) {
  const element = await page.$(selector);

  return page.evaluate(e => e.textContent, element);
}

function getMessage(oldStatistics, newStatistics) {
  const {
    totalCases,
    deaths,
    fatalityRate,
    recoveries
  } = newStatistics;

  const {
    totalCasesDelta,
    deathsDelta,
    fatalityRateDelta,
    recoveriesDelta
  } = getStatisticsDelta(oldStatistics, newStatistics);

  const message = '🇲🇽\n' +
    `Total cases: ${totalCases} ${getDeltaText(totalCasesDelta)}\n` +
    `Deaths: ${deaths} ${getDeltaText(deathsDelta)}\n` +
    `Fatality rate: ${fatalityRate}% ${getDeltaText(fatalityRateDelta, true)}\n` +
    `Recoveries: ${recoveries} ${getDeltaText(recoveriesDelta)}\n` +
    sourceUrl;

  debug(message);

  return message;
}

function getDeltaText(delta, isPercentage = false) {
  if (!delta) {
    return '';
  }

  const sign = delta > 0 ? '+' : '';

  if (isPercentage) {
    const roundedDelta = roundFloat(delta);

    return `(${sign}${roundedDelta}%)`;
  }

  return `(${sign}${delta})`;
}

function roundFloat(float) {
  return Math.round(float * 100) / 100;
}

async function sendSlackMessage(message) {
  // See: https://api.slack.com/methods/chat.postMessage
  const result = await webClient.chat.postMessage({ channel: conversationId, text: message });

  debug('Message sent:', result);
}

function sanitizeAndParseInt(string) {
  return parseInt(string.replace(/[^\d]/, ''), 10);
}

function sanitizeAndParseFloat(string) {
  const sanitizedString = string
    .replace(',', '.')
    .replace(/[^\d\.]/, '');

  return parseFloat(sanitizedString, 10);
}

function debug(...args) {
  if (DEBUG) {
    console.debug.apply(null, args);
  }
}
