import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { Color, ImageType } from './enums';
import { colorize, extnames, getFiles, getSelector, loadConfig, log } from './utils';

const config = loadConfig();
const selector = getSelector();

async function selectImage(page: Page, filepath: string) {
    log(colorize(`Selecting ${filepath}`, Color.cyan));
    const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click(selector.selectBtn),
    ]);
    await fileChooser.accept([filepath]);
}

async function setOptions(page: Page, filepath: string) {
    log(colorize(`Setting options for ${filepath}`, Color.cyan));
    if (config.followType) {
        const type = extnames[path.extname(filepath).substr(1)];
        if (type !== ImageType.jpeg) {
            await page.select(selector.typeSelect, type);
        }
    } else if (config.allTo && config.allTo !== ImageType.jpeg) {
        await page.select(selector.typeSelect, config.allTo);
    }
}

async function writeImage(page: Page, filepath: string, outputDir: string) {
    log(colorize(`Compressing ${filepath}`, Color.blue));
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
        savingMsg = colorize(savingMsg, Color.green);
    } else if (saving.endsWith('bigger')) {
        savingMsg = colorize(savingMsg, Color.red);
    }
    log(colorize(`Writing ${outputPath}${savingMsg}`, Color.blue));
    const blob = await page.goto(url);
    // todo: check if exist
    fs.writeFileSync(outputPath, await blob!.buffer());
}

async function squash(browser: Browser, filepath: string, outputDir: string) {
    const page = await browser.newPage();
    await page.goto(config.host);
    await selectImage(page, filepath);
    await setOptions(page, filepath);
    await writeImage(page, filepath, outputDir);
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
