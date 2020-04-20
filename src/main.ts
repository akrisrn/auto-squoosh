import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { color } from './enums';
import { colorize, extnames, getFiles, getSelector, loadConfig } from './utils';

const config = loadConfig();
const selector = getSelector();

async function selectImage(page: Page, filepath: string) {
    console.log(colorize(`Compressing ${filepath}`, color.cyan));
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector.selectBtn),
    ]);
    await fileChooser.accept([filepath]);
}

async function setOptions(page: Page, extname: string) {
    await page.select(selector.typeSelect, extnames[extname]);
}

async function writeImage(page: Page, outputDir: string) {
    await page.waitForSelector(selector.downloadLink, {
        timeout: 0,
    });
    const { url, filename, saving } = await page.evaluate((downloadLink, savingSpan) => {
        const a = document.querySelector(downloadLink);
        const span = document.querySelector(savingSpan);
        return {
            url: a.href,
            filename: a.download,
            saving: span ? span.innerText : '',
        };
    }, selector.downloadLink, selector.savingSpan);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, filename);
    let savingMsg = saving && ` (${saving})`;
    if (saving.endsWith('smaller')) {
        savingMsg = colorize(savingMsg, color.green);
    } else if (saving.endsWith('bigger')) {
        savingMsg = colorize(savingMsg, color.red);
    }
    console.log(colorize(`Writing ${outputPath}${savingMsg}`, color.blue));
    const blob = await page.goto(url);
    // todo: check if exist
    fs.writeFileSync(outputPath, await blob!.buffer());
}

async function squash(browser: Browser, filepath: string, outputDir: string) {
    const page = await browser.newPage();
    await page.goto(config.host);
    await selectImage(page, filepath);
    await setOptions(page, path.extname(filepath).substr(1));
    await writeImage(page, outputDir);
    await page.close();
}

(async () => {
    const args = [];
    if (config.proxy) {
        args.push(`--proxy-server=${config.proxy}`);
    }
    const browser = await puppeteer.launch({ args });
    const images = [];
    for (const filepath of getFiles(config.inputDir)) {
        images.push(squash(browser, filepath, config.outputDir));
    }
    await Promise.all(images);
    await browser.close();
})();
