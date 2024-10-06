import puppeteer from "puppeteer";
import clipboard from "clipboardy";
import fs from "fs";

const url_id = "https://www.linkedin.com/groups/14048479/members/";
const groupId = url_id.match(/groups\/(\d+)\/members/)[1];

const access_tokens = [
  "AQEDAASD0Cu4GKAAABkkjfasdasdasdOVYAfscfY_QHDvyp4hcjpyKVX-XSADSADASDSADFFASDSADSAD9s_kckZA4bdEdbqFfjzDTpPep5iXoTGX2itCY2BaJOc-1-tasdfasdfasdfasdf",
];

const message_quota_per_account = 250;
const jsonFilePath = "./linkedin_sent_messages.json"; // Path to the JSON file

// Function to load or create the JSON file for tracking messaged users
function loadOrCreateJson() {
  try {
    const data = fs.readFileSync(jsonFilePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    // If file doesn't exist, return an empty object
    return { [groupId]: { messaged: [] } };
  }
}

// Function to save the updated data to the JSON file
function saveJson(data) {
  fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
}

// Get the message template
function getMessage(name = "My friend") {
  return `${name}! les connect`;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async function linkedinScraper(access_token, message_quota_per_account) {
    // Load or create the JSON tracking file
    const jsonData = loadOrCreateJson();
    let messagedArray = jsonData[groupId].messaged || [];
  
    const browser = await puppeteer.launch({
      headless: false,
      args: ["--start-maximized"],
      defaultViewport: null,
    });
  
    const page = await browser.newPage();
  
    await page.setCookie({
      name: "li_at",
      value: access_token,
      domain: "www.linkedin.com",
      path: "/",
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
    });
  
    // Go to LinkedIn group page
    await page.goto(url_id, { waitUntil: "networkidle2" });
    await page.waitForSelector(".groups-members-list h1");
  
    const chevronDown = await page.$('svg[data-test-icon="chevron-down-small"]');
    if (chevronDown) {
      await chevronDown.click();
    } else {
      console.log("Chevron down not found.");
      return;
    }
  
    const membersText = await page.$eval(".groups-members-list h1", (el) => el.textContent);
    const membersCount = parseInt(membersText.replace(/\D/g, "")); // Extract only digits
    console.log(membersCount);
  
    let number_messaged = 0;

  
    for (let i = 0; i < membersCount; i++) {
      try {
        if (number_messaged >= message_quota_per_account) {
          break;
        }
  
        const contactRows = await page.$$(".ui-entity-action-row");
        const row = contactRows[i];
        let name = "";
  
        try {
          name = await row.$eval(".artdeco-entity-lockup__title", (el) => el.textContent.trim());
        } catch {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          const loadButton = await page.$(".scaffold-finite-scroll__load-button");
          if (loadButton) {
            await loadButton.click();
          }
          await page.waitForSelector(".ui-entity-action-row");
          continue;
        }
  
        let firstName, href;
  
        try {
          firstName = name.split(" ")[0];
          href = await row.$eval("a", (el) => el.getAttribute("href"));
          if (messagedArray.includes(href)) {
            console.log(`Skipping user with href: ${href}`);
            continue;
          }
        } catch (error) {
          console.log("error");
          continue;
        }
  
        try {
          const button = await row.$(".artdeco-button");
          await button.click();
        } catch (error) {
          console.log("error");
          continue;
        }
  
        await page.waitForSelector(".msg-form__contenteditable");
  
        await delay(1000); // Wait for 1 second
  
        const message = getMessage(firstName);
        clipboard.writeSync(message);
  
        await page.focus(".msg-form__contenteditable");
        await page.keyboard.down("Control");
        await page.keyboard.press("V");
        await page.keyboard.up("Control");
  
        await delay(2000); // Wait for 2 seconds
  
        await page.click(".msg-form__send-button");
        await page.waitForSelector(".msg-s-message-list");
  
        await delay(2000); // Wait for 1 second
  
        const closeIcon = await page.$('svg[data-test-icon="close-small"]');
        await closeIcon.click();

        await delay(2000); // Wait for 2 seconds
  
        console.log("we made it here");
  
        await page.evaluate(() => window.scrollBy(0, 50));
  
        messagedArray.push(href); // Add the user to the messaged list
        number_messaged += 1;
  
        console.log(i);
      } catch (error) {
        console.log("error");
        continue;
      }
    }
  
    // Update and save the JSON file
    jsonData[groupId].messaged = messagedArray;
    saveJson(jsonData);
  
    await browser.close();
  }
  

async function scraperLauncher() {
  for (let i = 0; i < access_tokens.length; i++) {
    await linkedinScraper(access_tokens[i], message_quota_per_account);
  }
}

scraperLauncher();
