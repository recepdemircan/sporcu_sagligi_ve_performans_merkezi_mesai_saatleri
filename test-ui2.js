import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  
  await page.goto('http://localhost:3000');
  
  // Wait for the login screen
  await page.waitForSelector('button');
  
  // Click the first button (hopefully logs in as Mahsum)
  // Let's actually click on the user "Mahsum Akikol"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const managerButton = buttons.find(b => b.textContent.includes('Mahsum'));
    if (managerButton) managerButton.click();
  });
  
  // Wait for the dashboard to load and see if there are any errors shown
  await new Promise(r => setTimeout(r, 2000));
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT CONTAINS 'hata':", bodyText.includes('hata'));
  if (bodyText.includes('hata')) {
     const hata = await page.evaluate(() => {
         const div = Array.from(document.querySelectorAll('div')).find(d => d.innerText.includes('hata'));
         return div ? div.innerText : 'not found';
     });
     console.log("HATA TEXT:", hata);
  }
  
  await browser.close();
})();
