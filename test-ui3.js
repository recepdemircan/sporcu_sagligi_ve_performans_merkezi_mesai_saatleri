import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', response => {
    if (response.status() === 404) {
      console.log('404:', response.url());
    }
  });
  
  await page.goto('http://localhost:3000');
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const managerButton = buttons.find(b => b.textContent.includes('Mahsum'));
    if (managerButton) managerButton.click();
  });
  
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
