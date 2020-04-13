const puppeteer = require('puppeteer');
const { WebClient } = require('@slack/web-api');

const { SLACK_TOKEN } = process.env;

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

  const totalCases = await getNumberFromSelector(page, '.section-el .section-el-number');
  const deaths = await getNumberFromSelector(page, '.section-el:nth-child(5) .section-el-number');
  const fatalityRate = await getNumberFromSelector(page, '.section-el:nth-child(10) .section-el-number');
  const recoveries = await getNumberFromSelector(page, '.section-el:nth-child(6) .section-el-number');

  const message = `Total cases: ${totalCases}\n` +
    `Deaths: ${deaths}\n` +
    `Fatality rate: ${fatalityRate}\n` +
    `Recoveries: ${recoveries}\n` +
    sourceUrl;

  console.log(message);

  await sendSlackMessage(message);
  await browser.close();
})();

async function getNumberFromSelector(page, selector) {
  const element = await page.$(selector);

  return page.evaluate(e => e.textContent, element);
}

async function sendSlackMessage(message) {
  // See: https://api.slack.com/methods/chat.postMessage
  const result = await webClient.chat.postMessage({ channel: conversationId, text: message });

  console.log('Message sent:', result);
}
